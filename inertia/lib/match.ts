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

export interface TeamTotals {
  kills: number
  deaths: number
  gold: number
  damage: number
}

export function teamTotals(match: Match): Record<number, TeamTotals> {
  const totals: Record<number, TeamTotals> = {
    100: { kills: 0, deaths: 0, gold: 0, damage: 0 },
    200: { kills: 0, deaths: 0, gold: 0, damage: 0 },
  }
  for (const p of match.participants) {
    const t = totals[p.teamId]
    if (!t) continue
    t.kills += p.kills || 0
    t.deaths += p.deaths || 0
    t.gold += p.goldEarned || 0
    t.damage += p.totalDamageDealtToChampions || 0
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
  const kda = (p.kills + p.assists) / Math.max(1, p.deaths)
  return (
    kda * 18 +
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

/** The enemy in the same lane, falling back to any enemy when roles are absent. */
export function laneOpponent(match: Match, p: Participant | undefined) {
  if (!p) return undefined
  const sameRole = match.participants.find(
    (o) => o.teamId !== p.teamId && o.position && o.position === p.position
  )
  return sameRole || match.participants.find((o) => o.teamId !== p.teamId)
}

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

export function frameValue(entry: TimelineEntry, key: 'gold' | 'cs' | 'xp') {
  if (key === 'gold') return entry.goldTotal || 0
  if (key === 'cs') return (entry.cs || 0) + (entry.jungleCs || 0)
  return entry.xp || 0
}

export function runeSet(frames: TimelineEntry[], p: Participant | undefined): RuneSet {
  const earliest = frames[0]
  if (earliest?.perks) {
    return {
      keystone: earliest.perks.keystone,
      primaryStyle: earliest.perks.primaryStyle,
      secondaryStyle: earliest.perks.secondaryStyle,
      runes: (earliest.perks.runes ?? []).filter((r) => r > 0),
      statPerks: earliest.perks.statPerks || { offense: 0, flex: 0, defense: 0 },
    }
  }
  return {
    keystone: 0,
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

/** Total gold per side at each timeline frame. */
export function teamGoldSeries(match: Match) {
  const frames = match.timeline ?? []
  if (!frames.length) return { times: [] as number[], blue: [] as number[], red: [] as number[] }

  const byTime = new Map<number, { blue: number; red: number }>()
  for (const entry of frames) {
    const bucket = byTime.get(entry.frameMs) ?? { blue: 0, red: 0 }
    if (entry.teamId === 100) bucket.blue += entry.goldTotal || 0
    else bucket.red += entry.goldTotal || 0
    byTime.set(entry.frameMs, bucket)
  }

  const times = [...byTime.keys()].sort((a, b) => a - b)
  return {
    times,
    blue: times.map((t) => byTime.get(t)!.blue),
    red: times.map((t) => byTime.get(t)!.red),
  }
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
