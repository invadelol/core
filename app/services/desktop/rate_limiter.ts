import redis from '@adonisjs/redis/services/main'
import logger from '@adonisjs/core/services/logger'

export interface RateLimitResult {
  allowed: boolean
  /** Hits counted in the current window, this one included. */
  count: number
  /** Seconds until the window resets; what a 429 sends as `Retry-After`. */
  retryAfter: number
}

/** The subset of the Redis client the limiter needs, so tests can stand in for it. */
export interface RateLimitStore {
  incrementWindow(key: string, ttlSeconds: number): Promise<number>
}

const redisStore: RateLimitStore = {
  async incrementWindow(key, ttlSeconds) {
    // One round trip. Re-arming the expiry on every hit is harmless: the key
    // carries the window number, so it never outlives the window by more
    // than one TTL and never leaks into the next one.
    const results = await redis.multi().incr(key).expire(key, ttlSeconds).exec()
    const [error, count] = results?.[0] ?? [new Error('empty Redis reply'), null]
    if (error) throw error
    return Number(count)
  },
}

/**
 * Fixed windows in Redis: `INCR` a key named after the window, expire it with
 * the window. Coarser than a sliding window, but one command per request and
 * exact across every server process, which is all these limits need
 * (docs/desktop-sync.md §2: per device and per client IP, per hour).
 */
export class FixedWindowLimiter {
  constructor(
    public prefix = 'desktop:rl:',
    private store: RateLimitStore = redisStore,
    private clock: () => number = Date.now
  ) {}

  async hit(
    bucket: string,
    id: string,
    limit: number,
    windowSeconds = 3600
  ): Promise<RateLimitResult> {
    const now = this.clock()
    const windowMs = windowSeconds * 1000
    const window = Math.floor(now / windowMs)
    const retryAfter = Math.max(1, Math.ceil(((window + 1) * windowMs - now) / 1000))
    try {
      const count = await this.store.incrementWindow(
        `${this.prefix}${bucket}:${id}:${window}`,
        windowSeconds
      )
      return { allowed: count <= limit, count, retryAfter }
    } catch (error) {
      // A Redis outage must not take uploads down with it: the limits guard
      // against abuse, and Riot's own limiter still stands behind them.
      logger.warn({ err: error, bucket }, 'desktop rate limiter unavailable, allowing request')
      return { allowed: true, count: 0, retryAfter }
    }
  }
}

/** The per-hour limits of docs/desktop-sync.md §2. */
export const DESKTOP_LIMITS = {
  register: { bucket: 'devices:ip', limit: 10 },
  link: { bucket: 'link:device', limit: 20 },
  resolveDevice: { bucket: 'resolve:device', limit: 30 },
  resolveIp: { bucket: 'resolve:ip', limit: 20 },
  uploadDevice: { bucket: 'matches:device', limit: 30 },
  uploadIp: { bucket: 'matches:ip', limit: 120 },
} as const

export default new FixedWindowLimiter()
