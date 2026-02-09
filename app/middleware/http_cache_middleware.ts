import { HttpContext } from '@adonisjs/core/http'
import redis from '@adonisjs/redis/services/main'
import { brotliCompress, brotliDecompress } from 'node:zlib'
import { promisify } from 'node:util'

import env from '#start/env'
import { CACHE_TTL_SECONDS } from '#config/constants'

const brotliCompressAsync = promisify(brotliCompress)
const brotliDecompressAsync = promisify(brotliDecompress)

/**
 * HTTP Cache middleware using Redis with Brotli compression.
 *
 * Caching strategy:
 * - Caches GET responses in Redis for CACHE_TTL_SECONDS
 * - Returns cached data if available (HIT)
 * - Cache is invalidated via SummonerUpdated events when data changes
 * - Browser is told NOT to cache (no-store) so stale data is never served
 *   after invalidation. Redis is the single source of truth for caching.
 */
export default class HttpCacheMiddleware {
  async handle({ request, response }: HttpContext, next: () => Promise<void>) {
    // Bypass cache in development
    if (env.get('NODE_ENV') === 'development') return next()
    if (request.method() !== 'GET') return next()

    // No cache for front (inertia)
    if (!request.url().includes('/api/')) return next()

    const url = request.url(true)
    const key = `http_cache:${url}`

    const cached = await this.getFromCache(key)
    if (cached) {
      // Set cache headers from stored response
      Object.keys(cached.headers).forEach((headerName) =>
        response.header(headerName, cached.headers[headerName])
      )
      response.header('X-Cache', 'HIT')
      // Tell browser not to cache – Redis handles caching, browser always re-validates
      response.header('Cache-Control', 'no-store, no-cache, must-revalidate')
      response.header('Pragma', 'no-cache')

      return response.send(cached.body)
    }

    // Cache miss - execute handler and cache result
    response.header('X-Cache', 'MISS')
    await next()

    if (response.getStatus() !== 200) return

    const body = response.getBody()
    if (!body) return

    // Tell browser not to cache – Redis handles caching
    response.header('Cache-Control', 'no-store, no-cache, must-revalidate')
    response.header('Pragma', 'no-cache')

    // Cache the response in Redis
    await this.saveToCache(key, body, response.getHeaders() as Record<string, string>)

    // Track cache key for this puuid (for invalidation via SummonerUpdated event)
    const puuidMatch = url.match(/\/api\/summoners\/puuid\/([a-zA-Z0-9_-]+)/)
    if (puuidMatch?.[1]) {
      await redis.sadd(`summoner:${puuidMatch[1]}:cache_keys`, key)
    }

    // Track cache key for match endpoints (for invalidation when match data refreshes)
    const matchIdMatch = url.match(/\/api\/matches\/([A-Z0-9]+_[0-9]+)/)
    if (matchIdMatch?.[1]) {
      await redis.sadd(`match:${matchIdMatch[1]}:cache_keys`, key)
    }
  }

  private async getFromCache(key: string) {
    try {
      const compressed = await redis.getBuffer(key)
      if (!compressed) return null

      const decompressed = await brotliDecompressAsync(compressed)
      return JSON.parse(decompressed.toString('utf8'))
    } catch {
      return null
    }
  }

  private async saveToCache(
    key: string,
    body: any,
    headers: Record<string, string>
  ): Promise<void> {
    try {
      const payload = {
        body,
        headers,
        timestamp: Date.now(),
      }
      const json = JSON.stringify(payload)
      const compressed = await brotliCompressAsync(Buffer.from(json, 'utf8'))
      await redis.setex(key, CACHE_TTL_SECONDS, compressed)
    } catch {}
  }
}
