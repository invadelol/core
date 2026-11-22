import { test } from '@japa/runner'
import { PlatformId, RiotAPITypes } from '@fightmegg/riot-api'
import { CoalescingRiotAPI, unmetered } from '#services/riot/client'
import { MemoryWindows, SlidingWindowLimiter } from '#services/quota/sliding_window'
import { RIOT_QUOTAS, RiotQuota, quotaAddress } from '#services/quota/riot_quota'
import { TooManyRequestsException } from '#exceptions/too_many_requests_exception'

/** The application's Riot client, its queue and all, with Riot itself replaced: every URL kept. */
function fakeRiot() {
  const api = new CoalescingRiotAPI('RGAPI-00000000-0000-0000-0000-000000000000')
  const urls: string[] = []
  ;(api as any).riotRateLimiter.execute = async ({ url }: { url: string }) => {
    urls.push(url)
    return []
  }
  /** One champion-mastery-v4 read (a fictional PUUID). */
  const read = (puuid = 'p'.repeat(78)) =>
    api.request(
      PlatformId.EUW1,
      RiotAPITypes.METHOD_KEY.CHAMPION_MASTERY.GET_ALL_CHAMPIONS,
      { encryptedPUUID: puuid },
      { id: 'test' }
    )
  return { api, urls, read }
}

/** Quotas over windows in memory, on a clock the test moves. */
function quotas(clock = { now: Date.UTC(2026, 10, 22, 12) }) {
  const quota = new RiotQuota(
    new SlidingWindowLimiter(new MemoryWindows(), new MemoryWindows(), () => clock.now),
    'test-secret'
  )
  return { quota, clock }
}

async function refusal(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    return error
  }
  return null
}

test.group('Riot quota: addresses', () => {
  test('an IPv4 address is itself, an IPv6 one its /64', ({ assert }) => {
    assert.equal(quotaAddress('81.2.69.160'), '81.2.69.160')
    assert.equal(quotaAddress('::ffff:81.2.69.160'), '81.2.69.160')
    assert.equal(quotaAddress('2001:db8:aa:bb:1:2:3:4'), '2001:db8:aa:bb::/64')
    assert.equal(quotaAddress('2001:db8:aa:bb::9'), '2001:db8:aa:bb::/64')
    assert.equal(quotaAddress('2001:0db8:00aa:00bb:ffff::1'), '2001:db8:aa:bb::/64')
    assert.equal(quotaAddress('2001:db8::1'), '2001:db8:0:0::/64')
    assert.equal(quotaAddress('::1'), '0:0:0:0::/64')
  })
})

test.group('Riot quota: requests', () => {
  test('only requests that reach Riot are counted, the first one admits the rest', async ({
    assert,
  }) => {
    const { quota } = quotas()
    const riot = fakeRiot()
    const { limit } = RIOT_QUOTAS.routes.mastery.address[0]
    // A request that never asks Riot (a cached answer) takes nothing.
    for (let i = 0; i < limit * 2; i++) await quota.run('198.51.100.1', 'mastery', async () => null)
    for (let i = 0; i < limit; i++) {
      await quota.run('198.51.100.1', 'mastery', async () => {
        await riot.read(`a${i}`.padEnd(78, 'x'))
        await riot.read(`b${i}`.padEnd(78, 'x'))
      })
    }
    assert.lengthOf(riot.urls, limit * 2, 'two reads per request, one admission')
    const error = await refusal(
      quota.run('198.51.100.1', 'mastery', () => riot.read('c'.repeat(78)))
    )
    assert.instanceOf(error, TooManyRequestsException)
    assert.equal((error as TooManyRequestsException).scope, 'address')
    assert.equal((error as TooManyRequestsException).status, 429)
    assert.isAbove((error as TooManyRequestsException).retryAfter, 0)
    assert.lengthOf(riot.urls, limit * 2, 'the refused read never left')
    // Another address, or another route, has quotas of its own.
    await quota.run('198.51.100.2', 'mastery', () => riot.read('d'.repeat(78)))
    await quota.run('198.51.100.1', 'live', () => riot.read('e'.repeat(78)))
    assert.lengthOf(riot.urls, limit * 2 + 2)
  })

  test('the window slides: the oldest request leaving frees one place', async ({ assert }) => {
    const { quota, clock } = quotas()
    const riot = fakeRiot()
    const [rule] = RIOT_QUOTAS.routes.live.address
    for (let i = 0; i < rule.limit; i++) {
      await quota.run('198.51.100.3', 'live', () => riot.read(`l${i}`.padEnd(78, 'x')))
      clock.now += 1000
    }
    const error = (await refusal(
      quota.run('198.51.100.3', 'live', () => riot.read('m'.repeat(78)))
    )) as TooManyRequestsException
    assert.equal(error.retryAfter, rule.seconds - rule.limit)
    clock.now += error.retryAfter * 1000
    await quota.run('198.51.100.3', 'live', () => riot.read('n'.repeat(78)))
    assert.instanceOf(
      await refusal(quota.run('198.51.100.3', 'live', () => riot.read('o'.repeat(78)))),
      TooManyRequestsException
    )
  })

  test('an IPv6 client counts as its /64', async ({ assert }) => {
    const { quota } = quotas()
    const riot = fakeRiot()
    const { limit } = RIOT_QUOTAS.routes.live.address[0]
    for (let i = 0; i < limit; i++) {
      await quota.run(`2001:db8:5:6::${i.toString(16)}`, 'live', () =>
        riot.read(`v${i}`.padEnd(78, 'x'))
      )
    }
    assert.instanceOf(
      await refusal(quota.run('2001:db8:5:6::ffff', 'live', () => riot.read('w'.repeat(78)))),
      TooManyRequestsException
    )
  })

  test('the Riot calls an address caused are charged, whatever route made them', async ({
    assert,
  }) => {
    const { quota } = quotas()
    const riot = fakeRiot()
    const [budget] = RIOT_QUOTAS.calls
    // One request that made the whole budget's worth of calls (a few big updates).
    await quota.run('198.51.100.4', 'sync', async () => {
      for (let i = 0; i < budget.limit; i++) await riot.read(`s${i}`.padEnd(78, 'x'))
    })
    const error = (await refusal(
      quota.run('198.51.100.4', 'mastery', () => riot.read('t'.repeat(78)))
    )) as TooManyRequestsException
    assert.instanceOf(error, TooManyRequestsException)
    assert.equal(error.scope, 'address')
    // A route without quota of its own (older games, paced elsewhere) still counts what it spent.
    await quota.run('198.51.100.5', null, async () => {
      for (let i = 0; i < budget.limit; i++) await riot.read(`u${i}`.padEnd(78, 'x'))
    })
    assert.instanceOf(
      await refusal(quota.run('198.51.100.5', 'live', () => riot.read('y'.repeat(78)))),
      TooManyRequestsException
    )
  })

  test('identical reads in flight together count once', async ({ assert }) => {
    const { quota } = quotas()
    const riot = fakeRiot()
    const [budget] = RIOT_QUOTAS.calls
    await quota.run('198.51.100.6', 'mastery', async () => {
      await Promise.all(Array.from({ length: budget.limit }, () => riot.read('z'.repeat(78))))
    })
    assert.lengthOf(riot.urls, 1)
    await quota.run('198.51.100.6', 'mastery', () => riot.read('q'.repeat(78)))
  })

  test('work left behind once the answer went out is neither refused nor counted', async ({
    assert,
  }) => {
    const { quota } = quotas()
    const riot = fakeRiot()
    const [rule] = RIOT_QUOTAS.routes.live.address
    for (let i = 0; i < rule.limit; i++) {
      await quota.run('198.51.100.7', 'live', () => riot.read(`k${i}`.padEnd(78, 'x')))
    }
    let later: Promise<unknown> | null = null
    let outside: Promise<unknown> | null = null
    await quota.run('198.51.100.7', 'live', async () => {
      // A timer set while serving runs after the answer, still in this request's context.
      later = new Promise((resolve) => setTimeout(resolve, 5)).then(() => riot.read('j'.repeat(78)))
      outside = unmetered(() => riot.read('i'.repeat(78)))
    })
    await later
    await outside
    assert.include(riot.urls.join(' '), 'j'.repeat(78))
    assert.include(riot.urls.join(' '), 'i'.repeat(78))
  })

  test("a player's own quota holds whoever asks, from any address", async ({ assert }) => {
    const { quota } = quotas()
    const riot = fakeRiot()
    const [rule] = RIOT_QUOTAS.routes.lookup.player
    const lookup = (ip: string) =>
      quota.run(ip, 'lookup', async () => {
        quota.target('Fictional#EUW')
        await riot.read(`${ip}`.padEnd(78, 'x'))
      })
    for (let i = 0; i < rule.limit; i++) await lookup(`203.0.113.${i + 1}`)
    const error = (await refusal(lookup('203.0.113.200'))) as TooManyRequestsException
    assert.instanceOf(error, TooManyRequestsException)
    assert.equal(error.scope, 'player')
    // The Riot ID is counted whatever its case; another player is free.
    await quota.run('203.0.113.201', 'lookup', async () => {
      quota.target('Someone Else#EUW')
      await riot.read('h'.repeat(78))
    })
  })

  test('a sync that worked is remembered for a minute', async ({ assert }) => {
    const { quota, clock } = quotas()
    assert.isFalse(await quota.recentlySynced('Fictional#EUW'))
    await quota.synced('Fictional#EUW')
    assert.isTrue(await quota.recentlySynced('fictional#euw'))
    clock.now += 60_000
    assert.isFalse(await quota.recentlySynced('Fictional#EUW'))
  })
})
