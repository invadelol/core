import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import redis from '@adonisjs/redis/services/main'
import logger from '@adonisjs/core/services/logger'

/**
 * Request signing (docs/desktop-sync.md §1.1).
 *
 * TLS already keeps the network out. Signing makes what leaks outside it
 * useless: the secret travels once, at registration, so a token lifted
 * from a log, a proxy capture or a HAR file cannot sign anything, and a
 * captured request can be neither altered (the signature covers method,
 * path, query and body bytes) nor sent again (timestamp window + replay
 * cache).
 *
 *   signature = hex(HMAC-SHA256(secret, "v1\n" + timestamp + "\n" + METHOD + "\n"
 *                                       + path_with_query + "\n" + hex(SHA-256(body))))
 *
 * The HMAC key is the secret exactly as the app received it: its 64 hex
 * characters as ASCII bytes (`createHmac('sha256', secret)`), not the 32
 * bytes they encode.
 */

export const SIGNATURE_VERSION = 'v1'
/** How far the app's clock may be from core's, either way. */
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000
/** A signature is remembered for longer than any timestamp stays acceptable. */
export const REPLAY_TTL_SECONDS = 10 * 60
export const EMPTY_BODY_SHA256 = createHash('sha256').update('').digest('hex')

const SECRET_PATTERN = /^[0-9a-f]{64}$/
const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/
const TIMESTAMP_PATTERN = /^[0-9]{1,16}$/

/** 32 random bytes, lowercase hex. Shown to the app once, stored encrypted. */
export function generateSecret(): string {
  return randomBytes(32).toString('hex')
}

export function isSecret(value: unknown): value is string {
  return typeof value === 'string' && SECRET_PATTERN.test(value)
}

export function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

export interface SignedParts {
  /** The `X-Invade-Timestamp` header, exactly as sent. */
  timestamp: string
  method: string
  /** Path and query string exactly as they appear in the request line. */
  path: string
  /** Lowercase hex SHA-256 of the raw body bytes. */
  bodyHash: string
}

export function canonicalRequest(parts: SignedParts): string {
  return [
    SIGNATURE_VERSION,
    parts.timestamp,
    parts.method.toUpperCase(),
    parts.path,
    parts.bodyHash,
  ].join('\n')
}

/** What the app computes; core uses it to compare, the tests to sign. */
export function signRequest(secret: string, parts: SignedParts) {
  return createHmac('sha256', secret).update(canonicalRequest(parts), 'utf8').digest('hex')
}

function same(a: string, b: string) {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  return left.length === right.length && timingSafeEqual(left, right)
}

export type SignatureVerdict = 'ok' | 'missing' | 'skew' | 'bad'

/**
 * Checks a request's signature headers. Pure: the clock comes in. The
 * timestamp is judged first so an app with a wrong clock learns that,
 * rather than being told to register again.
 */
export function verifySignature(input: {
  secret: string
  timestamp: string | undefined | null
  signature: string | undefined | null
  method: string
  path: string
  bodyHash: string
  now: number
}): SignatureVerdict {
  const { timestamp, signature } = input
  if (!timestamp || !signature) return 'missing'
  if (!TIMESTAMP_PATTERN.test(timestamp) || !SIGNATURE_PATTERN.test(signature)) return 'bad'
  if (Math.abs(input.now - Number(timestamp)) > MAX_CLOCK_SKEW_MS) return 'skew'

  const parts = { timestamp, method: input.method, path: input.path, bodyHash: input.bodyHash }
  return same(signRequest(input.secret, parts), signature) ? 'ok' : 'bad'
}

/** The subset of Redis the replay guard needs, so tests can stand in for it. */
export interface ReplayStore {
  /** True when the key was not set yet (and is now, for `ttlSeconds`). */
  setIfAbsent(key: string, ttlSeconds: number): Promise<boolean>
}

const redisStore: ReplayStore = {
  async setIfAbsent(key, ttlSeconds) {
    return (await redis.set(key, '1', 'EX', ttlSeconds, 'NX')) === 'OK'
  },
}

/**
 * Remembers every accepted signature for ten minutes (`SET NX`), so the
 * same signed request is accepted once. Keys hold a hash of the signature,
 * not the signature itself.
 */
export class ReplayGuard {
  constructor(
    public prefix = 'desktop:sig:',
    private store: ReplayStore = redisStore
  ) {}

  async firstUse(signature: string): Promise<boolean> {
    try {
      return await this.store.setIfAbsent(
        `${this.prefix}${sha256Hex(signature)}`,
        REPLAY_TTL_SECONDS
      )
    } catch (error) {
      // Like the rate limiter: a Redis outage must not take the app down.
      // The timestamp window still bounds a replay to five minutes.
      logger.warn({ err: error }, 'desktop replay cache unavailable, allowing request')
      return true
    }
  }
}

export default new ReplayGuard()
