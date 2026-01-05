import { HttpContext } from '@adonisjs/core/http'
import redis from '@adonisjs/redis/services/main'
import { brotliCompress, brotliDecompress } from 'node:zlib'
import { promisify } from 'node:util'

import env from '#start/env'
import { CACHE_FRESH_TTL_SECONDS, CACHE_TTL_SECONDS, CDN_MAX_AGE_SECONDS } from '#config/constants'

const brotliCompressAsync = promisify(brotliCompress)
const brotliDecompressAsync = promisify(brotliDecompress)

type CachedPayload = {
  body: any
  headers: Record<string, string>
  timestamp: number
}

/**
 * HTTP Cache middleware using Redis with Brotli compression.
 *
 * Caching strategy:
 * - Caches GET responses for CACHE_TTL_SECONDS
 * - Returns cached data if available (HIT)
 * - Cache is invalidated via SummonerUpdated events when data changes
 * - No background refresh (next() should only be called once per request)
 */
export default class HttpCacheMiddleware {
  async handle({ request, response }: HttpContext, next: () => Promise<void>) {
    if (env.get('NODE_ENV') === 'development') return next()
    if (request.method() !== 'GET') return next()

    const url = request.url(true)
    const cacheKey = `http_cache:${url}`

    const cached = await this.getFromCache(cacheKey)
    if (cached) {
      // Set cache headers from stored response
      Object.keys(cached.headers).forEach((key) => response.header(key, cached.headers[key]))
      response.header('X-Cache', 'HIT')
      response.header(
        'Cache-Control',
        `public, max-age=${CDN_MAX_AGE_SECONDS}, s-maxage=${CACHE_FRESH_TTL_SECONDS}`
      )

      return response.send(cached.body)
    }

    // Cache miss - execute handler and cache result
    response.header('X-Cache', 'MISS')
    await next()

    if (response.getStatus() !== 200) return

    const body = response.getBody()
    if (!body) return

    // Add cache headers
    response.header(
      'Cache-Control',
      `public, max-age=${CDN_MAX_AGE_SECONDS}, s-maxage=${CACHE_FRESH_TTL_SECONDS}`
    )

    // Cache the response
    await this.saveToCache(cacheKey, body, response.getHeaders() as Record<string, string>)

    // Track cache key for this puuid (for invalidation via SummonerUpdated event)
    const puuidMatch = url.match(/\/api\/summoners\/puuid\/([a-zA-Z0-9_-]+)/)
    if (puuidMatch?.[1]) {
      await redis.sadd(`summoner:${puuidMatch[1]}:cache_keys`, cacheKey)
    }
  }

  private async getFromCache(key: string): Promise<CachedPayload | null> {
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
      const payload: CachedPayload = {
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
