import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { rows } from '#services/ranked_games_service'
import { StatsCache } from '#services/stats_cache'
import { rankScore } from '#services/pro_ladder_service'
import { flexGroups, type GroupSize, type SideRow } from '#services/flex_groups'
import { summarizePlayers, type GamesRow, type PlayerGames } from '#services/ladder'

/**
 * The ranked flex ranks Invade knows on a server. Riot's flex ladder is not stored anywhere here
 * (the crawler reads Solo/Duo leagues only), so this is the ladder of the players the site looked
 * up or the desktop app saw in a lobby: their newest flex rank (`riot_rank`, kept current while
 * they are looked up), for those seen in the last `SEEN_DAYS` days. Who they queue with comes from
 * their stored flex games (`participants`, queue 440).
 */

export const SEEN_DAYS = 30
/** Players listed, best rank first. */
export const LISTED = 1000
/** Stored flex games read for groups and champions. */
const GAMES_DAYS = 90
const RANKED_FLEX = 440
const DAY_MS = 86_400_000
const SHAPE = 2

export interface FlexEntry {
  puuid: string
  gameName: string
  tagLine: string
  icon: number | null
  level: number | null
  tier: string
  division: string | null
  lp: number
  wins: number
  losses: number
  /** When the rank was read or seen unchanged, in ms. */
  at: number
}

/** Teammates of the players' games, as their side's rows and their Riot ID. */
export interface FlexGameRow extends SideRow {
  gameName: string
  tagLine: string
  icon: number
  position: string
  champion: number
}

export interface FlexSource {
  entries(platform: string, since: number): Promise<FlexEntry[]>
  games(puuids: string[], since: number): Promise<{ matchId: string; teamId: number }[]>
  sides(matchIds: string[]): Promise<FlexGameRow[]>
}

const num = (v: unknown) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

export const postgresSource: FlexSource = {
  async entries(platform, since) {
    const at = new Date(since)
    const { rows: found } = await db.rawQuery(
      `WITH seen AS (
         SELECT puuid FROM riot_rank WHERE queue_type = 'RANKED_FLEX_SR' AND fetched_at >= ?
         UNION
         SELECT puuid FROM riot_player WHERE platform = ? AND last_refresh_at >= ?
       )
       SELECT p.puuid, p.game_name, p.tag_line, p.profile_icon_id, p.summoner_level,
              k.tier, k.division, k.league_points, k.wins, k.losses,
              greatest(k.fetched_at, p.last_refresh_at) AS at
       FROM seen s
       JOIN riot_player p ON p.puuid = s.puuid AND p.platform = ?
       JOIN LATERAL (
         SELECT tier, division, league_points, wins, losses, fetched_at FROM riot_rank
         WHERE puuid = s.puuid AND queue_type = 'RANKED_FLEX_SR'
         ORDER BY fetched_at DESC LIMIT 1
       ) k ON true
       WHERE k.tier IS NOT NULL`,
      [at, platform, at, platform]
    )
    return (found as Record<string, any>[]).map((r) => ({
      puuid: String(r.puuid),
      gameName: String(r.game_name),
      tagLine: String(r.tag_line),
      icon: r.profile_icon_id ?? null,
      level: r.summoner_level ?? null,
      tier: String(r.tier),
      division: r.division ?? null,
      lp: num(r.league_points),
      wins: num(r.wins),
      losses: num(r.losses),
      at: new Date(r.at).getTime(),
    }))
  },

  async games(puuids, since) {
    const out: { matchId: string; teamId: number }[] = []
    for (let i = 0; i < puuids.length; i += 300) {
      const found = await rows(
        `SELECT DISTINCT match_id, team_id FROM participants
         WHERE puuid IN {puuids:Array(String)} AND queue_id = ${RANKED_FLEX}
           AND game_start_ms >= {since:UInt64}`,
        { puuids: puuids.slice(i, i + 300), since }
      )
      for (const [matchId, teamId] of found)
        out.push({ matchId: String(matchId), teamId: num(teamId) })
    }
    return out
  },

  async sides(matchIds) {
    const out: FlexGameRow[] = []
    for (let i = 0; i < matchIds.length; i += 2000) {
      const found = await rows(
        `SELECT match_id, team_id, puuid, win, riot_id_game_name, riot_id_tag_line, profile_icon_id,
                team_position, champion_id
         FROM participants
         WHERE match_id IN {ids:Array(String)} AND queue_id = ${RANKED_FLEX}
         LIMIT 1 BY match_id, puuid`,
        { ids: matchIds.slice(i, i + 2000) }
      )
      for (const [m, t, puuid, win, name, tag, icon, position, champion] of found) {
        out.push({
          matchId: String(m),
          teamId: num(t),
          puuid: String(puuid),
          win: num(win) === 1,
          gameName: String(name ?? ''),
          tagLine: String(tag ?? ''),
          icon: num(icon),
          position: String(position ?? ''),
          champion: num(champion),
        })
      }
    }
    return out
  },
}

export interface FlexMate {
  gameName: string
  tagLine: string
  icon: number | null
}

export interface FlexPlayer {
  place: number
  gameName: string
  tagLine: string
  icon: number | null
  level: number | null
  tier: string
  division: string | null
  lp: number
  wins: number
  losses: number
  /** When the rank was read or seen unchanged (ms). */
  at: number
  role: string | null
  champions: { champion: number; games: number; wins: number }[]
  /** Stored flex games of the last `GAMES_DAYS` days. */
  games: number
  queuesWith: {
    size: GroupSize
    mates: (FlexMate & { games: number })[]
    games: number
    wins: number
    share: number
  } | null
}

export interface FlexGroup {
  size: GroupSize
  /** `rank` for the members on the list (their flex rank). */
  members: (FlexMate & {
    role: string | null
    listed: boolean
    rank: { tier: string; division: string | null; lp: number } | null
  })[]
  games: number
  wins: number
}

export interface FlexLadder {
  platform: string
  players: FlexPlayer[]
  groups: FlexGroup[]
  shares: Record<GroupSize, number> | null
  tiers: { tier: string; players: number }[]
}

const TIER_ORDER = [
  'CHALLENGER',
  'GRANDMASTER',
  'MASTER',
  'DIAMOND',
  'EMERALD',
  'PLATINUM',
  'GOLD',
  'SILVER',
  'BRONZE',
  'IRON',
]

export class FlexLadderService {
  source: FlexSource = postgresSource
  #ladders = new StatsCache(`flex-ladder@${SHAPE}`, {
    freshMs: 20 * 60_000,
    keepMs: 12 * 3_600_000,
    maxLocal: 16,
  })

  ladder(platform: string): Promise<FlexLadder> {
    return this.#ladders.get(platform, () => this.read(platform))
  }

  clear() {
    this.#ladders.clear()
  }

  private async read(platform: string, now = Date.now()): Promise<FlexLadder> {
    const found = await this.source.entries(platform, now - SEEN_DAYS * DAY_MS)
    const ranked = found
      .map((e) => ({ e, score: rankScore(e.tier, e.division, e.lp) ?? -1 }))
      .filter((x) => x.score >= 0)
      // Riot ranks by tier first (an apex tier's LP can overlap the one above it), then LP.
      .sort(
        (a, b) =>
          TIER_ORDER.indexOf(a.e.tier) - TIER_ORDER.indexOf(b.e.tier) ||
          b.score - a.score ||
          b.e.wins - a.e.wins
      )
      .map((x) => x.e)
    const listed = ranked.slice(0, LISTED)
    const tiers = TIER_ORDER.map((tier) => ({
      tier,
      players: ranked.filter((e) => e.tier === tier).length,
    })).filter((t) => t.players)

    let sides: FlexGameRow[] = []
    try {
      const games = await this.source.games(
        listed.map((e) => e.puuid),
        now - GAMES_DAYS * DAY_MS
      )
      sides = games.length ? await this.source.sides([...new Set(games.map((g) => g.matchId))]) : []
    } catch (error) {
      logger.warn({ err: error, platform }, 'flex games unreadable')
    }
    const listedSet = new Set(listed.map((e) => e.puuid))
    const byPuuid = new Map(listed.map((e) => [e.puuid, e]))
    const habits = flexGroups(sides, listedSet)
    const champions = summarizePlayers(
      sides
        .filter((s) => listedSet.has(s.puuid))
        .map(
          (s): GamesRow => ({
            puuid: s.puuid,
            champion: s.champion,
            position: s.position,
            games: 1,
            wins: s.win ? 1 : 0,
            kills: 0,
            deaths: 0,
            assists: 0,
            last: 0,
          })
        )
    )
    const who = new Map<string, FlexMate>()
    for (const e of listed)
      who.set(e.puuid, { gameName: e.gameName, tagLine: e.tagLine, icon: e.icon })
    for (const s of sides) {
      if (!who.has(s.puuid) && s.gameName) {
        who.set(s.puuid, { gameName: s.gameName, tagLine: s.tagLine, icon: s.icon })
      }
    }
    const mate = (puuid: string): FlexMate => {
      const w = who.get(puuid)
      return { gameName: w?.gameName ?? '', tagLine: w?.tagLine ?? '', icon: w?.icon ?? null }
    }
    const roleOf = (games?: PlayerGames) => games?.role ?? null
    const players = listed.map((e, i): FlexPlayer => {
      const games = champions.get(e.puuid)
      const habit = habits.players.get(e.puuid)
      return {
        place: i + 1,
        gameName: e.gameName,
        tagLine: e.tagLine,
        icon: e.icon,
        level: e.level,
        tier: e.tier,
        division: ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(e.tier) ? null : e.division,
        lp: e.lp,
        wins: e.wins,
        losses: e.losses,
        at: e.at,
        role: roleOf(games),
        champions: (games?.champions ?? []).map((c) => ({
          champion: c.champion,
          games: c.games,
          wins: c.wins,
        })),
        games: habit?.total ?? 0,
        queuesWith: habit
          ? {
              size: habit.size,
              mates: habit.mates.slice(0, 4).map((m) => ({ ...mate(m.puuid), games: m.games })),
              games: habit.games,
              wins: habit.wins,
              share: habit.share,
            }
          : null,
      }
    })
    return {
      platform,
      players,
      groups: habits.groups.slice(0, 12).map((g) => ({
        size: g.size,
        members: g.members.map((m) => {
          const e = byPuuid.get(m)
          return {
            ...mate(m),
            role: roleOf(champions.get(m)),
            listed: listedSet.has(m),
            rank: e ? { tier: e.tier, division: e.division, lp: e.lp } : null,
          }
        }),
        games: g.games,
        wins: g.wins,
      })),
      shares: sides.length ? habits.shares : null,
      tiers,
    }
  }
}

const flexLadderService = new FlexLadderService()
export default flexLadderService
