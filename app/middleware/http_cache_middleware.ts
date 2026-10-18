import type { HttpContext } from '@adonisjs/core/http'
import redis from '@adonisjs/redis/services/main'
import env from '#start/env'
import {
  PAGE_CACHE_RESOURCE,
  PAGE_CACHE_TTL_SECONDS,
  compressResponse,
  decompressResponse,
  pageCacheKey,
  responseCacheKey,
  responseCacheResource,
  saveResponseCache,
} from '#services/http_response_cache'
import memoryCache, { contentHash } from '#services/response_memory_cache'

// Only concurrent requests share this map; persisted data always goes through
// Redis so invalidation works across server processes.
const inFlight = new Map<string, Promise<Buffer | null>>()

/** Pages are never invalidated, only expired, so they always compute against this. */
const PAGE_GENERATION = '0'

/**
 * How long a page waits on Redis before rendering without it. A hit is a
 * millisecond; this only matters when the connection hangs.
 */
const PAGE_REDIS_WAIT_MS = 500

export interface HttpCacheOptions {
  /**
   * Cache a server-rendered page that is identical for every visitor, rather
   * than an analytics response. See `pageCacheKey` for which URLs qualify.
   */
  page?: boolean
}

type Kind = 'json' | 'html'

/**
 * Serves cached analytics from the closest place that has them.
 *
 * Three tiers, each one a strict improvement on the next:
 *
 *   memory   a map lookup in this process, no I/O at all
 *   Redis    one round trip, shared by every process
 *   compute  the controller, coalesced so a burst costs one computation
 *
 * Responses carry a strong `ETag` and `no-cache`. That keeps the freshness
 * guarantee exactly as it was — the browser still asks us on every request —
 * while letting an unchanged answer come back as a bodyless 304 instead of
 * re-sending the whole payload.
 */
export default class HttpCacheMiddleware {
  async handle(ctx: HttpContext, next: () => Promise<void>, options: HttpCacheOptions = {}) {
    const { request, response } = ctx
    if (env.get('NODE_ENV') === 'development' || request.method() !== 'GET') return next()
    if (options.page && ctx.invadeUser) return next()
    if (options.page) return this.page(ctx, next)

    const url = request.url(true)
    const resource = responseCacheResource(url)
    if (!resource) return next()
    const key = responseCacheKey(url)

    response.header('Cache-Control', 'private, no-cache')
    response.header('X-Cache', 'MISS')

    memoryCache.listen()
    const local = memoryCache.get(key)
    if (local) return this.send(ctx, local.body, local.hash, 'MEMORY')

    let generation: string
    try {
      // One round trip for both: a miss needs the generation it will compute against.
      const [cached, current] = await redis.mgetBuffer(key, `${resource}:cache_generation`)
      if (cached) {
        const entry = memoryCache.set(key, resource, cached)
        return await this.send(ctx, cached, entry.hash, 'HIT')
      }
      generation = current?.toString() ?? '0'
    } catch {
      // Redis is an optimization, never a prerequisite for serving analytics.
      return next()
    }

    const flightKey = `${key}:${generation}`
    const pending = inFlight.get(flightKey)
    if (pending) {
      const cached = await pending
      if (cached) return this.send(ctx, cached, contentHash(cached), 'COALESCED')
      return next()
    }

    let finish!: (body: Buffer | null) => void
    inFlight.set(flightKey, new Promise((resolve) => (finish = resolve)))
    try {
      await next()
      const body = response.getBody()
      if (response.getStatus() !== 200 || body === null || body === undefined) return
      try {
        const compressed = await compressResponse(body)
        const saved = await saveResponseCache(key, resource, generation, compressed)
        finish(saved === 1 ? compressed : null)
        // Only publish to this process's memory once Redis has accepted the
        // write; a rejected write means an invalidation overtook us.
        const hash =
          saved === 1 ? memoryCache.set(key, resource, compressed).hash : contentHash(compressed)
        return await this.send(ctx, compressed, hash, 'MISS')
      } catch {
        // Preserve the successful controller response on cache/compression failure.
      }
    } finally {
      finish(null)
      inFlight.delete(flightKey)
    }
  }

  /**
   * The same three tiers for a whole server-rendered page, so a launch-day
   * burst costs one SSR render per minute instead of one per visitor.
   *
   * Only full page loads are cached: an Inertia visit (`X-Inertia`) asks for
   * the page object as JSON and always renders. Redis being slow or down is
   * never a reason not to answer: the page then simply renders.
   */
  private async page(ctx: HttpContext, next: () => Promise<void>) {
    const { request, response } = ctx
    if (request.header('x-inertia')) return next()
    const version = assetVersion(ctx)
    if (!version) return next()
    const key = pageCacheKey(request.url(true), version)
    if (!key) return next()

    response.header('X-Cache', 'MISS')
    // Set on every answer, not only Inertia ones, so no cache in the path can
    // ever hand this HTML to an Inertia visit or the reverse.
    appendVary(response, 'X-Inertia')

    memoryCache.listen()
    const local = memoryCache.get(key)
    if (local) return this.send(ctx, local.body, local.hash, 'MEMORY', 'html')

    if (redis.connection().status !== 'ready') return next()
    try {
      const cached = await within(redis.getBuffer(key), PAGE_REDIS_WAIT_MS)
      if (cached) {
        const entry = memoryCache.set(key, PAGE_CACHE_RESOURCE, cached)
        return await this.send(ctx, cached, entry.hash, 'HIT', 'html')
      }
    } catch {
      return next()
    }

    // One render per page when cold: everyone else waits for it.
    const flightKey = `${key}:${PAGE_GENERATION}`
    const pending = inFlight.get(flightKey)
    if (pending) {
      const cached = await pending
      if (cached) return this.send(ctx, cached, contentHash(cached), 'COALESCED', 'html')
      return next()
    }

    let finish!: (body: Buffer | null) => void
    inFlight.set(flightKey, new Promise((resolve) => (finish = resolve)))
    try {
      await next()
      const body = response.getBody()
      // Only a plain successful render is shared; anything carrying a cookie
      // is by definition about this visitor.
      if (response.getStatus() !== 200 || typeof body !== 'string' || !body) return
      if (response.getHeader('Set-Cookie')) return
      try {
        const compressed = await compressResponse(body)
        const saved = await within(
          saveResponseCache(
            key,
            PAGE_CACHE_RESOURCE,
            PAGE_GENERATION,
            compressed,
            PAGE_CACHE_TTL_SECONDS
          ),
          PAGE_REDIS_WAIT_MS
        )
        finish(saved === 1 ? compressed : null)
        const hash =
          saved === 1
            ? memoryCache.set(key, PAGE_CACHE_RESOURCE, compressed).hash
            : contentHash(compressed)
        return await this.send(ctx, compressed, hash, 'MISS', 'html')
      } catch {
        // The render already succeeded; it goes out as it is.
      }
    } finally {
      finish(null)
      inFlight.delete(flightKey)
    }
  }

  private async send(
    { request, response }: HttpContext,
    body: Buffer,
    hash: string,
    status: string,
    kind: Kind = 'json'
  ) {
    const acceptsBrotli = request.encoding(['br', 'identity']) === 'br'

    // Compressed and decoded bytes are different representations of the same
    // resource, so each gets its own validator rather than sharing one and
    // relying on every cache in the path to honour `Vary`.
    const etag = acceptsBrotli ? `"${hash}"` : `"${hash}-identity"`

    response.header('X-Cache', status)
    response.header('ETag', etag)

    appendVary(response, 'Accept-Encoding')

    if (request.header('if-none-match') === etag) {
      return response.status(304).send(null)
    }

    if (kind === 'html') {
      response.header('Content-Type', 'text/html; charset=utf-8')
      if (acceptsBrotli) {
        response.header('Content-Encoding', 'br')
        return response.send(body, false)
      }
      // As text, so the compression middleware gzips it exactly as it would
      // an uncached render.
      const html = await decompressResponse(body)
      return response.send(html.toString('utf8'), false)
    }

    response.header('Content-Type', 'application/json; charset=utf-8')
    if (acceptsBrotli) response.header('Content-Encoding', 'br')
    return response.send(acceptsBrotli ? body : await decompressResponse(body), false)
  }
}

function appendVary(response: HttpContext['response'], value: string) {
  const vary = String(response.getHeader('Vary') ?? '')
  if (vary.toLowerCase().includes(value.toLowerCase())) return
  response.header('Vary', vary ? `${vary}, ${value}` : value)
}

/**
 * The asset version Inertia stamps on every page: a hash of the build
 * manifest. The package does not expose it, so it is read from the request's
 * Inertia instance; if that ever changes shape, pages simply stop caching.
 */
function assetVersion(ctx: HttpContext): string | null {
  try {
    const inertia = ctx.inertia as unknown as {
      config?: { versionCache?: { getVersion(): string | number } }
    }
    const version = inertia?.config?.versionCache?.getVersion()
    return version === undefined || version === null || version === '' ? null : String(version)
  } catch {
    return null
  }
}

function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('redis timeout')), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}
