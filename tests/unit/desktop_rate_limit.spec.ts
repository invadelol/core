import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import redis from '@adonisjs/redis/services/main'
import { FixedWindowLimiter } from '#services/desktop/rate_limiter'
import { RetryScheduler } from '#services/desktop/retry_scheduler'

async function allowed(limiter: FixedWindowLimiter, bucket: string, id: string, limit: number) {
  const result = await limiter.hit(bucket, id, limit)
  return result.allowed
}

test.group('Desktop rate limiter', (group) => {
  group.tap((t) => t.tags(['@desktop']))
  // A prefix of its own per run, so nothing else in Redis is counted or left behind.
  const prefix = `desktop:rl:test:${randomUUID()}:`
  group.teardown(async () => {
    const keys = await redis.keys(`${prefix}*`)
    if (keys.length) await redis.del(...keys)
  })

  test('counts a fixed window per bucket and id in Redis', async ({ assert }) => {
    const limiter = new FixedWindowLimiter(prefix)
    const first = await limiter.hit('matches:device', 'a', 2)
    const second = await limiter.hit('matches:device', 'a', 2)
    const third = await limiter.hit('matches:device', 'a', 2)
    assert.deepEqual([first.allowed, second.allowed, third.allowed], [true, true, false])
    assert.equal(third.count, 3)
    assert.isAtLeast(third.retryAfter, 1)
    assert.isAtMost(third.retryAfter, 3600)

    // Other ids and other buckets have their own counters.
    assert.isTrue(await allowed(limiter, 'matches:device', 'b', 2))
    assert.isTrue(await allowed(limiter, 'matches:ip', 'a', 2))

    const keys = await redis.keys(`${prefix}matches:device:a:*`)
    assert.lengthOf(keys, 1)
    const ttl = await redis.ttl(keys[0])
    assert.isAbove(ttl, 0)
    assert.isAtMost(ttl, 3600)
  })

  test('a new window starts from zero, and Retry-After points at it', async ({ assert }) => {
    let now = Date.UTC(2026, 9, 8, 12, 59, 30)
    const limiter = new FixedWindowLimiter(prefix, undefined, () => now)
    await limiter.hit('devices:ip', 'x', 1)
    const blocked = await limiter.hit('devices:ip', 'x', 1)
    assert.isFalse(blocked.allowed)
    assert.equal(blocked.retryAfter, 30)

    now += 31_000
    assert.isTrue(await allowed(limiter, 'devices:ip', 'x', 1))
  })

  test('fails open when Redis is unavailable', async ({ assert }) => {
    const limiter = new FixedWindowLimiter(prefix, {
      incrementWindow: async () => {
        throw new Error('connection refused')
      },
    })
    assert.isTrue(await allowed(limiter, 'matches:device', 'a', 0))
  })
})

test.group('Desktop retry scheduler', (group) => {
  group.tap((t) => t.tags(['@desktop']))
  test('retries at each offset until done, then forgets the key', async ({ assert }) => {
    const scheduler = new RetryScheduler([5, 10, 15])
    const attempts: number[] = []
    scheduler.schedule('k', async (index) => {
      attempts.push(index)
      return index === 1 ? 'done' : 'retry'
    })
    assert.isFalse(scheduler.schedule('k', async () => 'done'))
    await new Promise((resolve) => setTimeout(resolve, 40))
    assert.deepEqual(attempts, [0, 1])
    assert.isFalse(scheduler.has('k'))
  })

  test('gives up after the last offset, failures included', async ({ assert }) => {
    const scheduler = new RetryScheduler([2, 4])
    let gaveUp = false
    scheduler.schedule(
      'k',
      async () => {
        throw new Error('still 404')
      },
      async () => {
        gaveUp = true
      }
    )
    await new Promise((resolve) => setTimeout(resolve, 30))
    assert.isTrue(gaveUp)
    assert.equal(scheduler.size, 0)
  })
})
