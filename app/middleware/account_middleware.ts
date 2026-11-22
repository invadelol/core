import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import logger from '@adonisjs/core/services/logger'
import sessionService, { SESSION_COOKIE, type SignedIn } from '#services/accounts/session_service'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    /** The signed-in person (an Invade account), when the session cookie checks out. */
    invadeUser: SignedIn | null
  }
}

/**
 * Reads the session cookie on every routed request. Only requests that carry one cost a query;
 * the desktop app's routes never do (they are signed by the device instead).
 */
export default class AccountMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    ctx.invadeUser = null
    const token = ctx.request.cookie(SESSION_COOKIE)
    if (token && !ctx.request.url().startsWith('/api/desktop/')) {
      try {
        ctx.invadeUser = await sessionService.authenticate(token)
      } catch (error) {
        // The database being down signs nobody in; the page still renders for everyone.
        logger.warn({ err: error }, 'account session lookup failed')
      }
    }
    return next()
  }
}
