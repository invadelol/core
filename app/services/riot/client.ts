import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { RiotAPI } from '@fightmegg/riot-api'
import { SyncGuard } from '#utils/sync_guard'
import { RiotUpstreamException, translateRiotError } from '#utils/riot_errors'

/**
 * Riot requests one method may have waiting in this process (queued in the SDK, or holding a
 * slot while it waits out a 429). Past it a new one is refused at once, as Riot itself would:
 * the SDK queues without bound, and while the key is spent faster than it refills every queued
 * request, and everything waiting on its answer, stays in memory until the process runs out.
 */
export const MAX_PENDING_PER_METHOD = 100

/**
 * Background requests (the desktop app's verifications) one method may have waiting. The SDK runs
 * 10 requests of a method at once, and one waiting out a 429 keeps its slot: with at most 4 of
 * them, 6 slots are always left for visitors, who also go first in the queue.
 */
export const MAX_BACKGROUND_PENDING_PER_METHOD = 4

/** Bottleneck runs the lowest number first (default 5): background work waits for visitors. */
const BACKGROUND_PRIORITY = 9

const background = new AsyncLocalStorage<true>()

/**
 * Runs `task` with its Riot requests behind every website request: someone clicking Update must
 * never wait for a queue of the desktop app's verifications.
 */
export function inBackground<T>(task: () => Promise<T>): Promise<T> {
  return background.run(true, task)
}

/** What a refused request tells its caller to wait, in seconds: about one window of the key. */
const BACKLOG_RETRY_AFTER = 60

/** What the SDK assumes when Riot sends no X-App-Rate-Limit header. */
const FALLBACK_APP_LIMITS = '10:10,500:600'

type RiotRateLimits = {
  appLimits: string
  appCounts: string
  methodLimits: string
  methodCounts: string
}

/** `20:1,100:120`: every bucket a positive `requests:seconds` pair. */
function validLimits(limits: unknown): limits is string {
  return (
    typeof limits === 'string' &&
    limits.split(',').every((bucket) => {
      const [requests, seconds, extra] = bucket.split(':').map(Number)
      return extra === undefined && requests > 0 && seconds > 0
    })
  )
}

/** One `count:seconds` per bucket of `limits`, keeping Riot's counts where they line up. */
function alignCounts(limits: string, counts: unknown) {
  const reported = typeof counts === 'string' ? counts.split(',') : []
  return limits
    .split(',')
    .map((bucket, index) => {
      const seconds = bucket.split(':')[1]
      const count = Number(reported[index]?.split(':')[0])
      return `${Number.isFinite(count) && count >= 0 ? count : 0}:${seconds}`
    })
    .join(',')
}

/**
 * Riot leaves rate limit headers out of some responses, most often a service 429, which has no
 * X-Method-Rate-Limit. The SDK parses them inside promise and timer callbacks nobody awaits, so
 * a missing header throws `invalid rate limits` (or a TypeError) out of the process and takes the
 * whole server down. Fall back to the app limits, which bound every method anyway.
 */
export function saneRateLimits<T extends RiotRateLimits>(rateLimits: T): T {
  const appLimits = validLimits(rateLimits.appLimits) ? rateLimits.appLimits : FALLBACK_APP_LIMITS
  const appCounts = alignCounts(appLimits, rateLimits.appCounts)
  const methodValid = validLimits(rateLimits.methodLimits)
  return {
    ...rateLimits,
    appLimits,
    appCounts,
    methodLimits: methodValid ? rateLimits.methodLimits : appLimits,
    methodCounts: methodValid
      ? alignCounts(rateLimits.methodLimits, rateLimits.methodCounts)
      : appCounts,
  }
}

/**
 * Bottleneck 2.19.5, which the SDK queues with, stops refilling a limiter's reservoir the first
 * time its settings change: `_startHeartbeat` clears the running interval and never starts a new
 * one. The SDK changes them after nearly every response, so a limiter that reaches 0 stays at 0,
 * its queue never moves again, and every request of that method is refused until the process
 * restarts (2026-10-22: every Update refused for hours while the key sat idle). Restart the
 * interval instead.
 */
function keepReservoirRefills() {
  const sdk = createRequire(createRequire(import.meta.url).resolve('@fightmegg/riot-rate-limiter'))
  const store = sdk('bottleneck/lib/LocalDatastore.js').prototype
  if (store.__refillsKept) return
  const start = store._startHeartbeat
  store._startHeartbeat = function (this: { heartbeat: NodeJS.Timeout | null }) {
    if (this.heartbeat != null) {
      clearInterval(this.heartbeat)
      this.heartbeat = null
    }
    return start.call(this)
  }
  store.__refillsKept = true
}

keepReservoirRefills()

/** Share identical reads before they enter the SDK's Bottleneck queues, and bound those queues. */
export class CoalescingRiotAPI extends RiotAPI {
  private requests = new SyncGuard()
  private pending = new Map<string, number>()
  private pendingBackground = new Map<string, number>()

  constructor(...args: ConstructorParameters<typeof RiotAPI>) {
    super(...args)
    const limiter = this.riotRateLimiter as any
    for (const name of ['setupRateLimiters', 'updateRateLimiters', 'syncRateLimiters']) {
      const original = limiter[name].bind(limiter)
      limiter[name] = (region: string, method: string, rateLimits: RiotRateLimits) => {
        try {
          return original(region, method, saneRateLimits(rateLimits))
        } catch {
          // Riot changed how many buckets a key has: keep the limiters we have. The request
          // still settles, as a 429 the caller reports, rather than as an uncaught throw.
        }
      }
    }
  }

  /** Requests of one method (`europe:MATCH_V5.GET_MATCH_BY_ID`) waiting on Riot right now. */
  waiting(platform: string, method: string) {
    return this.pending.get(`${platform}:${method}`) ?? 0
  }

  override request<T>(...args: Parameters<RiotAPI['request']>): Promise<T> {
    const [platform, method, path, options] = args
    const slot = `${platform}:${method}`
    const low = background.getStore() === true
    const request = () => {
      const waiting = this.pending.get(slot) ?? 0
      const waitingLow = this.pendingBackground.get(slot) ?? 0
      if (
        waiting >= MAX_PENDING_PER_METHOD ||
        (low && waitingLow >= MAX_BACKGROUND_PENDING_PER_METHOD)
      ) {
        return Promise.reject(
          new RiotUpstreamException(
            'Riot is rate limiting requests, try again in a moment',
            'E_RIOT_RATE_LIMITED',
            429,
            BACKLOG_RETRY_AFTER
          )
        )
      }
      this.pending.set(slot, waiting + 1)
      if (low) this.pendingBackground.set(slot, waitingLow + 1)
      return super
        .request<T>(platform, method, path, {
          ...options,
          id: randomUUID(),
          ...(low ? { priority: BACKGROUND_PRIORITY } : {}),
        })
        .catch((error) => {
          throw translateRiotError(error)
        })
        .finally(() => {
          release(this.pending, slot)
          if (low) release(this.pendingBackground, slot)
        })
    }

    // Never merge writes. The SDK's fixed job IDs also omit query parameters,
    // so distinct requests need unique IDs even when they target the same player.
    if (options?.method && options.method !== 'GET') return request()
    // A visitor's read never joins a background one: it would wait at its priority.
    const key = JSON.stringify([
      platform,
      method,
      path,
      options?.params,
      options?.headers,
      options?.body,
      low,
    ])
    return this.requests.run(key, request)
  }
}

function release(counts: Map<string, number>, slot: string) {
  const left = (counts.get(slot) ?? 1) - 1
  if (left > 0) counts.set(slot, left)
  else counts.delete(slot)
}
