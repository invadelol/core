import { positionOf, summaryOf, type MatchSummary, type Position } from '@invadelol/ui/logic'
import { detailOf, isRemake } from './match.js'
import type { Match } from './types.js'

/**
 * One player read for a multi search: how their recent Summoner's Rift games went, where they play
 * and on what. Ranked games are the sample when there are enough of them; otherwise every game on
 * the Rift, and `sample` says which.
 */
export interface Scout {
  sample: 'ranked' | 'rift'
  games: number
  wins: number
  /** Average kills, deaths and assists over the sample. */
  kills: number
  deaths: number
  assists: number
  /** Newest first, true for a win: the run of results. */
  results: boolean[]
  /** The current run when it is three games or longer, positive for wins. */
  streak: number
  roles: Array<{ lane: Position; games: number; share: number }>
  champions: Array<{ championId: number; games: number; wins: number; kda: number | null }>
  recent: MatchSummary[]
  /** Every stored game's id, for finding who of the lobby plays together. */
  matchIds: Set<string>
}

const RANKED_QUEUES = new Set([420, 440])
const RIFT = 11
/** Below this many ranked games the whole Rift is the sample. */
const RANKED_ENOUGH = 8
const RECENT = 10

export function scout(matches: Match[], puuid: string): Scout {
  const rift = matches.filter((m) => m.mapId === RIFT && m.queueId !== 0 && !isRemake(m))
  const ranked = rift.filter((m) => RANKED_QUEUES.has(m.queueId))
  const sample = ranked.length >= RANKED_ENOUGH ? 'ranked' : 'rift'
  const games = (sample === 'ranked' ? ranked : rift).slice(0, 20)

  let wins = 0
  let kills = 0
  let deaths = 0
  let assists = 0
  const results: boolean[] = []
  const lanes = new Map<Position, number>()
  const champions = new Map<number, { games: number; wins: number; k: number; d: number; a: number }>()
  for (const match of games) {
    const me = match.participants.find((p) => p.puuid === puuid)
    if (!me) continue
    results.push(me.win)
    if (me.win) wins++
    kills += me.kills
    deaths += me.deaths
    assists += me.assists
    const lane = positionOf(me.position)
    if (lane) lanes.set(lane, (lanes.get(lane) ?? 0) + 1)
    const champ = champions.get(me.championId) ?? { games: 0, wins: 0, k: 0, d: 0, a: 0 }
    champ.games++
    if (me.win) champ.wins++
    champ.k += me.kills
    champ.d += me.deaths
    champ.a += me.assists
    champions.set(me.championId, champ)
  }

  const played = results.length
  let run = 0
  for (const result of results) {
    if (result !== results[0]) break
    run++
  }

  const laned = [...lanes.values()].reduce((n, c) => n + c, 0)
  return {
    sample,
    games: played,
    wins,
    kills: played ? kills / played : 0,
    deaths: played ? deaths / played : 0,
    assists: played ? assists / played : 0,
    results,
    streak: run >= 3 ? (results[0] ? run : -run) : 0,
    roles: [...lanes.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([lane, count]) => ({ lane, games: count, share: count / laned })),
    champions: [...champions.entries()]
      .sort((a, b) => b[1].games - a[1].games || b[1].wins - a[1].wins)
      .slice(0, 4)
      .map(([championId, c]) => ({
        championId,
        games: c.games,
        wins: c.wins,
        kda: c.d ? (c.k + c.a) / c.d : null,
      })),
    recent: rift
      .slice(0, RECENT)
      .map((m) => summaryOf(detailOf(m), puuid, m.matchId))
      .filter((s): s is MatchSummary => Boolean(s)),
    matchIds: new Set(matches.map((m) => m.matchId)),
  }
}

/** Ratio of (kills + assists) to deaths, "Perfect" when they never died. */
export function kdaText(kills: number, deaths: number, assists: number) {
  return deaths ? ((kills + assists) / deaths).toFixed(2) : 'Perfect'
}

/** The player's season as `/season` sends it: stored games only. */
export interface Season {
  queue: 'solo' | 'rift'
  champions: Array<{
    championId: number
    games: number
    wins: number
    kills: number
    deaths: number
    assists: number
  }>
  roles: Array<{ role: string; games: number; wins: number }>
}

export interface ScoutTag {
  label: string
  /** What the tag is based on, shown on hover and tap. */
  detail: string
  tone?: 'win' | 'loss'
}

/**
 * A few short notes on how the player plays, each one read straight from their games: a champion
 * they lean on, a run of results, how often they die. Only what stands out; often nothing.
 */
export function scoutTags(
  season: Season | null,
  form: Scout | null,
  name: (id: number) => string
): ScoutTag[] {
  const tags: ScoutTag[] = []
  const total = season?.champions.reduce((n, c) => n + c.games, 0) ?? 0
  for (const champ of season?.champions.slice(0, 2) ?? []) {
    if (champ.games >= 10 && champ.games / total >= 0.2) {
      tags.push({
        label: `<3 ${name(champ.championId)}`,
        detail: `${champ.games} ${name(champ.championId)} games this season, ${Math.round((champ.games / total) * 100)}% of their games`,
      })
    }
  }
  if (form?.streak && form.streak >= 3)
    tags.push({ label: 'Win streak', detail: `Won the last ${form.streak}`, tone: 'win' })
  if (form?.streak && form.streak <= -3)
    tags.push({ label: 'Loss streak', detail: `Lost the last ${-form.streak}`, tone: 'loss' })
  if (form && form.games >= 8) {
    if (form.deaths <= 3.5)
      tags.push({ label: 'Rarely dies', detail: `${form.deaths.toFixed(1)} deaths a game lately` })
    else if (form.deaths >= 7.5)
      tags.push({ label: 'Dies often', detail: `${form.deaths.toFixed(1)} deaths a game lately` })
  }
  return tags
}
