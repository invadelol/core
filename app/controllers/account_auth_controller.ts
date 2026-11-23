import { timingSafeEqual } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import sessionService, {
  SESSION_COOKIE,
  secureCookies,
  sessionCookieOptions,
} from '#services/accounts/session_service'
import {
  identify,
  safeNext,
  signInAvailable,
  startFlow,
  type OAuthFlow,
} from '#services/accounts/oauth'
import { FixedWindowLimiter } from '#services/desktop/rate_limiter'
import { sameOrigin } from '#controllers/account_controller'
import { track } from '#services/openpanel'
import moderation from '#services/moderation/moderation'

const FLOW_COOKIE = 'invade_oauth'
const limiter = new FixedWindowLimiter('account:rl:')

const flowCookieOptions = () => ({
  httpOnly: true,
  secure: secureCookies(),
  // Lax: Discord's redirect back is a top-level GET, which carries it.
  sameSite: 'lax' as const,
  path: '/auth',
  maxAge: 600,
})

const ERRORS = new Set(['expired', 'failed', 'unavailable', 'denied', 'busy', 'suspended'])

/**
 * Sign-in with Discord (app/services/accounts/oauth.ts): the page, the redirect to Discord, its
 * callback, and sign-out. A session is a random token in an HttpOnly cookie; the database keeps
 * only its hash.
 */
export default class AccountAuthController {
  /** The sign-in page; someone already signed in goes on to where they were heading. */
  async page({ inertia, request, response, invadeUser }: HttpContext) {
    const next = safeNext(request.input('next'))
    if (invadeUser) return response.redirect(next)
    const error = request.input('error')
    return inertia.render('account/signin', {
      next,
      error: typeof error === 'string' && ERRORS.has(error) ? error : null,
      available: signInAvailable(),
      robots: 'noindex, follow',
    })
  }

  async redirect({ request, response }: HttpContext) {
    const next = safeNext(request.input('next'))
    const allowed = await limiter.hit('signin:ip', request.ip(), 60)
    if (!allowed.allowed) return response.redirect(`/signin?error=busy`)
    const started = startFlow(next)
    if (!started) return response.redirect('/signin?error=unavailable')
    response.encryptedCookie(FLOW_COOKIE, started.flow, flowCookieOptions())
    return response.redirect(started.url)
  }

  async callback(ctx: HttpContext) {
    const { request, response } = ctx
    const flow = request.encryptedCookie(FLOW_COOKIE) as OAuthFlow | null
    response.clearCookie(FLOW_COOKIE, { path: '/auth' })
    const state = request.input('state')
    const code = request.input('code')
    if (request.input('error')) {
      // The person said no on Discord's page.
      return response.redirect('/signin?error=denied')
    }
    if (
      !flow ||
      flow.expires < Date.now() ||
      typeof state !== 'string' ||
      typeof code !== 'string' ||
      code.length > 512 ||
      state.length !== flow.state.length ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(flow.state))
    ) {
      return response.redirect('/signin?error=expired')
    }

    try {
      const person = await identify(code)
      const userId = await sessionService.signIn(person.subject, person.name)
      if (await moderation.suspended(userId)) return response.redirect('/signin?error=suspended')
      if (ctx.invadeUser?.id !== userId) {
        await sessionService.destroy(request.cookie(SESSION_COOKIE))
        const token = await sessionService.create(userId)
        response.cookie(SESSION_COOKIE, token, sessionCookieOptions())
      }
      track('account_signed_in', { provider: 'discord' }, { profileId: userId })
      return response.redirect(safeNext(flow.next))
    } catch (error) {
      logger.warn({ err: error }, 'sign-in failed')
      return response.redirect('/signin?error=failed')
    }
  }

  /**
   * Signs the browser out, then goes home, or on to `next` (the app's link page sends "This is
   * not me" to the sign-in, and back to the link).
   */
  async signout(ctx: HttpContext) {
    sameOrigin(ctx)
    await sessionService.destroy(ctx.request.cookie(SESSION_COOKIE))
    ctx.response.clearCookie(SESSION_COOKIE, { path: '/' })
    const next = ctx.request.input('next')
    return ctx.response.redirect(next ? safeNext(next) : '/')
  }
}
