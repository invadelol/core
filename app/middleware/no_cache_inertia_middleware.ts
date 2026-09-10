import { HttpContext } from '@adonisjs/core/http'

/**
 * Middleware to prevent browser caching of Inertia pages.
 *
 * This ensures that when a summoner is updated/synced, the frontend
 * will always fetch fresh data instead of serving stale browser cache.
 *
 * API endpoints are excluded as they have their own caching strategy, and so
 * is the asset proxy, whose whole purpose is long-lived browser caching.
 */
export default class NoCacheInertiaMiddleware {
  async handle({ request, response }: HttpContext, next: () => Promise<void>) {
    await next()

    // Only apply no-cache headers to Inertia pages
    const url = request.url()
    if (!url.startsWith('/api/') && !url.startsWith('/cdn/')) {
      response.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      response.header('Pragma', 'no-cache')
      response.header('Expires', '0')
    }
  }
}
