import redis from '@adonisjs/redis/services/main'
import logger from '@adonisjs/core/services/logger'
import { createHash } from 'node:crypto'

/**
 * A per-process layer in front of the Redis response cache.
 *
 * Redis is fast, but it is still a round trip, and a profile page makes six
 * cached requests before it can finish painting. Holding the already-encoded
 * bytes in the process removes that round trip from the hot path entirely and
 * turns a cache hit into a map lookup.
 *
 * Correctness comes from the same generation counter Redis uses, plus a
 * broadcast: invalidating a resource publishes its name, and every process
 * drops its copies on receipt. The short TTL is the backstop — Redis pub/sub
 * is fire-and-forget, so if a message is ever lost an entry still expires on
 * its own within seconds rather than lingering for the full Redis TTL.
 */

export const RESPONSE_CACHE_CHANNEL = 'http_cache:v2:invalidate'

/** How long an entry may live without hearing from the invalidation channel. */
const TTL_MS = 15_000

/** Bounds the memory this can hold, evicting least-recently-used first. */
const MAX_ENTRIES = 512

interface Entry {
  body: Buffer
  /** Content hash of `body`; the caller turns it into an ETag. */
  hash: string
  expires: number
}

export class ResponseMemoryCache {
  #entries = new Map<string, Entry>()
  /** Cache keys per resource, so one invalidation drops the whole profile. */
  #byResource = new Map<string, Set<string>>()
  #listening = false

  constructor(
    private ttlMs = TTL_MS,
    private maxEntries = MAX_ENTRIES,
    private now = Date.now
  ) {}

  /**
   * Starts listening for invalidations.
   *
   * Called on first use rather than at import time, so nothing connects to
   * Redis merely because this module was loaded.
   */
  listen() {
    if (this.#listening) return
    this.#listening = true
    try {
      redis.subscribe(RESPONSE_CACHE_CHANNEL, (resource: string) => this.dropResource(resource))
    } catch (error) {
      // Without the broadcast the TTL still bounds staleness, so this is a
      // degradation rather than a failure.
      this.#listening = false
      logger.warn({ err: error }, 'response cache invalidation channel unavailable')
    }
  }

  get(key: string): Entry | null {
    const entry = this.#entries.get(key)
    if (!entry) return null
    if (entry.expires <= this.now()) {
      this.#entries.delete(key)
      return null
    }
    // Re-insert to keep Map iteration order as recency order.
    this.#entries.delete(key)
    this.#entries.set(key, entry)
    return entry
  }

  set(key: string, resource: string, body: Buffer): Entry {
    const entry: Entry = { body, hash: contentHash(body), expires: this.now() + this.ttlMs }

    this.#entries.delete(key)
    this.#entries.set(key, entry)

    let keys = this.#byResource.get(resource)
    if (!keys) this.#byResource.set(resource, (keys = new Set()))
    keys.add(key)

    while (this.#entries.size > this.maxEntries) {
      const oldest = this.#entries.keys().next().value
      if (oldest === undefined) break
      this.#entries.delete(oldest)
    }

    return entry
  }

  dropResource(resource: string) {
    const keys = this.#byResource.get(resource)
    if (!keys) return
    for (const key of keys) this.#entries.delete(key)
    this.#byResource.delete(resource)
  }

  clear() {
    this.#entries.clear()
    this.#byResource.clear()
  }

  get size() {
    return this.#entries.size
  }
}

/**
 * Content hash of a response body.
 *
 * Computed once when the bytes enter the cache and reused for every request
 * that hits it, so answering `If-None-Match` costs nothing per request.
 */
export function contentHash(body: Buffer) {
  return createHash('sha1').update(body).digest('base64url')
}

export default new ResponseMemoryCache()
