import type { HttpContext } from '@adonisjs/core/http'
import json from '@poppinss/utils/json'
import { brotliCompress, gzip, constants } from 'node:zlib'
import { promisify } from 'node:util'

const brotli = promisify(brotliCompress)
const deflate = promisify(gzip)

/**
 * Compresses text responses that nothing else has already encoded.
 *
 * The response cache stores its payloads Brotli-encoded and sends those bytes
 * straight through, so cached analytics never reach this middleware. What does
 * reach it is everything else we generate per request: server-rendered HTML,
 * Inertia's navigation JSON, search results and the asset name maps — all of
 * which went out uncompressed before.
 *
 * It works on the buffered body rather than by wrapping the socket, so a
 * streamed response (the image proxy, static files) is never touched.
 */

/** Under this, framing overhead cancels out anything compression saves. */
const MIN_BYTES = 512

/**
 * Quality 4 is the same setting the response cache uses. Higher qualities cost
 * far more CPU than they save bytes on a payload we compress once per request
 * and then throw away.
 */
const BROTLI_OPTIONS = { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } }

export default class CompressionMiddleware {
  async handle({ request, response }: HttpContext, next: () => Promise<void>) {
    await next()

    if (response.getHeader('Content-Encoding')) return
    const status = response.getStatus()
    if (status < 200 || status >= 300 || status === 204) return

    const body = response.getBody()
    if (body === null || body === undefined || body === '') return

    // Binary bodies are already in a compressed container, or belong to a
    // handler that set its own encoding. Streams never land here at all.
    if (body instanceof Uint8Array) return

    const type = typeof body
    if (type !== 'string' && type !== 'object') return

    // Serialised exactly the way the response would have serialised it, so
    // the bytes on the wire are unchanged apart from the encoding.
    const isString = type === 'string'
    const text = isString ? (body as string) : json.safeStringify(body)
    if (typeof text !== 'string') return

    const raw = Buffer.from(text, 'utf8')
    if (raw.length < MIN_BYTES) return

    const encoding = this.#negotiate(request.header('accept-encoding'))
    if (!encoding) return

    let encoded: Buffer
    try {
      encoded =
        encoding === 'br' ? await brotli(raw, BROTLI_OPTIONS) : await deflate(raw, { level: 6 })
    } catch {
      // A compression failure must never cost us the response itself.
      return
    }
    if (encoded.length >= raw.length) return

    // `send()` with a Buffer would otherwise label the body as binary, so the
    // content type the response had already chosen is restored explicitly.
    response.header('Content-Type', this.#contentType(response, isString, text))
    response.header('Content-Encoding', encoding)
    this.#appendVary(response, 'Accept-Encoding')
    response.send(encoded, false)
  }

  /**
   * Mirrors how the response would have typed this body on its own.
   *
   * Takes the response rather than a destructured `getHeader`: the method
   * reads a private field, so it only works when called on the response.
   */
  #contentType(response: HttpContext['response'], isString: boolean, text: string) {
    const existing = response.getHeader('Content-Type')
    if (existing) return existing as string
    if (!isString) return 'application/json; charset=utf-8'
    return /^\s*</.test(text) ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8'
  }

  #appendVary(response: HttpContext['response'], value: string) {
    const existing = String(response.getHeader('Vary') ?? '')
    if (existing.toLowerCase().includes(value.toLowerCase())) return
    response.header('Vary', existing ? `${existing}, ${value}` : value)
  }

  #negotiate(accepted: string | undefined): 'br' | 'gzip' | null {
    if (!accepted) return null
    const header = accepted.toLowerCase()
    for (const encoding of ['br', 'gzip'] as const) {
      const refused = new RegExp(`(^|,)\\s*${encoding}\\s*;\\s*q=0(\\.0+)?\\s*(,|$)`).test(header)
      if (!refused && (header.includes(encoding) || header.includes('*'))) return encoding
    }
    return null
  }
}
