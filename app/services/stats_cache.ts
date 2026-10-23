import redis from '@adonisjs/redis/services/main'
import logger from '@adonisjs/core/services/logger'

/**
 * Answers of the champion and pro statistics, kept a day so a page reads ClickHouse once a day
 * per filter, however many people open it.
 *
 * Two tiers: this process (a map lookup, no I/O) and Redis (shared by every process, and kept
 * across deploys, so a release never starts cold).
 *
 * - Fresh for `freshMs` (a day): served as is.
 * - Then stale until `keepMs`: served at once while one refresh runs in the background, so a
 *   visitor never waits for the daily refresh.
 * - A burst of requests for a missing answer costs one query: one load per key in this process,
 *   and across processes a Redis lock the others wait on (briefly; then they load it too).
 * - Every key carries a generation (the newest patch): when a new patch becomes the default,
 *   every answer is computed again.
 * - A failed load is never kept; a stale answer keeps being served while its refresh fails.
 */

/** What the cache needs from Redis, so tests can stand in for it. */
export interface StatsStore {
  get(key: string): Promise<string | null>
  /** Sets with an expiry, `nx` only when the key is missing; true when it was set. */
  set(key: string, value: string, ttlMs: number, nx?: boolean): Promise<boolean>
  del(key: string): Promise<void>
}

/** Redis never holds a page up: past this, the cache answers without it. */
const REDIS_WAIT_MS = 300

const redisStore: StatsStore = {
  get: (key) => within(redis.get(key), REDIS_WAIT_MS),
  async set(key, value, ttlMs, nx = false) {
    const done = nx
      ? await within(redis.set(key, value, 'PX', ttlMs, 'NX'), REDIS_WAIT_MS)
      : await within(redis.set(key, value, 'PX', ttlMs), REDIS_WAIT_MS)
    return done === 'OK'
  },
  async del(key) {
    await within(redis.del(key), REDIS_WAIT_MS)
  },
}

export interface StatsCacheOptions {
  /** Served as is this long. */
  freshMs: number
  /** Served (and refreshed) until then; gone after. */
  keepMs: number
  /** Answers kept in this process, least recently used dropped first. */
  maxLocal: number
  /** How long a process waits for another one's load before loading itself. */
  waitMs: number
  /** The generation of every key (the newest patch); a new one starts over. */
  generation: () => Promise<string>
  store: StatsStore
  now: () => number
}

const DAY_MS = 86_400_000
/** A load holds its key's lock at most this long (a crashed process frees it this way). */
const LOCK_MS = 60_000

interface Entry {
  at: number
  value: unknown
}

export class StatsCache {
  #local = new Map<string, Entry>()
  #loading = new Map<string, Promise<unknown>>()
  #refreshing = new Set<string>()
  #options: StatsCacheOptions

  constructor(
    public namespace: string,
    options: Partial<StatsCacheOptions> = {}
  ) {
    this.#options = {
      freshMs: DAY_MS,
      keepMs: 2 * DAY_MS,
      maxLocal: 2000,
      waitMs: 5000,
      generation: async () => '0',
      store: redisStore,
      now: Date.now,
      ...options,
    }
  }

  /** The answer for `key`, from the closest tier that has it, else `load()`. */
  async get<T>(key: string, load: () => Promise<T>): Promise<T> {
    const { now, freshMs, keepMs } = this.#options
    const full = `stats:v1:${this.namespace}:${await this.#generation()}:${key}`

    const local = this.#local.get(full)
    if (local && now() - local.at < keepMs) {
      this.#touch(full, local)
      if (now() - local.at >= freshMs) this.#refresh(full, load)
      return local.value as T
    }

    const stored = await this.#read(full)
    if (stored && now() - stored.at < keepMs) {
      this.#remember(full, stored)
      if (now() - stored.at >= freshMs) this.#refresh(full, load)
      return stored.value as T
    }

    return this.#load(full, load) as Promise<T>
  }

  /** Drops this process's copies (the Redis ones expire on their own). */
  clear() {
    this.#local.clear()
  }

  async #generation() {
    try {
      return await this.#options.generation()
    } catch {
      return '0'
    }
  }

  /** One load per key in this process; across processes, the one holding the lock loads. */
  #load(full: string, load: () => Promise<unknown>): Promise<unknown> {
    const pending = this.#loading.get(full)
    if (pending) return pending
    // A load that ended while this request was reading Redis.
    const done = this.#local.get(full)
    if (done && this.#options.now() - done.at < this.#options.freshMs) {
      return Promise.resolve(done.value)
    }
    const run = (async () => {
      const lock = `${full}:lock`
      // Without Redis every process loads for itself.
      const owner = await this.#options.store.set(lock, '1', LOCK_MS, true).catch(() => true)
      if (!owner) {
        const found = await this.#waitFor(full)
        if (found) {
          this.#remember(full, found)
          return found.value
        }
      }
      try {
        return await this.#compute(full, load)
      } finally {
        if (owner) await this.#options.store.del(lock).catch(() => {})
      }
    })()
    this.#loading.set(full, run)
    run.finally(() => this.#loading.delete(full)).catch(() => {})
    return run
  }

  /**
   * A stale answer's refresh, in the background: once per key in this process, and only by the
   * process holding the lock. It fails quietly; the stale answer stays until `keepMs`.
   */
  #refresh(full: string, load: () => Promise<unknown>) {
    if (this.#loading.has(full) || this.#refreshing.has(full)) return
    this.#refreshing.add(full)
    const lock = `${full}:lock`
    ;(async () => {
      const owner = await this.#options.store.set(lock, '1', LOCK_MS, true).catch(() => true)
      if (!owner) return
      try {
        await this.#compute(full, load)
      } finally {
        await this.#options.store.del(lock).catch(() => {})
      }
    })()
      .catch((error) => logger.warn({ err: error, key: full }, 'stats refresh failed'))
      .finally(() => this.#refreshing.delete(full))
  }

  async #compute(full: string, load: () => Promise<unknown>) {
    const value = await load()
    const entry = { at: this.#options.now(), value }
    this.#remember(full, entry)
    await this.#options.store
      .set(full, JSON.stringify(entry), this.#options.keepMs)
      .catch(() => false)
    return value
  }

  async #waitFor(full: string): Promise<Entry | null> {
    const until = this.#options.now() + this.#options.waitMs
    while (this.#options.now() < until) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      const found = await this.#read(full)
      if (found) return found
    }
    return null
  }

  async #read(full: string): Promise<Entry | null> {
    try {
      const raw = await this.#options.store.get(full)
      return raw ? (JSON.parse(raw) as Entry) : null
    } catch {
      return null
    }
  }

  #remember(full: string, entry: Entry) {
    this.#local.delete(full)
    this.#local.set(full, entry)
    while (this.#local.size > this.#options.maxLocal) {
      this.#local.delete(this.#local.keys().next().value!)
    }
  }

  /** Keeps Map order as recency order. */
  #touch(full: string, entry: Entry) {
    this.#local.delete(full)
    this.#local.set(full, entry)
  }
}

function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('redis timeout')), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}
