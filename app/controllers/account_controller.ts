import type { HttpContext } from '@adonisjs/core/http'
import accountService from '#services/accounts/account_service'
import sessionService, { SESSION_COOKIE, accountOrigin } from '#services/accounts/session_service'
import { availableProviders } from '#services/accounts/oauth'
import { AccountError } from '#services/accounts/errors'
import { FixedWindowLimiter } from '#services/desktop/rate_limiter'

const limiter = new FixedWindowLimiter('account:rl:')

/**
 * A browser write must come from the site itself: the session cookie is `SameSite=Lax`, and the
 * `Origin` header of a POST says where the page that sent it lives.
 */
export function sameOrigin(ctx: HttpContext) {
  const origin = ctx.request.header('origin')
  if (origin !== accountOrigin()) throw AccountError.foreignOrigin()
}

function signedIn(ctx: HttpContext) {
  if (!ctx.invadeUser) throw AccountError.signedOut()
  return ctx.invadeUser
}

async function limit(bucket: string, id: string, max: number) {
  const result = await limiter.hit(bucket, id, max)
  if (!result.allowed) throw AccountError.rateLimited(result.retryAfter)
}

/**
 * The signed-in person's account on the site: the account page, the page a desktop app's link
 * opens, and the JSON routes both use. Every answer is private and never cached.
 */
export default class AccountController {
  async page(ctx: HttpContext) {
    if (!ctx.invadeUser) return ctx.response.redirect('/signin?next=/account')
    const error = ctx.request.input('error')
    const { default: clipService, CLIP_LIMITS } = await import('#services/clips/clip_service')
    return ctx.inertia.render('account/account', {
      account: await accountService.snapshot(ctx.invadeUser),
      clips: await clipService.ofUser(ctx.invadeUser),
      clipLimit: CLIP_LIMITS.perAccount,
      providers: availableProviders(),
      error: error === 'taken' ? error : null,
      robots: 'noindex, nofollow',
    })
  }

  /** `/account/link/:code`: the desktop app opened this to connect itself (§10.1). */
  async linkPage(ctx: HttpContext) {
    const code = ctx.params.code
    if (!ctx.invadeUser) {
      return ctx.response.redirect(`/signin?next=${encodeURIComponent(`/account/link/${code}`)}`)
    }
    return ctx.inertia.render('account/link', {
      code,
      pairing: await accountService.pairing(code, ctx.invadeUser),
      robots: 'noindex, nofollow',
    })
  }

  async show(ctx: HttpContext) {
    ctx.response.header('Cache-Control', 'no-store')
    return ctx.response.ok(await accountService.snapshot(signedIn(ctx)))
  }

  async change(ctx: HttpContext) {
    sameOrigin(ctx)
    const user = signedIn(ctx)
    await limit('changes:user', user.id, 600)
    ctx.response.header('Cache-Control', 'no-store')
    return ctx.response.ok(await accountService.change(user, ctx.request.body() as never))
  }

  async approve(ctx: HttpContext) {
    sameOrigin(ctx)
    const user = signedIn(ctx)
    await limit('approve:user', user.id, 20)
    ctx.response.header('Cache-Control', 'no-store')
    return ctx.response.ok(await accountService.approve(user, ctx.request.input('code')))
  }

  /** Deletes the account for good; the browser is signed out. */
  async destroy(ctx: HttpContext) {
    sameOrigin(ctx)
    const user = signedIn(ctx)
    if (ctx.request.input('confirm') !== 'delete') {
      throw AccountError.invalid('Confirm to delete your account.')
    }
    await accountService.remove(user)
    await sessionService.destroy(ctx.request.cookie(SESSION_COOKIE))
    ctx.response.clearCookie(SESSION_COOKIE, { path: '/' })
    return ctx.response.noContent()
  }
}
