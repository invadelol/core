import cache from '@adonisjs/cache/services/main'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'
import clickhouse from 'adonisjs-clickhouse/services/main'
import { summaryOf } from '@invadelol/ui/logic'
import matchRepository from '#services/analytics/match_repository'
import { ladder } from '#services/desktop/lp'
import { escapeClickhouseString } from '#utils/clickhouse'
import { detailOf, isRemake, scoreLobby } from '../../inertia/lib/match.js'
import type { Match } from '../../inertia/lib/types.js'
import type {
  BestGame,
  ChampionRow,
  Climb,
  HomeChampions,
  HomeData,
  HomePlayer,
  HomeRank,
  HomeTrending,
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
} as const

/* ── Pure parts, tested on their own ─────────────────────────────── */

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
}

export default new HomeService()
