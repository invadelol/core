import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * A request refused by a quota (`riot_quota.ts`) before it reached Riot: 429 with `Retry-After`,
 * in the API's error shape (`{ errors: [{ message, code }], retryAfter }`). `scope` says whose
 * quota ran out: the client's address, or the player asked about.
 */
export class TooManyRequestsException extends Exception {
  static status = 429
  static code = 'E_TOO_MANY_REQUESTS'

  constructor(
    public retryAfter: number,
    public scope: 'address' | 'player'
  ) {
    super(
      scope === 'player'
        ? 'This player was asked for too often, try again later'
        : 'Too many requests from this address, try again later',
      { status: 429, code: 'E_TOO_MANY_REQUESTS' }
    )
  }

  async handle(error: this, ctx: HttpContext) {
    ctx.response.header('Retry-After', String(error.retryAfter))
    ctx.response.header('Cache-Control', 'no-store')
    return ctx.response.status(429).send({
      errors: [{ message: error.message, code: error.code }],
      retryAfter: error.retryAfter,
      scope: error.scope,
    })
  }

  /** An expected answer, counted by the quota itself rather than logged one by one. */
  async report() {}
}
