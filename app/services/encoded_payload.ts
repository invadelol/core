import { brotliCompress, gzip, constants } from 'node:zlib'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'

const brotli = promisify(brotliCompress)
const deflate = promisify(gzip)

export type PayloadEncoding = 'br' | 'gzip'

export interface EncodedPayload {
  identity: Buffer
  encoded: Partial<Record<PayloadEncoding, Buffer>>
  etag: string
}

/**
 * Holds a rarely-changing JSON response in every encoding it may be asked for.
 *
 * Some responses are derived from data that changes on a patch cycle but are
 * requested on every page load. Serialising and compressing those per request
 * is pure repetition, so this does both once and hands out the bytes until the
 * TTL expires. Because the work is amortised, the compression can be done at
 * the highest quality rather than the cheapest.
 */
export class EncodedPayloadCache {
  #entries = new Map<string, { payload: EncodedPayload; expires: number }>()
  #inFlight = new Map<string, Promise<EncodedPayload>>()

  constructor(
    private ttlMs: number,
    private now = Date.now
  ) {}

  /**
   * `cacheable` decides whether the built value is worth keeping. Without it a
   * single upstream failure gets encoded, stored, and served for the whole TTL
   * as though it were the answer.
   */
  async get(
    key: string,
    build: () => Promise<unknown>,
    cacheable?: (value: unknown) => boolean
  ): Promise<EncodedPayload> {
    const cached = this.#entries.get(key)
    if (cached && cached.expires > this.now()) return cached.payload

    const pending = this.#inFlight.get(key)
    if (pending) return pending

    const load = this.#build(key, build, cacheable).finally(() => this.#inFlight.delete(key))
    this.#inFlight.set(key, load)
    return load
  }

  async #build(
    key: string,
    build: () => Promise<unknown>,
    cacheable?: (value: unknown) => boolean
  ): Promise<EncodedPayload> {
    const value = await build()
    const identity = Buffer.from(JSON.stringify(value), 'utf8')
    const [br, gz] = await Promise.all([
      brotli(identity, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: 11,
          [constants.BROTLI_PARAM_SIZE_HINT]: identity.length,
        },
      }),
      deflate(identity, { level: 9 }),
    ])

    const payload: EncodedPayload = {
      identity,
      encoded: {
        ...(br.length < identity.length ? { br } : {}),
        ...(gz.length < identity.length ? { gzip: gz } : {}),
      },
      etag: `"${createHash('sha1').update(identity).digest('base64url')}"`,
    }

    if (!cacheable || cacheable(value)) {
      this.#entries.set(key, { payload, expires: this.now() + this.ttlMs })
    }
    return payload
  }

  clear() {
    this.#entries.clear()
  }
}

/** Best encoding the client accepts, or null to send the raw bytes. */
export function negotiatePayload(
  payload: EncodedPayload,
  accepted: string | undefined
): PayloadEncoding | null {
  if (!accepted) return null
  const header = accepted.toLowerCase()
  for (const encoding of ['br', 'gzip'] as const) {
    if (!payload.encoded[encoding]) continue
    const refused = new RegExp(`(^|,)\\s*${encoding}\\s*;\\s*q=0(\\.0+)?\\s*(,|$)`).test(header)
    if (!refused && (header.includes(encoding) || header.includes('*'))) return encoding
  }
  return null
}
