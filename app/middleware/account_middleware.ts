import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { authenticate, type AccountUser } from '#services/accounts/service'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    invadeUser: AccountUser | null
  }
}
export default class AccountMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const token = ctx.request.cookie('invade_session')
    ctx.invadeUser = typeof token === 'string' ? await authenticate(token) : null
    if (token) ctx.response.header('Cache-Control', 'private, no-store')
    return next()
  }
}
