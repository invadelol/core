import cache from '@adonisjs/cache/services/main'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'
import clickhouse from 'adonisjs-clickhouse/services/main'
import { summaryOf } from '@invadelol/ui/logic'
import matchRepository from '#services/analytics/match_repository'
import championStatsService, { DEFAULT_BRACKET } from '#services/champion_stats_service'
import type { Filter, Summary } from '#services/champion_stats'
import { ladder } from '#services/desktop/lp'
import { discordServer } from '#services/discord_server'
import proLadderService, { type LadderRow } from '#services/pro_ladder_service'
import { LEAGUES } from '#services/pro_leagues'
import proService from '#services/pro_service'
import { patchStart, rows as statRows } from '#services/ranked_games_service'
import { RANKED_SOLO, seedTiers } from '#services/ranked_stats'
import { areEventsCounted } from '#services/stats_cells'
import { escapeClickhouseString } from '#utils/clickhouse'
import { detailOf, isRemake, scoreLobby } from '../../inertia/lib/match.js'
import type { Match } from '../../inertia/lib/types.js'
import type {
  BestGame,
  ChampionRow,
  Climb,
  HomeBan,
  HomeChampion,
  HomeChampions,
  HomeClimber,
  HomeData,
  HomeLaneRow,
  HomePage,
  HomePick,
  HomePlayer,
  HomePro,
  HomeRank,
  HomeTrending,
  SiteNav,
} from '../../inertia/lib/home.js'

/**
 * The home page: a few figures and lists read from what invade.lol already stores (Postgres,
 * ClickHouse, Redis), never from Riot. Each section is cached on its own for a few minutes and
 * kept for hours past that: once a section has been read, a visitor is always served the last
 * copy at once while a fresh one is computed in the background, and an outage of one store
 * costs only its own sections.
 */

const HOUR = 3_600_000
const DAY = 24 * HOUR

const SOLO = 'RANKED_SOLO_5x5'
const SOLO_QUEUE = 420

/** Summoner's Rift queues with lanes, where a score means the same thing: Solo, Flex, Draft, Quickplay. */
export const BEST_GAME_QUEUES = [420, 440, 400, 490] as const
/** The newest games of the last day that are scored for the best games: bounded whatever the traffic. */
export const BEST_GAME_CANDIDATES = 400
export const BEST_GAMES = 5

export const TRENDING_PLAYERS = 6
export const TRENDING_DAYS = 7
/** A day's views are kept a little past the window, then Redis drops them. */
const VIEW_BUCKET_TTL_SECONDS = (TRENDING_DAYS + 1) * 86_400

export const CLIMBS = 6

/** A patch is shown once this many Solo/Duo games of it are stored; before that, the one before. */
export const MIN_PATCH_GAMES = 1000
/** Below this many games on the patch, a champion's win rate is not shown at all. */
export const MIN_CHAMPION_GAMES = 100
/** How far back patches are looked for. */
const PATCH_LOOKBACK = 60 * DAY

const SECTION_CACHE = { grace: '12h', timeout: '1.5s' } as const
const TTL = {
  trending: '5m',
  best: '5m',
  climbs: '5m',
  champions: '15m',
  picks: '10m',
  pros: '5m',
  lanes: '10m',
} as const

/** Rows in each of the home's lists. */
export const HOME_ROWS = 5
/** Climbers in the header's Stats menu. */
export const NAV_CLIMBERS = 4
/** Pros in the header's Pros menu. */
export const NAV_PROS = 4
/** A climb counts once the champion reached this place in its role (a climb to #40 is noise). */
export const CLIMB_TOP = 20
/** Below this many games in the role, a champion's lane figures are not listed. */
export const LANE_MIN_GAMES = 200
/** Lane bullies: the roles with a lane opponent of their own. */
export const LANE_POSITIONS = ['TOP', 'MIDDLE', 'BOTTOM'] as const
/** When the patch's events are not counted yet: at most this many of its games are read. */
const LANE_SAMPLE = 20_000
const LANE_LIMITS = { max_execution_time: 20, max_threads: 2 } as const

/** How long the home waits for Discord's counts on a cold cache before it renders without them. */
const DISCORD_WAIT_MS = 600
/** How long the home waits for a section computing on a cold cache (a warm one is a lookup). */
const SECTION_WAIT_MS = 1200

/** `load`, or null once `ms` have passed: the work goes on and fills its cache. */
function capped<T>(load: Promise<T | null>, ms = SECTION_WAIT_MS): Promise<T | null> {
  let timer: NodeJS.Timeout | undefined
  return Promise.race([
    load.finally(() => clearTimeout(timer)),
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), ms)
    }),
  ])
}

/* ── Pure parts, tested on their own ─────────────────────────────── */

/** The default tier list as the home and the menus read it (each takes its own part). */
export interface TierBoard {
  patch: string
  previousPatch: string | null
  games: number
  champions: number
  best: HomePick[]
  bans: HomeBan[]
  climbers: HomeClimber[]
}

export interface ProBoard {
  top: HomePro[]
  counts: { players: number; accounts: number; teams: number } | null
}

export interface LaneBoard {
  bullies: HomeLaneRow[]
  firstBlood: HomeLaneRow[]
}

/** A pro as the directory lists them (`proService.directory().top`). */
type DirectoryPro = {
  slug: string
  name: string
  team: { id: string; slug: string; name: string; shortName: string | null } | null
  best: { tier: string; division: number | null; lp: number | null } | null
}

export interface ChampionInfo {
  id: number
  name: string
  slug: string
}

const championOf = (
  names: Map<number, ChampionInfo>,
  championId: number,
  position: string
): HomeChampion | null => {
  const c = names.get(championId)
  return c ? { championId, name: c.name, slug: c.slug, position } : null
}

/** The first of each role on the tier list, in the roles' order. */
export function bestPicks(summary: Summary, names: Map<number, ChampionInfo>): HomePick[] {
  const picks: HomePick[] = []
  for (const position of ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']) {
    const first = summary.roles.find((r) => r.position === position && r.rank === 1)
    const champion = first && championOf(names, first.champion, position)
    if (first && champion) picks.push({ ...champion, tier: first.tier, winRate: first.win })
  }
  return picks
}

/** The champions banned in the most games, each in the role it is played most. */
export function mostBanned(
  summary: Summary,
  names: Map<number, ChampionInfo>,
  limit = HOME_ROWS
): HomeBan[] {
  const main = new Map<number, { position: string; games: number; ban: number }>()
  for (const r of summary.roles) {
    const known = main.get(r.champion)
    if (!known || r.games > known.games)
      main.set(r.champion, { position: r.position, games: r.games, ban: r.ban })
  }
  return [...main]
    .filter(([, r]) => r.ban > 0)
    .sort((a, b) => b[1].ban - a[1].ban)
    .slice(0, limit)
    .flatMap(([id, r]) => {
      const champion = championOf(names, id, r.position)
      return champion ? [{ ...champion, banRate: r.ban }] : []
    })
}

/**
 * The champions that gained the most places in their role since the patch before, among those
 * now in the role's top `CLIMB_TOP`. One line per champion.
 */
export function climbersOf(
  summary: Summary,
  previous: Summary | null,
  names: Map<number, ChampionInfo>,
  limit = NAV_CLIMBERS
): HomeClimber[] {
  if (!previous) return []
  const before = new Map<string, number>()
  for (const r of previous.roles) if (r.rank) before.set(`${r.position}:${r.champion}`, r.rank)
  const seen = new Set<number>()
  return summary.roles
    .flatMap((r) => {
      const from = before.get(`${r.position}:${r.champion}`)
      return r.rank && r.rank <= CLIMB_TOP && from && from > r.rank
        ? [{ r, from, gain: from - r.rank }]
        : []
    })
    .sort((a, b) => b.gain - a.gain || a.r.rank! - b.r.rank!)
    .flatMap(({ r, from }) => {
      if (seen.has(r.champion)) return []
      seen.add(r.champion)
      const champion = championOf(names, r.champion, r.position)
      return champion ? [{ ...champion, from, to: r.rank! }] : []
    })
    .slice(0, limit)
}

/**
 * A lane figure's list: per role and champion, games and a sum, read as the sum per game. Only the
 * roles the tier list lists the champion in, with `minGames` games or more there, best first.
 */
export function laneRows(
  found: Array<[string, number, number, number]>,
  summary: Summary,
  names: Map<number, ChampionInfo>,
  minGames = LANE_MIN_GAMES,
  limit = HOME_ROWS
): HomeLaneRow[] {
  const listed = new Set(summary.roles.map((r) => `${r.position}:${r.champion}`))
  return (
    found
      .filter(([position, id, games]) => games >= minGames && listed.has(`${position}:${id}`))
      .map(([position, id, games, sum]) => ({ position, id, games, value: sum / games }))
      .sort((a, b) => b.value - a.value)
      // One line per champion, in its best role.
      .filter((r, i, rows) => rows.findIndex((o) => o.id === r.id) === i)
      .slice(0, limit)
      .flatMap((r) => {
        const champion = championOf(names, r.id, r.position)
        return champion ? [{ ...champion, value: r.value }] : []
      })
  )
}

/** The cells of the default bracket (every region). */
const bracketSql = (filter: Filter) => {
  const tiers = seedTiers(filter.bracket)
  return tiers ? `AND seed_tier IN (${tiers})` : ''
}

/** Gold ahead of the lane opponent at minute 10, summed per role and champion (counted cells). */
const goldCellsSql = (filter: Filter) => `
  SELECT position, champion, sum(games), sum(gold_diff) FROM stats_early
  WHERE patch = {patch:String} AND minute = 10
    AND position IN (${LANE_POSITIONS.map((p) => `'${p}'`).join(',')}) ${bracketSql(filter)}
  GROUP BY position, champion`

/** Games with a first blood, and the games the champion took or assisted it (counted cells). */
const firstBloodCellsSql = (filter: Filter) => `
  SELECT position, champion, sum(games), sum(kills) + sum(assists) FROM stats_first_blood
  WHERE patch = {patch:String} ${bracketSql(filter)}
  GROUP BY position, champion`

/** A patch not counted yet: a sample of its crawled games, picked by game id hash. */
const sampleSql = (filter: Filter) => `
  SELECT match_id FROM match_seed WHERE patch = {patch:String} ${bracketSql(filter)}
  ORDER BY cityHash64(match_id) LIMIT ${LANE_SAMPLE}`

const playersSql = (positions: readonly string[] | null) => `
  SELECT match_id, participant_id, team_id, team_position, champion_id FROM participant_items FINAL
  WHERE patch = {patch:String} AND queue_id = ${RANKED_SOLO} AND match_id IN (SELECT match_id FROM s)
    ${positions ? `AND team_position IN (${positions.map((p) => `'${p}'`).join(',')})` : "AND team_position != ''"}`

/** `goldCellsSql` read from the sample's timeline frames. */
const goldSampleSql = (filter: Filter) => `
  WITH s AS (${sampleSql(filter)}),
  gold AS (
    SELECT match_id, participant_id, any(gold_total) AS g FROM match_timeline
    WHERE game_start_ms >= {patchStart:UInt64} AND match_id IN (SELECT match_id FROM s)
      AND intDiv(frame_ms, 60000) = 10
    GROUP BY match_id, participant_id
  )
  SELECT a.team_position, a.champion_id, count(), sum(toInt64(ga.g) - toInt64(gb.g))
  FROM (${playersSql(LANE_POSITIONS)}) AS a
  INNER JOIN (${playersSql(LANE_POSITIONS)}) AS b
    ON a.match_id = b.match_id AND a.team_position = b.team_position
  INNER JOIN gold AS ga ON ga.match_id = a.match_id AND ga.participant_id = a.participant_id
  INNER JOIN gold AS gb ON gb.match_id = b.match_id AND gb.participant_id = b.participant_id
  WHERE a.team_id != b.team_id
  GROUP BY a.team_position, a.champion_id`

/** `firstBloodCellsSql` read from the sample's kill events. */
const firstBloodSampleSql = (filter: Filter) => `
  WITH s AS (${sampleSql(filter)})
  SELECT p.team_position, p.champion_id, count(),
         countIf(fb.killer = p.participant_id OR has(fb.assists, p.participant_id))
  FROM (${playersSql(null)}) AS p
  INNER JOIN (
    SELECT match_id, argMin(killer, t_ms) AS killer, argMin(assists, t_ms) AS assists
    FROM match_events
    WHERE game_start_ms >= {patchStart:UInt64} AND kind = 'kill'
      AND match_id IN (SELECT match_id FROM s)
    GROUP BY match_id
  ) AS fb USING (match_id)
  GROUP BY p.team_position, p.champion_id`

const laneFigures = (found: unknown[][]) =>
  found.map(
    ([position, id, games, sum]) =>
      [String(position), Number(id), Number(games), Number(sum)] as [string, number, number, number]
  )

/** The UTC day keys of profile views, newest first. */
export function viewBucketKeys(now: number, days = TRENDING_DAYS) {
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(now - i * DAY).toISOString().slice(0, 10)
    return `home:views:${day}`
  })
}

export interface RankSnapshot {
  puuid: string
  tier: string
  division: string | null
  lp: number
  wins: number
  losses: number | null
  at: number
}

/**
 * The biggest Solo/Duo climbs: for every player whose rank moved in the window, the newest
 * snapshot against the last one before the window (or the first one in it). A climb needs two
 * snapshots that are real ranks and a gain; the rest is not listed.
 */
export function climbsFrom(
  inWindow: RankSnapshot[],
  baselines: Map<string, RankSnapshot>,
  limit = CLIMBS
): Array<Omit<Climb, 'player'> & { puuid: string; now: RankSnapshot }> {
  const byPlayer = new Map<string, RankSnapshot[]>()
  for (const row of inWindow) {
    const list = byPlayer.get(row.puuid) ?? []
    list.push(row)
    byPlayer.set(row.puuid, list)
  }

  const climbs = []
  for (const [puuid, rows] of byPlayer) {
    rows.sort((a, b) => a.at - b.at)
    const base = baselines.get(puuid)
    const series = (base ? [base, ...rows] : rows).filter((r) => ladder(r) !== null)
    if (series.length < 2) continue
    const first = series[0]
    const last = series[series.length - 1]
    const gain = ladder(last)! - ladder(first)!
    if (gain <= 0) continue
    const losses =
      first.losses === null || last.losses === null ? null : Math.max(0, last.losses - first.losses)
    climbs.push({
      puuid,
      now: last,
      gain,
      wins: Math.max(0, last.wins - first.wins),
      losses,
      points: series.map((r) => ladder(r)!),
    })
  }
  return climbs.sort((a, b) => b.gain - a.gain || b.now.at - a.now.at).slice(0, limit)
}

/** "16.20" after "16.9": patches compare by their numbers, not as text. */
export function comparePatches(a: string, b: string) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d) return d
  }
  return 0
}

/**
 * The patch to show, newest first among those with enough games, and the one before it.
 * Null while no patch has enough: the section stays hidden rather than show thin numbers.
 */
export function pickPatch(patches: Array<{ patch: string; games: number }>) {
  const ordered = patches.filter((p) => p.patch).sort((a, b) => comparePatches(b.patch, a.patch))
  const index = ordered.findIndex((p) => p.games >= MIN_PATCH_GAMES)
  if (index === -1) return null
  return { current: ordered[index], previous: ordered[index + 1] ?? null }
}

export interface ChampionCount {
  championId: number
  position: string
  games: number
  wins: number
}

/** Per champion over every position: games, wins and the position played most. */
function byChampion(counts: ChampionCount[]) {
  const champions = new Map<
    number,
    { games: number; wins: number; positions: Map<string, number> }
  >()
  for (const row of counts) {
    if (!row.championId) continue
    const c = champions.get(row.championId) ?? { games: 0, wins: 0, positions: new Map() }
    c.games += row.games
    c.wins += row.wins
    c.positions.set(row.position, (c.positions.get(row.position) ?? 0) + row.games)
    champions.set(row.championId, c)
  }
  return champions
}

/**
 * The champion table of a patch, gated: a champion with fewer than `minGames` games on it is
 * left out, and its change against the patch before is given only when it passed the same gate
 * there. Sorted by win rate.
 */
export function championRows(
  current: ChampionCount[],
  bans: Map<number, number>,
  patchGames: number,
  previous: ChampionCount[] = [],
  minGames = MIN_CHAMPION_GAMES
): ChampionRow[] {
  if (patchGames <= 0) return []
  const before = byChampion(previous)
  const rows: ChampionRow[] = []
  for (const [championId, c] of byChampion(current)) {
    if (c.games < minGames) continue
    const prev = before.get(championId)
    const position = [...c.positions].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
    rows.push({
      championId,
      position,
      games: c.games,
      wins: c.wins,
      winRate: c.wins / c.games,
      pickRate: Math.min(1, c.games / patchGames),
      banRate: Math.min(1, (bans.get(championId) ?? 0) / patchGames),
      previousWinRate: prev && prev.games >= minGames ? prev.wins / prev.games : null,
    })
  }
  return rows.sort((a, b) => b.winRate - a.winRate || b.games - a.games)
}

export interface ScoredLine {
  matchId: string
  puuid: string
  score: number
  at: number
}

/** Every player's score in every game, best first: one line per player, so one stomp is one row. */
export function bestLines(matches: Match[], limit = BEST_GAMES): ScoredLine[] {
  const lines: ScoredLine[] = []
  for (const match of matches) {
    if (isRemake(match)) continue
    for (const [puuid, s] of Object.entries(scoreLobby(match))) {
      lines.push({ matchId: match.matchId, puuid, score: s.score, at: Number(match.gameStartMs) })
    }
  }
  lines.sort((a, b) => b.score - a.score || b.at - a.at)
  const seen = new Set<string>()
  const best: ScoredLine[] = []
  for (const line of lines) {
    if (seen.has(line.puuid)) continue
    seen.add(line.puuid)
    best.push(line)
    if (best.length === limit) break
  }
  return best
}

/* ── Reads ───────────────────────────────────────────────────────── */

async function chRows(query: string): Promise<unknown[][]> {
  const result = await clickhouse.query({ query, format: 'JSONCompactEachRow' })
  return (await result.json<unknown[]>()) ?? []
}

const n = (value: unknown) => {
  const x = Number(value)
  return Number.isFinite(x) ? x : 0
}

function rankOf(row: {
  tier: string | null
  division: string | null
  league_points: number | null
}) {
  if (!row.tier) return null
  const apex = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(row.tier)
  return { tier: row.tier, division: apex ? '' : (row.division ?? ''), lp: n(row.league_points) }
}

export class HomeService {
  /** Everything the page shows; a section that cannot be read is null. */
  async overview(): Promise<HomeData> {
    const [trending, best, climbs, champions] = await Promise.all([
      this.section('trending', TTL.trending, () => this.trending()),
      this.section('best', TTL.best, () => this.bestGames()),
      this.section('climbs', TTL.climbs, () => this.climbs()),
      this.section('champions', TTL.champions, () => this.champions()),
    ])
    return { trending, best, climbs, champions }
  }

  private async section<T>(
    name: string,
    ttl: string,
    factory: () => Promise<T>
  ): Promise<T | null> {
    try {
      return await cache.getOrSet({ key: `home:v1:${name}`, ttl, ...SECTION_CACHE, factory })
    } catch (error) {
      logger.warn({ err: error, section: name }, 'home section unavailable')
      return null
    }
  }

  /** Counts a profile view in today's bucket, for Trending. Never fails the view. */
  async recordView(puuid: string, now = Date.now()) {
    const [key] = viewBucketKeys(now, 1)
    try {
      await redis.multi().zincrby(key, 1, puuid).expire(key, VIEW_BUCKET_TTL_SECONDS).exec()
    } catch (error) {
      logger.warn({ err: error }, 'profile view not counted for trending')
    }
  }

  /** Stored profiles by puuid, with their newest Solo/Duo rank. Index reads only. */
  async players(puuids: string[]): Promise<Map<string, HomePlayer>> {
    const players = new Map<string, HomePlayer>()
    if (!puuids.length) return players
    const [rows, ranks] = await Promise.all([
      db
        .from('riot_player')
        .select('puuid', 'game_name', 'tag_line', 'platform', 'profile_icon_id')
        .whereIn('puuid', puuids),
      db
        .from('riot_rank')
        .distinctOn('puuid')
        .select('puuid', 'tier', 'division', 'league_points')
        .whereIn('puuid', puuids)
        .where('queue_type', SOLO)
        .orderBy([
          { column: 'puuid', order: 'asc' },
          { column: 'fetched_at', order: 'desc' },
        ]),
    ])
    const rankByPuuid = new Map<string, HomeRank | null>(
      ranks.map((r: any) => [r.puuid, rankOf(r)])
    )
    for (const row of rows) {
      players.set(row.puuid, {
        gameName: row.game_name,
        tagLine: row.tag_line,
        platform: row.platform,
        profileIconId: row.profile_icon_id ?? null,
        rank: rankByPuuid.get(row.puuid) ?? null,
      })
    }
    return players
  }

  /**
   * The most viewed profiles of the last 7 days, from the daily view buckets. Until a view has
   * been counted that way (a fresh deploy), lifetime views stand in, and the page says so.
   */
  async trending(now = Date.now()): Promise<HomeTrending> {
    const keys = viewBucketKeys(now)
    const union = 'home:views:week'
    const result = await redis
      .multi()
      .zunionstore(union, keys.length, ...keys)
      .zrevrange(union, 0, TRENDING_PLAYERS * 2 - 1, 'WITHSCORES')
      .del(union)
      .exec()
    const flat = (result?.[1]?.[1] as string[] | undefined) ?? []
    const week: Array<{ puuid: string; views: number }> = []
    for (let i = 0; i < flat.length; i += 2) week.push({ puuid: flat[i], views: n(flat[i + 1]) })

    if (week.length) {
      const players = await this.players(week.map((w) => w.puuid))
      return {
        window: 'week',
        players: week
          .filter((w) => players.has(w.puuid))
          .slice(0, TRENDING_PLAYERS)
          .map((w) => ({ ...players.get(w.puuid)!, views: w.views })),
      }
    }

    const top = await db
      .from('riot_player')
      .select('puuid', 'view_count')
      .where('view_count', '>', 0)
      .orderBy('view_count', 'desc')
      .limit(TRENDING_PLAYERS)
    const players = await this.players(top.map((r) => r.puuid))
    return {
      window: 'all',
      players: top
        .filter((r) => players.has(r.puuid))
        .map((r) => ({ ...players.get(r.puuid)!, views: n(r.view_count) })),
    }
  }

  /**
   * The best scores of the last day: the newest stored laned games (at most
   * BEST_GAME_CANDIDATES), scored exactly as the profile scores them, one line per player.
   */
  async bestGames(now = Date.now()): Promise<BestGame[]> {
    const matches = (await matchRepository.getRecent({
      since: now - DAY,
      queueIds: BEST_GAME_QUEUES,
      limit: BEST_GAME_CANDIDATES,
    })) as Match[]
    const lines = bestLines(matches)
    if (!lines.length) return []

    const byId = new Map(matches.map((m) => [m.matchId, m]))
    const stored = await this.players(lines.map((l) => l.puuid))
    const best: BestGame[] = []
    for (const line of lines) {
      const match = byId.get(line.matchId)!
      const p = match.participants.find((x) => x.puuid === line.puuid)
      const game = summaryOf(detailOf(match), line.puuid, line.matchId)
      if (!p || !game) continue
      const known = stored.get(line.puuid)
      best.push({
        matchId: line.matchId,
        game,
        player: known ?? {
          gameName: p.gameName,
          tagLine: p.tagLine,
          platform: match.platform,
          profileIconId: p.profileIconId ?? null,
          rank: null,
        },
      })
    }
    return best.filter((b) => b.player.gameName && b.player.tagLine)
  }

  /**
   * Solo/Duo climbs of the last day from the stored rank snapshots (league-v4 reads and the
   * desktop app's post-game snapshots alike). One range read on `fetched_at`, then the newest
   * snapshot before the window for just those players, on the rank history index.
   */
  async climbs(now = Date.now()): Promise<Climb[]> {
    const since = new Date(now - DAY)
    const recent = await db
      .from('riot_rank')
      .select('puuid', 'tier', 'division', 'league_points', 'wins', 'losses', 'fetched_at')
      .where('queue_type', SOLO)
      .where('fetched_at', '>=', since)
    if (!recent.length) return []

    const puuids = [...new Set(recent.map((r) => r.puuid as string))]
    const before = await db
      .from('riot_rank')
      .distinctOn('puuid')
      .select('puuid', 'tier', 'division', 'league_points', 'wins', 'losses', 'fetched_at')
      .whereIn('puuid', puuids)
      .where('queue_type', SOLO)
      .where('fetched_at', '<', since)
      .orderBy([
        { column: 'puuid', order: 'asc' },
        { column: 'fetched_at', order: 'desc' },
      ])

    const snapshot = (r: any): RankSnapshot => ({
      puuid: r.puuid,
      tier: r.tier,
      division: r.division,
      lp: n(r.league_points),
      wins: n(r.wins),
      losses: r.losses === null || r.losses === undefined ? null : n(r.losses),
      at: new Date(r.fetched_at).getTime(),
    })
    const climbs = climbsFrom(
      recent.map(snapshot),
      new Map(before.map((r) => [r.puuid, snapshot(r)]))
    )
    const players = await this.players(climbs.map((c) => c.puuid))
    return climbs
      .filter((c) => players.has(c.puuid))
      .map(({ puuid, now: last, ...climb }) => ({
        ...climb,
        player: { ...players.get(puuid)!, rank: rankOf({ ...last, league_points: last.lp }) },
      }))
  }

  /**
   * Champions on the newest patch with enough Solo/Duo games: win, pick and ban rates, and the
   * win rate's change since the patch before. The patch list reads `matches` over two months;
   * the picks read only the patch's games (an `IN` set, the partitions bounded by its start).
   */
  async champions(now = Date.now()): Promise<HomeChampions | null> {
    const patches = await chRows(`
      SELECT patch, count(), min(game_start_ms)
      FROM matches
      WHERE game_start_ms >= ${now - PATCH_LOOKBACK} AND queue_id = ${SOLO_QUEUE}
      GROUP BY patch
    `)
    const picked = pickPatch(
      patches.map((r) => ({ patch: String(r[0]), games: n(r[1]), from: n(r[2]) }))
    )
    if (!picked) return null
    const starts = new Map(patches.map((r) => [String(r[0]), n(r[2])]))

    const counts = async (patch: string): Promise<ChampionCount[]> => {
      const from = starts.get(patch) ?? 0
      const rows = await chRows(`
        SELECT champion_id, team_position, count(), sum(win)
        FROM participants
        WHERE game_start_ms >= ${from} AND queue_id = ${SOLO_QUEUE}
          AND match_id IN (
            SELECT match_id FROM matches
            WHERE game_start_ms >= ${from} AND queue_id = ${SOLO_QUEUE}
              AND patch = '${escapeClickhouseString(patch)}'
          )
        GROUP BY champion_id, team_position
      `)
      return rows.map((r) => ({
        championId: n(r[0]),
        position: String(r[1] ?? ''),
        games: n(r[2]),
        wins: n(r[3]),
      }))
    }

    const current = picked.current.patch
    const from = starts.get(current) ?? 0
    const [currentCounts, previousCounts, banRows] = await Promise.all([
      counts(current),
      picked.previous ? counts(picked.previous.patch) : Promise.resolve([]),
      chRows(`
        SELECT ban, count()
        FROM matches
        ARRAY JOIN arrayDistinct(arrayConcat(t1_bans, t2_bans)) AS ban
        WHERE game_start_ms >= ${from} AND queue_id = ${SOLO_QUEUE}
          AND patch = '${escapeClickhouseString(current)}' AND ban > 0
        GROUP BY ban
      `),
    ])
    const bans = new Map(banRows.map((r) => [n(r[0]), n(r[1])]))

    return {
      patch: current,
      previousPatch: picked.previous?.patch ?? null,
      games: picked.current.games,
      minGames: MIN_CHAMPION_GAMES,
      rows: championRows(currentCounts, bans, picked.current.games, previousCounts),
    }
  }

  /* ── The home and the header's menus ─────────────────────────────── */

  /**
   * The home's sections in one go; one that cannot be read is null and the rest still show. A
   * section still computing on a cold cache after `SECTION_WAIT_MS` is left out of this render
   * and keeps computing into the cache for the next one.
   */
  async page(): Promise<HomePage> {
    const [picks, pros, lanes, discord] = await Promise.all([
      capped(this.picks()),
      capped(this.pros()),
      capped(this.lanes()),
      this.discord(),
    ])
    return {
      picks: picks && { patch: picks.patch, best: picks.best, bans: picks.bans },
      pros: pros?.top.length ? pros.top.map(({ tier, ...p }) => (void tier, p)) : null,
      lanes,
      discord,
    }
  }

  /** The community server's counts, left out when Discord is slow or unreachable. */
  discord() {
    return capped(
      discordServer.counts().catch(() => null),
      DISCORD_WAIT_MS
    )
  }

  /** What the header's menus show beside their links. */
  async nav(): Promise<SiteNav> {
    const [picks, pros] = await Promise.all([capped(this.picks()), capped(this.pros())])
    const { bans, ...tierList } = picks ?? { bans: null }
    void bans
    return {
      tierList: picks ? (tierList as SiteNav['tierList']) : null,
      pros: pros && { top: pros.top.slice(0, NAV_PROS), counts: pros.counts },
      leagues: LEAGUES.map((l) => ({
        slug: l.slug,
        name: l.name,
        short: l.code,
        teams: l.teams.length,
      })),
    }
  }

  /** The default filter of the champion pages (newest shown patch, Emerald and above). */
  private async filter(): Promise<Filter | null> {
    const filter = await championStatsService.filter({ rank: DEFAULT_BRACKET })
    return filter && { ...filter, region: null }
  }

  private async names(): Promise<Map<number, ChampionInfo>> {
    const list = await championStatsService.champions()
    return new Map(list.map((c) => [c.id, { id: c.id, name: c.name, slug: c.slug }]))
  }

  /** The tier list's best pick per role, the most banned and the climbers since last patch. */
  picks(): Promise<TierBoard | null> {
    return this.section('picks', TTL.picks, async () => {
      const filter = await this.filter()
      if (!filter) return null
      const [summary, previous, names] = await Promise.all([
        championStatsService.summary(filter),
        championStatsService.previous(filter).catch(() => null),
        this.names(),
      ])
      if (!summary.games) return null
      return {
        patch: summary.patch,
        previousPatch: previous?.patch ?? null,
        games: summary.games,
        champions: names.size,
        best: bestPicks(summary, names),
        bans: mostBanned(summary, names),
        climbers: climbersOf(summary, previous, names),
      }
    })
  }

  /**
   * The highest ranked pros now, as the pros ladder ranks them with their moves over 24 hours,
   * and how many players, accounts and teams the directory holds. Falls back to the directory's
   * top when the ladder cannot be read.
   */
  pros(): Promise<ProBoard | null> {
    return this.section('pros', TTL.pros, async () => {
      const [directory, ladderTop] = await Promise.all([
        proService.directory(),
        proLadderService.ladder({ limit: HOME_ROWS }).catch((error) => {
          logger.warn({ err: error }, 'home pros: ladder unavailable')
          return null
        }),
      ])
      const pros: HomePro[] = ladderTop?.rows.length
        ? ladderTop.rows.map(fromLadder)
        : directory.top.slice(0, HOME_ROWS).map((p: DirectoryPro) => ({
            slug: p.slug,
            name: p.name,
            team: p.team ? { id: p.team.id, name: p.team.name, shortName: p.team.shortName } : null,
            tier: p.best?.tier ?? null,
            lp: p.best?.lp ?? null,
          }))
      return { top: pros, counts: directory.counts ?? null }
    })
  }

  /**
   * Gold ahead of the lane opponent at 10 minutes and the share of first bloods, per champion and
   * role on the default filter: from the counted cells, else from a sample of the patch's games.
   */
  lanes(): Promise<LaneBoard | null> {
    return this.section('lanes', TTL.lanes, async () => {
      const filter = await this.filter()
      if (!filter) return null
      const [summary, names, counted] = await Promise.all([
        championStatsService.summary(filter),
        this.names(),
        areEventsCounted(filter.patch),
      ])
      const params = counted
        ? { patch: filter.patch }
        : { patch: filter.patch, patchStart: await patchStart(filter.patch) }
      const settings = counted ? undefined : LANE_LIMITS
      const [gold, firstBlood] = await Promise.all([
        statRows(counted ? goldCellsSql(filter) : goldSampleSql(filter), params, settings),
        statRows(
          counted ? firstBloodCellsSql(filter) : firstBloodSampleSql(filter),
          params,
          settings
        ),
      ])
      const bullies = laneRows(laneFigures(gold), summary, names).filter((r) => r.value > 0)
      const firsts = laneRows(laneFigures(firstBlood), summary, names)
      if (!bullies.length && !firsts.length) return null
      return { bullies, firstBlood: firsts }
    })
  }
}

/** A ladder row as the home's lists and the Pros menu show it. */
function fromLadder(row: LadderRow): HomePro {
  const team = row.pro.team
  return {
    slug: row.pro.slug,
    name: row.pro.name,
    team: team ? { id: team.id, name: team.name, shortName: team.shortName } : null,
    tier: row.account.tier,
    lp: row.account.lp,
    movement:
      row.move && row.move.places !== null ? { places: row.move.places, lp: row.move.lp } : null,
  }
}

export default new HomeService()
