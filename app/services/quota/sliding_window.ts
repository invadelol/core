import { randomUUID } from 'node:crypto'
import redis from '@adonisjs/redis/services/main'
import logger from '@adonisjs/core/services/logger'

/**
 * One window of a take. A window holds the moments of what it counted during the last
 * `windowMs`; a take is refused when any of its windows lacks `need` free places, and otherwise
 * counts `add` entries in each.
 */
export interface Window {
  key: string
  windowMs: number
  limit: number
  /** Free places this take needs (0: this window never refuses it). */
  need: number
  /** Entries counted once every window had room (0: only checked). */
  add: number
}

export interface TakeResult {
  /** 0 when taken; else ms before the fullest window has room again (nothing was counted). */
  waitMs: number
  /** Index of the window that refused, -1 when taken. */
  blocked: number
}

/** Where windows live, so tests (and a Redis outage) can stand in for Redis. */
export interface WindowStore {
  take(windows: Window[], now: number, id: string): Promise<TakeResult>
}

/**
 * The sliding window log, atomic over every window of a take: a sorted set per window whose
 * scores are the moments counted. Entries older than the window are dropped first; the wait is
 * the time until enough of the oldest leave for the take to fit.
 */
const TAKE = `
local now = tonumber(ARGV[1])
local id = ARGV[2]
local wait, blocked = 0, 0
for i, key in ipairs(KEYS) do
  local at = 3 + (i - 1) * 4
  local window, limit, need = tonumber(ARGV[at]), tonumber(ARGV[at + 1]), tonumber(ARGV[at + 2])
  redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
  if need > 0 then
    local count = redis.call('ZCARD', key)
    local over = count + need - limit
    if over > 0 then
      local free = window
      if over <= count then
        local oldest = redis.call('ZRANGE', key, over - 1, over - 1, 'WITHSCORES')
        free = tonumber(oldest[2]) + window - now
      end
      if free > wait then
        wait, blocked = free, i
      end
    end
  end
end
if wait > 0 then return { wait, blocked - 1 } end
for i, key in ipairs(KEYS) do
  local at = 3 + (i - 1) * 4
  local window, add = tonumber(ARGV[at]), tonumber(ARGV[at + 3])
  if add > 0 then
    local entries = {}
    for n = 1, add do
      entries[#entries + 1] = now
      entries[#entries + 1] = id .. ':' .. n
    end
    redis.call('ZADD', key, unpack(entries))
    redis.call('PEXPIRE', key, window)
  end
end
return { 0, -1 }
`

export const redisWindows: WindowStore = {
  async take(windows, now, id) {
    const args = windows.flatMap((w) => [w.windowMs, w.limit, w.need, w.add])
    const [waitMs, blocked] = (await redis.eval(
      TAKE,
      windows.length,
      ...windows.map((w) => w.key),
      now,
      id,
      ...args
    )) as [number, number]
    return { waitMs: Number(waitMs), blocked: Number(blocked) }
  },
}

/**
 * The same windows in this process's memory: for tests, and in place of Redis while it is down
 * (each process then counts on its own, which still holds a single client back). Bounded: past
 * `maxKeys` the least recently used window is forgotten.
 */
export class MemoryWindows implements WindowStore {
  private windows = new Map<string, number[]>()

  constructor(private maxKeys = 50_000) {}

  async take(windows: Window[], now: number): Promise<TakeResult> {
    let waitMs = 0
    let blocked = -1
    const kept = windows.map((w, index) => {
      const moments = (this.windows.get(w.key) ?? []).filter((at) => at > now - w.windowMs)
      if (w.need > 0) {
        const over = moments.length + w.need - w.limit
        if (over > 0) {
          const free = over <= moments.length ? moments[over - 1] + w.windowMs - now : w.windowMs
          if (free > waitMs) [waitMs, blocked] = [free, index]
        }
      }
      return moments
    })
    windows.forEach((w, index) => {
      const moments = kept[index]
      if (!waitMs) for (let n = 0; n < w.add; n++) moments.push(now)
      // Re-inserted, so the Map's order is the order of use.
      this.windows.delete(w.key)
      if (moments.length) this.windows.set(w.key, moments)
    })
    while (this.windows.size > this.maxKeys) {
      this.windows.delete(this.windows.keys().next().value!)
    }
    return { waitMs, blocked }
  }
}

/**
 * Sliding windows in Redis, exact across every server process. When Redis cannot answer, the
 * windows are kept in memory instead (said once a minute in the log), never simply waved through:
 * the windows protect the Riot key, which an outage does not make any larger.
 */
export class SlidingWindowLimiter {
  private warnedAt = 0

  constructor(
    private store: WindowStore = redisWindows,
    private fallback: WindowStore = new MemoryWindows(),
    private clock: () => number = Date.now
  ) {}

  async take(windows: Window[]): Promise<TakeResult> {
    const now = this.clock()
    const id = randomUUID()
    try {
      return await this.store.take(windows, now, id)
    } catch (error) {
      if (now - this.warnedAt > 60_000) {
        this.warnedAt = now
        logger.warn({ err: error }, 'quota windows unavailable in Redis, counting in memory')
      }
      return this.fallback.take(windows, now, id)
    }
  }
}
