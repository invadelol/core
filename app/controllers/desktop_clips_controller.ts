import type { HttpContext } from '@adonisjs/core/http'
import accountService from '#services/accounts/account_service'
import clipService from '#services/clips/clip_service'
import { notificationsOf } from '#services/clips/notifications'
import { AccountError } from '#services/accounts/errors'
import rateLimiter from '#services/desktop/rate_limiter'
import { DesktopException } from '#exceptions/desktop_exception'
import type { SignedIn } from '#services/accounts/session_service'

/** Hourly limits per device (docs/desktop-sync.md §11, §12). */
const LIMITS = {
  create: { bucket: 'clips:create:device', limit: 30 },
  complete: { bucket: 'clips:complete:device', limit: 60 },
  read: { bucket: 'clips:read:device', limit: 300 },
  notifications: { bucket: 'clips:notifications:device', limit: 1200 },
}

/** The connected person, or `E_NOT_CONNECTED`; account refusals keep their status and code. */
async function run<T>(
  ctx: HttpContext,
  rule: (typeof LIMITS)[keyof typeof LIMITS],
  work: (user: SignedIn) => Promise<T>
) {
  if (!ctx.desktopDevice) throw DesktopException.unauthorized()
  const allowed = await rateLimiter.hit(rule.bucket, ctx.desktopDevice.id, rule.limit)
  if (!allowed.allowed) throw DesktopException.rateLimited(allowed.retryAfter)
  try {
    const user = await accountService.deviceUser(ctx.desktopDevice.id)
    if (!user) throw AccountError.notConnected()
    return await work(user)
  } catch (error) {
    if (error instanceof AccountError) {
      throw new DesktopException(error.message, error.status, error.code ?? 'E_ACCOUNT_INVALID')
    }
    throw error
  }
}

/**
 * Posting clips from the desktop app (docs/desktop-sync.md §11): the clip's details (one clip
 * per game: another one asks to replace it), the files sent straight to the storage on the
 * addresses given, then complete; the person's clips; deletion; and what happened around them
 * (§12).
 */
export default class DesktopClipsController {
  async create(ctx: HttpContext) {
    return run(ctx, LIMITS.create, async (user) => {
      const result = await clipService.create(user, ctx.request.body() as never)
      if ('existing' in result) {
        const message =
          'This game already has a clip of yours online. Post with replace to swap it.'
        return ctx.response.conflict({
          code: 'E_CLIP_EXISTS',
          errors: [{ message, code: 'E_CLIP_EXISTS' }],
          existing: result.existing,
        })
      }
      return ctx.response.created(result)
    })
  }

  async complete(ctx: HttpContext) {
    return run(ctx, LIMITS.complete, async (user) => {
      const clip = await clipService.complete(user, ctx.params.id)
      return ctx.response.ok({ ...clip, status: 'ready' })
    })
  }

  async index(ctx: HttpContext) {
    return run(ctx, LIMITS.read, async (user) => {
      ctx.response.header('Cache-Control', 'no-store')
      return ctx.response.ok({ clips: await clipService.mine(user) })
    })
  }

  async destroy(ctx: HttpContext) {
    return run(ctx, LIMITS.create, async (user) => {
      await clipService.remove(user, ctx.params.id)
      return ctx.response.noContent()
    })
  }

  async notifications(ctx: HttpContext) {
    return run(ctx, LIMITS.notifications, async (user) => {
      ctx.response.header('Cache-Control', 'no-store')
      return ctx.response.ok(await notificationsOf(user.id, ctx.request.input('after')))
    })
  }
}
