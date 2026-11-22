import { timingSafeEqual } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import sessionService, {
  SESSION_COOKIE,
  secureCookies,
  sessionCookieOptions,
} from '#services/accounts/session_service'
import {
  availableProviders,
  identify,
  isProvider,
  safeNext,
  startFlow,
  type OAuthFlow,
} from '#services/accounts/oauth'
import { FixedWindowLimiter } from '#services/desktop/rate_limiter'
import { sameOrigin } from '#controllers/account_controller'
import { track } from '#services/openpanel'

const FLOW_COOKIE = 'invade_oauth'
const limiter = new FixedWindowLimiter('account:rl:')

const flowCookieOptions = () => ({
  httpOnly: true,
  secure: secureCookies(),
  // Lax: the provider's redirect back is a top-level GET, which carries it.
  sameSite: 'lax' as const,
  path: '/auth',
  maxAge: 600,
})

const ERRORS = new Set(['expired', 'failed', 'unavailable', 'denied', 'busy'])

/**
 * Sign-in with Discord or Google (app/services/accounts/oauth.ts): the page, the redirect to the
 * provider, its callback, and sign-out. A session is a random token in an HttpOnly cookie; the
 * database keeps only its hash.
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
      providers: availableProviders(),
      robots: 'noindex, follow',
    })
  }

  async redirect({ params, request, response }: HttpContext) {
    if (!isProvider(params.provider)) return response.notFound()
    const next = safeNext(request.input('next'))
    const allowed = await limiter.hit('signin:ip', request.ip(), 60)
    if (!allowed.allowed) return response.redirect(`/signin?error=busy`)
    const started = startFlow(params.provider, next)
    if (!started) return response.redirect('/signin?error=unavailable')
    response.encryptedCookie(FLOW_COOKIE, started.flow, flowCookieOptions())
    return response.redirect(started.url)
  }

  async callback(ctx: HttpContext) {
    const { params, request, response } = ctx
    if (!isProvider(params.provider)) return response.notFound()
    const flow = request.encryptedCookie(FLOW_COOKIE) as OAuthFlow | null
    response.clearCookie(FLOW_COOKIE, { path: '/auth' })
    const state = request.input('state')
    const code = request.input('code')
    if (request.input('error')) {
      // The person said no on the provider's page.
      return response.redirect('/signin?error=denied')
    }
    if (
      !flow ||
      flow.provider !== params.provider ||
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
      const person = await identify(flow, code)
      const result = await sessionService.signIn(
        flow.provider,
        person.subject,
        person.name,
        ctx.invadeUser
      )
      if (result.taken) {
        // Signed in already, with a provider account that belongs to someone else: nothing moves.
        return response.redirect('/account?error=taken')
      }
      if (!ctx.invadeUser || ctx.invadeUser.id !== result.userId) {
        await sessionService.destroy(request.cookie(SESSION_COOKIE))
        const token = await sessionService.create(result.userId)
        response.cookie(SESSION_COOKIE, token, sessionCookieOptions())
      }
      track('account_signed_in', { provider: flow.provider }, { profileId: result.userId })
      return response.redirect(safeNext(flow.next))
    } catch (error) {
      logger.warn({ err: error, provider: flow.provider }, 'sign-in failed')
      return response.redirect('/signin?error=failed')
    }
  }

  async signout(ctx: HttpContext) {
    sameOrigin(ctx)
    await sessionService.destroy(ctx.request.cookie(SESSION_COOKIE))
    ctx.response.clearCookie(SESSION_COOKIE, { path: '/' })
    return ctx.response.redirect('/')
  }
}
