import type { LpReport, RankSnapshot, RankedQueue } from '#types/desktop'

/**
 * LP change rules (docs/desktop-sync.md §4.4). Pure: no clock, no database.
 *
 * An LP change is only believable when the app saw the rank right before and
 * right after this game and nothing else happened in between, so every rule
 * below is about proving that the two snapshots are exactly one game apart.
 */

export const TIERS = [
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'EMERALD',
  'DIAMOND',
  'MASTER',
  'GRANDMASTER',
  'CHALLENGER',
] as const

/** Master and above share one LP ladder with no divisions. */
export const APEX_TIERS = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER'])
export const DIVISIONS = ['IV', 'III', 'II', 'I'] as const

/** Ladder value where Master 0 LP sits: Diamond I 100 LP, one step past the last division. */
export const APEX_FLOOR = 2800

export const RANKED_QUEUES: Record<number, RankedQueue> = {
  420: 'RANKED_SOLO_5x5',
  440: 'RANKED_FLEX_SR',
}

const THIRTY_MINUTES = 30 * 60 * 1000

/**
 * A rank as one number: Iron IV 0 LP is 0, every division adds 100, and all
 * apex tiers sit on one ladder from 2800, where Riot ranks them by LP alone.
 * Null when the rank is not a real one.
 */
export function ladder(rank: Pick<RankSnapshot, 'tier' | 'division' | 'lp'>): number | null {
  const tier = String(rank.tier ?? '').toUpperCase()
  const lp = Number(rank.lp)
  if (!Number.isInteger(lp) || lp < 0) return null
  if (APEX_TIERS.has(tier)) return APEX_FLOOR + lp

  const tierIndex = TIERS.indexOf(tier as (typeof TIERS)[number])
  const divisionIndex = DIVISIONS.indexOf(
    String(rank.division ?? '').toUpperCase() as (typeof DIVISIONS)[number]
  )
  if (tierIndex === -1 || divisionIndex === -1 || lp > 100) return null
  return tierIndex * 400 + divisionIndex * 100 + lp
}

export interface GameFactsForLp {
  queueId: number
  gameCreation: number
  /** Seconds. */
  gameDuration: number
  /** The uploader's result. */
  win: boolean
}

export interface AcceptedLpChange {
  queue: RankedQueue
  before: RankSnapshot
  after: RankSnapshot
  delta: number
}

export type LpVerdict = { ok: true; change: AcceptedLpChange } | { ok: false; reason: string }

function snapshotProblem(name: string, value: unknown): string | null {
  if (!value || typeof value !== 'object') return `${name} snapshot missing`
  const snapshot = value as Record<string, unknown>
  for (const key of ['lp', 'wins', 'losses']) {
    const n = snapshot[key]
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) {
      return `${name}.${key} is not a count`
    }
  }
  if (typeof snapshot.at !== 'number' || !Number.isFinite(snapshot.at)) {
    return `${name}.at is not a timestamp`
  }
  if (snapshot.provisional === true) return `${name} snapshot is provisional`
  if (typeof snapshot.tier !== 'string') return `${name}.tier missing`
  if (ladder(snapshot as unknown as RankSnapshot) === null) {
    // Placements report no tier ("", "NONE", "UNRANKED"): provisional too.
    return `${name} rank ${String(snapshot.tier)} ${String(snapshot.division ?? '')} is not valid`
  }
  return null
}

function promoted(before: RankSnapshot, after: RankSnapshot) {
  const tierOf = (rank: RankSnapshot) => TIERS.indexOf(rank.tier.toUpperCase() as any)
  const divisionOf = (rank: RankSnapshot) =>
    APEX_TIERS.has(rank.tier.toUpperCase())
      ? 0
      : DIVISIONS.indexOf(String(rank.division ?? '').toUpperCase() as any)
  return (
    tierOf(after) > tierOf(before) ||
    (tierOf(after) === tierOf(before) && divisionOf(after) > divisionOf(before))
  )
}

/** Normalised copy: upper-case names, no division for apex tiers. */
function clean(snapshot: RankSnapshot): RankSnapshot {
  const tier = snapshot.tier.toUpperCase()
  return {
    tier,
    division: APEX_TIERS.has(tier) ? 'I' : String(snapshot.division).toUpperCase(),
    lp: snapshot.lp,
    wins: snapshot.wins,
    losses: snapshot.losses,
    at: snapshot.at,
  }
}

export function validateLpChange(report: unknown, game: GameFactsForLp): LpVerdict {
  const reject = (reason: string): LpVerdict => ({ ok: false, reason })
  if (!report || typeof report !== 'object') return reject('lp is not an object')
  const lp = report as Partial<LpReport>

  const expected = RANKED_QUEUES[game.queueId]
  if (!expected) return reject(`queue ${game.queueId} has no LP`)
  if (lp.queue !== expected) return reject(`queue ${String(lp.queue)} does not match ${expected}`)

  const problem = snapshotProblem('before', lp.before) ?? snapshotProblem('after', lp.after)
  if (problem) return reject(problem)
  const before = clean(lp.before!)
  const after = clean(lp.after!)

  // Exactly one game apart, and it was this one.
  if (after.wins + after.losses !== before.wins + before.losses + 1) {
    return reject('snapshots are not exactly one game apart')
  }
  const expectedWins = before.wins + (game.win ? 1 : 0)
  if (after.wins !== expectedWins) return reject('snapshots disagree with the game result')

  // The app takes `before` when the game clock starts, after the loading
  // screen, so it can trail `gameCreation` by minutes. What matters is that
  // it predates the result; the one-game rule above does the real guarding.
  const gameEnd = game.gameCreation + game.gameDuration * 1000
  if (before.at >= gameEnd) return reject('before snapshot taken after the game ended')
  if (after.at < gameEnd) return reject('after snapshot taken before the game ended')
  if (after.at - gameEnd > THIRTY_MINUTES) return reject('after snapshot taken too long after')

  const delta = ladder(after)! - ladder(before)!
  if (Math.abs(delta) > 100) return reject(`delta ${delta} is out of range`)
  if (game.win) {
    // A win always gains LP; only a promotion may land on the same ladder value.
    if (delta < 0 || (delta === 0 && !promoted(before, after))) {
      return reject(`win with delta ${delta}`)
    }
  } else if (delta > 0 || (delta === 0 && before.lp !== 0)) {
    // A loss at 0 LP (or under demotion protection) costs nothing; otherwise it costs LP.
    return reject(`loss with delta ${delta}`)
  }

  return { ok: true, change: { queue: expected, before, after, delta } }
}
