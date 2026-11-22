import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import redis from '@adonisjs/redis/services/main'
import {
  MemoryWindows,
  SlidingWindowLimiter,
  redisWindows,
  type Window,
  type WindowStore,
} from '#services/quota/sliding_window'

/** The same rules, in Redis and in memory: the memory store stands in for Redis when it is down. */
const stores: Array<[string, () => WindowStore]> = [
  ['Redis', () => redisWindows],
  ['memory', () => new MemoryWindows()],
]

for (const [name, store] of stores) {
  test.group(`Sliding windows (${name})`, (group) => {
    // A prefix of its own per run, so nothing else in Redis is counted or left behind.
    const prefix = `quota:test:${randomUUID()}:`
    group.teardown(async () => {
      const keys = await redis.keys(`${prefix}*`)
      if (keys.length) await redis.del(...keys)
    })

    const window = (key: string, limit: number, need = 1, add = 1): Window => ({
      key: `${prefix}${key}`,
      windowMs: 10_000,
      limit,
      need,
      add,
    })

    test('lets `limit` through, then counts down until the oldest leaves the window', async ({
      assert,
    }) => {
      let now = Date.UTC(2026, 10, 22, 12)
      const limiter = new SlidingWindowLimiter(store(), new MemoryWindows(), () => now)
      const take = () => limiter.take([window('a', 3)])
      for (let i = 0; i < 3; i++) {
        assert.equal((await take()).waitMs, 0)
        now += 1000
      }
      assert.deepEqual(await take(), { waitMs: 7000, blocked: 0 }, 'the first leaves at 10 s')
      now += 4000
      assert.equal((await take()).waitMs, 3000, 'a refusal counts nothing')
      now += 3000
      assert.equal((await take()).waitMs, 0, 'one place came free')
      assert.equal((await take()).waitMs, 1000, 'and only one')
    })

    test('a take is all or nothing over its windows', async ({ assert }) => {
      const now = Date.UTC(2026, 10, 22, 13)
      const limiter = new SlidingWindowLimiter(store(), new MemoryWindows(), () => now)
      assert.equal((await limiter.take([window('full', 1)])).waitMs, 0)
      const refused = await limiter.take([window('free', 5), window('full', 1)])
      assert.equal(refused.blocked, 1, 'the second window refused')
      // Nothing was counted in the first one: its five places are all there.
      for (let i = 0; i < 5; i++) assert.equal((await limiter.take([window('free', 5)])).waitMs, 0)
      assert.isAbove((await limiter.take([window('free', 5)])).waitMs, 0)
    })

    test('`need` only checks, `add` only counts, several at once', async ({ assert }) => {
      const now = Date.UTC(2026, 10, 22, 14)
      const limiter = new SlidingWindowLimiter(store(), new MemoryWindows(), () => now)
      // Checking room never fills the window.
      for (let i = 0; i < 4; i++) {
        assert.equal((await limiter.take([window('calls', 3, 1, 0)])).waitMs, 0)
      }
      // A charge goes in whatever room is left, and the next check sees it.
      assert.equal((await limiter.take([window('calls', 3, 0, 5)])).waitMs, 0)
      const refused = await limiter.take([window('calls', 3, 1, 0)])
      assert.equal(refused.waitMs, 10_000)
    })

    test('windows expire in Redis with their length', async ({ assert }) => {
      if (name !== 'Redis') return
      const limiter = new SlidingWindowLimiter(redisWindows)
      await limiter.take([window('ttl', 3)])
      const ttl = await redis.pttl(`${prefix}ttl`)
      assert.isAbove(ttl, 0)
      assert.isAtMost(ttl, 10_000)
    })
  })
}

test.group('Sliding windows without Redis', () => {
  test('count in memory rather than letting everything through', async ({ assert }) => {
    const down: WindowStore = {
      take: async () => {
        throw new Error('connection refused')
      },
    }
    const limiter = new SlidingWindowLimiter(down, new MemoryWindows(), () => 1_000)
    const w: Window = { key: 'k', windowMs: 60_000, limit: 2, need: 1, add: 1 }
    assert.equal((await limiter.take([w])).waitMs, 0)
    assert.equal((await limiter.take([w])).waitMs, 0)
    assert.equal((await limiter.take([w])).waitMs, 60_000)
  })

  test('the memory store forgets the least recently used windows past its size', async ({
    assert,
  }) => {
    const memory = new MemoryWindows(2)
    const w = (key: string): Window => ({ key, windowMs: 60_000, limit: 1, need: 1, add: 1 })
    await memory.take([w('a')], 1)
    await memory.take([w('b')], 1)
    await memory.take([w('c')], 1)
    assert.equal((await memory.take([w('a')], 1)).waitMs, 0, 'a was forgotten')
    assert.isAbove((await memory.take([w('c')], 1)).waitMs, 0, 'c was kept')
  })
})
