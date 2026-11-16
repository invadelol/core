import redis from '@adonisjs/redis/services/main'
import type { ApexEntry, ApexTier, Cutoff, TierRead } from '#services/ladder'

/**
 * What the apex ladders were, kept in Redis as each new read of a league comes in, so a ladder can
 * say how a player moved and how the cutoffs moved: nothing in ClickHouse keeps an older read
 * (`league_entries` keeps one row per player). No Riot request and no new table: the ladder
 * service writes a point when the reads it sees differ from the last point it wrote.
 *
 * - A point (`ladder:points:<platform>`, a list, newest first, `MAX_POINTS` long, kept
 *   `POINTS_TTL_S`): when it was taken, each tier's read time, and the Challenger and Grandmaster
 *   cutoffs. The cutoff line reads these.
 * - Its LP (`ladder:lp:<platform>:<at>`, kept `LP_TTL_S`): every apex player's LP then, by the
 *   start of their PUUID. A move compares a player's LP now with the newest point at least
 *   `BASELINE_MIN_MS` older, only for tiers read again since.
 */

const MAX_POINTS = 90
const POINTS_TTL_S = 45 * 86_400
const LP_TTL_S = 4 * 86_400
/** A move reads against a point at least this old (a day, give or take the reads' timing). */
export const BASELINE_MIN_MS = 20 * 3_600_000
/** Long enough to tell two players of one server apart. */
const KEY_LENGTH = 20

export interface HistoryPoint {
  /** When the point was written, in ms. */
  at: number
  reads: Partial<Record<ApexTier, number>>
  cutoffs: { CHALLENGER: number | null; GRANDMASTER: number | null }
}

/** One player's move against the baseline point. */
export interface Move {
  lp: number
  /** Places gained (positive) or lost. */
  places: number
}

export const lpKey = (puuid: string) => puuid.slice(0, KEY_LENGTH)

/** The reads a point would record, by tier. */
export function readsOf(reads: TierRead[]): HistoryPoint['reads'] {
  return Object.fromEntries(reads.map((r) => [r.tier, r.at]))
}

/** Whether `reads` holds a read the newest point does not. */
export function isNewRead(reads: HistoryPoint['reads'], last: HistoryPoint | undefined) {
  if (!last) return Object.keys(reads).length > 0
  return (Object.keys(reads) as ApexTier[]).some((t) => reads[t] !== last.reads[t])
}

/** The newest point at least `BASELINE_MIN_MS` older than `now`. Points come newest first. */
export function baselineOf(points: HistoryPoint[], now: number) {
  return points.find((p) => p.at <= now - BASELINE_MIN_MS) ?? null
}

/**
 * Each current entry's move against the baseline's LP: only tiers read again since the baseline
 * (an older read says nothing new), only players on the ladder then. Places compare the ladder now
 * with the baseline's own order (one LP scale for every apex tier).
 */
export function movesOf(
  entries: ApexEntry[],
  reads: HistoryPoint['reads'],
  baseline: HistoryPoint,
  lpThen: Record<string, number>
): Map<string, Move> {
  const out = new Map<string, Move>()
  const order = Object.entries(lpThen).sort((a, b) => b[1] - a[1])
  const placeThen = new Map(order.map(([k], i) => [k, i + 1]))
  entries.forEach((e, i) => {
    if (!reads[e.tier] || reads[e.tier] === baseline.reads[e.tier]) return
    const key = lpKey(e.puuid)
    const was = lpThen[key]
    if (was === undefined) return
    out.set(e.puuid, { lp: e.lp - was, places: (placeThen.get(key) ?? i + 1) - (i + 1) })
  })
  return out
}

/** The cutoff line: one point per read of the tier, oldest first, within `days`. */
export function cutoffLine(
  points: HistoryPoint[],
  tier: 'CHALLENGER' | 'GRANDMASTER',
  now: number,
  days = 30
) {
  const since = now - days * 86_400_000
  const seen = new Set<number>()
  const out: { at: number; lp: number }[] = []
  for (const p of [...points].reverse()) {
    const read = p.reads[tier]
    const lp = p.cutoffs[tier]
    if (!read || lp === null || read < since || seen.has(read)) continue
    seen.add(read)
    out.push({ at: read, lp })
  }
  return out
}

/** Where the history is kept; tests stand in for it. */
export interface HistoryStore {
  points(platform: string): Promise<HistoryPoint[]>
  add(platform: string, point: HistoryPoint, lp: Record<string, number>): Promise<void>
  lp(platform: string, at: number): Promise<Record<string, number> | null>
}

export const redisHistory: HistoryStore = {
  async points(platform) {
    const raw = await redis.lrange(`ladder:points:${platform}`, 0, MAX_POINTS - 1)
    return raw.map((r) => JSON.parse(r) as HistoryPoint)
  },
  async add(platform, point, lp) {
    const list = `ladder:points:${platform}`
    await redis
      .multi()
      .set(`ladder:lp:${platform}:${point.at}`, JSON.stringify(lp), 'EX', LP_TTL_S)
      .lpush(list, JSON.stringify(point))
      .ltrim(list, 0, MAX_POINTS - 1)
      .expire(list, POINTS_TTL_S)
      .exec()
  },
  async lp(platform, at) {
    const raw = await redis.get(`ladder:lp:${platform}:${at}`)
    return raw ? (JSON.parse(raw) as Record<string, number>) : null
  },
}

/** What a ladder snapshot carries of its history. */
export interface LadderHistory {
  /** Moves by PUUID, against `since`. */
  moves: Record<string, Move>
  /** When the baseline was taken (ms), null without one. */
  since: number | null
  /** The cutoffs at the baseline, for "+2 since". */
  cutoffsThen: HistoryPoint['cutoffs'] | null
  /** One point per read of each tier over 30 days, oldest first. */
  lines: { CHALLENGER: { at: number; lp: number }[]; GRANDMASTER: { at: number; lp: number }[] }
}

/**
 * Records this read when it is new, then reads the moves and the cutoff lines. Never throws: a
 * ladder without Redis has no history.
 */
export async function recordAndRead(
  store: HistoryStore,
  platform: string,
  reads: TierRead[],
  entries: ApexEntry[],
  cuts: Cutoff[],
  now = Date.now()
): Promise<LadderHistory> {
  const empty: LadderHistory = {
    moves: {},
    since: null,
    cutoffsThen: null,
    lines: { CHALLENGER: [], GRANDMASTER: [] },
  }
  try {
    let points = await store.points(platform)
    const byTier = readsOf(reads)
    if (entries.length && isNewRead(byTier, points[0])) {
      const point: HistoryPoint = {
        at: now,
        reads: byTier,
        cutoffs: {
          CHALLENGER: cuts.find((c) => c.tier === 'CHALLENGER')?.lp ?? null,
          GRANDMASTER: cuts.find((c) => c.tier === 'GRANDMASTER')?.lp ?? null,
        },
      }
      const lp = Object.fromEntries(entries.map((e) => [lpKey(e.puuid), e.lp]))
      await store.add(platform, point, lp)
      points = [point, ...points]
    }
    const lines = {
      CHALLENGER: cutoffLine(points, 'CHALLENGER', now),
      GRANDMASTER: cutoffLine(points, 'GRANDMASTER', now),
    }
    const baseline = baselineOf(points, now)
    if (!baseline) return { ...empty, lines }
    const lpThen = await store.lp(platform, baseline.at)
    return {
      moves: lpThen ? Object.fromEntries(movesOf(entries, byTier, baseline, lpThen)) : {},
      since: baseline.at,
      cutoffsThen: baseline.cutoffs,
      lines,
    }
  } catch {
    return empty
  }
}
