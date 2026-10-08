import type { IncomingMessage } from 'node:http'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import app from '@adonisjs/core/services/app'
import BodyParserMiddleware from '@adonisjs/core/bodyparser_middleware'
import type { BodyParserConfig } from '@adonisjs/core/types/bodyparser'

/** Largest game upload the desktop app may send (docs/desktop-sync.md §2.5). */
export const DESKTOP_MAX_PAYLOAD_BYTES = 2_000_000

/** Routes allowed the larger JSON limit; every other route keeps the default 1 MB. */
const LARGE_JSON_ROUTES = new Set(['/api/desktop/matches'])

const config = app.config.get<BodyParserConfig>('bodyparser')
const standard = new BodyParserMiddleware(config, app.experimentalFlags)
const large = new BodyParserMiddleware(
  { ...config, json: { ...config.json, limit: DESKTOP_MAX_PAYLOAD_BYTES } },
  app.experimentalFlags
)

/** Past this, an oversized upload is not worth reading just to answer it politely. */
const MAX_DRAIN_BYTES = 16 * 1024 * 1024

/**
 * Reads and discards the rest of a rejected body. Node closes a connection
 * whose request body was left unread, so without this the client sees a
 * broken pipe instead of the 413 that tells it to retry without the timeline.
 */
function drain(request: IncomingMessage) {
  if (request.complete || Number(request.headers['content-length']) > MAX_DRAIN_BYTES) {
    return Promise.resolve()
  }
  return new Promise<void>((resolve) => {
    const done = () => resolve()
    request.once('end', done).once('error', done).once('close', done)
    setTimeout(done, 10_000).unref()
    request.resume()
  })
}

/**
 * The framework's body parser, with one exception: a finished game with its
 * timeline can approach 2 MB, so the upload route gets that limit while the
 * rest of the API keeps refusing anything over 1 MB before reading it.
 */
export default class BodyParser {
  async handle(ctx: HttpContext, next: NextFn) {
    if (!ctx.route || !LARGE_JSON_ROUTES.has(ctx.route.pattern)) {
      return standard.handle(ctx, next)
    }
    try {
      return await large.handle(ctx, next)
    } catch (error) {
      if ((error as { code?: string }).code === 'E_REQUEST_ENTITY_TOO_LARGE') {
        await drain(ctx.request.request)
      }
      throw error
    }
  }
}
