import { test } from '@japa/runner'
import { IncomingMessage } from 'node:http'
import { Socket } from 'node:net'
import { randomBytes } from 'node:crypto'
import testUtils from '@adonisjs/core/services/test_utils'
import redis from '@adonisjs/redis/services/main'
import HttpCacheMiddleware from '#middleware/http_cache_middleware'
import memoryCache from '#services/response_memory_cache'
import { pageCacheKey } from '#services/http_response_cache'
import { desktopReleases } from '#services/desktop_release'

async function clearPages() {
  memoryCache.clear()
  const keys = await redis.keys('http_cache:v2:page:*')
  if (keys.length) await redis.del(...keys)
}

/** A context as the router hands it over, with the asset version Inertia would carry. */
async function context(url: string, version = 'test-version') {
  const req = new IncomingMessage(new Socket())
  req.url = url
  req.method = 'GET'
  req.headers['accept-encoding'] = 'identity'
  const ctx = await testUtils.createHttpContext({ req })
  ;(ctx as any).inertia = { config: { versionCache: { getVersion: () => version } } }
  return ctx
}

/** A fresh `ref` per test, so no run can see an earlier run's entry. */
const ref = () => `t-${randomBytes(6).toString('hex')}`

test.group('Page cache', (group) => {
  const latest = desktopReleases.latest
  let renders = 0

  group.setup(async () => {
    await redis.ping()
  })
  group.each.setup(async () => {
    renders = 0
    desktopReleases.latest = async () => {
      renders++
      return { version: '9.9.9', urls: {} }
    }
    await clearPages()
  })
  group.each.teardown(async () => {
    desktopReleases.latest = latest
    await clearPages()
  })

  test('renders /app once, then answers from memory and Redis with the same bytes', async ({
    client,
    assert,
  }) => {
    const miss = await client.get('/app').header('accept-encoding', 'identity')
    miss.assertStatus(200)
    miss.assertHeader('x-cache', 'MISS')
    miss.assertTextIncludes('9.9.9')
    assert.equal(miss.header('cache-control'), 'private, no-cache, must-revalidate')
    assert.match(String(miss.header('content-type')), /^text\/html/)
    assert.include(miss.header('vary'), 'X-Inertia')

    const memory = await client.get('/app').header('accept-encoding', 'identity')
    memory.assertHeader('x-cache', 'MEMORY')
    assert.equal(memory.text(), miss.text())

    memoryCache.clear()
    const hit = await client.get('/app').header('accept-encoding', 'identity')
    hit.assertHeader('x-cache', 'HIT')
    assert.equal(hit.text(), miss.text())
    assert.equal(hit.header('cache-control'), 'private, no-cache, must-revalidate')
    assert.match(String(hit.header('content-type')), /^text\/html/)

    // Hits never reach the controller.
    assert.equal(renders, 1)
  })

  test('a hit is byte-identical to an uncached render, and Redis failing still renders', async ({
    client,
    assert,
  }) => {
    const cached = await client.get('/').header('accept-encoding', 'identity')
    cached.assertHeader('x-cache', 'MISS')

    memoryCache.clear()
    const original = redis.getBuffer
    try {
      redis.getBuffer = (async () => {
        throw new Error('Redis unavailable')
      }) as typeof redis.getBuffer
      const uncached = await client.get('/').header('accept-encoding', 'identity')
      uncached.assertStatus(200)
      uncached.assertTextIncludes('Find a player')
      assert.equal(uncached.text(), cached.text())
    } finally {
      redis.getBuffer = original
    }
  })

  test('sends brotli and gzip encodings like an uncached render, and 304s a matching ETag', async ({
    client,
    assert,
  }) => {
    await client.get('/app').header('accept-encoding', 'identity')
    const br = await client.get('/app').header('accept-encoding', 'gzip, br')
    br.assertHeader('x-cache', 'MEMORY')
    br.assertHeader('content-encoding', 'br')
    br.assertTextIncludes('Invade for desktop')

    const gzip = await client.get('/app').header('accept-encoding', 'gzip')
    gzip.assertHeader('content-encoding', 'gzip')
    gzip.assertTextIncludes('Invade for desktop')

    const etag = br.header('etag')
    const revalidated = await client
      .get('/app')
      .header('accept-encoding', 'gzip, br')
      .header('if-none-match', String(etag))
    revalidated.assertStatus(304)
    assert.equal(renders, 1)
  })

  test('Inertia visits bypass the cache and get their JSON page object', async ({
    client,
    assert,
  }) => {
    const html = await client.get('/app').header('accept-encoding', 'identity')
    const version = html.text().match(/&quot;version&quot;:&quot;([^&]+)&quot;/)?.[1]
    assert.exists(version)

    for (let i = 0; i < 2; i++) {
      const visit = await client
        .get('/app')
        .header('x-inertia', 'true')
        .header('x-inertia-version', version!)
      visit.assertStatus(200)
      assert.isUndefined(visit.header('x-cache'))
      assert.equal(visit.body().component, 'app')
      assert.equal(visit.body().url, '/app')
    }
    assert.equal(renders, 3)
  })

  test('a ref gets its own entry carrying its own URL; other queries render normally', async ({
    client,
    assert,
  }) => {
    const id = ref()
    const first = await client.get(`/app?ref=${id}`).header('accept-encoding', 'identity')
    first.assertHeader('x-cache', 'MISS')
    first.assertTextIncludes(`/app?ref=${id}`)
    const again = await client.get(`/app?ref=${id}`).header('accept-encoding', 'identity')
    again.assertHeader('x-cache', 'MEMORY')
    again.assertTextIncludes(`/app?ref=${id}`)

    const other = ref()
    const second = await client.get(`/app?ref=${other}`).header('accept-encoding', 'identity')
    second.assertHeader('x-cache', 'MISS')
    second.assertTextIncludes(`/app?ref=${other}`)
    assert.notInclude(second.text(), id)

    for (const query of [`ref=${id}&utm_source=x`, `ref=${'a'.repeat(33)}`, 'q=1', 'ref=a.b']) {
      const response = await client.get(`/app?${query}`).header('accept-encoding', 'identity')
      response.assertStatus(200)
      assert.isUndefined(response.header('x-cache'), query)
    }
    assert.equal(renders, 6)
  })

  test('only / and /app qualify, keyed by asset version', ({ assert }) => {
    assert.isNull(pageCacheKey('/legal', 'v1'))
    assert.isNull(pageCacheKey('/app/', 'v1'))
    assert.isNull(pageCacheKey('/?ref=a&ref=b', 'v1'))
    assert.equal(pageCacheKey('/?ref=launch', 'v1'), 'http_cache:v2:page:v1:/?ref=launch')
    assert.notEqual(pageCacheKey('/app', 'v1'), pageCacheKey('/app', 'v2'))
  })

  test('does not cache a failed render or one that sets a cookie', async ({ assert }) => {
    const middleware = new HttpCacheMiddleware()
    const url = `/app?ref=${ref()}`
    const key = pageCacheKey(url, 'test-version')!

    const failed = await context(url)
    await middleware.handle(failed, async () => failed.response.status(500).send('<p>down</p>'), {
      page: true,
    })
    assert.equal(failed.response.getStatus(), 500)
    assert.isNull(await redis.getBuffer(key))

    const cookie = await context(url)
    await middleware.handle(
      cookie,
      async () => {
        cookie.response.header('Set-Cookie', 'visitor=1')
        cookie.response.send('<p>yours</p>')
      },
      { page: true }
    )
    assert.isNull(await redis.getBuffer(key))

    let ran = false
    const retry = await context(url)
    await middleware.handle(
      retry,
      async () => {
        ran = true
        retry.response.send('<p>page</p>')
      },
      { page: true }
    )
    assert.isTrue(ran)
    assert.equal(retry.response.getHeader('X-Cache'), 'MISS')
    assert.isNotNull(await redis.getBuffer(key))
    assert.isAtMost(await redis.ttl(key), 60)
  })

  test('coalesces a cold burst into one render', async ({ assert }) => {
    const middleware = new HttpCacheMiddleware()
    const url = `/?ref=${ref()}`
    let calls = 0
    const contexts = await Promise.all(Array.from({ length: 10 }, () => context(url)))
    await Promise.all(
      contexts.map((ctx) =>
        middleware.handle(
          ctx,
          async () => {
            calls++
            await new Promise((resolve) => setTimeout(resolve, 30))
            ctx.response.send('<p>home</p>')
          },
          { page: true }
        )
      )
    )
    assert.equal(calls, 1)
    const statuses = contexts.map((ctx) => ctx.response.getHeader('X-Cache')).sort()
    assert.deepEqual(statuses, ['COALESCED', ...Array(8).fill('COALESCED'), 'MISS'].sort())
    for (const ctx of contexts) assert.equal(ctx.response.getBody(), '<p>home</p>')
  })

  test('a different asset version never sees the previous build’s page', async ({ assert }) => {
    const middleware = new HttpCacheMiddleware()
    const url = `/app?ref=${ref()}`
    const old = await context(url, 'build-a')
    await middleware.handle(old, async () => old.response.send('<p>a</p>'), { page: true })
    const next = await context(url, 'build-b')
    let ran = false
    await middleware.handle(
      next,
      async () => {
        ran = true
        next.response.send('<p>b</p>')
      },
      { page: true }
    )
    assert.isTrue(ran)
    assert.equal(next.response.getBody(), '<p>b</p>')
  })
})
