import { POSITION_NAMES, POSITION_ORDER } from './assets.js'
import { damageShare, goldShare, killParticipation, matchMinutes, teamTotals } from './match.js'
import type { ChampionStats, GlobalStats, Match, Participant } from './types.js'

/**
 * Slices of a match sample, shaped like the `/stats` payload.
 *
 * The compare page already downloads 100 matches per player for its
 * sparklines, which is everything needed to answer the questions a global
 * average cannot: how they do in one role, on one champion, or in the games
 * they actually shared. Re-cutting the sample here keeps those answers on the
 * same filters as the headline numbers rather than inventing a second source.
 */
export interface Line extends GlobalStats {
  games: number
  wins: number
}

function emptyLine(): Line {
  return {
    games: 0,
    wins: 0,
    total: 0,
    winrate: 0,
    kda: 0,
    killParticipation: 0,
    damageShare: 0,
    goldShare: 0,
    csMin: 0,
    goldPerMinute: 0,
    damagePerMinute: 0,
    visionMin: 0,
  }
}

/**
 * Every headline metric, averaged over whatever matches are handed in.
 *
 * Each one is the mean of its per-game value, which is how `/stats` computes
 * the same figures server side. A slice therefore lines up with the headline
 * row above it instead of quietly using a second definition of KDA.
 */
export function lineOf(matches: Match[], puuid: string): Line {
  const line = emptyLine()
  let ratio = 0
  let kp = 0
  let dmgShare = 0
  let gldShare = 0
  let cs = 0
  let gold = 0
  let damage = 0
  let vision = 0

  for (const match of matches) {
    const p = match.participants.find((x) => x.puuid === puuid)
    if (!p) continue
    const minutes = matchMinutes(match)
    const totals = teamTotals(match)
    line.games++
    if (p.win) line.wins++
    ratio += (p.kills + p.assists) / Math.max(1, p.deaths)
    kp += killParticipation(p, totals) / 100
    dmgShare += damageShare(p, totals) / 100
    gldShare += goldShare(p, totals) / 100
    cs += (p.cs || 0) / minutes
    gold += (p.goldEarned || 0) / minutes
    damage += (p.totalDamageDealtToChampions || 0) / minutes
    vision += (p.visionScore || 0) / minutes
  }

  const n = line.games || 1
  line.total = line.games
  line.winrate = line.wins / n
  line.kda = ratio / n
  line.killParticipation = kp / n
  line.damageShare = dmgShare / n
  line.goldShare = gldShare / n
  line.csMin = cs / n
  line.goldPerMinute = gold / n
  line.damagePerMinute = damage / n
  line.visionMin = vision / n
  return line
}

export interface Side {
  matches: Match[]
  puuid: string
}

export interface RoleRow {
  role: string
  label: string
  /** One entry per player, null where they never played the position. */
  lines: Array<Line | null>
}

/** The same metrics again, cut by the position each player queued. */
export function roleRows(sides: Side[]): RoleRow[] {
  const perSide = sides.map((side) => {
    const groups = new Map<string, Match[]>()
    for (const match of side.matches) {
      const me = match.participants.find((x) => x.puuid === side.puuid)
      if (!me?.position || !POSITION_ORDER.includes(me.position)) continue
      const bucket = groups.get(me.position) ?? []
      bucket.push(match)
      groups.set(me.position, bucket)
    }
    const lines = new Map<string, Line>()
    for (const [role, matches] of groups) lines.set(role, lineOf(matches, side.puuid))
    return lines
  })

  return POSITION_ORDER.filter((role) => perSide.some((lines) => lines.has(role))).map((role) => ({
    role,
    label: POSITION_NAMES[role] ?? role,
    lines: perSide.map((lines) => lines.get(role) ?? null),
  }))
}

export interface SharedGame {
  match: Match
  /** The two players, in the order the sides were handed in. */
  players: Participant[]
  /** Same team, as opposed to having been drawn against each other. */
  together: boolean
}

/**
 * The games both samples contain.
 *
 * Both players are in the same match row, so one sample is usually enough,
 * but the two windows do not always line up: merging them by match id keeps a
 * game that fell off the end of one list and not the other.
 */
export function sharedGames(sides: Side[]): SharedGame[] {
  const [a, b] = sides
  if (!a || !b) return []

  const byId = new Map<string, Match>()
  for (const match of [...a.matches, ...b.matches]) byId.set(match.matchId, match)

  const games: SharedGame[] = []
  for (const match of byId.values()) {
    const mine = match.participants.find((p) => p.puuid === a.puuid)
    const theirs = match.participants.find((p) => p.puuid === b.puuid)
    if (!mine || !theirs) continue
    games.push({ match, players: [mine, theirs], together: mine.teamId === theirs.teamId })
  }
  return games.sort((x, y) => y.match.gameStartMs - x.match.gameStartMs)
}

export interface ChampionRow {
  championId: number
  /** One entry per player, null where they have never picked it. */
  stats: Array<ChampionStats | null>
}

export interface ChampionSplit {
  both: ChampionRow[]
  /** Each player's most played picks the other has not touched. */
  only: ChampionRow[][]
}

export function championSplit(pools: ChampionStats[][], limit = 5): ChampionSplit {
  const [mine = [], theirs = []] = pools
  const byId = pools.map((pool) => new Map(pool.map((c) => [c.championId, c])))

  const both = mine
    .filter((c) => byId[1]?.has(c.championId))
    .map((c) => ({ championId: c.championId, stats: [c, byId[1]!.get(c.championId)!] }))
    .sort((x, y) => y.stats[0]!.games + y.stats[1]!.games - (x.stats[0]!.games + x.stats[1]!.games))

  const exclusive = (pool: ChampionStats[], other: Map<number, ChampionStats>, index: number) =>
    pool
      .filter((c) => !other.has(c.championId))
      .sort((x, y) => y.games - x.games || y.winrate - x.winrate)
      .slice(0, limit)
      .map((c) => ({
        championId: c.championId,
        stats: index === 0 ? [c, null] : [null, c],
      }))

  return {
    both,
    only: [exclusive(mine, byId[1] ?? new Map(), 0), exclusive(theirs, byId[0] ?? new Map(), 1)],
  }
}
