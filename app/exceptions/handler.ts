import { RiotUpstreamException, unwrapCacheFactoryError } from '#utils/riot_errors'
import { DesktopException } from '#exceptions/desktop_exception'
import { payloadLimitOf } from '#middleware/body_parser_middleware'
import app from '@adonisjs/core/services/app'
import { HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import type { HttpError, StatusPageRange, StatusPageRenderer } from '@adonisjs/core/types/http'

/**
 * The desktop app reacts to a status and a code, never to prose, so its
 * routes answer every client error in one shape (docs/desktop-sync.md §1):
 * `{ errors: [{ message, code }], retryAfter? }`, with `Retry-After` on 429/503.
 * Upstream codes keep their meaning but take the statuses the app expects.
 */
function desktopError(
  error: any,
  url: string
): { status: number; body: Record<string, unknown> } | null {
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
    const limit = payloadLimitOf(url)
    const size = !limit
      ? '1 MB'
      : limit >= 1_000_000
        ? `${limit / 1_000_000} MB`
        : `${Math.round(limit / 1024)} KB`
    return reply(413, 'E_PAYLOAD_TOO_LARGE', `The request body is larger than ${size}`)
  }

  const status = Number(error?.status ?? error?.statusCode ?? 500)
  if (status === 404) return reply(404, 'E_SUMMONER_NOT_FOUND', 'Summoner not found')
  if (status >= 400 && status < 500) {
    // Malformed JSON, an unsupported platform and friends: the request is wrong.
    return reply(status, 'E_VALIDATION_ERROR', String(error?.message ?? 'Invalid request'))
  }
  return null
}

/**
 * What a refused desktop request is logged with: the code the app received
 * and, for a shape error, which fields failed which rule. Never the values:
 * an upload is full of Riot IDs and PUUIDs. Null for what is not a refusal
 * worth a line: 429 and 503 are the expected pauses, 5xx is reported anyway.
 */
export function desktopRefusal(
  error: any,
  url: string
): { status: number; code: string; reason?: string; fields?: string[] } | null {
  const reply = desktopError(error, url)
  if (!reply || reply.status < 400 || reply.status >= 500 || reply.status === 429) return null
  const errors = reply.body.errors as { code: string; field?: unknown; rule?: unknown }[]
  const code = errors[0]?.code ?? 'E_UNKNOWN'
  if (code === 'E_VALIDATION_ERROR' && Array.isArray(error?.messages)) {
    const fields = errors.map(
      (entry) => `${String(entry.field ?? '?')}: ${String(entry.rule ?? '?')}`
    )
    return { status: reply.status, code, fields: [...new Set(fields)].slice(0, 20) }
  }
  // Desktop exceptions are written by core and name no player (match_validation.ts).
  const reason = error instanceof DesktopException ? error.message : undefined
  return { status: reply.status, code, ...(reason ? { reason } : {}) }
}

/**
 * What an error page may say about the error: its status, and its message only when the app or
 * the framework wrote it for people (an `E_*` exception). Anything else (a driver, a TypeError)
 * can carry internals, so it stays in the log; stacks never leave the server.
 */
export function publicError(error: Partial<HttpError>) {
  const status = Number(error.status) || 500
  const authored = typeof error.code === 'string' && /^E_[A-Z_]+$/.test(error.code)
  return { status, message: authored && error.message ? error.message : null }
}

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * In production a missing or failed page answers with the site's own error page; the API keeps
   * its JSON errors (every request is made to accept JSON, see force_json_response_middleware).
   */
  protected renderStatusPages = app.inProduction

  protected statusPages: Record<StatusPageRange, StatusPageRenderer> = {
    '404': (error, ctx) => this.page('errors/not_found', error, ctx),
    '500..599': (error, ctx) => this.page('errors/server_error', error, ctx),
  }

  private page(component: string, error: HttpError, ctx: HttpContext) {
    if (ctx.request.url().startsWith('/api/')) return this.renderError(error, ctx)
    return ctx.inertia.render(component, { error: publicError(error) })
  }

  /**
   * The method is used for handling errors and returning
   * response to the client
   */
  async handle(error: unknown, ctx: HttpContext) {
    error = unwrapCacheFactoryError(error)
    if (ctx.request.url().startsWith('/api/desktop/')) {
      const reply = desktopError(error, ctx.request.url())
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
    // A refused desktop request is an outcome the app acts on, not a fault, but
    // without this line a broken app release fails silently (2026-10-19: almost
    // every upload was refused and nothing said why).
    if (ctx.request.url().startsWith('/api/desktop/')) {
      const refusal = desktopRefusal(error, ctx.request.url())
      if (refusal) {
        ctx.logger.warn(
          {
            ...refusal,
            route: `${ctx.request.method()} ${ctx.request.url()}`,
            device: ctx.desktopDevice?.id,
            app: ctx.desktopDevice?.app,
          },
          `desktop request refused: ${refusal.code}`
        )
        return
      }
    }
    // Expected outcomes the app acts on (rate limited, paused), not faults.
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
