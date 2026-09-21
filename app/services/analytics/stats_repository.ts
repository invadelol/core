import clickhouse from 'adonisjs-clickhouse/services/main'
import { asString, escapeClickhouseString } from '#utils/clickhouse'
import type {
  SummonerActivity,
  SummonerFriend,
  SummonerStats,
  SummonerChampionStats,
} from '#types/summoner'
import { DEFAULT_STATS_COUNT, DEFAULT_FRIENDS_LIMIT, TOP_CHAMPIONS_COUNT } from '#config/constants'

/** Positional rows: see `columns.ts` for why these queries avoid key names. */
async function rows(query: string): Promise<unknown[][]> {
  const result = await clickhouse.query({ query, format: 'JSONCompactEachRow' })
  return (await result.json<unknown[]>()) ?? []
}

function number(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function integer(value: number | undefined, fallback: number) {
  const n = Math.trunc(Number(value))
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/**
 * Repository for summoner statistics ClickHouse queries.
 *
 * Every query here restricts `participants` with an `IN` set over a small
 * window of match ids before anything else happens. That set is what lets
 * ClickHouse prune granules with the primary key and the `match_id` bloom
 * filter. Expressing the same restriction as a JOIN instead would stream the
 * whole `participants` table through the join on every request, which is the
 * difference between reading a few thousand rows and reading all of them.
 */
export class StatsRepository {
  /**
   * Get daily activity (games played per day)
   */
  async getSummonerActivity(puuid: string): Promise<SummonerActivity[]> {
    const result = await rows(`
      SELECT
        toDate(fromUnixTimestamp64Milli(game_start_ms)) as day,
        count() as games,
        sum(win) as wins
      FROM participants
      PREWHERE puuid = '${escapeClickhouseString(puuid)}'
      GROUP BY day
      ORDER BY day ASC
    `)

    return result.map((row) => ({
      day: asString(row[0]),
      games: number(row[1]),
      wins: number(row[2]),
    }))
  }

  /**
   * Get frequent teammates.
   *
   * `match_id IN (...)` is what prunes the read; the tuple test that follows
   * it keeps only players who were on the same side of those games.
   */
  async getSummonerFriends(puuid: string): Promise<SummonerFriend[]> {
    const escapedPuuid = escapeClickhouseString(puuid)
    const result = await rows(`
      WITH my_matches AS (
        SELECT match_id, team_id
        FROM participants
        PREWHERE puuid = '${escapedPuuid}'
      )
      SELECT
        puuid,
        argMax(riot_id_game_name, game_start_ms) as gameName,
        argMax(riot_id_tag_line, game_start_ms) as tagLine,
        argMax(profile_icon_id, game_start_ms) as profileIconId,
        argMax(summoner_level, game_start_ms) as level,
        count() as games,
        sum(win) as wins
      FROM participants
      WHERE match_id IN (SELECT match_id FROM my_matches)
        AND (match_id, team_id) IN (SELECT match_id, team_id FROM my_matches)
        AND puuid != '${escapedPuuid}'
      GROUP BY puuid
      HAVING games > 1
      ORDER BY games DESC
      LIMIT ${DEFAULT_FRIENDS_LIMIT}
    `)

    return result.map((row) => ({
      puuid: asString(row[0]),
      gameName: asString(row[1]),
      tagLine: asString(row[2]),
      profileIconId: number(row[3]),
      level: number(row[4]),
      games: number(row[5]),
      wins: number(row[6]),
    }))
  }

  /**
   * Get global stats and top champions
   */
  async getSummonerStats(
    puuid: string,
    filters: {
      queueIds?: number[] | readonly number[]
      count: number
      /** Skips this many of the most recent games, so a period can be
       *  compared against the one before it. */
      offset?: number
      championId?: number
      role?: string
    }
  ): Promise<SummonerStats> {
    const escapedPuuid = escapeClickhouseString(puuid)
    const count = integer(filters.count, DEFAULT_STATS_COUNT)
    const offset = Math.max(0, Math.trunc(Number(filters.offset)) || 0)

    const whereClauses: string[] = []
    if (filters.queueIds?.length) {
      whereClauses.push(`queue_id IN (${filters.queueIds.map(Number).join(',')})`)
    }
    if (filters.championId) {
      whereClauses.push(`champion_id = ${Math.trunc(filters.championId)}`)
    }
    if (filters.role && filters.role !== 'all') {
      whereClauses.push(`team_position = '${escapeClickhouseString(filters.role)}'`)
    }
    const whereSql = whereClauses.length ? `AND ${whereClauses.join(' AND ')}` : ''

    const filteredMatches = `
      SELECT match_id
      FROM participants
      PREWHERE puuid = '${escapedPuuid}'
      WHERE 1=1 ${whereSql}
      ORDER BY game_start_ms DESC, match_id DESC
      LIMIT ${count} OFFSET ${offset}
    `

    // The player's own rows are selected in their own subquery rather than
    // left to predicate pushdown, so the join can never widen the read.
    const query = `
      WITH filtered_matches AS (${filteredMatches}),
      mine AS (
        SELECT match_id, team_id, total_cs, vision_score, gold_earned, dmg_to_champ,
               kills, deaths, assists, win
        FROM participants
        WHERE match_id IN (SELECT match_id FROM filtered_matches)
          AND puuid = '${escapedPuuid}'
      ),
      team_totals AS (
        SELECT
          match_id,
          team_id,
          sum(dmg_to_champ) as total_dmg,
          sum(gold_earned) as total_gold,
          sum(kills) as total_kills
        FROM participants
        WHERE match_id IN (SELECT match_id FROM filtered_matches)
        GROUP BY match_id, team_id
      ),
      durations AS (
        SELECT match_id, duration_sec
        FROM matches
        WHERE match_id IN (SELECT match_id FROM filtered_matches)
      )
      SELECT
        avg(p.total_cs / (m.duration_sec / 60.0)) as csMin,
        avg(p.vision_score / (m.duration_sec / 60.0)) as visionMin,
        avg(p.gold_earned / (m.duration_sec / 60.0)) as goldPerMinute,
        avg(p.dmg_to_champ / (m.duration_sec / 60.0)) as damagePerMinute,
        avg((p.kills + p.assists) / if(p.deaths = 0, 1, p.deaths)) as kda,
        avg(p.win) as winrate,
        count() as total,
        avg(p.dmg_to_champ / if(t.total_dmg = 0, 1, t.total_dmg)) as damageShare,
        avg(p.gold_earned / if(t.total_gold = 0, 1, t.total_gold)) as goldShare,
        avg((p.kills + p.assists) / if(t.total_kills = 0, 1, t.total_kills)) as killParticipation
      FROM mine p
      JOIN durations m ON p.match_id = m.match_id
      JOIN team_totals t ON p.match_id = t.match_id AND p.team_id = t.team_id
    `

    const champsQuery = `
      WITH filtered_matches AS (${filteredMatches})
      SELECT
        champion_id as championId,
        count() as games,
        avg(win) as winrate,
        avg((kills + assists) / if(deaths = 0, 1, deaths)) as kda
      FROM participants
      WHERE match_id IN (SELECT match_id FROM filtered_matches)
        AND puuid = '${escapedPuuid}'
      GROUP BY championId
      ORDER BY games DESC, kda DESC
      LIMIT ${TOP_CHAMPIONS_COUNT}
    `

    const [globalRows, champRows] = await Promise.all([rows(query), rows(champsQuery)])

    const row = globalRows[0]
    const total = row ? number(row[6]) : 0

    if (!total) {
      return {
        global: {
          csMin: 0,
          visionMin: 0,
          goldPerMinute: 0,
          damagePerMinute: 0,
          kda: 0,
          killParticipation: 0,
          damageShare: 0,
          goldShare: 0,
          winrate: 0,
          total: 0,
        },
        champions: [],
      }
    }

    return {
      global: {
        csMin: number(row[0]),
        visionMin: number(row[1]),
        goldPerMinute: number(row[2]),
        damagePerMinute: number(row[3]),
        kda: number(row[4]),
        winrate: number(row[5]),
        total,
        damageShare: number(row[7]),
        goldShare: number(row[8]),
        killParticipation: number(row[9]),
      },
      champions: champRows.map((champ) => ({
        championId: number(champ[0]),
        games: number(champ[1]),
        winrate: number(champ[2]),
        kda: number(champ[3]),
      })),
    }
  }

  /**
   * Get per-champion statistics
   */
  async getSummonerChampionStats(
    puuid: string,
    count: number = DEFAULT_STATS_COUNT,
    filters: { queueIds?: readonly number[]; role?: string } = {}
  ): Promise<SummonerChampionStats[]> {
    const escapedPuuid = escapeClickhouseString(puuid)
    const conditions = []
    if (filters.queueIds?.length)
      conditions.push(`queue_id IN (${filters.queueIds.map(Number).join(',')})`)
    if (filters.role && filters.role !== 'all')
      conditions.push(
        `team_position = '${escapeClickhouseString(filters.role === 'SUPPORT' ? 'UTILITY' : filters.role)}'`
      )
    const result = await rows(`
      WITH my_matches AS (
        SELECT match_id
        FROM participants
        PREWHERE puuid = '${escapedPuuid}'
        ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
        ORDER BY game_start_ms DESC, match_id DESC
        LIMIT ${integer(count, DEFAULT_STATS_COUNT)}
      ),
      mine AS (
        SELECT match_id, champion_id, win, kills, deaths, assists,
               total_cs, gold_earned, dmg_to_champ
        FROM participants
        WHERE match_id IN (SELECT match_id FROM my_matches)
          AND puuid = '${escapedPuuid}'
      ),
      durations AS (
        SELECT match_id, duration_sec
        FROM matches
        WHERE match_id IN (SELECT match_id FROM my_matches)
      )
      SELECT
        p.champion_id as championId,
        count() as games,
        sum(p.win) as wins,
        avg(p.win) as winrate,
        avg((p.kills + p.assists) / if(p.deaths = 0, 1, p.deaths)) as kda,
        avg(p.kills) as avgKills,
        avg(p.deaths) as avgDeaths,
        avg(p.assists) as avgAssists,
        avg(p.total_cs / (m.duration_sec / 60.0)) as csMin,
        avg(p.gold_earned / (m.duration_sec / 60.0)) as goldMin,
        avg(p.dmg_to_champ / (m.duration_sec / 60.0)) as damageMin,
        max(p.kills) as maxKills,
        sum(m.duration_sec) as duration
      FROM mine p
      JOIN durations m ON p.match_id = m.match_id
      GROUP BY p.champion_id
      ORDER BY games DESC
    `)

    return result.map((row) => ({
      championId: number(row[0]),
      games: number(row[1]),
      wins: number(row[2]),
      winrate: number(row[3]),
      kda: number(row[4]),
      avgKills: number(row[5]),
      avgDeaths: number(row[6]),
      avgAssists: number(row[7]),
      csMin: number(row[8]),
      goldMin: number(row[9]),
      damageMin: number(row[10]),
      maxKills: number(row[11]),
      duration: number(row[12]),
    }))
  }
}

export default new StatsRepository()
