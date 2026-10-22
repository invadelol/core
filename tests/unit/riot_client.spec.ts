import { test } from '@japa/runner'
import { PlatformId } from '@fightmegg/riot-api'
import Bottleneck from 'bottleneck'
import {
  CoalescingRiotAPI,
  inBackground,
  MAX_BACKGROUND_PENDING_PER_METHOD,
  MAX_PENDING_PER_METHOD,
  saneRateLimits,
} from '#services/riot/client'
import { RiotUpstreamException } from '#utils/riot_errors'

test.group('Concurrent Riot requests', () => {
  test('shares concurrent match and rank reads and allows a later refresh', async ({ assert }) => {
    const client = new CoalescingRiotAPI('test-key')
    let calls = 0
    client.riotRateLimiter.execute = async () => {
      calls++
      return []
    }
    const matches = () =>
      client.matchV5.getIdsByPuuid({ puuid: 'player', cluster: PlatformId.EUROPE })
    const ranks = () =>
      client.league.getEntriesByPUUID({ puuid: 'player', region: PlatformId.EUW1 })
    await Promise.all([matches(), matches(), ranks(), ranks()])
    assert.equal(calls, 2)
    await matches()
    assert.equal(calls, 3)
  })

  test('different pages get distinct queue IDs and keep their own responses', async ({
    assert,
  }) => {
    const client = new CoalescingRiotAPI('test-key')
    const ids = new Set<string>()
    client.riotRateLimiter.execute = async (request, options) => {
      assert.isDefined(options?.id)
      assert.isFalse(ids.has(options!.id!))
      ids.add(options!.id!)
      return [new URL(request.url).searchParams.get('start')]
    }
    const page = (start: number) =>
      client.matchV5.getIdsByPuuid({
        puuid: 'player',
        cluster: PlatformId.EUROPE,
        params: { start, count: 20 },
      })
    assert.deepEqual(await Promise.all([page(0), page(20), page(0)]), [['0'], ['20'], ['0']])
    assert.equal(ids.size, 2)
  })

  test('releases a failed read so the next attempt can succeed', async ({ assert }) => {
    const client = new CoalescingRiotAPI('test-key')
    let calls = 0
    client.riotRateLimiter.execute = async () => {
      if (++calls === 1) throw { status: 503 }
      return []
    }
    const read = () => client.matchV5.getIdsByPuuid({ puuid: 'player', cluster: PlatformId.EUROPE })
    const results = await Promise.allSettled([read(), read()])
    assert.isTrue(results.every((result) => result.status === 'rejected'))
    assert.equal(calls, 1)
    assert.deepEqual(await read(), [])
    assert.equal(calls, 2)
  })

  test('honors exhausted SDK retry windows without scheduling more requests', async ({
    assert,
  }) => {
    const client = new CoalescingRiotAPI('test-key')
    let calls = 0
    client.riotRateLimiter.execute = async () => {
      calls++
      throw { status: 429, retryAfter: 15_000 }
    }
    const read = () => client.matchV5.getIdsByPuuid({ puuid: 'player', cluster: PlatformId.EUROPE })
    for (let attempt = 0; attempt < 2; attempt++) {
      const [result] = await Promise.allSettled([read()])
      assert.equal(result.status, 'rejected')
      if (result.status === 'rejected') {
        assert.instanceOf(result.reason, RiotUpstreamException)
        assert.equal(result.reason.retryAfter, 15)
        assert.equal(result.reason.upstreamStatus, 429)
      }
    }
    assert.equal(calls, 1)
  })

  test('refuses new requests of a method once its backlog is full, and takes them again as it drains', async ({
    assert,
  }) => {
    const client = new CoalescingRiotAPI('test-key')
    const release: Array<() => void> = []
    let calls = 0
    client.riotRateLimiter.execute = () => {
      calls++
      return new Promise((resolve) => release.push(() => resolve({})))
    }
    const match = (n: number) =>
      client.matchV5.getMatchById({ matchId: `EUW1_${n}`, cluster: PlatformId.EUROPE })
    const waiting = Array.from({ length: MAX_PENDING_PER_METHOD }, (_, n) => match(n))
    await new Promise<void>((resolve) => setImmediate(resolve))
    assert.equal(
      client.waiting(PlatformId.EUROPE, 'MATCH_V5.GET_MATCH_BY_ID'),
      MAX_PENDING_PER_METHOD
    )

    const [refused] = await Promise.allSettled([match(MAX_PENDING_PER_METHOD)])
    assert.equal(refused.status, 'rejected')
    if (refused.status === 'rejected') {
      assert.instanceOf(refused.reason, RiotUpstreamException)
      assert.equal(refused.reason.upstreamStatus, 429)
    }
    assert.equal(calls, MAX_PENDING_PER_METHOD)

    // Another method keeps its own backlog.
    client.riotRateLimiter.execute = async () => ({})
    await client.matchV5.getMatchTimelineById({ matchId: 'EUW1_0', cluster: PlatformId.EUROPE })

    release.forEach((resolve) => resolve())
    await Promise.all(waiting)
    assert.equal(client.waiting(PlatformId.EUROPE, 'MATCH_V5.GET_MATCH_BY_ID'), 0)
    assert.deepEqual(await match(MAX_PENDING_PER_METHOD + 1), {})
  })

  test('a 429 without method rate limit headers does not throw out of the limiter', ({
    assert,
  }) => {
    const limiter = new CoalescingRiotAPI('test-key').riotRateLimiter as any
    limiter.setupRateLimiters('europe', 'MATCH_V5.GET_MATCH_BY_ID', {
      appLimits: '20:1,100:120',
      appCounts: '1:1,1:120',
      methodLimits: '2000:10',
      methodCounts: '1:10',
    })
    // What a service 429 carries: no X-Method-Rate-Limit, so the SDK reads ''.
    assert.doesNotThrow(() =>
      limiter.updateRateLimiters('europe', 'MATCH_V5.GET_MATCH_BY_ID', {
        appLimits: '20:1,100:120',
        appCounts: '20:1,40:120',
        methodLimits: '',
        methodCounts: '',
      })
    )
  })

  test('a first 429 without method headers still sets up the limiter the retry needs', ({
    assert,
  }) => {
    const limiter = new CoalescingRiotAPI('test-key').riotRateLimiter as any
    limiter.setupRateLimiters('europe', 'MATCH_V5.GET_MATCH_BY_ID', {
      appLimits: '10:10,500:600',
      appCounts: '1:10,1:600',
      methodLimits: '',
      methodCounts: '',
    })
    // The SDK schedules its retry on this limiter from a timer; without it the process dies.
    assert.isDefined(limiter.rateLimiters.europe['MATCH_V5.GET_MATCH_BY_ID']?.main)
  })

  test('fills rate limits Riot left out from the app limits', ({ assert }) => {
    assert.deepInclude(
      saneRateLimits({
        appLimits: '20:1,100:120',
        appCounts: '3:1',
        methodLimits: '',
        methodCounts: '',
      }),
      {
        appCounts: '3:1,0:120',
        methodLimits: '20:1,100:120',
        methodCounts: '3:1,0:120',
      }
    )
    assert.deepInclude(
      saneRateLimits({ appLimits: '', appCounts: '', methodLimits: '50:10', methodCounts: '' }),
      { appLimits: '10:10,500:600', methodLimits: '50:10', methodCounts: '0:10' }
    )
  })

  test('background requests wait behind visitors in the SDK queue', async ({ assert }) => {
    const client = new CoalescingRiotAPI('test-key')
    const limiter = client.riotRateLimiter as any
    // One slot (the SDK has 10): every job past the first waits in the queue.
    limiter.configuration.concurrency = 1
    limiter.setupRateLimiters('europe', 'MATCH_V5.GET_MATCH_BY_ID', {
      appLimits: '20:1,100:120',
      appCounts: '0:1,0:120',
      methodLimits: '2000:10',
      methodCounts: '0:10',
    })
    const order: string[] = []
    limiter.executeRequest = async ({ req }: { req: { url: string } }) => {
      order.push(req.url.split('/').pop()!)
      // About what a Riot call takes: the jobs behind it are queued by then.
      await new Promise((resolve) => setTimeout(resolve, 50))
      return {}
    }
    const match = (id: string) =>
      client.matchV5.getMatchById({ matchId: id, cluster: PlatformId.EUROPE })

    const queued = inBackground(() =>
      Promise.all(['EUW1_1', 'EUW1_2', 'EUW1_3', 'EUW1_4'].map(match))
    )
    await new Promise((resolve) => setTimeout(resolve, 20))
    const visitor = match('EUW1_9')
    await Promise.all([queued, visitor])
    // The first background job was already running; the visitor's goes right after it.
    assert.deepEqual(order, ['EUW1_1', 'EUW1_9', 'EUW1_2', 'EUW1_3', 'EUW1_4'])
  })

  test('a visitor never joins a background read, and background has a small backlog', async ({
    assert,
  }) => {
    const client = new CoalescingRiotAPI('test-key')
    const release: Array<() => void> = []
    const priorities: Array<number | null | undefined> = []
    client.riotRateLimiter.execute = (_request, options) => {
      priorities.push(options?.priority)
      return new Promise((resolve) => release.push(() => resolve({})))
    }
    const match = (n: number) =>
      client.matchV5.getMatchById({ matchId: `EUW1_${n}`, cluster: PlatformId.EUROPE })

    const background = Array.from({ length: MAX_BACKGROUND_PENDING_PER_METHOD }, (_, n) =>
      inBackground(() => match(n))
    )
    const [refused] = await Promise.allSettled([inBackground(() => match(99))])
    assert.equal(refused.status, 'rejected')
    // Same game as a background read in flight: a request of its own, at the visitor's priority.
    const visitor = match(0)
    await new Promise<void>((resolve) => setImmediate(resolve))
    assert.lengthOf(priorities, MAX_BACKGROUND_PENDING_PER_METHOD + 1)
    assert.isTrue(priorities.slice(0, -1).every((priority) => priority === 9))
    assert.isUndefined(priorities.at(-1))

    release.forEach((resolve) => resolve())
    await Promise.all([...background, visitor])
    client.riotRateLimiter.execute = async () => ({})
    assert.deepEqual(await inBackground(() => match(100)), {}, 'drained: taken again')
  })

  test('a limiter keeps refilling its reservoir after its settings change', async ({ assert }) => {
    new CoalescingRiotAPI('test-key')
    const limiter = new Bottleneck({
      reservoir: 0,
      reservoirRefreshAmount: 2,
      reservoirRefreshInterval: 50,
      heartbeatInterval: 10,
    })
    // What the SDK does after a response: the reservoir follows Riot's count, here spent.
    await limiter.updateSettings({ reservoir: 0 })
    const ran = await Promise.race([
      limiter.schedule(async () => true),
      new Promise((resolve) => setTimeout(() => resolve(false), 1000)),
    ])
    await limiter.stop({ dropWaitingJobs: true })
    assert.isTrue(ran)
  })
})
