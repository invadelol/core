import type { HttpContext } from '@adonisjs/core/http'
import collectionService from '#services/skins/collection_service'
import rateLimiter from '#services/desktop/rate_limiter'
import { AccountError } from '#services/accounts/errors'
import { DesktopException } from '#exceptions/desktop_exception'
import { collectionValidator } from '#validators/collection'

/** Collection reads per device and hour: one per League client sign-in, with room for retries. */
const LIMIT = { bucket: 'collection:device', limit: 60 }

/**
 * `PUT /api/desktop/collection` (docs/desktop-sync.md §13): the skins the League client says a
 * proven League account owns, as the app just read them. Signed like every desktop route.
 */
export default class DesktopCollectionController {
  async replace(ctx: HttpContext) {
    const device = ctx.desktopDevice
    if (!device) throw DesktopException.unauthorized()
    const limited = await rateLimiter.hit(LIMIT.bucket, device.id, LIMIT.limit)
    if (!limited.allowed) throw DesktopException.rateLimited(limited.retryAfter)
    const read = await ctx.request.validateUsing(collectionValidator)
    try {
      await collectionService.replace(device.id, read)
    } catch (error) {
      // Account refusals keep their status and code, in the desktop routes' shape (§1).
      if (error instanceof AccountError) {
        throw new DesktopException(error.message, error.status, error.code ?? 'E_ACCOUNT_INVALID')
      }
      throw error
    }
    return ctx.response.noContent()
  }
}
