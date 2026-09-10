import type { HttpContext } from '@adonisjs/core/http'
import redis from '@adonisjs/redis/services/main'
import env from '#start/env'
import {
  compressResponse,
  decompressResponse,
  responseCacheKey,
  responseCacheResource,
  saveResponseCache,
} from '#services/http_response_cache'
import memoryCache, { contentHash } from '#services/response_memory_cache'

// Only concurrent requests share this map; persisted data always goes through
// Redis so invalidation works across server processes.
const inFlight = new Map<string, Promise<Buffer | null>>()

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
  async handle(ctx: HttpContext, next: () => Promise<void>) {
    const { request, response } = ctx
    if (env.get('NODE_ENV') === 'development' || request.method() !== 'GET') return next()

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
      const cached = await redis.getBuffer(key)
      if (cached) {
        const entry = memoryCache.set(key, resource, cached)
        return await this.send(ctx, cached, entry.hash, 'HIT')
      }
      generation = (await redis.get(`${resource}:cache_generation`)) ?? '0'
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

  private async send(
    { request, response }: HttpContext,
    body: Buffer,
    hash: string,
    status: string
  ) {
    const acceptsBrotli = request.encoding(['br', 'identity']) === 'br'

    // Compressed and decoded bytes are different representations of the same
    // resource, so each gets its own validator rather than sharing one and
    // relying on every cache in the path to honour `Vary`.
    const etag = acceptsBrotli ? `"${hash}"` : `"${hash}-identity"`

    response.header('X-Cache', status)
    response.header('ETag', etag)

    const vary = String(response.getHeader('Vary') ?? '')
    if (!vary.toLowerCase().includes('accept-encoding')) {
      response.header('Vary', vary ? `${vary}, Accept-Encoding` : 'Accept-Encoding')
    }

    if (request.header('if-none-match') === etag) {
      return response.status(304).send(null)
    }

    response.header('Content-Type', 'application/json; charset=utf-8')
    if (acceptsBrotli) response.header('Content-Encoding', 'br')
    return response.send(acceptsBrotli ? body : await decompressResponse(body), false)
  }
}
