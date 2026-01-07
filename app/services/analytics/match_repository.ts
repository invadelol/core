import clickhouse from 'adonisjs-clickhouse/services/main'
import { asString, escapeClickhouseString } from '#utils/clickhouse'
import { DEFAULT_MATCH_COUNT, DEFAULT_OFFSET } from '#config/constants'

/**
 * Repository for match-related ClickHouse queries
 */
export class MatchRepository {
  /**
   * Returns the subset of matchIds that already exist in ClickHouse.
   */
  async getExistingIds(matchIds: string[]): Promise<Set<string>> {
    const unique = Array.from(new Set(matchIds.filter(Boolean)))
    if (!unique.length) return new Set()

    const inList = unique.map((id) => `'${escapeClickhouseString(id)}'`).join(',')
    const result = await clickhouse.query({
      query: `SELECT match_id FROM matches WHERE match_id IN (${inList})`,
      format: 'JSONEachRow',
    })

    const rows = (await result.json<{ match_id: string }>()) ?? []
    return new Set(rows.map((r) => asString(r.match_id)).filter(Boolean))
  }

  /**
   * Get matches for a summoner with participant details
   */
  async getByPuuid(
    puuid: string,
    filters: {
      queueIds?: number[] | readonly number[]
      count?: number
      offset?: number
      championId?: number
      role?: string
    }
  ) {
    const count = filters.count ?? DEFAULT_MATCH_COUNT
    const offset = filters.offset ?? DEFAULT_OFFSET
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
      WITH my_matches AS (
        SELECT match_id
        FROM participants
        PREWHERE puuid = '${escapedPuuid}'
        WHERE 1=1 ${whereSql}
        ORDER BY game_start_ms DESC
        LIMIT ${count} OFFSET ${offset}
      )
      SELECT
        m.match_id as matchId,
        m.game_start_ms as gameStartMs,
        m.duration_sec as duration,
        m.queue_id as queueId,
        m.patch as patch,
        groupArray(
          (
            p.puuid,
            p.riot_id_game_name,
            p.riot_id_tag_line,
            p.champion_id,
            p.team_id,
            p.win,
            p.kills,
            p.deaths,
            p.assists,
            p.total_cs,
            p.summoner_level,
            p.item0,
            p.item1,
            p.item2,
            p.item3,
            p.item4,
            p.item5,
            p.item6,
            p.primary_style,
            p.secondary_style,
            p.vision_score,
            p.dmg_taken,
            p.dmg_to_champ,
            p.team_position
          )
        ) as participants
      FROM matches m
      JOIN participants p ON m.match_id = p.match_id
      WHERE m.match_id IN (SELECT match_id FROM my_matches)
      GROUP BY m.match_id, m.game_start_ms, m.duration_sec, m.queue_id, m.patch
      ORDER BY gameStartMs DESC
    `

    const result = await clickhouse.query({
      query,
      format: 'JSONEachRow',
    })

    const rows = (await result.json<any>()) ?? []

    return rows.map((row: any) => ({
      ...row,
      participants: row.participants.map((p: any) => ({
        puuid: p[0],
        gameName: p[1],
        tagLine: p[2],
        championId: p[3],
        teamId: p[4],
        win: p[5],
        kills: p[6],
        deaths: p[7],
        assists: p[8],
        cs: p[9],
        level: p[10],
        items: [p[11], p[12], p[13], p[14], p[15], p[16], p[17]],
        perks: { primary: p[18], sub: p[19] },
        visionScore: p[20],
        damageTaken: p[21],
        damageDealt: p[22],
        position: p[23],
      })),
    }))
  }

  /**
   * Get recent match participants for upsert operations
   */
  async getRecentParticipants(
    puuid: string,
    limit: number = DEFAULT_MATCH_COUNT
  ): Promise<
    Array<{
      puuid: string
      gameName: string
      tagLine: string
      profileIconId: number
      summonerLevel: number
    }>
  > {
    const escapedPuuid = escapeClickhouseString(puuid)
    const query = `
      WITH my_matches AS (
        SELECT match_id
        FROM participants
        PREWHERE puuid = '${escapedPuuid}'
        ORDER BY game_start_ms DESC
        LIMIT ${limit}
      )
      SELECT
        p.puuid as puuid,
        argMax(p.riot_id_game_name, p.game_start_ms) as gameName,
        argMax(p.riot_id_tag_line, p.game_start_ms) as tagLine,
        argMax(p.profile_icon_id, p.game_start_ms) as profileIconId,
        argMax(p.summoner_level, p.game_start_ms) as summonerLevel
      FROM participants p
      INNER JOIN my_matches m ON p.match_id = m.match_id
      GROUP BY p.puuid
    `

    const result = await clickhouse.query({
      query,
      format: 'JSONEachRow',
    })

    return (
      (await result.json<{
        puuid: string
        gameName: string
        tagLine: string
        profileIconId: number
        summonerLevel: number
      }>()) ?? []
    )
  }
}

export default new MatchRepository()
