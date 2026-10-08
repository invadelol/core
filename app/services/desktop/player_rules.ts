import { createHash } from 'node:crypto'
import { APEX_TIERS, DIVISIONS, TIERS, ladder } from '#services/desktop/lp'
import type {
  ObservationContext,
  ObservedMastery,
  ObservedRank,
  PlayerSnapshot,
  RankedQueue,
} from '#types/desktop'

/**
 * Rules for player snapshots (docs/desktop-sync.md §6). Pure: the clock, the
 * champion list and the stored data come in as arguments.
 *
 * A snapshot is what the League client showed about a player, read on
 * somebody's computer. None of these rules can prove it is true; they keep
 * a forged or corrupted one cheap to reject, and keep one that slipped
 * through from moving a profile further than a few games could.
 */

export const RANKED_QUEUE_TYPES: readonly RankedQueue[] = ['RANKED_SOLO_5x5', 'RANKED_FLEX_SR']
const CONTEXTS = new Set<ObservationContext>(['self', 'profile', 'champ_select', 'in_game'])

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
/** A snapshot older than this is not worth applying (§6.2, §6.3). */
export const OBSERVATION_MAX_AGE_MS = 24 * HOUR
const FUTURE_SKEW_MS = 5 * MINUTE
/** A second device must report the same rank within this window to corroborate (§6.4). */
export const CORROBORATION_WINDOW_MS = 6 * HOUR
/** Further than this from a rank stored within a day is not a few games' worth (§6.4). */
export const IMPLAUSIBLE_LADDER_JUMP = 800
const JUMP_WINDOW_MS = 24 * HOUR
/** A sampled snapshot is only judged when Riot is read this soon after it (§1.2). */
export const AUDIT_WINDOW_MS = 10 * MINUTE
export const AUDIT_LP_TOLERANCE = 30

export interface PlayerContext {
  now: number
  /** The batch's platform, canonical, or null when it is not a supported one. */
  platform: string | null
  /** Champion ids the website knows; null falls back to the id range, as for games. */
  championIds: ReadonlySet<number> | null
}

export type PlayerVerdict = { ok: true; player: PlayerSnapshot } | { ok: false; reason: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max

const absent = (value: unknown) => value === undefined || value === null

/** Characters, not UTF-16 units: Riot IDs are often Korean, Chinese or accented. */
const length = (value: string) => [...value].length

function riotIdPart(value: unknown, max: number): value is string {
  return (
    typeof value === 'string' &&
    length(value) >= 1 &&
    length(value) <= max &&
    !value.includes('#') &&
    value.trim() === value
  )
}

function checkRank(entry: unknown, self: boolean): { rank?: ObservedRank; reason?: string } {
  if (!entry || typeof entry !== 'object') return { reason: 'rank entry is not an object' }
  const rank = entry as Record<string, unknown>
  if (!RANKED_QUEUE_TYPES.includes(rank.queue as RankedQueue)) {
    return { reason: `queue ${String(rank.queue)} is not ranked solo or flex` }
  }
  if (!absent(rank.provisional) && typeof rank.provisional !== 'boolean') {
    return { reason: 'provisional is not a boolean' }
  }
  // Placements have no rank to apply; the client may not even send a tier.
  if (rank.provisional === true) return {}

  const tier = typeof rank.tier === 'string' ? rank.tier.toUpperCase() : ''
  if (!TIERS.includes(tier as (typeof TIERS)[number])) {
    return { reason: `tier ${String(rank.tier)} is not valid` }
  }
  const apex = APEX_TIERS.has(tier)
  const rawDivision = typeof rank.division === 'string' ? rank.division.toUpperCase() : null
  let division: string
  if (apex) {
    // League-v4 says "I" for apex tiers; an empty division means the same.
    if (rawDivision !== null && rawDivision !== 'I' && rawDivision !== '') {
      return { reason: `division ${rawDivision} is not valid for ${tier}` }
    }
    division = 'I'
  } else {
    if (!DIVISIONS.includes(rawDivision as (typeof DIVISIONS)[number])) {
      return { reason: `division ${String(rank.division)} is not valid` }
    }
    division = rawDivision!
  }
  if (!isInt(rank.lp, 0, apex ? 5000 : 100))
    return { reason: `lp ${String(rank.lp)} is out of range` }
  if (!isInt(rank.wins, 0, 5000)) return { reason: 'wins is out of range' }
  if (!absent(rank.losses)) {
    if (!isInt(rank.losses, 0, 5000)) return { reason: 'losses is out of range' }
    // The client only shows the signed-in account's losses.
    if (!self) return { reason: 'losses are only known for the signed-in account' }
  }
  return {
    rank: {
      queue: rank.queue as RankedQueue,
      tier,
      division,
      lp: rank.lp as number,
      wins: rank.wins as number,
      losses: absent(rank.losses) ? null : (rank.losses as number),
    },
  }
}

function checkMastery(
  entry: unknown,
  context: PlayerContext
): { mastery?: ObservedMastery; reason?: string } {
  if (!entry || typeof entry !== 'object') return { reason: 'mastery entry is not an object' }
  const m = entry as Record<string, unknown>
  const known = context.championIds
    ? typeof m.championId === 'number' && context.championIds.has(m.championId)
    : isInt(m.championId, 1, 1999)
  if (!known) return { reason: `champion ${String(m.championId)} is unknown` }
  if (!isInt(m.championLevel, 0, 1000)) return { reason: 'championLevel is out of range' }
  if (!isInt(m.championPoints, 0, 100_000_000)) return { reason: 'championPoints is out of range' }
  if (!isInt(m.lastPlayTime, 0, context.now + FUTURE_SKEW_MS)) {
    return { reason: 'lastPlayTime is in the future or not a timestamp' }
  }
  return {
    mastery: {
      championId: m.championId as number,
      championLevel: m.championLevel as number,
      championPoints: m.championPoints as number,
      lastPlayTime: m.lastPlayTime as number,
    },
  }
}

/**
 * The per-player checks of §6.2. A player that fails is answered `rejected`
 * on its own; the rest of the batch goes on. Returns the snapshot
 * normalised: raw PUUID and tier names in one case, provisional queues
 * dropped, a private profile's mastery dropped.
 */
export function validatePlayer(input: unknown, context: PlayerContext): PlayerVerdict {
  const reject = (reason: string): PlayerVerdict => ({ ok: false, reason })
  if (!input || typeof input !== 'object') return reject('player is not an object')
  const p = input as Record<string, unknown>

  if (typeof p.rawPuuid !== 'string' || !UUID.test(p.rawPuuid)) {
    return reject('rawPuuid is not a UUID')
  }
  if (!riotIdPart(p.gameName, 16)) return reject('gameName is not a valid Riot ID name')
  if (!riotIdPart(p.tagLine, 5)) return reject('tagLine is not a valid Riot ID tag')
  if (!context.platform) return reject('platform is not supported')

  if (!isInt(p.observedAt, context.now - OBSERVATION_MAX_AGE_MS, context.now + FUTURE_SKEW_MS)) {
    return reject('observedAt is not within the last 24 hours')
  }
  if (!absent(p.profileIconId) && !isInt(p.profileIconId, 0, 100_000)) {
    return reject('profileIconId is out of range')
  }
  if (!absent(p.summonerLevel) && !isInt(p.summonerLevel, 1, 5000)) {
    return reject('summonerLevel is out of range')
  }
  if (!absent(p.privacy) && p.privacy !== 'PUBLIC' && p.privacy !== 'PRIVATE') {
    return reject('privacy is neither PUBLIC nor PRIVATE')
  }
  if (!absent(p.self) && typeof p.self !== 'boolean') return reject('self is not a boolean')
  if (!absent(p.context) && !CONTEXTS.has(p.context as ObservationContext)) {
    return reject(`context ${String(p.context)} is not valid`)
  }
  const self = p.self === true

  let ranks: ObservedRank[] | null = null
  if (!absent(p.ranks)) {
    if (!Array.isArray(p.ranks)) return reject('ranks is not a list')
    if (p.ranks.length > 2) return reject('more than two rank entries')
    const queues = new Set<string>()
    ranks = []
    for (const entry of p.ranks) {
      const queue = (entry as { queue?: unknown } | null)?.queue
      if (queues.has(String(queue))) return reject(`queue ${String(queue)} is listed twice`)
      queues.add(String(queue))
      const checked = checkRank(entry, self)
      if (checked.reason) return reject(checked.reason)
      if (checked.rank) ranks.push(checked.rank)
    }
  }

  let mastery: ObservedMastery[] | null = null
  if (!absent(p.mastery)) {
    if (!Array.isArray(p.mastery)) return reject('mastery is not a list')
    if (p.mastery.length > 10) return reject('more than ten mastery entries')
    const champions = new Set<number>()
    mastery = []
    for (const entry of p.mastery) {
      const checked = checkMastery(entry, context)
      if (checked.reason) return reject(checked.reason)
      if (champions.has(checked.mastery!.championId)) {
        return reject(`champion ${checked.mastery!.championId} is listed twice`)
      }
      champions.add(checked.mastery!.championId)
      mastery.push(checked.mastery!)
    }
  }

  const privacy = absent(p.privacy) ? null : (p.privacy as 'PUBLIC' | 'PRIVATE')
  return {
    ok: true,
    player: {
      rawPuuid: p.rawPuuid.toLowerCase(),
      gameName: p.gameName as string,
      tagLine: p.tagLine as string,
      platform: context.platform,
      profileIconId: absent(p.profileIconId) ? null : (p.profileIconId as number),
      summonerLevel: absent(p.summonerLevel) ? null : (p.summonerLevel as number),
      privacy,
      self,
      context: absent(p.context) ? null : (p.context as ObservationContext),
      observedAt: p.observedAt as number,
      ranks,
      // A private profile's mastery is never kept, whatever the app sent.
      mastery: privacy === 'PRIVATE' ? null : mastery,
    },
  }
}

/** What was reported, without when or where it was seen (the app's own dedup rule, §6.6). */
export function snapshotHash(player: PlayerSnapshot): string {
  const reported: Partial<PlayerSnapshot> = { ...player }
  delete reported.observedAt
  delete reported.context
  return createHash('sha256').update(JSON.stringify(reported)).digest('hex')
}

/** A stored `riot_rank` row, as the rules need it. */
export interface StoredRank {
  queue: string
  tier: string | null
  division: string | null
  lp: number | null
  wins: number | null
  losses: number | null
  /** Epoch ms. */
  fetchedAt: number
}

/**
 * Same rank, as far as the snapshot can tell: unknown losses are not a
 * difference, known ones that a stored row lacks are.
 */
export function sameRank(stored: StoredRank, observed: ObservedRank): boolean {
  const division = (rank: { tier: string | null; division: string | null }) =>
    APEX_TIERS.has(String(rank.tier).toUpperCase()) ? 'I' : String(rank.division).toUpperCase()
  return (
    String(stored.tier).toUpperCase() === observed.tier &&
    division(stored) === observed.division &&
    stored.lp === observed.lp &&
    stored.wins === observed.wins &&
    (observed.losses === null || stored.losses === observed.losses)
  )
}

/**
 * A queue more than 800 ladder points away from a rank stored within a day
 * of the snapshot: no run of games does that, a forged report does (§6.4).
 */
export function implausibleJump(
  ranks: ObservedRank[] | null,
  stored: ReadonlyMap<string, StoredRank>,
  observedAt: number
): boolean {
  for (const rank of ranks ?? []) {
    const previous = stored.get(rank.queue)
    if (!previous || Math.abs(previous.fetchedAt - observedAt) > JUMP_WINDOW_MS) continue
    const before = ladder({
      tier: previous.tier ?? '',
      division: previous.division,
      lp: previous.lp ?? 0,
    })
    const after = ladder(rank)
    if (before !== null && after !== null && Math.abs(after - before) > IMPLAUSIBLE_LADDER_JUMP) {
      return true
    }
  }
  return false
}

/** Tier, division and LP per queue: what two devices must agree on to corroborate. */
export function sameRanks(a: ObservedRank[] | null, b: ObservedRank[] | null): boolean {
  if (!a || !b) return false
  const key = (ranks: ObservedRank[]) =>
    ranks
      .map((rank) => `${rank.queue}:${rank.tier}:${rank.division}:${rank.lp}`)
      .sort()
      .join('|')
  return key(a) === key(b)
}

export interface PreviousReport {
  deviceId: string | null
  ipHash: string | null
  gameName: string
  tagLine: string
  platform: string
  observedAt: number
  ranks: ObservedRank[] | null
  status: string
}

/**
 * An untrusted device's report about someone else stands when another
 * device, on another network, reported the same Riot ID with the same rank
 * within six hours (§6.4).
 */
export function corroborates(
  previous: PreviousReport | null | undefined,
  player: PlayerSnapshot,
  reporter: { deviceId: string; ipHash: string | null }
): boolean {
  if (!previous || previous.status === 'conflict') return false
  if (!previous.deviceId || previous.deviceId === reporter.deviceId) return false
  if (!previous.ipHash || !reporter.ipHash || previous.ipHash === reporter.ipHash) return false
  if (Math.abs(previous.observedAt - player.observedAt) > CORROBORATION_WINDOW_MS) return false
  if (previous.platform !== player.platform) return false
  if (
    previous.gameName.toLowerCase() !== player.gameName.toLowerCase() ||
    previous.tagLine.toLowerCase() !== player.tagLine.toLowerCase()
  ) {
    return false
  }
  return sameRanks(previous.ranks, player.ranks)
}

/** A league-v4 entry, as the audit needs it. */
export interface RiotEntry {
  queueType: string
  tier: string
  rank: string
  leaguePoints: number
  wins: number
  losses: number
}

export type AuditVerdict =
  | { verdict: 'match' }
  | { verdict: 'inconclusive'; reason: string }
  | { verdict: 'mismatch'; differences: string[] }

/**
 * Judges an applied snapshot against league-v4 (§1.2). Only what no honest
 * client could have reported counts as a mismatch:
 *
 * - judged only when Riot was read within 10 minutes of the snapshot;
 * - counts never go down, so fewer wins (or fewer known losses) is a lie;
 * - a game that provably ended in between (more wins, more known losses)
 *   makes the queue inconclusive;
 * - otherwise tier and division must be the same and LP within 30. Another
 *   player's losses are hidden, so for them one unseen loss could explain a
 *   drop of up to 100 ladder points (a loss, a demotion): such a drop is
 *   inconclusive, never a mismatch.
 */
export function judgeSnapshot(
  ranks: ObservedRank[],
  entries: RiotEntry[],
  timing: { observedAt: number; checkedAt: number }
): AuditVerdict {
  if (timing.checkedAt - timing.observedAt > AUDIT_WINDOW_MS) {
    return { verdict: 'inconclusive', reason: 'Riot was read too long after the snapshot' }
  }
  const byQueue = new Map(entries.map((entry) => [entry.queueType, entry]))
  const differences: string[] = []
  let judged = 0
  for (const rank of ranks) {
    const riot = byQueue.get(rank.queue)
    if (!riot) {
      differences.push(`${rank.queue}: Riot has no rank`)
      continue
    }
    const knownLosses = rank.losses !== null
    if (riot.wins < rank.wins || (knownLosses && riot.losses < rank.losses!)) {
      differences.push(`${rank.queue}: more games reported than Riot has`)
      continue
    }
    if (riot.wins > rank.wins || (knownLosses && riot.losses > rank.losses!)) continue

    const riotRank = { tier: riot.tier, division: riot.rank, lp: riot.leaguePoints }
    const drop = (ladder(rank) ?? 0) - (ladder(riotRank) ?? 0)
    if (!knownLosses && drop > 0 && drop <= 100) continue

    judged++
    const tier = riot.tier.toUpperCase()
    const division = APEX_TIERS.has(tier) ? 'I' : riot.rank.toUpperCase()
    if (tier !== rank.tier || division !== rank.division) {
      differences.push(
        `${rank.queue}: ${rank.tier} ${rank.division} reported, Riot has ${tier} ${division}`
      )
    } else if (Math.abs(riot.leaguePoints - rank.lp) > AUDIT_LP_TOLERANCE) {
      differences.push(`${rank.queue}: ${rank.lp} LP reported, Riot has ${riot.leaguePoints}`)
    }
  }
  if (differences.length) return { verdict: 'mismatch', differences }
  return judged ? { verdict: 'match' } : { verdict: 'inconclusive', reason: 'games ended since' }
}
