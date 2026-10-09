/**
 * One match as the detail views read it (Breakdown, Gold, Timeline): players with their derived
 * shares and lane leads, both teams, and the timeline as per-minute series plus its kills and
 * objectives. Mirrors the desktop app's `MatchDetail` (src/profile/types.ts), so the views and
 * their story logic (`match_story.ts`) are the same in both products. Nothing here is estimated:
 * a value the stored match does not carry is `null` and its row is left out.
 */
import { isLanedMode, isRemake, laneOpponent, matchMinutes, teamTotals } from './match.js'
import type { Match, Participant } from './types.js'

export interface PlayerView {
  participantId: number
  teamId: number
  win: boolean
  puuid: string
  gameName: string
  tagLine: string
  championId: number
  position: string
  level: number
  kills: number
  deaths: number
  assists: number
  /** 0‥1 of the team's kills. */
  kp: number
  cs: number
  csMin: number
  gold: number
  goldShare: number
  damage: number
  physical: number
  magic: number
  trueDamage: number
  damageShare: number
  damageTaken: number
  vision: number
  wardsPlaced: number
  wardsKilled: number
  controlWards: number
  objectiveDamage: number
  turretDamage: number
  /** Participant id of the lane opponent. */
  opponent: number | null
  /** Lead over the lane opponent at 15:00 (needs the timeline and a 15-minute game). */
  gold15: number | null
  xp15: number | null
  cs15: number | null
}

export interface TeamView {
  teamId: number
  win: boolean
  kills: number
  gold: number
  damage: number
  towers: number
  dragons: number
  barons: number
}

export interface Kill {
  t: number
  killer: number
  victim: number
  assists: number[]
  x: number
  y: number
}

export interface Objective {
  t: number
  kind: 'dragon' | 'baron' | 'herald' | 'grubs' | 'monster' | 'tower' | 'inhibitor'
  sub: string
  team: number
  lane: string
  killer: number
}

export interface TimelineView {
  /** Seconds of each frame (one per minute, the last at the end). */
  t: number[]
  /** `gold[i]` belongs to `players[i]`. */
  gold: number[][]
  xp: number[][]
  cs: number[][]
  /** Blue minus red. */
  goldDiff: number[]
  xpDiff: number[]
  kills: Kill[]
  objectives: Objective[]
  /** The match has kill and objective events (stored before they were kept: false). */
  hasEvents: boolean
}

export interface MatchView {
  duration: number
  remake: boolean
  players: PlayerView[]
  teams: TeamView[]
  timeline: TimelineView | null
}

const FRAME_15 = 15 * 60 * 1000

export function matchView(match: Match): MatchView {
  const totals = teamTotals(match)
  const minutes = matchMinutes(match)
  const frames = match.timeline ?? []

  // Participant ids come from the timeline (Riot's ids, the ones events use); without one,
  // the stored order stands in.
  const idOf = new Map<string, number>()
  for (const f of frames) if (f.puuid && !idOf.has(f.puuid)) idOf.set(f.puuid, f.participantId)
  const pid = (p: Participant, i: number) => idOf.get(p.puuid) ?? i + 1

  const times = [...new Set(frames.map((f) => f.frameMs))].sort((a, b) => a - b)
  const frameIndex = new Map(times.map((ms, k) => [ms, k]))
  const series = (puuid: string, read: (f: (typeof frames)[number]) => number) => {
    const row = new Array<number>(times.length).fill(0)
    for (const f of frames) if (f.puuid === puuid) row[frameIndex.get(f.frameMs)!] = read(f)
    // A player missing from a frame keeps their previous value.
    for (let k = 1; k < row.length; k++) if (!row[k] && row[k - 1]) row[k] = row[k - 1]
    return row
  }
  const gold = match.participants.map((p) => series(p.puuid, (f) => f.goldTotal))
  const xp = match.participants.map((p) => series(p.puuid, (f) => f.xp))
  const cs = match.participants.map((p) => series(p.puuid, (f) => f.cs + f.jungleCs))
  const sideDiff = (rows: number[][]) =>
    times.map((_, k) =>
      rows.reduce(
        (s, row, i) =>
          s +
          (match.participants[i].teamId === 100
            ? 1
            : match.participants[i].teamId === 200
              ? -1
              : 0) *
            row[k],
        0
      )
    )
  const at15 = frameIndex.get(FRAME_15)
  const laned = isLanedMode(match)

  const players: PlayerView[] = match.participants.map((p, i) => {
    const team = totals[p.teamId]
    const opp = laned ? laneOpponent(match, p) : undefined
    const j = opp ? match.participants.indexOf(opp) : -1
    const lead15 = (rows: number[][]) =>
      at15 !== undefined && j >= 0 ? rows[i][at15] - rows[j][at15] : null
    return {
      participantId: pid(p, i),
      teamId: p.teamId,
      win: p.win,
      puuid: p.puuid,
      gameName: p.gameName,
      tagLine: p.tagLine,
      championId: p.championId,
      position: p.position,
      level: p.champLevel || p.level,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      kp: team?.kills ? (p.kills + p.assists) / team.kills : 0,
      cs: p.cs,
      csMin: p.cs / minutes,
      gold: p.goldEarned,
      goldShare: team?.gold ? p.goldEarned / team.gold : 0,
      damage: p.totalDamageDealtToChampions,
      physical: p.physicalDamageDealtToChampions,
      magic: p.magicDamageDealtToChampions,
      trueDamage: p.trueDamageDealtToChampions,
      damageShare: team?.damage ? p.totalDamageDealtToChampions / team.damage : 0,
      damageTaken: p.damageTaken,
      vision: p.visionScore,
      wardsPlaced: p.wardsPlaced,
      wardsKilled: p.wardsKilled,
      controlWards: p.visionWardsBoughtInGame,
      objectiveDamage: p.damageDealtToObjectives,
      turretDamage: p.damageDealtToTurrets,
      opponent: opp ? pid(opp, j) : null,
      gold15: lead15(gold),
      xp15: lead15(xp),
      cs15: lead15(cs),
    }
  })

  const sum = (teamId: number, f: (p: PlayerView) => number) =>
    players.filter((p) => p.teamId === teamId).reduce((s, p) => s + f(p), 0)
  const teamIds = [...new Set(players.map((p) => p.teamId))].sort((a, b) => a - b)
  const teams: TeamView[] = teamIds.map((teamId) => ({
    teamId,
    win: players.some((p) => p.teamId === teamId && p.win),
    kills: sum(teamId, (p) => p.kills),
    gold: sum(teamId, (p) => p.gold),
    damage: sum(teamId, (p) => p.damage),
    towers: teamId === 100 ? match.t1Towers : teamId === 200 ? match.t2Towers : 0,
    dragons: teamId === 100 ? match.t1Dragons : teamId === 200 ? match.t2Dragons : 0,
    barons: teamId === 100 ? match.t1Barons : teamId === 200 ? match.t2Barons : 0,
  }))

  const events = match.events ?? []
  const timeline: TimelineView | null =
    times.length > 1
      ? {
          t: times.map((ms) => Math.round(ms / 1000)),
          gold,
          xp,
          cs,
          goldDiff: sideDiff(gold),
          xpDiff: sideDiff(xp),
          kills: events
            .filter((e) => e.kind === 'kill')
            .map((e) => ({
              t: e.t,
              killer: e.killer,
              victim: e.victim,
              assists: e.assists ?? [],
              x: e.x,
              y: e.y,
            })),
          objectives: events
            .filter((e) => e.kind !== 'kill')
            .map((e) => ({
              t: e.t,
              kind: e.kind as Objective['kind'],
              sub: e.sub,
              team: e.team,
              lane: e.lane,
              killer: e.killer,
            })),
          hasEvents: events.length > 0,
        }
      : null

  return { duration: match.duration, remake: isRemake(match), players, teams, timeline }
}

/** `ally` / `enemy` of a team, from the viewed player's side (blue side when nobody is viewed). */
export const relation = (teamId: number, me: PlayerView | undefined) =>
  teamId === (me?.teamId ?? 100) ? 'ally' : 'enemy'

/* ── Formatting shared by the detail views ─────────────────────── */

const UI = 'en-US'

export const num = (n: number, digits = 0) =>
  n.toLocaleString(UI, { minimumFractionDigits: digits, maximumFractionDigits: digits })

/** 0.372 → "37%". */
export const pct = (ratio: number) => `${num(Math.round(ratio * 100))}%`

/** Seconds → "12:05". */
export function mmss(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** 2340 → "+2.3k", -800 → "−800". */
export function signedK(n: number) {
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  const a = Math.abs(n)
  return sign + (a >= 1000 ? `${num(a / 1000, 1)}k` : num(a))
}

/** 1532 → "1.5k", 240000 → "240k", 12 → "12". */
export function short(n: number) {
  if (n >= 100_000) return `${num(Math.round(n / 1000))}k`
  if (n >= 1000) return `${num(n / 1000, 1)}k`
  return num(n)
}
