import clickhouse from 'adonisjs-clickhouse/services/main'
import { escapeClickhouseString } from '#utils/clickhouse'
import type {
  SummonerActivity,
  SummonerFriend,
  SummonerStats,
  SummonerChampionStats,
} from '#types/summoner'
import { DEFAULT_STATS_COUNT, DEFAULT_FRIENDS_LIMIT, TOP_CHAMPIONS_COUNT } from '#config/constants'

/**
 * Repository for summoner statistics ClickHouse queries
 */
export class StatsRepository {
  /**
   * Get daily activity (games played per day)
   */
  async getSummonerActivity(puuid: string): Promise<SummonerActivity[]> {
    const result = await clickhouse.query({
      query: `
        SELECT
          toDate(fromUnixTimestamp64Milli(game_start_ms)) as day,
          count() as games,
          sum(win) as wins
        FROM participants
        PREWHERE puuid = '${escapeClickhouseString(puuid)}'
        GROUP BY day
        ORDER BY day ASC
      `,
      format: 'JSONEachRow',
    })

    return (await result.json<SummonerActivity>()) ?? []
  }

  /**
   * Get frequent teammates
   */
  async getSummonerFriends(puuid: string): Promise<SummonerFriend[]> {
    const escapedPuuid = escapeClickhouseString(puuid)
    const result = await clickhouse.query({
      query: `
        WITH my_matches AS (
          SELECT match_id, team_id
          FROM participants
          PREWHERE puuid = '${escapedPuuid}'
        )
        SELECT
          p.puuid as puuid,
          argMax(p.riot_id_game_name, p.game_start_ms) as gameName,
          argMax(p.riot_id_tag_line, p.game_start_ms) as tagLine,
          argMax(p.profile_icon_id, p.game_start_ms) as profileIconId,
          argMax(p.summoner_level, p.game_start_ms) as level,
          count() as games,
          sum(p.win) as wins
        FROM participants p
        INNER JOIN my_matches m ON p.match_id = m.match_id AND p.team_id = m.team_id
        WHERE p.puuid != '${escapedPuuid}'
        GROUP BY p.puuid
        HAVING games > 1
        ORDER BY games DESC
        LIMIT ${DEFAULT_FRIENDS_LIMIT}
      `,
      format: 'JSONEachRow',
    })

    return (await result.json<SummonerFriend>()) ?? []
  }

  /**
   * Get global stats and top champions
   */
  async getSummonerStats(
    puuid: string,
    filters: {
      queueIds?: number[] | readonly number[]
      count: number
      championId?: number
      role?: string
    }
  ): Promise<SummonerStats> {
    const escapedPuuid = escapeClickhouseString(puuid)

    const whereClauses: string[] = []
    if (filters.queueIds?.length) {
      whereClauses.push(`queue_id IN (${filters.queueIds.join(',')})`)
    }
    if (filters.championId) {
      whereClauses.push(`champion_id = ${filters.championId}`)
    }
    if (filters.role && filters.role !== 'all') {
      whereClauses.push(`team_position = '${escapeClickhouseString(filters.role)}'`)
    }
    const whereSql = whereClauses.length ? `AND ${whereClauses.join(' AND ')}` : ''

    const query = `
      WITH filtered_matches AS (
        SELECT match_id
        FROM participants
        PREWHERE puuid = '${escapedPuuid}'
        WHERE 1=1 ${whereSql}
        ORDER BY game_start_ms DESC
        LIMIT ${filters.count}
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
      FROM participants p
      JOIN matches m ON p.match_id = m.match_id
      JOIN team_totals t ON p.match_id = t.match_id AND p.team_id = t.team_id
      WHERE p.match_id IN (SELECT match_id FROM filtered_matches)
        AND p.puuid = '${escapedPuuid}'
    `

    const champsQuery = `
      WITH filtered_matches AS (
        SELECT match_id
        FROM participants
        PREWHERE puuid = '${escapedPuuid}'
        WHERE 1=1 ${whereSql}
        ORDER BY game_start_ms DESC
        LIMIT ${filters.count}
      )
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

    const [globalRes, champsRes] = await Promise.all([
      clickhouse.query({ query, format: 'JSONEachRow' }),
      clickhouse.query({ query: champsQuery, format: 'JSONEachRow' }),
    ])

    const globalRows = await globalRes.json<any>()
    const champions = await champsRes.json<any>()

    if (!globalRows.length || globalRows[0].total === 0) {
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

    const global = globalRows[0]
    return {
      global: {
        csMin: global.csMin,
        visionMin: global.visionMin,
        goldPerMinute: global.goldPerMinute,
        damagePerMinute: global.damagePerMinute,
        kda: global.kda,
        killParticipation: global.killParticipation,
        damageShare: global.damageShare,
        goldShare: global.goldShare,
        winrate: global.winrate,
        total: global.total,
      },
      champions,
    }
  }

  /**
   * Get per-champion statistics
   */
  async getSummonerChampionStats(
    puuid: string,
    count: number = DEFAULT_STATS_COUNT
  ): Promise<SummonerChampionStats[]> {
    const escapedPuuid = escapeClickhouseString(puuid)
    const query = `
      WITH my_matches AS (
        SELECT match_id
        FROM participants
        PREWHERE puuid = '${escapedPuuid}'
        ORDER BY game_start_ms DESC
        LIMIT ${count}
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
        avg(p.dmg_to_champ / (m.duration_sec / 60.0)) as damageMin
      FROM participants p
      JOIN matches m ON p.match_id = m.match_id
      WHERE p.match_id IN (SELECT match_id FROM my_matches)
        AND p.puuid = '${escapedPuuid}'
      GROUP BY p.champion_id
      ORDER BY games DESC
    `

    const result = await clickhouse.query({
      query,
      format: 'JSONEachRow',
    })

    return (await result.json<SummonerChampionStats>()) ?? []
  }
}

export default new StatsRepository()
