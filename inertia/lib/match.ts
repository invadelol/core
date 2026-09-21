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

/**
 * A single number blending combat, economy and vision, used only to rank the
 * ten players of one lobby against each other.
 */
export function performanceScore(match: Match, p: Participant) {
  const minutes = matchMinutes(match)
  const ratio = (p.kills + p.assists) / Math.max(1, p.deaths)
  return (
    ratio * 18 +
    (p.damageDealt || 0) / minutes / 140 +
    (p.goldEarned || 0) / minutes / 70 +
    ((p.visionScore || 0) / minutes) * 2 +
    ((p.cs || 0) / minutes) * 4
  )
}

export interface LobbyRanking {
  score: Record<string, number>
  /** 1–10, best first. */
  rank: Record<string, number>
  /** 0–100, relative to the best player in the lobby. */
  rating: Record<string, number>
  mvpPuuid: string | null
  acePuuid: string | null
}

export function rankLobby(match: Match): LobbyRanking {
  const score: Record<string, number> = {}
  for (const p of match.participants) score[p.puuid] = performanceScore(match, p)

  const sorted = [...match.participants].sort((a, b) => score[b.puuid] - score[a.puuid])
  const best = Math.max(...Object.values(score), 1)

  const rank: Record<string, number> = {}
  const rating: Record<string, number> = {}
  sorted.forEach((p, index) => {
    rank[p.puuid] = index + 1
    rating[p.puuid] = Math.round((score[p.puuid] / best) * 100)
  })

  const winningTeam = teamWon(match, 100) ? 100 : 200
  return {
    score,
    rank,
    rating,
    mvpPuuid: sorted.find((p) => p.teamId === winningTeam)?.puuid ?? null,
    acePuuid: sorted.find((p) => p.teamId !== winningTeam)?.puuid ?? null,
  }
}

export interface Grade {
  letter: 'S' | 'A' | 'B' | 'C' | 'D'
  /** 0-100, the player's rating against the best in that lobby. */
  rating: number
  rank: number
}

/**
 * One glyph that answers "was that a good game".
 *
 * Rank within the lobby is the honest version of this: it is computed from the
 * same ten players who shared the map, so it does not reward padding a stat in
 * a one-sided game. The letter is what gets read; the rating is the detail.
 */
export function gradeFor(lobby: LobbyRanking, puuid: string): Grade | null {
  const rank = lobby.rank[puuid]
  if (!rank) return null
  const rating = lobby.rating[puuid] ?? 0
  if (rank === 1) return { letter: 'S', rating, rank }
  if (rank <= 3) return { letter: 'A', rating, rank }
  if (rank <= 6) return { letter: 'B', rating, rank }
  if (rank <= 8) return { letter: 'C', rating, rank }
  return { letter: 'D', rating, rank }
}

/** Gold for the best game in the lobby, then down the ranking. */
export const GRADE_COLOR: Record<Grade['letter'], string> = {
  S: 'var(--color-gold)',
  A: 'var(--color-win)',
  B: 'var(--color-blue)',
  C: 'var(--color-red)',
  D: 'var(--color-loss)',
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
