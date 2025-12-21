import { HttpContext } from '@adonisjs/core/http'
import redis from '@adonisjs/redis/services/main'

export default class HttpCacheMiddleware {
  async handle({ request, response }: HttpContext, next: () => Promise<void>) {
    if (request.method() !== 'GET') return next()

    const url = request.url(true)
    const cacheKey = `http_cache:${url}`

    const cached = await redis.get(cacheKey)
    if (cached) {
      const { body, headers } = JSON.parse(cached)
      Object.keys(headers).forEach((key) => response.header(key, headers[key]))
      return response.send(body)
    }

    await next()

    if (response.getStatus() !== 200) return

    const body = response.getBody()
    if (!body) return

    const payload = JSON.stringify({ body, headers: response.getHeaders() })
    await redis.setex(cacheKey, 3600, payload)

    const puuidMatch = url.match(/\/summoners\/([a-zA-Z0-9_-]+)/)
    if (!puuidMatch?.[1]) return

    await redis.sadd(`summoner:${puuidMatch[1]}:cache_keys`, cacheKey)
  }
}
