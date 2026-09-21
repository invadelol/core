import { test } from '@japa/runner'
import { PlatformId } from '@fightmegg/riot-api'
import { CoalescingRiotAPI } from '#services/riot/client'
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
})
