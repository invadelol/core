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

// Only concurrent requests share memory; persisted data always goes through Redis
// so invalidation works across server processes.
const inFlight = new Map<string, Promise<Buffer | null>>()

export default class HttpCacheMiddleware {
  async handle(ctx: HttpContext, next: () => Promise<void>) {
    const { request, response } = ctx
    if (env.get('NODE_ENV') === 'development' || request.method() !== 'GET') return next()

    const url = request.url(true)
    const resource = responseCacheResource(url)
    if (!resource) return next()
    const key = responseCacheKey(url)

    response.header('Cache-Control', 'no-store')
    response.header('X-Cache', 'MISS')

    let generation: string
    try {
      const cached = await redis.getBuffer(key)
      if (cached) return await this.send(ctx, cached, 'HIT')
      generation = (await redis.get(`${resource}:cache_generation`)) ?? '0'
    } catch {
      // Redis is an optimization, never a prerequisite for serving analytics.
      return next()
    }

    const flightKey = `${key}:${generation}`
    const pending = inFlight.get(flightKey)
    if (pending) {
      const cached = await pending
      if (cached) return this.send(ctx, cached, 'COALESCED')
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
        return await this.send(ctx, compressed, 'MISS')
      } catch {
        // Preserve the successful controller response on cache/compression failure.
      }
    } finally {
      finish(null)
      inFlight.delete(flightKey)
    }
  }

  private async send({ request, response }: HttpContext, body: Buffer, status: string) {
    const acceptsBrotli = request.encoding(['br', 'identity']) === 'br'
    const payload = acceptsBrotli ? body : await decompressResponse(body)
    response.header('Content-Type', 'application/json; charset=utf-8')
    const vary = String(response.getHeader('Vary') ?? '')
    response.header('Vary', vary ? `${vary}, Accept-Encoding` : 'Accept-Encoding')
    response.header('X-Cache', status)
    if (acceptsBrotli) response.header('Content-Encoding', 'br')
    return response.send(payload)
  }
}
