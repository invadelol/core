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
        m.t1_win as t1Win,
        m.t2_win as t2Win,
        m.t1_towers as t1Towers,
        m.t2_towers as t2Towers,
        m.t1_inhibs as t1Inhibs,
        m.t2_inhibs as t2Inhibs,
        m.t1_dragons as t1Dragons,
        m.t2_dragons as t2Dragons,
        m.t1_barons as t1Barons,
        m.t2_barons as t2Barons,
        m.t1_heralds as t1Heralds,
        m.t2_heralds as t2Heralds,
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
            p.champ_level,
            p.item0,
            p.item1,
            p.item2,
            p.item3,
            p.item4,
            p.item5,
            p.item6,
            p.spell1,
            p.spell2,
            p.primary_style,
            p.secondary_style,
            p.vision_score,
            p.dmg_taken,
            p.dmg_to_champ,
            p.team_position,
            p.gold_earned,
            p.wards_placed,
            p.wards_killed,
            p.dmg_to_turrets,
            p.dmg_to_objectives,
            p.physical_dmg_dealt,
            p.magic_dmg_dealt,
            p.true_dmg_dealt,
            p.physical_dmg_to_champ,
            p.magic_dmg_to_champ,
            p.true_dmg_to_champ,
            p.neutral_minions_killed,
            p.vision_wards_bought,
            p.all_in_pings,
            p.assist_pings,
            p.command_pings,
            p.danger_pings,
            p.enemy_missing_pings,
            p.enemy_vision_pings,
            p.get_back_pings,
            p.need_vision_pings,
            p.on_my_way_pings,
            p.push_pings,
            p.vision_cleared_pings,
            p.bait_pings,
            p.hold_pings
          )
        ) as participants
      FROM matches m
      JOIN participants p ON m.match_id = p.match_id
      WHERE m.match_id IN (SELECT match_id FROM my_matches) AND p.puuid = '${escapedPuuid}'
      GROUP BY
        m.match_id,
        m.game_start_ms,
        m.duration_sec,
        m.queue_id,
        m.patch,
        m.t1_win,
        m.t2_win,
        m.t1_towers,
        m.t2_towers,
        m.t1_inhibs,
        m.t2_inhibs,
        m.t1_dragons,
        m.t2_dragons,
        m.t1_barons,
        m.t2_barons,
        m.t1_heralds,
        m.t2_heralds
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
        champLevel: p[11],
        items: [p[12], p[13], p[14], p[15], p[16], p[17], p[18]],
        spells: [p[19], p[20]],
        perks: { primary: p[21], sub: p[22] },
        visionScore: p[23],
        damageTaken: p[24],
        damageDealt: p[25],
        position: p[26],
        goldEarned: p[27],
        wardsPlaced: p[28],
        wardsKilled: p[29],
        damageDealtToTurrets: p[30],
        damageDealtToObjectives: p[31],
        physicalDamageDealt: p[32],
        magicDamageDealt: p[33],
        trueDamageDealt: p[34],
        physicalDamageDealtToChampions: p[35],
        magicDamageDealtToChampions: p[36],
        trueDamageDealtToChampions: p[37],
        neutralMinionsKilled: p[38],
        visionWardsBoughtInGame: p[39],
        allInPings: p[40],
        assistPings: p[41],
        commandPings: p[42],
        dangerPings: p[43],
        enemyMissingPings: p[44],
        enemyVisionPings: p[45],
        getBackPings: p[46],
        needVisionPings: p[47],
        onMyWayPings: p[48],
        pushPings: p[49],
        visionClearedPings: p[50],
        baitPings: p[51],
        holdPings: p[52],
      })),
      timeline: [],
    }))
  }

  /**
   * Get full details for a single match
   */
  async getByMatchId(matchId: string) {
    const escapedMatchId = escapeClickhouseString(matchId)

    const query = `
      SELECT
        m.match_id as matchId,
        m.game_start_ms as gameStartMs,
        m.duration_sec as duration,
        m.queue_id as queueId,
        m.patch as patch,
        m.t1_win as t1Win,
        m.t2_win as t2Win,
        m.t1_towers as t1Towers,
        m.t2_towers as t2Towers,
        m.t1_inhibs as t1Inhibs,
        m.t2_inhibs as t2Inhibs,
        m.t1_dragons as t1Dragons,
        m.t2_dragons as t2Dragons,
        m.t1_barons as t1Barons,
        m.t2_barons as t2Barons,
        m.t1_heralds as t1Heralds,
        m.t2_heralds as t2Heralds,
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
            p.champ_level,
            p.item0,
            p.item1,
            p.item2,
            p.item3,
            p.item4,
            p.item5,
            p.item6,
            p.spell1,
            p.spell2,
            p.primary_style,
            p.secondary_style,
            p.vision_score,
            p.dmg_taken,
            p.dmg_to_champ,
            p.team_position,
            p.gold_earned,
            p.wards_placed,
            p.wards_killed,
            p.dmg_to_turrets,
            p.dmg_to_objectives,
            p.physical_dmg_dealt,
            p.magic_dmg_dealt,
            p.true_dmg_dealt,
            p.physical_dmg_to_champ,
            p.magic_dmg_to_champ,
            p.true_dmg_to_champ,
            p.neutral_minions_killed,
            p.vision_wards_bought,
            p.all_in_pings,
            p.assist_pings,
            p.command_pings,
            p.danger_pings,
            p.enemy_missing_pings,
            p.enemy_vision_pings,
            p.get_back_pings,
            p.need_vision_pings,
            p.on_my_way_pings,
            p.push_pings,
            p.vision_cleared_pings,
            p.bait_pings,
            p.hold_pings
          )
        ) as participants
      FROM matches m
      JOIN participants p ON m.match_id = p.match_id
      WHERE m.match_id = '${escapedMatchId}'
      GROUP BY
        m.match_id,
        m.game_start_ms,
        m.duration_sec,
        m.queue_id,
        m.patch,
        m.t1_win,
        m.t2_win,
        m.t1_towers,
        m.t2_towers,
        m.t1_inhibs,
        m.t2_inhibs,
        m.t1_dragons,
        m.t2_dragons,
        m.t1_barons,
        m.t2_barons,
        m.t1_heralds,
        m.t2_heralds
    `

    const result = await clickhouse.query({
      query,
      format: 'JSONEachRow',
    })

    const row = (await result.json<any>())?.[0]
    if (!row) return null

    // Fetch timeline
    const timelineQuery = `
      SELECT
        groupArray(
          (
            participant_id,
            puuid,
            team_id,
            frame_ms,
            level,
            xp,
            gold_current,
            gold_total,
            gold_per_sec,
            cs,
            jungle_cs,
            kills,
            deaths,
            assists,
            pos_x,
            pos_y,
            time_cc,
            spell1,
            spell2,
            primary_style,
            secondary_style,
            keystone,
            rune1,
            rune2,
            rune3,
            rune4,
            rune5,
            rune6,
            stat_offense,
            stat_flex,
            stat_defense,
            skill_order
          )
        ) as timeline
      FROM match_timeline
      WHERE match_id = '${escapedMatchId}'
    `

    const timelineResult = await clickhouse.query({
      query: timelineQuery,
      format: 'JSONEachRow',
    })

    const timelineRow = (await timelineResult.json<any>())?.[0]
    const timelineData = timelineRow?.timeline.map((t: any) => ({
      participantId: t[0],
      puuid: t[1],
      teamId: t[2],
      frameMs: t[3],
      level: t[4],
      xp: t[5],
      goldCurrent: t[6],
      goldTotal: t[7],
      goldPerSec: t[8],
      cs: t[9],
      jungleCs: t[10],
      kills: t[11],
      deaths: t[12],
      assists: t[13],
      posX: t[14],
      posY: t[15],
      timeCc: t[16],
      spells: [t[17], t[18]],
      perks: {
        primaryStyle: t[19],
        secondaryStyle: t[20],
        keystone: t[21],
        runes: [t[22], t[23], t[24], t[25], t[26], t[27]],
        statPerks: {
          offense: t[28],
          flex: t[29],
          defense: t[30],
        },
      },
      skillOrder: t[31] ?? [],
    })) ?? []

    return {
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
        champLevel: p[11],
        items: [p[12], p[13], p[14], p[15], p[16], p[17], p[18]],
        spells: [p[19], p[20]],
        perks: { primary: p[21], sub: p[22] },
        visionScore: p[23],
        damageTaken: p[24],
        damageDealt: p[25],
        position: p[26],
        goldEarned: p[27],
        wardsPlaced: p[28],
        wardsKilled: p[29],
        damageDealtToTurrets: p[30],
        damageDealtToObjectives: p[31],
        physicalDamageDealt: p[32],
        magicDamageDealt: p[33],
        trueDamageDealt: p[34],
        physicalDamageDealtToChampions: p[35],
        magicDamageDealtToChampions: p[36],
        trueDamageDealtToChampions: p[37],
        neutralMinionsKilled: p[38],
        visionWardsBoughtInGame: p[39],
        allInPings: p[40],
        assistPings: p[41],
        commandPings: p[42],
        dangerPings: p[43],
        enemyMissingPings: p[44],
        enemyVisionPings: p[45],
        getBackPings: p[46],
        needVisionPings: p[47],
        onMyWayPings: p[48],
        pushPings: p[49],
        visionClearedPings: p[50],
        baitPings: p[51],
        holdPings: p[52],
      })),
      timeline: timelineData,
    }
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
