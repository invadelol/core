import type { Match, Participant, RuneSet, TimelineEntry } from './types.js'
import { POSITION_ORDER } from './assets.js'

export function matchMinutes(match: Pick<Match, 'duration'>) {
  return Math.max((match.duration || 0) / 60, 1)
}

export function teamWon(match: Match, teamId: number) {
  return teamId === 100 ? Boolean(match.t1Win) : Boolean(match.t2Win)
}

/** Winning side first, so the scoreboard always reads top-down. */
export function teamOrder(match: Match) {
  return teamWon(match, 100) ? [100, 200] : [200, 100]
}

/** Team members sorted by lane, so both sides line up row for row. */
export function teamMembers(match: Match, teamId: number) {
  return match.participants
    .filter((p) => p.teamId === teamId)
    .sort((a, b) => {
      const ai = POSITION_ORDER.indexOf(a.position)
      const bi = POSITION_ORDER.indexOf(b.position)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
}

export function objectives(match: Match, teamId: number) {
  const blue = teamId === 100
  return {
    towers: blue ? match.t1Towers : match.t2Towers,
    inhibs: blue ? match.t1Inhibs : match.t2Inhibs,
    dragons: blue ? match.t1Dragons : match.t2Dragons,
    barons: blue ? match.t1Barons : match.t2Barons,
    heralds: blue ? match.t1Heralds : match.t2Heralds,
  }
}

/** Champions each side removed from the draft, in ban order. */
export function bansOf(match: Match, teamId: number): number[] {
  const list = teamId === 100 ? match.t1Bans : match.t2Bans
  return (list ?? []).filter((id) => id > 0)
}

export function hasDraft(match: Match) {
  return bansOf(match, 100).length > 0 || bansOf(match, 200).length > 0
}

/** Modes where Riot records no lane, so role-based UI has to stand down. */
export function isLanedMode(match: Match) {
  return match.participants.some((p) => POSITION_ORDER.includes(p.position))
}

export interface TeamTotals {
  kills: number
  deaths: number
  assists: number
  gold: number
  damage: number
  damageTaken: number
  vision: number
  cs: number
}

export function teamTotals(match: Match): Record<number, TeamTotals> {
  const empty = (): TeamTotals => ({
    kills: 0,
    deaths: 0,
    assists: 0,
    gold: 0,
    damage: 0,
    damageTaken: 0,
    vision: 0,
    cs: 0,
  })
  const totals: Record<number, TeamTotals> = { 100: empty(), 200: empty() }
  for (const p of match.participants) {
    const t = totals[p.teamId]
    if (!t) continue
    t.kills += p.kills || 0
    t.deaths += p.deaths || 0
    t.assists += p.assists || 0
    t.gold += p.goldEarned || 0
    t.damage += p.totalDamageDealtToChampions || 0
    t.damageTaken += p.damageTaken || 0
    t.vision += p.visionScore || 0
    t.cs += p.cs || 0
  }
  return totals
}

export function killParticipation(p: Participant, totals: Record<number, TeamTotals>) {
  const teamKills = totals[p.teamId]?.kills || 0
  if (!teamKills) return 0
  return ((p.kills + p.assists) / teamKills) * 100
}

export function damageShare(p: Participant, totals: Record<number, TeamTotals>) {
  const teamDamage = totals[p.teamId]?.damage || 0
  if (!teamDamage) return 0
  return ((p.totalDamageDealtToChampions || 0) / teamDamage) * 100
}

export function goldShare(p: Participant, totals: Record<number, TeamTotals>) {
  const teamGold = totals[p.teamId]?.gold || 0
  if (!teamGold) return 0
  return ((p.goldEarned || 0) / teamGold) * 100
}

/* ── Score ─────────────────────────────────────────────────────────

   One 0–100 number for how a game went, built from five sub-scores so
   the number can explain itself:

     Fighting    KDA, kill participation, staying alive
     Damage      damage to champions, and damage soaked for the team
     Farming     gold and creep score
     Vision      vision score
     Objectives  damage to objectives

   Every stat is rated twice. Once against the lobby, as a z-score over
   the ten players squashed onto 0–1, so one runaway carry does not
   flatten everybody else. And once against the lane opponent, as a
   share of the two players' combined total, because a support's farm
   means nothing next to a mid laner's but a lot next to the other
   support's. Roles then weight the five categories by what the role is
   asked to do. A win adds a fixed ten points: it is the point of the
   game, but it does not turn a bad game into a good one.

   Games under five minutes are remakes and are not scored. */

export const SCORE_CATEGORIES = ['fighting', 'damage', 'farming', 'vision', 'objectives'] as const
export type ScoreCategory = (typeof SCORE_CATEGORIES)[number]

export const SCORE_CATEGORY_LABEL: Record<ScoreCategory, string> = {
  fighting: 'Fighting',
  damage: 'Damage',
  farming: 'Farming',
  vision: 'Vision',
  objectives: 'Objectives',
}

type ScoreMetric =
  | 'kda'
  | 'kp'
  | 'alive'
  | 'dealt'
  | 'taken'
  | 'gold'
  | 'cs'
  | 'vision'
  | 'objectives'

/** How each category is assembled from raw stats. */
const CATEGORY_METRICS: Record<ScoreCategory, Partial<Record<ScoreMetric, number>>> = {
  fighting: { kda: 0.45, kp: 0.35, alive: 0.2 },
  damage: { dealt: 0.75, taken: 0.25 },
  farming: { gold: 0.5, cs: 0.5 },
  vision: { vision: 1 },
  objectives: { objectives: 1 },
}

const ROLE_WEIGHTS: Record<string, Record<ScoreCategory, number>> = {
  TOP: { fighting: 25, damage: 25, farming: 25, vision: 8, objectives: 17 },
  JUNGLE: { fighting: 30, damage: 15, farming: 15, vision: 15, objectives: 25 },
  MIDDLE: { fighting: 28, damage: 30, farming: 25, vision: 7, objectives: 10 },
  BOTTOM: { fighting: 27, damage: 32, farming: 28, vision: 5, objectives: 8 },
  UTILITY: { fighting: 40, damage: 15, farming: 0, vision: 40, objectives: 5 },
  /* ARAM and the other roleless modes: fights are the whole game. */
  NONE: { fighting: 45, damage: 45, farming: 10, vision: 0, objectives: 0 },
}

/** Below this a game is a remake, and a score would only be noise. */
const MIN_SCORED_SECONDS = 300

export interface PlayerScore {
  /** 0–100 overall. */
  score: number
  /** 0–100 per category, before role weighting. */
  categories: Record<ScoreCategory, number>
  /** The role weights that produced the overall, summing to 100. */
  weights: Record<ScoreCategory, number>
}

function scoreMetrics(p: Participant, totals: Record<number, TeamTotals>) {
  return {
    kda: (p.kills + p.assists) / Math.max(1, p.deaths),
    kp: killParticipation(p, totals),
    /* Fewer deaths is better; negated so that "higher is better" holds
       for every metric and one formula rates them all. */
    alive: -(p.deaths || 0),
    dealt: p.totalDamageDealtToChampions,
    taken: p.damageTaken,
    gold: p.goldEarned,
    cs: p.cs,
    vision: p.visionScore,
    objectives: p.damageDealtToObjectives,
  } satisfies Record<ScoreMetric, number | undefined>
}

/** A z-score over the lobby, squashed onto 0–1 (0.5 is the lobby mean). */
function lobbyStanding(value: number, values: number[]) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  const sd = Math.max(Math.sqrt(variance), Math.abs(mean) * 0.05, 1e-6)
  return 1 / (1 + Math.exp(-1.7 * ((value - mean) / sd)))
}

/** Share of the two laners' combined total, 0.5 when even. */
function laneEdge(mine: number, theirs: number, key: ScoreMetric) {
  if (key === 'alive') return (1 - theirs) / (2 - mine - theirs)
  const total = mine + theirs
  return total > 0 ? mine / total : 0.5
}

const scoreCache = new WeakMap<Match, Record<string, PlayerScore>>()

/** Every player's score and breakdown in one lobby. Empty for a remake. */
export function scoreLobby(match: Match): Record<string, PlayerScore> {
  const cached = scoreCache.get(match)
  if (cached) return cached

  const result: Record<string, PlayerScore> = {}
  scoreCache.set(match, result)
  if ((match.duration || 0) < MIN_SCORED_SECONDS || match.participants.length < 2) return result

  const totals = teamTotals(match)
  const laned = isLanedMode(match)
  const rows = match.participants.map((p) => ({ p, m: scoreMetrics(p, totals) }))
  const byPuuid = new Map(rows.map((row) => [row.p.puuid, row]))

  /* A payload that does not carry a stat (an older cached list, a mode
     without it) drops that stat for everyone rather than zeroing it, so a
     game scores the same wherever it is read. */
  const present = (key: ScoreMetric) =>
    rows.some((r) => r.m[key] !== undefined && r.m[key] !== null)
  const column = (key: ScoreMetric) => rows.map((r) => r.m[key] || 0)
  const columns = new Map<ScoreMetric, number[]>()

  for (const { p, m } of rows) {
    const opponent = laned ? laneOpponent(match, p) : undefined
    const theirs = opponent ? byPuuid.get(opponent.puuid)?.m : undefined

    const rate = (key: ScoreMetric) => {
      if (!columns.has(key)) columns.set(key, column(key))
      const value = m[key] || 0
      const lobby = lobbyStanding(value, columns.get(key)!)
      if (!theirs) return lobby
      return lobby * 0.5 + laneEdge(value, theirs[key] || 0, key) * 0.5
    }

    const categories = {} as Record<ScoreCategory, number>
    const available: ScoreCategory[] = []
    for (const category of SCORE_CATEGORIES) {
      let sum = 0
      let weight = 0
      for (const [key, w] of Object.entries(CATEGORY_METRICS[category]) as [
        ScoreMetric,
        number,
      ][]) {
        if (!present(key)) continue
        sum += rate(key) * w
        weight += w
      }
      categories[category] = weight ? Math.round((sum / weight) * 100) : 0
      if (weight) available.push(category)
    }

    const role = (laned && ROLE_WEIGHTS[p.position]) || ROLE_WEIGHTS.NONE
    const roleTotal = available.reduce((n, c) => n + role[c], 0) || 1
    const weights = {} as Record<ScoreCategory, number>
    let share = 0
    for (const category of SCORE_CATEGORIES) {
      const w = available.includes(category) ? role[category] / roleTotal : 0
      weights[category] = Math.round(w * 100)
      share += (categories[category] / 100) * w
    }

    const raw = 8 + share * 82 + (p.win ? 10 : 0)
    result[p.puuid] = {
      score: Math.max(0, Math.min(100, Math.round(raw))),
      categories,
      weights,
    }
  }
  return result
}

/** Every player's overall score in one lobby, 0–100. Empty for a remake. */
export function lobbyScores(match: Match): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [puuid, entry] of Object.entries(scoreLobby(match))) out[puuid] = entry.score
  return out
}

export interface LobbyRanking {
  /** 0–100, see scoreLobby. Empty for a remake. */
  score: Record<string, number>
  /** 1–10, best first. */
  rank: Record<string, number>
  mvpPuuid: string | null
  acePuuid: string | null
}

export function rankLobby(match: Match): LobbyRanking {
  const score = lobbyScores(match)
  const scored = match.participants.filter((p) => score[p.puuid] !== undefined)
  const sorted = [...scored].sort((a, b) => score[b.puuid] - score[a.puuid])

  const rank: Record<string, number> = {}
  sorted.forEach((p, index) => (rank[p.puuid] = index + 1))

  const winningTeam = teamWon(match, 100) ? 100 : 200
  return {
    score,
    rank,
    mvpPuuid: sorted.find((p) => p.teamId === winningTeam)?.puuid ?? null,
    acePuuid: sorted.find((p) => p.teamId !== winningTeam)?.puuid ?? null,
  }
}

export type ScoreTier = 'elite' | 'great' | 'good' | 'fair' | 'poor'

export function scoreTier(score: number): ScoreTier {
  if (score >= 85) return 'elite'
  if (score >= 70) return 'great'
  if (score >= 55) return 'good'
  if (score >= 40) return 'fair'
  return 'poor'
}

/** Gold for the top tier, then down the outcome scale. */
export const SCORE_TONE: Record<ScoreTier, string> = {
  elite: 'var(--color-signal)',
  great: 'var(--color-win)',
  good: 'var(--color-blue)',
  fair: 'var(--color-ink-2)',
  poor: 'var(--color-loss)',
}

export const SCORE_LABEL: Record<ScoreTier, string> = {
  elite: 'Elite',
  great: 'Great',
  good: 'Solid',
  fair: 'Average',
  poor: 'Rough',
}

/** The enemy in the same lane, falling back to the mirrored slot in modes
 *  where Riot records no position at all. */
export function laneOpponent(match: Match, p: Participant | undefined) {
  if (!p) return undefined
  if (p.position) {
    const sameRole = match.participants.find(
      (o) => o.teamId !== p.teamId && o.position === p.position
    )
    if (sameRole) return sameRole
  }
  const mine = match.participants.filter((o) => o.teamId === p.teamId)
  const theirs = match.participants.filter((o) => o.teamId !== p.teamId)
  const index = mine.indexOf(p)
  return theirs[index] ?? theirs[0]
}

/* ── Timeline ──────────────────────────────────────────────────── */

/** Timeline frames grouped by player and ordered in time. */
export function indexTimeline(match: Match | null | undefined) {
  const byPuuid: Record<string, TimelineEntry[]> = {}
  for (const entry of match?.timeline ?? []) {
    const key = entry.puuid || String(entry.participantId)
    ;(byPuuid[key] ||= []).push(entry)
  }
  for (const frames of Object.values(byPuuid)) frames.sort((a, b) => a.frameMs - b.frameMs)
  return byPuuid
}

export type SeriesKey = 'gold' | 'cs' | 'xp' | 'level' | 'kills'

export function frameValue(entry: TimelineEntry, key: SeriesKey) {
  if (key === 'gold') return entry.goldTotal || 0
  if (key === 'cs') return (entry.cs || 0) + (entry.jungleCs || 0)
  if (key === 'level') return entry.level || 0
  if (key === 'kills') return entry.kills || 0
  return entry.xp || 0
}

/** The distinct frame timestamps of a match, ascending. */
export function frameTimes(match: Match | null | undefined) {
  const seen = new Set<number>()
  for (const entry of match?.timeline ?? []) seen.add(entry.frameMs)
  return [...seen].sort((a, b) => a - b)
}

/** The frame a player was in at (or just before) a point in time. */
export function frameAt(frames: TimelineEntry[], ms: number) {
  let found: TimelineEntry | undefined
  for (const frame of frames) {
    if (frame.frameMs > ms) break
    found = frame
  }
  return found ?? frames[0]
}

/**
 * The classic lane read: how far ahead or behind a player was at a given
 * minute. Everything needed for it was already in the timeline and never
 * shown anywhere in the app.
 */
export interface LaneDiff {
  minute: number
  gold: number
  cs: number
  xp: number
  complete: boolean
}

export function laneDiff(
  mine: TimelineEntry[],
  theirs: TimelineEntry[],
  minute: number
): LaneDiff | null {
  if (!mine.length || !theirs.length) return null
  const ms = minute * 60_000
  const a = frameAt(mine, ms)
  const b = frameAt(theirs, ms)
  if (!a || !b) return null
  const played = Math.max(mine[mine.length - 1]?.frameMs ?? 0, 0)
  return {
    minute,
    gold: (a.goldTotal || 0) - (b.goldTotal || 0),
    cs: (a.cs || 0) + (a.jungleCs || 0) - ((b.cs || 0) + (b.jungleCs || 0)),
    xp: (a.xp || 0) - (b.xp || 0),
    complete: played >= ms,
  }
}

/** Total gold per side at each timeline frame, plus the running lead. */
export function teamGoldSeries(match: Match) {
  const frames = match.timeline ?? []
  if (!frames.length) {
    return {
      times: [] as number[],
      blue: [] as number[],
      red: [] as number[],
      diff: [] as number[],
    }
  }

  const byTime = new Map<number, { blue: number; red: number }>()
  for (const entry of frames) {
    const bucket = byTime.get(entry.frameMs) ?? { blue: 0, red: 0 }
    if (entry.teamId === 100) bucket.blue += entry.goldTotal || 0
    else bucket.red += entry.goldTotal || 0
    byTime.set(entry.frameMs, bucket)
  }

  const times = [...byTime.keys()].sort((a, b) => a - b)
  const blue = times.map((t) => byTime.get(t)!.blue)
  const red = times.map((t) => byTime.get(t)!.red)
  return { times, blue, red, diff: times.map((_, i) => blue[i] - red[i]) }
}

/** Either side's total of one metric, frame by frame, plus the running lead. */
export function teamSeries(match: Match, key: SeriesKey) {
  const frames = match.timeline ?? []
  const byTime = new Map<number, { blue: number; red: number }>()
  for (const entry of frames) {
    const bucket = byTime.get(entry.frameMs) ?? { blue: 0, red: 0 }
    const value = frameValue(entry, key)
    if (entry.teamId === 100) bucket.blue += value
    else bucket.red += value
    byTime.set(entry.frameMs, bucket)
  }
  const times = [...byTime.keys()].sort((a, b) => a - b)
  const blue = times.map((t) => byTime.get(t)!.blue)
  const red = times.map((t) => byTime.get(t)!.red)
  return { times, blue, red, diff: times.map((_, i) => blue[i] - red[i]) }
}

/** Summoner's Rift spans roughly 0–15000 on both axes. */
/**
 * Kills scored in each frame, per side.
 *
 * The timeline stores a running kill count per participant, so the difference
 * between consecutive frames is what happened during that minute. That turns
 * a flat gold curve into something you can read events off: the spikes are
 * fights.
 */
export function killsPerFrame(match: Match) {
  const times = frameTimes(match)
  const index = new Map(times.map((t, i) => [t, i]))
  const blue = new Array(times.length).fill(0)
  const red = new Array(times.length).fill(0)

  const running = new Map<number, number>()
  for (const entry of match.timeline ?? []) {
    const i = index.get(entry.frameMs)
    if (i === undefined) continue
    const seen = running.get(entry.participantId) ?? 0
    const gained = Math.max(0, (entry.kills || 0) - seen)
    running.set(entry.participantId, entry.kills || 0)
    if (!gained) continue
    if (entry.teamId === 100) blue[i] += gained
    else red[i] += gained
  }

  return { times, blue, red }
}

export const MAP_SIZE = 15000

export interface MapDot {
  puuid: string
  teamId: number
  championId: number
  /** 0–100, already flipped so 0 is the top of a rendered map. */
  x: number
  y: number
  level: number
}

/** Where every player stood at one moment, ready to plot. */
export function positionsAt(match: Match, ms: number): MapDot[] {
  const byPuuid = indexTimeline(match)
  const dots: MapDot[] = []
  for (const p of match.participants) {
    const frames = byPuuid[p.puuid]
    if (!frames?.length) continue
    const frame = frameAt(frames, ms)
    if (!frame || (!frame.posX && !frame.posY)) continue
    dots.push({
      puuid: p.puuid,
      teamId: p.teamId,
      championId: p.championId,
      x: Math.min(100, Math.max(0, (frame.posX / MAP_SIZE) * 100)),
      y: Math.min(100, Math.max(0, 100 - (frame.posY / MAP_SIZE) * 100)),
      level: frame.level,
    })
  }
  return dots
}

/**
 * Where each player has just come from, so a dot on the map reads as movement
 * rather than a pin. The tail is the frames immediately before `ms`.
 */
export function positionTrails(match: Match, ms: number, length = 1) {
  const byPuuid = indexTimeline(match)
  const trails: Record<string, Array<{ x: number; y: number }>> = {}

  for (const p of match.participants) {
    const frames = byPuuid[p.puuid]
    if (!frames?.length) continue
    const upTo = frames.filter((f) => f.frameMs <= ms).slice(-(length + 1))
    const points = upTo
      .filter((f) => f.posX || f.posY)
      .map((f) => ({
        x: Math.min(100, Math.max(0, (f.posX / MAP_SIZE) * 100)),
        y: Math.min(100, Math.max(0, 100 - (f.posY / MAP_SIZE) * 100)),
      }))
    /* A minute is long enough to recall, die, or take a teleport, and joining
       those two points draws a line straight through the map. Only a plausible
       walk is kept. */
    const walked: Array<{ x: number; y: number }> = []
    for (const point of points) {
      const last = walked[walked.length - 1]
      if (last && Math.hypot(point.x - last.x, point.y - last.y) > 26) walked.length = 0
      walked.push(point)
    }
    if (walked.length > 1) trails[p.puuid] = walked
  }

  return trails
}

export function runeSet(frames: TimelineEntry[], p: Participant | undefined): RuneSet {
  const earliest = frames[0]
  if (earliest?.perks?.keystone) {
    return {
      keystone: earliest.perks.keystone,
      primaryStyle: earliest.perks.primaryStyle,
      secondaryStyle: earliest.perks.secondaryStyle,
      runes: (earliest.perks.runes ?? []).filter((r) => r > 0),
      statPerks: earliest.perks.statPerks || { offense: 0, flex: 0, defense: 0 },
    }
  }
  return {
    keystone: p?.perks?.keystone || 0,
    primaryStyle: p?.perks?.primary || 0,
    secondaryStyle: p?.perks?.sub || 0,
    runes: [],
    statPerks: { offense: 0, flex: 0, defense: 0 },
  }
}

export function skillOrderOf(frames: TimelineEntry[]) {
  return frames.find((f) => Array.isArray(f.skillOrder) && f.skillOrder.length)?.skillOrder ?? []
}

/** Q/W/E/R × 18 levels, each cell holding the level the point was spent at. */
export function skillMatrix(skillOrder: number[]) {
  const keys = ['Q', 'W', 'E', 'R'] as const
  const matrix: Record<(typeof keys)[number], Array<number | null>> = {
    Q: Array(18).fill(null),
    W: Array(18).fill(null),
    E: Array(18).fill(null),
    R: Array(18).fill(null),
  }
  skillOrder.forEach((slot, index) => {
    const level = index + 1
    const key = keys[slot - 1]
    if (!key || level > 18) return
    matrix[key][level - 1] = level
  })
  return matrix
}

/** The order the first three points were spent, e.g. "Q → E → W". */
export function skillPriority(skillOrder: number[]) {
  const keys = ['Q', 'W', 'E', 'R']
  const seen: string[] = []
  for (const slot of skillOrder) {
    const key = keys[slot - 1]
    if (key && key !== 'R' && !seen.includes(key)) seen.push(key)
    if (seen.length === 3) break
  }
  return seen
}

export function totalPings(p: Participant) {
  return (
    (p.allInPings || 0) +
    (p.assistPings || 0) +
    (p.commandPings || 0) +
    (p.dangerPings || 0) +
    (p.enemyMissingPings || 0) +
    (p.enemyVisionPings || 0) +
    (p.getBackPings || 0) +
    (p.needVisionPings || 0) +
    (p.onMyWayPings || 0) +
    (p.pushPings || 0) +
    (p.visionClearedPings || 0) +
    (p.baitPings || 0) +
    (p.holdPings || 0)
  )
}
