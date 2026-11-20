import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/** Only invade.lol is for search: preproduction and any other host tell crawlers to stay out. */
const INDEXED = new Set(['invade.lol', 'www.invade.lol'])

export default class PreviewNoindexMiddleware {
  async handle({ request, response }: HttpContext, next: NextFn) {
    await next()
    const host = (request.hostname() ?? '').toLowerCase()
    if (!INDEXED.has(host)) response.header('X-Robots-Tag', 'noindex, nofollow')
  }
}
