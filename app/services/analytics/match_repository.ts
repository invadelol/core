import clickhouse from 'adonisjs-clickhouse/services/main'
import { asString, escapeClickhouseString } from '#utils/clickhouse'
import { DEFAULT_MATCH_COUNT, DEFAULT_OFFSET } from '#config/constants'

/**
 * Repository for match-related ClickHouse queries
 */
export class MatchRepository {
  /**
   * We store most ClickHouse `groupArray` values as tuples for speed.
   * This helper converts a participant tuple (ordered SELECT list) into a JS object
   * with stable field names used by the frontend.
   */
  private mapParticipantTuple(p: any) {
    const totalDamageDealtToChampions = (p[35] || 0) + (p[36] || 0) + (p[37] || 0)

    return {
      puuid: p[0],
      gameName: p[1],
      tagLine: p[2],
      championId: p[3],
      teamId: p[4],
      win: p[5],
      kills: p[6],
      deaths: p[7],
      assists: p[8],

      /**
       * Kept for backward compatibility with existing UI usage.
       * This is the aggregated lane + jungle CS value stored in ClickHouse.
       */
      cs: p[9],
      totalMinionsKilled: p[9],
      level: p[10],
      champLevel: p[11],
      items: [p[12], p[13], p[14], p[15], p[16], p[17], p[18]],
      spells: [p[19], p[20]],
      perks: { primary: p[21], sub: p[22] },

      visionScore: p[23],
      damageTaken: p[24],

      // "damageDealt" is used throughout the UI as damage to champions.
      damageDealt: p[25],
      totalDamageDealtToChampions,
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
    }
  }

  /**
   * Converts a timeline tuple (ordered SELECT list) into the object shape used by the UI.
   * Note: we sort frames in ClickHouse, so we can keep this mapping lightweight here.
   */
  private mapTimelineTuple(t: any) {
    return {
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
    }
  }

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
   * Get matches for a summoner (fast list).
   *
   * Important: this intentionally does NOT load match timeline data.
   * Timeline is large and should be loaded on-demand via `getById()`.
   *
   * Performance approach:
   * 1. CTE finds the small set of match_ids (fast PREWHERE on puuid index).
   * 2. Parallel queries: one for match metadata, one for participants.
   * 3. JS-side merge avoids a heavy GROUP BY + groupArray on the DB.
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

    // Step 1: Get matching match_ids (very fast – uses PREWHERE on puuid)
    const idsQuery = `
      SELECT match_id, game_start_ms
      FROM participants
      PREWHERE puuid = '${escapedPuuid}'
      WHERE 1=1 ${whereSql}
      ORDER BY game_start_ms DESC
      LIMIT ${count} OFFSET ${offset}
    `

    const idsResult = await clickhouse.query({ query: idsQuery, format: 'JSONEachRow' })
    const idsRows = (await idsResult.json<{ match_id: string; game_start_ms: number }>()) ?? []

    if (!idsRows.length) return []

    const matchIds = idsRows.map((r) => asString(r.match_id))
    const inList = matchIds.map((id) => `'${escapeClickhouseString(id)}'`).join(',')

    // Step 2: Parallel fetch match metadata + participants
    const matchQuery = `
      SELECT
        match_id as matchId,
        game_start_ms as gameStartMs,
        duration_sec as duration,
        queue_id as queueId,
        patch,
        t1_win as t1Win,
        t2_win as t2Win,
        t1_towers as t1Towers,
        t2_towers as t2Towers,
        t1_inhibs as t1Inhibs,
        t2_inhibs as t2Inhibs,
        t1_dragons as t1Dragons,
        t2_dragons as t2Dragons,
        t1_barons as t1Barons,
        t2_barons as t2Barons,
        t1_heralds as t1Heralds,
        t2_heralds as t2Heralds
      FROM matches
      PREWHERE match_id IN (${inList})
    `

    const participantsQuery = `
      SELECT
        match_id,
        puuid,
        riot_id_game_name,
        riot_id_tag_line,
        champion_id,
        team_id,
        win,
        kills,
        deaths,
        assists,
        total_cs,
        summoner_level,
        champ_level,
        item0, item1, item2, item3, item4, item5, item6,
        spell1, spell2,
        primary_style, secondary_style,
        vision_score,
        dmg_taken,
        dmg_to_champ,
        team_position,
        gold_earned,
        wards_placed,
        wards_killed,
        dmg_to_turrets,
        dmg_to_objectives,
        physical_dmg_dealt,
        magic_dmg_dealt,
        true_dmg_dealt,
        physical_dmg_to_champ,
        magic_dmg_to_champ,
        true_dmg_to_champ,
        neutral_minions_killed,
        vision_wards_bought,
        all_in_pings,
        assist_pings,
        command_pings,
        danger_pings,
        enemy_missing_pings,
        enemy_vision_pings,
        get_back_pings,
        need_vision_pings,
        on_my_way_pings,
        push_pings,
        vision_cleared_pings,
        bait_pings,
        hold_pings
      FROM participants
      PREWHERE match_id IN (${inList})
    `

    const [matchResult, partResult] = await Promise.all([
      clickhouse.query({ query: matchQuery, format: 'JSONEachRow' }),
      clickhouse.query({ query: participantsQuery, format: 'JSONEachRow' }),
    ])

    const matchRows = (await matchResult.json<any>()) ?? []
    const partRows = (await partResult.json<any>()) ?? []

    // Step 3: JS-side merge (much faster than DB GROUP BY for small result sets)
    const matchMap = new Map<string, any>()
    for (const m of matchRows) {
      matchMap.set(m.matchId, { ...m, participants: [] })
    }

    for (const p of partRows) {
      const match = matchMap.get(p.match_id)
      if (!match) continue
      const totalDmgToChamp =
        (p.physical_dmg_to_champ || 0) + (p.magic_dmg_to_champ || 0) + (p.true_dmg_to_champ || 0)
      match.participants.push({
        puuid: p.puuid,
        gameName: p.riot_id_game_name,
        tagLine: p.riot_id_tag_line,
        championId: p.champion_id,
        teamId: p.team_id,
        win: p.win,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        cs: p.total_cs,
        totalMinionsKilled: p.total_cs,
        level: p.summoner_level,
        champLevel: p.champ_level,
        items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6],
        spells: [p.spell1, p.spell2],
        perks: { primary: p.primary_style, sub: p.secondary_style },
        visionScore: p.vision_score,
        damageTaken: p.dmg_taken,
        damageDealt: p.dmg_to_champ,
        totalDamageDealtToChampions: totalDmgToChamp,
        position: p.team_position,
        goldEarned: p.gold_earned,
        wardsPlaced: p.wards_placed,
        wardsKilled: p.wards_killed,
        damageDealtToTurrets: p.dmg_to_turrets,
        damageDealtToObjectives: p.dmg_to_objectives,
        physicalDamageDealt: p.physical_dmg_dealt,
        magicDamageDealt: p.magic_dmg_dealt,
        trueDamageDealt: p.true_dmg_dealt,
        physicalDamageDealtToChampions: p.physical_dmg_to_champ,
        magicDamageDealtToChampions: p.magic_dmg_to_champ,
        trueDamageDealtToChampions: p.true_dmg_to_champ,
        neutralMinionsKilled: p.neutral_minions_killed,
        visionWardsBoughtInGame: p.vision_wards_bought,
        allInPings: p.all_in_pings,
        assistPings: p.assist_pings,
        commandPings: p.command_pings,
        dangerPings: p.danger_pings,
        enemyMissingPings: p.enemy_missing_pings,
        enemyVisionPings: p.enemy_vision_pings,
        getBackPings: p.get_back_pings,
        needVisionPings: p.need_vision_pings,
        onMyWayPings: p.on_my_way_pings,
        pushPings: p.push_pings,
        visionClearedPings: p.vision_cleared_pings,
        baitPings: p.bait_pings,
        holdPings: p.hold_pings,
      })
    }

    // Return in descending game start order
    return matchIds.map((id) => matchMap.get(id)).filter(Boolean)
  }

  /**
   * Load full match details (including timeline) by match id.
   *
   * Performance approach:
   * - Three parallel flat queries (match, participants, timeline) — no JOINs or GROUP BY.
   * - JS-side merge is trivial for a single match.
   * - Timeline rows returned flat and sorted by frame_ms (ClickHouse ORDER BY).
   */
  async getById(matchId: string) {
    const escapedMatchId = escapeClickhouseString(matchId)

    // Three parallel queries – no joins, no groupArray overhead
    const matchQuery = `
      SELECT
        match_id as matchId,
        game_start_ms as gameStartMs,
        duration_sec as duration,
        queue_id as queueId,
        patch,
        t1_win as t1Win,
        t2_win as t2Win,
        t1_towers as t1Towers,
        t2_towers as t2Towers,
        t1_inhibs as t1Inhibs,
        t2_inhibs as t2Inhibs,
        t1_dragons as t1Dragons,
        t2_dragons as t2Dragons,
        t1_barons as t1Barons,
        t2_barons as t2Barons,
        t1_heralds as t1Heralds,
        t2_heralds as t2Heralds
      FROM matches
      PREWHERE match_id = '${escapedMatchId}'
      LIMIT 1
    `

    const participantsQuery = `
      SELECT
        puuid,
        riot_id_game_name,
        riot_id_tag_line,
        champion_id,
        team_id,
        win,
        kills,
        deaths,
        assists,
        total_cs,
        summoner_level,
        champ_level,
        item0, item1, item2, item3, item4, item5, item6,
        spell1, spell2,
        primary_style, secondary_style,
        vision_score,
        dmg_taken,
        dmg_to_champ,
        team_position,
        gold_earned,
        wards_placed,
        wards_killed,
        dmg_to_turrets,
        dmg_to_objectives,
        physical_dmg_dealt,
        magic_dmg_dealt,
        true_dmg_dealt,
        physical_dmg_to_champ,
        magic_dmg_to_champ,
        true_dmg_to_champ,
        neutral_minions_killed,
        vision_wards_bought,
        all_in_pings,
        assist_pings,
        command_pings,
        danger_pings,
        enemy_missing_pings,
        enemy_vision_pings,
        get_back_pings,
        need_vision_pings,
        on_my_way_pings,
        push_pings,
        vision_cleared_pings,
        bait_pings,
        hold_pings
      FROM participants
      PREWHERE match_id = '${escapedMatchId}'
    `

    const timelineQuery = `
      SELECT
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
        rune1, rune2, rune3, rune4, rune5, rune6,
        stat_offense, stat_flex, stat_defense,
        skill_order
      FROM match_timeline
      PREWHERE match_id = '${escapedMatchId}'
      ORDER BY frame_ms ASC
    `

    const [matchRes, partRes, timelineRes] = await Promise.all([
      clickhouse.query({ query: matchQuery, format: 'JSONEachRow' }),
      clickhouse.query({ query: participantsQuery, format: 'JSONEachRow' }),
      clickhouse.query({ query: timelineQuery, format: 'JSONEachRow' }),
    ])

    const matchRows = (await matchRes.json<any>()) ?? []
    const base = matchRows[0]
    if (!base?.matchId) return null

    const partRows = (await partRes.json<any>()) ?? []
    const timelineRows = (await timelineRes.json<any>()) ?? []

    // Map participants from flat rows
    const participants = partRows.map((p: any) => {
      const totalDmgToChamp =
        (p.physical_dmg_to_champ || 0) + (p.magic_dmg_to_champ || 0) + (p.true_dmg_to_champ || 0)
      return {
        puuid: p.puuid,
        gameName: p.riot_id_game_name,
        tagLine: p.riot_id_tag_line,
        championId: p.champion_id,
        teamId: p.team_id,
        win: p.win,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        cs: p.total_cs,
        totalMinionsKilled: p.total_cs,
        level: p.summoner_level,
        champLevel: p.champ_level,
        items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6],
        spells: [p.spell1, p.spell2],
        perks: { primary: p.primary_style, sub: p.secondary_style },
        visionScore: p.vision_score,
        damageTaken: p.dmg_taken,
        damageDealt: p.dmg_to_champ,
        totalDamageDealtToChampions: totalDmgToChamp,
        position: p.team_position,
        goldEarned: p.gold_earned,
        wardsPlaced: p.wards_placed,
        wardsKilled: p.wards_killed,
        damageDealtToTurrets: p.dmg_to_turrets,
        damageDealtToObjectives: p.dmg_to_objectives,
        physicalDamageDealt: p.physical_dmg_dealt,
        magicDamageDealt: p.magic_dmg_dealt,
        trueDamageDealt: p.true_dmg_dealt,
        physicalDamageDealtToChampions: p.physical_dmg_to_champ,
        magicDamageDealtToChampions: p.magic_dmg_to_champ,
        trueDamageDealtToChampions: p.true_dmg_to_champ,
        neutralMinionsKilled: p.neutral_minions_killed,
        visionWardsBoughtInGame: p.vision_wards_bought,
        allInPings: p.all_in_pings,
        assistPings: p.assist_pings,
        commandPings: p.command_pings,
        dangerPings: p.danger_pings,
        enemyMissingPings: p.enemy_missing_pings,
        enemyVisionPings: p.enemy_vision_pings,
        getBackPings: p.get_back_pings,
        needVisionPings: p.need_vision_pings,
        onMyWayPings: p.on_my_way_pings,
        pushPings: p.push_pings,
        visionClearedPings: p.vision_cleared_pings,
        baitPings: p.bait_pings,
        holdPings: p.hold_pings,
      }
    })

    // Map timeline from flat rows (already sorted by frame_ms)
    const timeline = timelineRows.map((t: any) => ({
      participantId: t.participant_id,
      puuid: t.puuid,
      teamId: t.team_id,
      frameMs: t.frame_ms,
      level: t.level,
      xp: t.xp,
      goldCurrent: t.gold_current,
      goldTotal: t.gold_total,
      goldPerSec: t.gold_per_sec,
      cs: t.cs,
      jungleCs: t.jungle_cs,
      kills: t.kills,
      deaths: t.deaths,
      assists: t.assists,
      posX: t.pos_x,
      posY: t.pos_y,
      timeCc: t.time_cc,
      spells: [t.spell1, t.spell2],
      perks: {
        primaryStyle: t.primary_style,
        secondaryStyle: t.secondary_style,
        keystone: t.keystone,
        runes: [t.rune1, t.rune2, t.rune3, t.rune4, t.rune5, t.rune6],
        statPerks: {
          offense: t.stat_offense,
          flex: t.stat_flex,
          defense: t.stat_defense,
        },
      },
      skillOrder: t.skill_order ?? [],
    }))

    return {
      ...base,
      participants,
      timeline,
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
