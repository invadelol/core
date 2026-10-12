import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import redis from '@adonisjs/redis/services/main'
import { MatchPager, OLDER_PAGES } from '#services/match_pager'

test.group('Match pager', (group) => {
  // A prefix of its own per run, so nothing else in Redis is counted or left behind.
  const prefix = `pages:test:${randomUUID()}:`
  group.teardown(async () => {
    const keys = await redis.keys(`${prefix}*`)
    if (keys.length) await redis.del(...keys)
  })

  test('three pages of a player right away, then one every two minutes, in Redis', async ({
    assert,
  }) => {
    let now = Date.UTC(2026, 9, 12, 12)
    const pager = new MatchPager(prefix, undefined, () => now)
    const takes = async (n: number) => {
      const out = []
      for (let i = 0; i < n; i++) out.push(await pager.take('player-a', '10.0.0.1'))
      return out
    }
    assert.deepEqual(await takes(4), [0, 0, 0, 120])
    now += 42_000
    assert.equal(await pager.take('player-a', '10.0.0.1'), 78, 'Retry-After counts down')
    now += 78_000
    assert.deepEqual(await takes(2), [0, 120], 'one page, then the next two minutes later')

    // Another player, or the same one from another address, has pages of its own.
    assert.equal(await pager.take('player-b', '10.0.0.1'), 0)
    assert.equal(await pager.take('player-a', '10.0.0.2'), 0)

    const ttl = await redis.pttl(`${prefix}player:player-a:10.0.0.1`)
    assert.isAbove(ttl, 0)
    assert.isAtMost(ttl, OLDER_PAGES.player.burst * OLDER_PAGES.player.everyMs)
  })

  test('one address scrolling many players is held at a few profiles worth', async ({ assert }) => {
    const now = Date.UTC(2026, 9, 12, 13)
    const pager = new MatchPager(prefix, undefined, () => now)
    const { burst, everyMs } = OLDER_PAGES.address
    for (let i = 0; i < burst; i++) {
      assert.equal(await pager.take(`p${Math.floor(i / 3)}`, '10.0.0.9'), 0)
    }
    assert.equal(await pager.take('fresh-player', '10.0.0.9'), everyMs / 1000)
    // Refused by the address, so the fresh player's own three pages were not spent: once the
    // address has earned three, all three go.
    const later = new MatchPager(prefix, undefined, () => now + 3 * everyMs)
    for (let i = 0; i < 3; i++) assert.equal(await later.take('fresh-player', '10.0.0.9'), 0)
    assert.isAbove(await later.take('fresh-player', '10.0.0.9'), 0)
  })

  test('fails open when Redis is unavailable', async ({ assert }) => {
    const pager = new MatchPager(prefix, {
      take: async () => {
        throw new Error('connection refused')
      },
    })
    assert.equal(await pager.take('player-a', '10.0.0.1'), 0)
  })
})
