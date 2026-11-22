import type { HttpContext } from '@adonisjs/core/http'
import accountService from '#services/accounts/account_service'
import clipService from '#services/clips/clip_service'
import { AccountError } from '#services/accounts/errors'
import rateLimiter from '#services/desktop/rate_limiter'
import { DesktopException } from '#exceptions/desktop_exception'

/** Hourly limits per device (docs/desktop-sync.md §11). */
const LIMITS = {
  create: { bucket: 'clips:create:device', limit: 30 },
  file: { bucket: 'clips:file:device', limit: 60 },
  read: { bucket: 'clips:read:device', limit: 300 },
}

async function limit(rule: (typeof LIMITS)[keyof typeof LIMITS], id: string) {
  const result = await rateLimiter.hit(rule.bucket, id, rule.limit)
  if (!result.allowed) throw DesktopException.rateLimited(result.retryAfter)
}

/** The connected person, or `E_NOT_CONNECTED`; account refusals keep their status and code. */
async function run<T>(
  ctx: HttpContext,
  rule: (typeof LIMITS)[keyof typeof LIMITS],
  work: (user: { id: string; name: string }) => Promise<T>
) {
  if (!ctx.desktopDevice) throw DesktopException.unauthorized()
  await limit(rule, ctx.desktopDevice.id)
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
 * Posting clips from the desktop app (docs/desktop-sync.md §11): the clip's details, then its
 * video and its picture as they are on disk, each a signed request; the person's clips; deletion.
 */
export default class DesktopClipsController {
  async create(ctx: HttpContext) {
    return run(ctx, LIMITS.create, async (user) =>
      ctx.response.created(await clipService.create(user, ctx.request.body() as never))
    )
  }

  async video(ctx: HttpContext) {
    return run(ctx, LIMITS.file, async (user) =>
      ctx.response.ok(
        await clipService.putVideo(user, ctx.params.id, ctx.desktopRawBody ?? Buffer.alloc(0))
      )
    )
  }

  async poster(ctx: HttpContext) {
    return run(ctx, LIMITS.file, async (user) =>
      ctx.response.ok(
        await clipService.putPoster(user, ctx.params.id, ctx.desktopRawBody ?? Buffer.alloc(0))
      )
    )
  }

  async index(ctx: HttpContext) {
    return run(ctx, LIMITS.read, async (user) => {
      ctx.response.header('Cache-Control', 'no-store')
      return ctx.response.ok({ clips: await clipService.ofUser(user) })
    })
  }

  async destroy(ctx: HttpContext) {
    return run(ctx, LIMITS.create, async (user) => {
      await clipService.remove(user, ctx.params.id)
      return ctx.response.noContent()
    })
  }
}
