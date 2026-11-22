import type { HttpContext } from '@adonisjs/core/http'
import accountService from '#services/accounts/account_service'
import { AccountError } from '#services/accounts/errors'
import rateLimiter from '#services/desktop/rate_limiter'
import { DesktopException } from '#exceptions/desktop_exception'
import { emptyAccount, type AccountChange } from '../../inertia/lib/account_types.js'
import type DesktopDevice from '#models/desktop_device'

/** Hourly limits per device (docs/desktop-sync.md §10). */
const LIMITS = {
  pair: { bucket: 'account:pair:device', limit: 20 },
  read: { bucket: 'account:read:device', limit: 600 },
  change: { bucket: 'account:change:device', limit: 600 },
  verify: { bucket: 'account:verify:device', limit: 60 },
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

/**
 * The Invade account seen from the desktop app (docs/desktop-sync.md §10): connecting the app
 * through the browser, the account it is connected to, the same changes the site makes, and the
 * proof of the League account signed in to the client. Signed like every desktop route; no
 * browser cookie or OAuth token ever reaches the app.
 */
export default class DesktopAccountController {
  /** A link to open in the browser, where the person signs in and approves this app. */
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
      const user = await accountService.deviceUser(current.id)
      if (!user) throw AccountError.notConnected()
      const body = ctx.request.body() as AccountChange & {
        gameName?: string
        tagLine?: string
        platform?: string
      }
      // The app may know a player only by the client's raw PUUID or by Riot ID: favorites are
      // stored against the API PUUID, as on the site.
      // Only a new favorite may look a stranger up (one Riot call); a removal of a player Invade
      // does not hold is already done.
      if (body?.type === 'favorite' || body?.type === 'moveFavorite') {
        body.puuid = await accountService.resolveProfile(body, { lookup: body.type === 'favorite' })
      } else if (body?.type === 'removeFavorite') {
        try {
          body.puuid = await accountService.resolveProfile(body, { lookup: false })
        } catch (error) {
          if (!(error instanceof AccountError) || error.status !== 404) throw error
          return ctx.response.ok(await accountService.snapshot(user))
        }
      }
      ctx.response.header('Cache-Control', 'no-store')
      return ctx.response.ok(await accountService.change(user, body))
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
}
