import { createHash } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type DesktopDevice from '#models/desktop_device'
import deviceService from '#services/desktop/device_service'
import replayGuard, { verifySignature } from '#services/desktop/signing'
import { bearerToken } from '#services/desktop/tokens'
import { DesktopException } from '#exceptions/desktop_exception'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    /** The desktop app behind `Authorization: Bearer inv_dev_…`, when there is one. */
    desktopDevice?: DesktopDevice
  }
}

/**
 * The path and query exactly as the request line carried them: what the app
 * signed. An absolute-form target (`http://host/path`) is reduced to its path.
 */
function requestTarget(ctx: HttpContext) {
  const target = ctx.request.request.url ?? '/'
  return target.startsWith('/') ? target : target.replace(/^[a-z]+:\/\/[^/]*/i, '') || '/'
}

/**
 * Hash of the raw body, from the body parser when it ran (every desktop
 * route); otherwise from the text it kept, which is the same bytes for any
 * UTF-8 body.
 */
async function bodyHash(ctx: HttpContext) {
  if (ctx.desktopBodyDigest) return ctx.desktopBodyDigest
  return createHash('sha256')
    .update(ctx.request.raw() ?? '', 'utf8')
    .digest('hex')
}

/**
 * Authenticates the desktop app (docs/desktop-sync.md §1, §1.1): the device
 * token says who, the signature proves the request came from the device
 * that holds the secret and was neither altered nor sent before.
 *
 * `optional` lets a request through without a token (onboarding before the
 * player opted in to publishing), but a token that is present must be valid
 * and signed: answering 401 is what makes the app drop a revoked token and
 * register again. Nothing here logs the token, the secret or the signature.
 */
export default class DesktopAuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: { optional?: boolean } = {}) {
    const header = ctx.request.header('authorization')
    if (!header && options.optional) return next()

    const token = bearerToken(header)
    const device = token ? await deviceService.authenticate(token) : null
    if (!device) throw DesktopException.unauthorized()

    // A device from before signing has nothing to sign with: it registers again.
    const secret = deviceService.secretOf(device)
    if (!secret) throw DesktopException.unauthorized()

    const signature = ctx.request.header('x-invade-signature')
    const verdict = verifySignature({
      secret,
      timestamp: ctx.request.header('x-invade-timestamp'),
      signature,
      method: ctx.request.method(),
      path: requestTarget(ctx),
      bodyHash: await bodyHash(ctx),
      now: Date.now(),
    })
    if (verdict === 'skew') throw DesktopException.clockSkew()
    if (verdict !== 'ok') throw DesktopException.badSignature()
    // Only a valid signature is remembered, so nobody can fill the cache with guesses.
    if (!(await replayGuard.firstUse(signature!))) throw DesktopException.replay()

    await deviceService.touch(device)
    ctx.desktopDevice = device
    return next()
  }
}
