import { HttpContext } from '@adonisjs/core/http'

/**
 * Middleware to prevent browser caching of Inertia pages.
 *
 * This ensures that when a summoner is updated/synced, the frontend
 * will always fetch fresh data instead of serving stale browser cache.
 *
 * API endpoints are excluded as they have their own caching strategy.
 */
export default class NoCacheInertiaMiddleware {
  async handle({ request, response }: HttpContext, next: () => Promise<void>) {
    await next()

    // Only apply no-cache headers to non-API routes (Inertia pages)
    if (!request.url().startsWith('/api/')) {
      response.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      response.header('Pragma', 'no-cache')
      response.header('Expires', '0')
    }
  }
}
