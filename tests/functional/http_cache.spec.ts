import { test } from '@japa/runner'
import { IncomingMessage } from 'node:http'
import { Socket } from 'node:net'
import { randomUUID } from 'node:crypto'
import testUtils from '@adonisjs/core/services/test_utils'
import redis from '@adonisjs/redis/services/main'
import HttpCacheMiddleware from '#middleware/http_cache_middleware'
import memoryCache from '#services/response_memory_cache'
import {
  compressResponse,
  decompressResponse,
  invalidateResponseCache,
  responseCacheKey,
  saveResponseCache,
} from '#services/http_response_cache'

async function context(url: string, encoding = 'br', ifNoneMatch?: string) {
  const req = new IncomingMessage(new Socket())
  req.url = url
  req.method = 'GET'
  req.headers['accept-encoding'] = encoding
  if (ifNoneMatch) req.headers['if-none-match'] = ifNoneMatch
  return testUtils.createHttpContext({ req })
}

async function decoded(body: Buffer) {
  const json = await decompressResponse(body)
  return JSON.parse(json.toString())
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => (resolve = done))
  return { promise, resolve }
}

test.group('HTTP response cache', (group) => {
  const resources: string[] = []
  function resource() {
    const id = `summoner:perf_test_${randomUUID()}`
    resources.push(id)
    return id
  }
  const urlFor = (id: string) => `/api/summoners/puuid/${id.slice(9)}/stats?count=100`

  // Each test decides which tier it is exercising, so the in-process layer
  // never leaks a hit into the next one.
  group.each.setup(() => memoryCache.clear())

  group.teardown(async () => {
    await invalidateResponseCache(resources)
    for (const id of resources) await redis.del(`${id}:cache_generation`)
  })

  test('round trips JSON and serves compressed hits without executing the handler', async ({
    assert,
  }) => {
    const url = urlFor(resource())
    const middleware = new HttpCacheMiddleware()
    const payload = { global: { total: 15, winrate: 0.6 }, name: 'Éclair' }
    const first = await context(url)
    await middleware.handle(first, async () => {
      first.response.ok(payload)
    })
    assert.equal(first.response.getHeader('Content-Encoding'), 'br')
    assert.deepEqual(await decoded(first.response.getBody()), payload)
    const hit = await context(url)
    await middleware.handle(hit, async () => {
      assert.fail('cache hit executed controller')
    })
    assert.equal(hit.response.getHeader('X-Cache'), 'MEMORY')
    assert.deepEqual(hit.response.getBody(), first.response.getBody())
    assert.equal(hit.response.getHeader('Cache-Control'), 'private, no-cache')

    // Dropping the in-process layer falls through to Redis, same bytes.
    memoryCache.clear()
    const redisHit = await context(url)
    await middleware.handle(redisHit, async () => assert.fail('cache hit executed controller'))
    assert.equal(redisHit.response.getHeader('X-Cache'), 'HIT')
    assert.deepEqual(redisHit.response.getBody(), first.response.getBody())
  })

  test('answers a matching If-None-Match with a bodyless 304', async ({ assert }) => {
    const url = urlFor(resource())
    const middleware = new HttpCacheMiddleware()
    const first = await context(url)
    await middleware.handle(first, async () => first.response.ok({ total: 7 }))

    const etag = String(first.response.getHeader('ETag'))
    assert.match(etag, /^"[\w-]+"$/)

    const revalidated = await context(url, 'br', etag)
    await middleware.handle(revalidated, async () =>
      assert.fail('revalidation executed controller')
    )
    assert.equal(revalidated.response.getStatus(), 304)
    assert.isNull(revalidated.response.getBody())

    // A client on a different encoding holds a different representation, so
    // its validator must not match the Brotli one.
    const identity = await context(url, 'identity', etag)
    await middleware.handle(identity, async () => assert.fail('revalidation executed controller'))
    assert.equal(identity.response.getStatus(), 200)
    assert.deepEqual(JSON.parse(identity.response.getBody().toString()), { total: 7 })
  })

  test('an invalidation drops the in-process copy as well as the Redis one', async ({ assert }) => {
    const id = resource()
    const url = urlFor(id)
    const middleware = new HttpCacheMiddleware()
    const first = await context(url)
    await middleware.handle(first, async () => first.response.ok({ total: 1 }))

    // Proves the copy is genuinely in memory before the invalidation lands.
    const warm = await context(url)
    await middleware.handle(warm, async () => assert.fail('memory did not hold the response'))
    assert.equal(warm.response.getHeader('X-Cache'), 'MEMORY')

    await invalidateResponseCache([id])

    let recomputed = 0
    const after = await context(url)
    await middleware.handle(after, async () => {
      recomputed++
      after.response.ok({ total: 2 })
    })
    assert.equal(recomputed, 1, 'memory served a copy that had been invalidated')
    assert.deepEqual(await decoded(after.response.getBody()), { total: 2 })
  })

  test('honors br;q=0 and returns JSON bytes for clients without Brotli', async ({ assert }) => {
    const id = resource()
    const url = urlFor(id)
    await saveResponseCache(responseCacheKey(url), id, '0', await compressResponse({ total: 42 }))
    for (const encoding of ['gzip, br;q=0', 'identity', '']) {
      const ctx = await context(url, encoding)
      await new HttpCacheMiddleware().handle(ctx, async () => {
        assert.fail('unexpected miss')
      })
      assert.isUndefined(ctx.response.getHeader('Content-Encoding'))
      assert.deepEqual(JSON.parse(ctx.response.getBody().toString()), { total: 42 })
    }
  })

  test('coalesces a burst of cold requests into one database computation', async ({ assert }) => {
    const url = urlFor(resource())
    const middleware = new HttpCacheMiddleware()
    let computations = 0
    const contexts = await Promise.all(Array.from({ length: 12 }, () => context(url)))
    await Promise.all(
      contexts.map((ctx) =>
        middleware.handle(ctx, async () => {
          computations++
          // Give concurrent requests time to reach the in-flight entry.
          await new Promise((resolve) => setTimeout(resolve, 40))
          ctx.response.ok({ total: 12 })
        })
      )
    )
    assert.equal(computations, 1)
    for (const ctx of contexts) {
      assert.deepEqual(await decoded(ctx.response.getBody()), {
        total: 12,
      })
    }
  })

  test('invalidation rejects a stale in-flight write and clears every query variant', async ({
    assert,
  }) => {
    const id = resource()
    const url = urlFor(id)
    const old = await compressResponse({ total: 1 })
    await saveResponseCache(responseCacheKey(url), id, '0', old)
    await saveResponseCache(responseCacheKey(`${url}&view=summary`), id, '0', old)
    await invalidateResponseCache([id])
    assert.isNull(await redis.getBuffer(responseCacheKey(url)))
    assert.isNull(await redis.getBuffer(responseCacheKey(`${url}&view=summary`)))
    assert.equal(await saveResponseCache(responseCacheKey(url), id, '0', old), 0)
    assert.isNull(await redis.getBuffer(responseCacheKey(url)))
    const generation = (await redis.get(`${id}:cache_generation`))!
    assert.equal(await saveResponseCache(responseCacheKey(url), id, generation, old), 1)
    assert.isAbove(await redis.ttl(`${id}:cache_keys`), 0)
  })

  test('a post-update request does not join an older in-flight computation', async ({ assert }) => {
    const id = resource()
    const url = urlFor(id)
    const entered = deferred()
    const release = deferred()
    const middleware = new HttpCacheMiddleware()
    const old = await context(url)
    const oldRequest = middleware.handle(old, async () => {
      entered.resolve()
      await release.promise
      old.response.ok({ total: 1 })
    })
    await entered.promise
    await invalidateResponseCache([id])
    const fresh = await context(url)
    await middleware.handle(fresh, async () => {
      fresh.response.ok({ total: 2 })
    })
    release.resolve()
    await oldRequest
    const cached = await redis.getBuffer(responseCacheKey(url))
    assert.deepEqual(await decoded(cached!), { total: 2 })
  })

  test('does not cache errors and allows retry after a controller failure', async ({ assert }) => {
    const url = urlFor(resource())
    const middleware = new HttpCacheMiddleware()
    const error = await context(url)
    await middleware.handle(error, async () => {
      error.response.notFound({ message: 'missing' })
    })
    assert.isNull(await redis.getBuffer(responseCacheKey(url)))
    const failed = await context(url)
    await assert.rejects(
      () =>
        middleware.handle(failed, async () => {
          throw new Error('database unavailable')
        }),
      'database unavailable'
    )
    const retry = await context(url)
    await middleware.handle(retry, async () => {
      retry.response.ok({ total: 3 })
    })
    assert.equal(retry.response.getHeader('X-Cache'), 'MISS')
  })

  test('serves the controller response during Redis read or write outages', async ({ assert }) => {
    const originalRead = redis.getBuffer
    const originalWrite = redis.eval
    try {
      redis.getBuffer = (async () => {
        throw new Error('Redis unavailable')
      }) as typeof redis.getBuffer
      const readFailure = await context(urlFor(resource()))
      await new HttpCacheMiddleware().handle(readFailure, async () => {
        readFailure.response.ok({ total: 5 })
      })
      assert.deepEqual(readFailure.response.getBody(), { total: 5 })
      redis.getBuffer = originalRead
      redis.eval = (async () => {
        throw new Error('Redis unavailable')
      }) as typeof redis.eval
      const writeFailure = await context(urlFor(resource()))
      await new HttpCacheMiddleware().handle(writeFailure, async () => {
        writeFailure.response.ok({ total: 6 })
      })
      assert.deepEqual(writeFailure.response.getBody(), { total: 6 })
    } finally {
      redis.getBuffer = originalRead
      redis.eval = originalWrite
    }
  })

  test('normalizes query order without conflating different values', ({ assert }) => {
    assert.equal(
      responseCacheKey('/api/matches/EUW1_1?a=1&b=2'),
      responseCacheKey('/api/matches/EUW1_1?b=2&a=1')
    )
    assert.notEqual(
      responseCacheKey('/api/matches/EUW1_1?a=1'),
      responseCacheKey('/api/matches/EUW1_1?a=2')
    )
  })
})
