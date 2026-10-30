import logger from '@adonisjs/core/services/logger'
import type { PlatformId } from '@fightmegg/riot-api'
import riotApiService, { type RiotAPITypes } from '#services/riot/api'
import { inBackground } from '#services/riot/client'
import matchRepository from '#services/analytics/match_repository'
import { RetryScheduler, type AttemptResult } from '#services/desktop/retry_scheduler'
import { RiotBudget } from '#services/desktop/riot_budget'
import { FixedWindowLimiter } from '#services/desktop/rate_limiter'
import { RiotUpstreamException, riotErrorStatus } from '#utils/riot_errors'

type MatchCluster = Exclude<RiotAPITypes.Cluster, PlatformId.ESPORTS>

/**
 * When a queued game is asked of Riot, from the moment it is queued: at once, then as match-v5
 * publishes a game that just ended (minutes after it, the same waits as the desktop uploads').
 */
export const PENDING_ATTEMPTS = [0, 1, 3, 6, 15].map((minutes) => minutes * 60_000)

/** Attempts per routing cluster in any two minutes (each is one match-v5 call, two when it lands). */
export const PENDING_RIOT_BUDGET = 20

/** New games one address may have queued, per window. Asking again for a queued game is free. */
export const PENDING_PER_ADDRESS = { limit: 12, windowSeconds: 600 }

/** Games waiting at once; past it a new one is not queued (it is asked for again later). */
export const MAX_PENDING = 500

/** A game Riot never gave (or never will: a Brawl game) answers not found this long. */
export const MISSING_MS = 10 * 60_000

/** Games remembered as missing at once. */
const MAX_MISSING = 5000

/** What a reader who could not be given a stored game is told to do. */
export type PendingAnswer = { status: 'pending'; retryAfter: number } | { status: 'missing' }

const MISSING: PendingAnswer = { status: 'missing' }

/** What the queue needs from the stores and from Riot (tests stand in for them). */
export interface PendingDeps {
  /** Whether the game is stored, shown or not. */
  stored(matchId: string): Promise<boolean>
  /** Fetches the game from Riot and stores it; null when it is of a queue that is never stored. */
  fetch(matchId: string, cluster: MatchCluster): Promise<unknown>
}

const defaults: PendingDeps = {
  stored: async (matchId) => {
    const existing = await matchRepository.getExistingIds([matchId])
    return existing.has(matchId)
  },
  // Imported when first needed: the match service hands this queue the games its syncs could not
  // fetch yet, so it cannot be imported here up front.
  fetch: async (matchId, cluster) => {
    const { default: matches } = await import('#services/matches_service')
    return inBackground(() => matches.fetchAndStoreMatch(matchId, cluster))
  },
}

/** The routing cluster of a match id (`EUW1_7998180573` → europe); null for an unknown platform. */
export function clusterOf(matchId: string): MatchCluster | null {
  const platform = matchId.split('_')[0] ?? ''
  try {
    return riotApiService.platformToRegion(platform) as MatchCluster
  } catch {
    return null
  }
}

/**
 * A failure no later try will change: Riot refused the request itself (a malformed id). Riot not
 * having the game yet (404), limits, outages and our own stores failing are all worth a retry.
 */
function final(error: unknown) {
  if (error instanceof RiotUpstreamException) return false
  const status = riotErrorStatus(error)
  return status !== null && status >= 400 && status < 500 && status !== 404 && status !== 429
}

/**
 * Games someone asked for that are not stored yet, fetched from Riot in the background: a public
 * page never calls Riot itself. Most are games that just ended: match-v5 publishes a game minutes
 * after its end, so a game is asked for at once and again 1, 3, 6 and 15 minutes later
 * ([`PENDING_ATTEMPTS`]), then answers not found for a while ([`MISSING_MS`]).
 *
 * Deduplicated (one queue entry per game, however many readers wait for it) and paced: a budget of
 * Riot calls per cluster, behind every visitor's own Riot request, and a limit of new games per
 * address. In-process and best effort, like the desktop retries: a restart forgets the queue and the
 * next reader queues the game again.
 */
export class PendingMatches {
  retries = new RetryScheduler(PENDING_ATTEMPTS)
  budget = new RiotBudget(PENDING_RIOT_BUDGET)
  limiter = new FixedWindowLimiter('pending:rl:')
  now = () => Date.now()

  /** Queued games, and since when. */
  private queued = new Map<string, number>()
  /** Games Riot did not give, and until when they answer not found. */
  private missing = new Map<string, number>()

  constructor(private deps: PendingDeps = defaults) {}

  /**
   * What a reader asking for `matchId`, which is not stored, is told: `pending` (with the seconds
   * after which to ask again) while it is queued, or could not be queued right now; `missing` when
   * Riot did not give it lately, or its platform is unknown. Queues it when it can.
   */
  async request(matchId: string, ip?: string | null): Promise<PendingAnswer> {
    const cluster = clusterOf(matchId)
    if (!cluster) return MISSING
    if (this.queued.has(matchId)) return this.pending(matchId)
    if (this.isMissing(matchId)) return MISSING
    if (this.queued.size >= MAX_PENDING) return { status: 'pending', retryAfter: 60 }
    if (ip) {
      const { limit, windowSeconds } = PENDING_PER_ADDRESS
      const hit = await this.limiter.hit('ip', ip, limit, windowSeconds)
      if (!hit.allowed) return { status: 'pending', retryAfter: Math.min(60, hit.retryAfter) }
    }
    this.enqueue(matchId, cluster)
    return this.pending(matchId)
  }

  /**
   * Queues `matchId` (no address limit: for a game Riot itself named). False when it is queued
   * already, the queue is full, or its platform is unknown.
   */
  enqueue(matchId: string, cluster: MatchCluster | null = clusterOf(matchId)): boolean {
    if (!cluster || this.queued.has(matchId) || this.queued.size >= MAX_PENDING) return false
    this.missing.delete(matchId)
    this.queued.set(matchId, this.now())
    this.retries.schedule(
      matchId,
      () => this.attempt(matchId, cluster),
      async () => {
        this.queued.delete(matchId)
        this.markMissing(matchId)
      }
    )
    return true
  }

  /** Whether `matchId` is waiting in the queue. */
  has(matchId: string) {
    return this.queued.has(matchId)
  }

  /** Forgets every queued and missing game, and their timers. */
  clear() {
    this.retries.clear()
    this.queued.clear()
    this.missing.clear()
  }

  private async attempt(matchId: string, cluster: MatchCluster): Promise<AttemptResult> {
    try {
      // Stored meanwhile (the desktop app's upload, a profile's sync): nothing to ask.
      if (await this.deps.stored(matchId)) return this.finish(matchId, false)
      if (!this.budget.take(cluster)) return 'retry'
      const stored = await this.deps.fetch(matchId, cluster)
      // Of a queue that is never stored (Brawl, League Classic): never shown either.
      return this.finish(matchId, stored === null)
    } catch (error) {
      if (final(error)) return this.finish(matchId, true)
      if (!(error instanceof RiotUpstreamException) && riotErrorStatus(error) === null) {
        logger.warn({ err: error, matchId }, 'pending match not stored, trying again later')
      }
      return 'retry'
    }
  }

  private finish(matchId: string, missing: boolean): AttemptResult {
    this.queued.delete(matchId)
    if (missing) this.markMissing(matchId)
    return 'done'
  }

  /** Readers ask again soon while Riot usually publishes the game, then less often. */
  private pending(matchId: string): PendingAnswer {
    const waited = this.now() - (this.queued.get(matchId) ?? this.now())
    return {
      status: 'pending',
      retryAfter: waited < 2 * 60_000 ? 5 : waited < 10 * 60_000 ? 15 : 30,
    }
  }

  private isMissing(matchId: string) {
    const until = this.missing.get(matchId)
    if (until === undefined) return false
    if (until > this.now()) return true
    this.missing.delete(matchId)
    return false
  }

  private markMissing(matchId: string) {
    if (this.missing.size >= MAX_MISSING) this.missing.clear()
    this.missing.set(matchId, this.now() + MISSING_MS)
  }
}

export default new PendingMatches()
