import type { HttpContext } from '@adonisjs/core/http'
import accountService from '#services/accounts/account_service'
import savedService from '#services/social/saved'
import sessionService, { SESSION_COOKIE, accountOrigin } from '#services/accounts/session_service'
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

export function signedIn(ctx: HttpContext) {
  if (!ctx.invadeUser) throw AccountError.signedOut()
  return ctx.invadeUser
}

/** Counts a person's writes in a bucket, an hour at a time. */
export async function limit(bucket: string, id: string, max: number) {
  const result = await limiter.hit(bucket, id, max)
  if (!result.allowed) throw AccountError.rateLimited(result.retryAfter)
}

/** Where a signed-out visitor goes to sign in, and comes back to this page after. */
const signInFirst = (ctx: HttpContext) =>
  ctx.response.redirect(`/signin?next=${encodeURIComponent(ctx.request.url(true))}`)

/**
 * The signed-in person's account on the site: their Favorites and their settings (both private),
 * the page a desktop app's link opens, and the JSON routes they use. Every answer is private and
 * never cached.
 */
export default class AccountController {
  /** `/account`: the Favorites tab, the clips and matches the person keeps. */
  async favorites(ctx: HttpContext) {
    if (!ctx.invadeUser) return signInFirst(ctx)
    const [account, saved] = await Promise.all([
      accountService.snapshot(ctx.invadeUser),
      savedService.list(ctx.invadeUser.id),
    ])
    return ctx.inertia.render('account/favorites', {
      account,
      saved,
      robots: 'noindex, nofollow',
    })
  }

  /** `/account/settings`: League accounts, sign-in, privacy, desktop apps, deletion. */
  async settings(ctx: HttpContext) {
    if (!ctx.invadeUser) return signInFirst(ctx)
    return ctx.inertia.render('account/settings', {
      account: await accountService.snapshot(ctx.invadeUser),
      robots: 'noindex, nofollow',
    })
  }

  /** `/account/link/:code`: the desktop app opened this to connect itself (§10.1). */
  async linkPage(ctx: HttpContext) {
    if (!ctx.invadeUser) return signInFirst(ctx)
    return ctx.inertia.render('account/link', {
      code: String(ctx.params.code),
      pairing: await accountService.pairing(ctx.params.code, ctx.invadeUser),
      account: await accountService.viewer(ctx.invadeUser),
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
    return ctx.response.ok(await accountService.change(user, ctx.request.input('ops'), 'site'))
  }

  async approve(ctx: HttpContext) {
    sameOrigin(ctx)
    const user = signedIn(ctx)
    await limit('approve:user', user.id, 20)
    await accountService.approve(user, ctx.request.input('code'))
    return ctx.response.noContent()
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
