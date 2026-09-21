import { HttpContext } from '@adonisjs/core/http'

/**
 * Keeps Inertia pages from being reused without asking us first.
 *
 * The goal is that a synced summoner never renders from a stale copy.
 * `no-cache` achieves exactly that: the browser may store the page but has to
 * revalidate before reusing it, so an update is always picked up.
 *
 * It deliberately does *not* say `no-store`. That directive additionally
 * evicts the page from the back/forward cache, so every Back press re-fetched
 * the HTML, re-booted Vue and re-issued all six analytics requests instead of
 * restoring the page as it was. Freshness never needed that, and the
 * instant-Back behaviour is worth a great deal more.
 *
 * API endpoints are excluded as they have their own caching strategy, and so
 * is the asset proxy, whose whole purpose is long-lived browser caching.
 */
export default class NoCacheInertiaMiddleware {
  async handle({ request, response }: HttpContext, next: () => Promise<void>) {
    await next()

    const url = request.url()
    if (
      !url.startsWith('/api/') &&
      !url.startsWith('/cdn/') &&
      !url.startsWith('/og/') &&
      url !== '/sitemap.xml' &&
      url !== '/robots.txt'
    ) {
      response.header('Cache-Control', 'private, no-cache, must-revalidate')
    }
  }
}
