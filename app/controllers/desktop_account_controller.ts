import type { HttpContext } from '@adonisjs/core/http'
import accountService from '#services/accounts/account_service'
import buildsService from '#services/builds/builds_service'
import { AccountError } from '#services/accounts/errors'
import rateLimiter from '#services/desktop/rate_limiter'
import { DesktopException } from '#exceptions/desktop_exception'
import { emptyAccount } from '../../inertia/lib/account_types.js'
import type DesktopDevice from '#models/desktop_device'
import type { SignedIn } from '#services/accounts/session_service'

/** Hourly limits per device (docs/desktop-sync.md §10, §14). */
const LIMITS = {
  pair: { bucket: 'account:pair:device', limit: 20 },
  read: { bucket: 'account:read:device', limit: 600 },
  change: { bucket: 'account:change:device', limit: 600 },
  verify: { bucket: 'account:verify:device', limit: 60 },
  builds: { bucket: 'account:builds:device', limit: 120 },
}

function device(ctx: HttpContext): DesktopDevice {
  if (!ctx.desktopDevice) throw DesktopException.unauthorized()
  return ctx.desktopDevice
}

async function limit(rule: (typeof LIMITS)[keyof typeof LIMITS], id: string) {
  const result = await rateLimiter.hit(rule.bucket, id, rule.limit)
  if (!result.allowed) throw DesktopException.rateLimited(result.retryAfter)
}

/** Account refusals keep their status and code, in the desktop routes' error shape (§1). */
async function run<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    if (error instanceof AccountError) {
      throw new DesktopException(error.message, error.status, error.code ?? 'E_ACCOUNT_INVALID')
    }
    throw error
  }
}

/** The Invade account this device is connected to; a 403 when it is not (never a 401). */
async function connected(current: DesktopDevice): Promise<SignedIn> {
  const user = await accountService.deviceUser(current.id)
  if (!user) throw AccountError.notConnected()
  return user
}

/**
 * The Invade account seen from the desktop app (docs/desktop-sync.md §10, §14): connecting the
 * app through the browser, the account it is connected to, the changes it makes, the proof of the
 * League account signed in to the client, and the account's builds. Signed like every desktop
 * route; no browser cookie or OAuth token ever reaches the app.
 */
export default class DesktopAccountController {
  /** A one-time link to open in the browser, where the person signs in and says yes. */
  async pair(ctx: HttpContext) {
    const current = device(ctx)
    await limit(LIMITS.pair, current.id)
    return ctx.response.created(await accountService.pair(current.id))
  }

  async show(ctx: HttpContext) {
    const current = device(ctx)
    await limit(LIMITS.read, current.id)
    ctx.response.header('Cache-Control', 'no-store')
    const user = await accountService.deviceUser(current.id)
    return ctx.response.ok(user ? await accountService.snapshot(user) : emptyAccount())
  }

  async change(ctx: HttpContext) {
    const current = device(ctx)
    await limit(LIMITS.change, current.id)
    return run(async () => {
      const user = await connected(current)
      const account = await accountService.change(user, ctx.request.input('ops'), 'app')
      ctx.response.header('Cache-Control', 'no-store')
      return ctx.response.ok(account)
    })
  }

  /** The League account the client is signed in to, proven by this app (§10.3). */
  async verify(ctx: HttpContext) {
    const current = device(ctx)
    await limit(LIMITS.verify, current.id)
    return run(async () => {
      const result = await accountService.verify(current.id, ctx.request.input('rawPuuid'), {
        auto: ctx.request.input('auto') === true,
      })
      ctx.response.header('Cache-Control', 'no-store')
      return ctx.response.ok(result)
    })
  }

  /** This app leaves the account; its device, games and local data stay. */
  async disconnect(ctx: HttpContext) {
    await accountService.disconnect(device(ctx).id)
    return ctx.response.noContent()
  }

  /** The account's builds: the app's own, then those saved from others (§14). */
  async builds(ctx: HttpContext) {
    const current = device(ctx)
    await limit(LIMITS.read, current.id)
    return run(async () => {
      const user = await connected(current)
      ctx.response.header('Cache-Control', 'no-store')
      return ctx.response.ok({ builds: await buildsService.ofAccount(user.id) })
    })
  }

  /** The app's whole set of builds: absent ones leave the account (§14). */
  async syncBuilds(ctx: HttpContext) {
    const current = device(ctx)
    await limit(LIMITS.builds, current.id)
    return run(async () => {
      const user = await connected(current)
      const builds = await buildsService.sync(user.id, ctx.request.body())
      ctx.response.header('Cache-Control', 'no-store')
      return ctx.response.ok({ builds })
    })
  }
}
