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

export default class HttpCacheMiddleware {
  async handle({ request, response }: HttpContext, next: () => Promise<void>) {
    if (env.get('NODE_ENV') === 'development') return next()
    if (request.method() !== 'GET') return next()

    const url = request.url(true)
    const cacheKey = `http_cache:${url}`

    const cached = await this.getFromCache(cacheKey)
    if (cached) {
      const age = Date.now() - cached.timestamp
      const stale = age > CACHE_FRESH_TTL_SECONDS * 1000

      // Set cache headers
      Object.keys(cached.headers).forEach((key) => response.header(key, cached.headers[key]))
      response.header('X-Cache', stale ? 'STALE' : 'HIT')
      response.header(
        'Cache-Control',
        `public, max-age=${CDN_MAX_AGE_SECONDS}, s-maxage=${CACHE_FRESH_TTL_SECONDS}`
      )

      if (stale) {
        this.refreshInBackground(request, response, next, cacheKey, url).catch(() => {})
      }

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

    // Track cache key for this puuid (for invalidation)
    const puuidMatch = url.match(/\/summoners\/puuid\/([a-zA-Z0-9_-]+)/)
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

  private async refreshInBackground(
    _request: HttpContext['request'],
    _response: HttpContext['response'],
    next: () => Promise<void>,
    cacheKey: string,
    url: string
  ): Promise<void> {
    try {
      // Execute handler to refresh data
      await next()

      // If we got a response body, update the cache
      const body = _response.getBody()
      if (!body) {
        return
      }

      await this.saveToCache(cacheKey, body, _response.getHeaders() as Record<string, string>)

      // Update cache key tracking
      const puuidMatch = url.match(/\/summoners\/puuid\/([a-zA-Z0-9_-]+)/)
      if (puuidMatch?.[1]) {
        await redis.sadd(`summoner:${puuidMatch[1]}:cache_keys`, cacheKey)
      }
    } catch {}
  }
}
