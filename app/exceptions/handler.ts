import { RiotUpstreamException, unwrapCacheFactoryError } from '#utils/riot_errors'
import app from '@adonisjs/core/services/app'
import { HttpContext, ExceptionHandler } from '@adonisjs/core/http'

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
