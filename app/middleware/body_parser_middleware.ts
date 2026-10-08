import { createHash } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import app from '@adonisjs/core/services/app'
import BodyParserMiddleware from '@adonisjs/core/bodyparser_middleware'
import type { BodyParserConfig } from '@adonisjs/core/types/bodyparser'
import { EMPTY_BODY_SHA256 } from '#services/desktop/signing'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    /**
     * Hex SHA-256 of the request body's bytes as they arrived, for the
     * desktop routes' signatures (docs/desktop-sync.md §1.1).
     */
    desktopBodyDigest?: Promise<string>
  }
}

/** Largest game upload the desktop app may send (docs/desktop-sync.md §2.5). */
export const DESKTOP_MAX_PAYLOAD_BYTES = 2_000_000

/** Routes with a JSON limit of their own; every other route keeps the default 1 MB. */
const JSON_LIMITS = new Map([['/api/desktop/matches', DESKTOP_MAX_PAYLOAD_BYTES]])

/** The limit a 413 on this URL refers to, when the route has one of its own. */
export function payloadLimitOf(url: string): number | null {
  return JSON_LIMITS.get(url.split('?')[0]) ?? null
}

const config = app.config.get<BodyParserConfig>('bodyparser')
const standard = new BodyParserMiddleware(config, app.experimentalFlags)
const parsers = new Map(
  [...JSON_LIMITS].map(([pattern, limit]) => [
    pattern,
    new BodyParserMiddleware({ ...config, json: { ...config.json, limit } }, app.experimentalFlags),
  ])
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
 * Hashes the body bytes while the framework's parser reads them: the parser
 * keeps only the decoded text, and a signature covers the bytes. Listening
 * before the parser starts means both see every chunk, and nothing is
 * buffered twice. A body that never completes hashes to nothing a signature
 * can match.
 */
function digestBody(request: IncomingMessage, hasBody: boolean): Promise<string> {
  if (!hasBody) return Promise.resolve(EMPTY_BODY_SHA256)
  const hash = createHash('sha256')
  return new Promise((resolve) => {
    const onData = (chunk: Buffer | string) => hash.update(chunk)
    const finish = (value: string) => {
      request.off('data', onData)
      resolve(value)
    }
    request.on('data', onData)
    request.once('end', () => finish(hash.digest('hex')))
    request.once('error', () => finish('incomplete'))
    request.once('close', () => {
      if (!request.complete) finish('incomplete')
    })
  })
}

/**
 * The framework's body parser, with two additions for the desktop routes:
 * per-route JSON limits (a finished game with its timeline can approach
 * 2 MB; every other route keeps refusing anything over 1 MB before reading
 * it), and the hash of the raw body their signatures need.
 */
export default class BodyParser {
  async handle(ctx: HttpContext, next: NextFn) {
    const pattern = ctx.route?.pattern ?? ''
    if (pattern.startsWith('/api/desktop/')) {
      ctx.desktopBodyDigest = digestBody(ctx.request.request, ctx.request.hasBody())
    }

    const parser = parsers.get(pattern)
    if (!parser) return standard.handle(ctx, next)
    try {
      return await parser.handle(ctx, next)
    } catch (error) {
      if ((error as { code?: string }).code === 'E_REQUEST_ENTITY_TOO_LARGE') {
        await drain(ctx.request.request)
      }
      throw error
    }
  }
}
