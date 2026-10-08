import { RiotUpstreamException, unwrapCacheFactoryError } from '#utils/riot_errors'
import { DesktopException } from '#exceptions/desktop_exception'
import app from '@adonisjs/core/services/app'
import { HttpContext, ExceptionHandler } from '@adonisjs/core/http'

/**
 * The desktop app reacts to a status and a code, never to prose, so its
 * routes answer every client error in one shape (docs/desktop-sync.md §1):
 * `{ errors: [{ message, code }], retryAfter? }`, with `Retry-After` on 429/503.
 * Upstream codes keep their meaning but take the statuses the app expects.
 */
function desktopError(error: any): { status: number; body: Record<string, unknown> } | null {
  const reply = (status: number, code: string, message: string, retryAfter?: number) => ({
    status,
    body: {
      errors: [{ message, code }],
      ...(retryAfter ? { retryAfter } : {}),
    },
  })

  if (error instanceof DesktopException) {
    return reply(error.status, error.code!, error.message, error.retryAfter)
  }
  if (error instanceof RiotUpstreamException) {
    if (error.code === 'E_RIOT_RATE_LIMITED') {
      return reply(429, error.code, error.message, error.retryAfter ?? 60)
    }
    // A rejected key is an outage from the app's point of view.
    return reply(503, 'E_RIOT_UNAVAILABLE', 'Riot API is unavailable', error.retryAfter ?? 300)
  }
  if (error?.code === 'E_VALIDATION_ERROR' && Array.isArray(error.messages)) {
    return {
      status: 422,
      body: {
        errors: error.messages.map((entry: Record<string, unknown>) => ({
          ...entry,
          code: 'E_VALIDATION_ERROR',
        })),
      },
    }
  }
  if (error?.code === 'E_REQUEST_ENTITY_TOO_LARGE') {
    return reply(413, 'E_PAYLOAD_TOO_LARGE', 'The upload is larger than 2 MB')
  }

  const status = Number(error?.status ?? error?.statusCode ?? 500)
  if (status === 404) return reply(404, 'E_SUMMONER_NOT_FOUND', 'Summoner not found')
  if (status >= 400 && status < 500) {
    // Malformed JSON, an unsupported platform and friends: the request is wrong.
    return reply(status, 'E_VALIDATION_ERROR', String(error?.message ?? 'Invalid request'))
  }
  return null
}

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * The method is used for handling errors and returning
   * response to the client
   */
  async handle(error: unknown, ctx: HttpContext) {
    error = unwrapCacheFactoryError(error)
    if (ctx.request.url().startsWith('/api/desktop/')) {
      const reply = desktopError(error)
      if (reply) {
        const retryAfter = reply.body.retryAfter
        if (retryAfter) ctx.response.header('Retry-After', String(retryAfter))
        return ctx.response.status(reply.status).send(reply.body)
      }
    }
    if (error instanceof RiotUpstreamException) {
      if (error.retryAfter) ctx.response.header('Retry-After', String(error.retryAfter))
      return ctx.response.status(error.status).send({
        errors: [{ message: error.message, code: error.code }],
        ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
      })
    }
    return super.handle(error, ctx)
  }

  /**
   * The method is used to report error to the logging service or
   * the third party error monitoring service.
   *
   * @note You should not attempt to send a response from this method.
   */
  async report(error: unknown, ctx: HttpContext) {
    error = unwrapCacheFactoryError(error)
    // Expected outcomes the app acts on (bad token, not linked, paused), not faults.
    if (error instanceof DesktopException) return
    // The default report writes only the message, which in production reads
    // as a bare "Internal server error" with nothing to act on. Anything that
    // reached here uncaught is worth a full line: where it happened, what the
    // upstream said, and the stack.
    if (error instanceof RiotUpstreamException) {
      ctx.logger.warn(
        {
          code: error.code,
          upstreamStatus: error.upstreamStatus,
          retryAfter: error.retryAfter,
          method: ctx.request.method(),
          url: ctx.request.url(),
        },
        error.message
      )
      return
    }
    const err = error as any
    const status = Number(err?.status ?? err?.statusCode ?? 500)

    if (status >= 500) {
      ctx.logger.error(
        {
          err,
          status,
          code: err?.code,
          method: ctx.request.method(),
          url: ctx.request.url(true),
          // Riot's client attaches the upstream response; it explains most
          // 500s here (429 rate limit, 403 expired key).
          upstreamStatus: err?.response?.status ?? err?.status,
          upstreamBody: err?.response?.data ?? err?.body,
        },
        `Unhandled ${status} on ${ctx.request.method()} ${ctx.request.url()}`
      )
      return
    }

    return super.report(error, ctx)
  }
}
