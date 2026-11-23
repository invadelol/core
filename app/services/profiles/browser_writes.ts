import type { HttpContext } from '@adonisjs/core/http'
import { AccountError } from '#services/accounts/errors'
import { accountOrigin, type SignedIn } from '#services/accounts/session_service'
import { FixedWindowLimiter } from '#services/desktop/rate_limiter'

/** Profile and skin writes per person and hour: generous for a person, a wall for a script. */
export const WRITES_PER_HOUR = 600

export const writeLimiter = new FixedWindowLimiter('profile:rl:')

/**
 * The person behind a browser write on their profile or on skins: signed in, from the site's own
 * origin (the session cookie is `SameSite=Lax`; `Origin` says where the sending page lives), and
 * within the hourly limit. Answers are private.
 */
export async function browserWriter(ctx: HttpContext): Promise<SignedIn> {
  if (ctx.request.header('origin') !== accountOrigin()) throw AccountError.foreignOrigin()
  if (!ctx.invadeUser) throw AccountError.signedOut()
  const result = await writeLimiter.hit('writes:user', ctx.invadeUser.id, WRITES_PER_HOUR)
  if (!result.allowed) throw AccountError.rateLimited(result.retryAfter)
  ctx.response.header('Cache-Control', 'no-store')
  return ctx.invadeUser
}
