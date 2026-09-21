import clickhouse from 'adonisjs-clickhouse/services/main'
import { asString, escapeClickhouseString } from '#utils/clickhouse'
import { plan, type ColumnPlan } from '#services/analytics/columns'
import { DEFAULT_MATCH_COUNT, DEFAULT_OFFSET } from '#config/constants'

/* ── Column plans ───────────────────────────────────────────────
   The SELECT clause and the row reader come from one list, so a column can
   never be added to a query without the reader learning where it sits.
   See `columns.ts` for why rows come back positionally.
   ────────────────────────────────────────────────────────────── */

const MATCH_COLUMNS = [
  'match_id',
  'platform',
  'game_start_ms',
  'duration_sec',
  'queue_id',
  'map_id',
  'patch',
  't1_win',
  't2_win',
  't1_towers',
  't2_towers',
  't1_inhibs',
  't2_inhibs',
  't1_dragons',
  't2_dragons',
  't1_barons',
  't2_barons',
  't1_heralds',
  't2_heralds',
  't1_bans',
  't2_bans',
] as const

const matchPlan = plan<any>(MATCH_COLUMNS, {
  matchId: 'match_id',
  platform: 'platform',
  gameStartMs: 'game_start_ms',
  duration: 'duration_sec',
  queueId: 'queue_id',
  mapId: 'map_id',
  patch: 'patch',
  t1Win: 't1_win',
  t2Win: 't2_win',
  t1Towers: 't1_towers',
  t2Towers: 't2_towers',
  t1Inhibs: 't1_inhibs',
  t2Inhibs: 't2_inhibs',
  t1Dragons: 't1_dragons',
  t2Dragons: 't2_dragons',
  t1Barons: 't1_barons',
  t2Barons: 't2_barons',
  t1Heralds: 't1_heralds',
  t2Heralds: 't2_heralds',
  // Drafted away and never shown until now, although every ingested match
  // has carried them since the first migration.
  t1Bans: 't1_bans',
  t2Bans: 't2_bans',
})

/**
 * Everything a scoreboard needs, and nothing else. The match list stops here;
 * the analysis-only columns below are read only for a single expanded match.
 */
const SUMMARY_PARTICIPANT_COLUMNS = [
  'match_id',
  'puuid',
  'riot_id_game_name',
  'riot_id_tag_line',
  'champion_id',
  'team_id',
  'win',
  'kills',
  'deaths',
  'assists',
  'total_cs',
  'summoner_level',
  'champ_level',
  'item0',
  'item1',
  'item2',
  'item3',
  'item4',
  'item5',
  'item6',
  'spell1',
  'spell2',
  'primary_style',
  'secondary_style',
  // The keystone is the single most recognisable thing about a build, and it
  // was ingested from the first patch but never selected, so every rune glyph
  // in a match list rendered as an empty placeholder.
  'keystone',
  'vision_score',
  'dmg_taken',
  'dmg_to_champ',
  'team_position',
  'gold_earned',
  'physical_dmg_to_champ',
  'magic_dmg_to_champ',
  'true_dmg_to_champ',
] as const

const DETAIL_PARTICIPANT_COLUMNS = [
  'lane',
  'wards_placed',
  'wards_killed',
  'dmg_to_turrets',
  'dmg_to_objectives',
  'physical_dmg_dealt',
  'magic_dmg_dealt',
  'true_dmg_dealt',
  'neutral_minions_killed',
  'vision_wards_bought',
  'all_in_pings',
  'assist_pings',
  'command_pings',
  'danger_pings',
  'enemy_missing_pings',
  'enemy_vision_pings',
  'get_back_pings',
  'need_vision_pings',
  'on_my_way_pings',
  'push_pings',
  'vision_cleared_pings',
  'bait_pings',
  'hold_pings',
] as const

const SUMMARY_PARTICIPANT_FIELDS = {
  puuid: 'puuid',
  gameName: 'riot_id_game_name',
  tagLine: 'riot_id_tag_line',
  championId: 'champion_id',
  teamId: 'team_id',
  win: 'win',
  kills: 'kills',
  deaths: 'deaths',
  assists: 'assists',
  cs: 'total_cs',
  totalMinionsKilled: 'total_cs',
  level: 'summoner_level',
  champLevel: 'champ_level',
  visionScore: 'vision_score',
  damageTaken: 'dmg_taken',
  damageDealt: 'dmg_to_champ',
  position: 'team_position',
  goldEarned: 'gold_earned',
  physicalDamageDealtToChampions: 'physical_dmg_to_champ',
  magicDamageDealtToChampions: 'magic_dmg_to_champ',
  trueDamageDealtToChampions: 'true_dmg_to_champ',
}

const DETAIL_PARTICIPANT_FIELDS = {
  lane: 'lane',
  wardsPlaced: 'wards_placed',
  wardsKilled: 'wards_killed',
  damageDealtToTurrets: 'dmg_to_turrets',
  damageDealtToObjectives: 'dmg_to_objectives',
  physicalDamageDealt: 'physical_dmg_dealt',
  magicDamageDealt: 'magic_dmg_dealt',
  trueDamageDealt: 'true_dmg_dealt',
  neutralMinionsKilled: 'neutral_minions_killed',
  visionWardsBoughtInGame: 'vision_wards_bought',
  allInPings: 'all_in_pings',
  assistPings: 'assist_pings',
  commandPings: 'command_pings',
  dangerPings: 'danger_pings',
  enemyMissingPings: 'enemy_missing_pings',
  enemyVisionPings: 'enemy_vision_pings',
  getBackPings: 'get_back_pings',
  needVisionPings: 'need_vision_pings',
  onMyWayPings: 'on_my_way_pings',
  pushPings: 'push_pings',
  visionClearedPings: 'vision_cleared_pings',
  baitPings: 'bait_pings',
  holdPings: 'hold_pings',
}

/** Items, spells, runes and the damage total are assembled, not selected. */
function participantExtras(row: readonly unknown[], at: (column: string) => number) {
  const number = (column: string) => (row[at(column)] as number) || 0
  return {
    items: [
      row[at('item0')],
      row[at('item1')],
      row[at('item2')],
      row[at('item3')],
      row[at('item4')],
      row[at('item5')],
      row[at('item6')],
    ],
    spells: [row[at('spell1')], row[at('spell2')]],
    perks: {
      primary: row[at('primary_style')],
      sub: row[at('secondary_style')],
      keystone: row[at('keystone')],
    },
    totalDamageDealtToChampions:
      number('physical_dmg_to_champ') + number('magic_dmg_to_champ') + number('true_dmg_to_champ'),
  }
}

const summaryParticipantPlan = plan<any>(
  SUMMARY_PARTICIPANT_COLUMNS,
  SUMMARY_PARTICIPANT_FIELDS,
  participantExtras
)

const fullParticipantPlan = plan<any>(
  [...SUMMARY_PARTICIPANT_COLUMNS, ...DETAIL_PARTICIPANT_COLUMNS],
  { ...SUMMARY_PARTICIPANT_FIELDS, ...DETAIL_PARTICIPANT_FIELDS },
  participantExtras
)

const TIMELINE_COLUMNS = [
  'participant_id',
  'puuid',
  'team_id',
  'frame_ms',
  'level',
  'xp',
  'gold_current',
  'gold_total',
  'gold_per_sec',
  'cs',
  'jungle_cs',
  'kills',
  'deaths',
  'assists',
  'pos_x',
  'pos_y',
  'time_cc',
  'spell1',
  'spell2',
  'primary_style',
  'secondary_style',
  'keystone',
  'rune1',
  'rune2',
  'rune3',
  'rune4',
  'rune5',
  'rune6',
  'stat_offense',
  'stat_flex',
  'stat_defense',
  'skill_order',
] as const

const timelinePlan = plan<any>(
  TIMELINE_COLUMNS,
  {
    participantId: 'participant_id',
    puuid: 'puuid',
    teamId: 'team_id',
    frameMs: 'frame_ms',
    level: 'level',
    xp: 'xp',
    goldCurrent: 'gold_current',
    goldTotal: 'gold_total',
    goldPerSec: 'gold_per_sec',
    cs: 'cs',
    jungleCs: 'jungle_cs',
    kills: 'kills',
    deaths: 'deaths',
    assists: 'assists',
    posX: 'pos_x',
    posY: 'pos_y',
    timeCc: 'time_cc',
  },
  (row, at) => ({
    spells: [row[at('spell1')], row[at('spell2')]],
    perks: {
      primaryStyle: row[at('primary_style')],
      secondaryStyle: row[at('secondary_style')],
      keystone: row[at('keystone')],
      runes: [
        row[at('rune1')],
        row[at('rune2')],
        row[at('rune3')],
        row[at('rune4')],
        row[at('rune5')],
        row[at('rune6')],
      ],
      statPerks: {
        offense: row[at('stat_offense')],
        flex: row[at('stat_flex')],
        defense: row[at('stat_defense')],
      },
    },
    skillOrder: row[at('skill_order')] ?? [],
  })
)

/** One positional result set: a single `JSON.parse`, no per-row key strings. */
async function rawRows(query: string): Promise<unknown[][]> {
  const result = await clickhouse.query({ query, format: 'JSONCompactEachRow' })
  return (await result.json<unknown[]>()) ?? []
}

async function readRows<T>(query: string, columns: ColumnPlan<T>): Promise<T[]> {
  const raw = await rawRows(query)
  const out: T[] = new Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = columns.read(raw[i])
  return out
}

/** Only integers ever reach a query string; caller input never does. */
function integer(value: number | undefined, fallback: number) {
  const n = Math.trunc(Number(value))
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

/**
 * Repository for match-related ClickHouse queries.
 *
 * Performance strategy:
 * - Flat SELECT + PREWHERE, no JOIN and no GROUP BY / groupArray.
 * - Every independent read is issued concurrently, and no read has to wait on
 *   another read's *result* before it can start.
 * - Rows arrive positionally and are assembled in JS, which is far cheaper
 *   than a DB-side GROUP BY for these small result sets.
 */
export class MatchRepository {
  /**
   * Returns the subset of matchIds that already exist in ClickHouse.
   */
  async getExistingIds(matchIds: string[]): Promise<Set<string>> {
    const unique = Array.from(new Set(matchIds.filter(Boolean)))
    if (!unique.length) return new Set()

    const inList = unique.map((id) => `'${escapeClickhouseString(id)}'`).join(',')
    const rows = await rawRows(`SELECT match_id FROM matches WHERE match_id IN (${inList})`)

    const found = new Set<string>()
    for (const row of rows) {
      const id = asString(row[0])
      if (id) found.add(id)
    }
    return found
  }

  /**
   * Get matches for a summoner (fast list).
   *
   * Important: this intentionally does NOT load match timeline data.
   * Timeline is large and is loaded on demand via `getById()`.
   *
   * The window of match ids is defined once and inlined into both reads, so
   * the metadata and the participants are fetched in a single concurrent
   * step. Resolving the ids in their own round trip first would put an extra
   * network latency in front of every match list, and the id scan itself is a
   * cheap ordered read over one player's slice of the primary index.
   */
  async getByPuuid(
    puuid: string,
    filters: {
      view?: 'summary' | 'full'
      queueIds?: number[] | readonly number[]
      count?: number
      offset?: number
      championId?: number
      role?: string
    }
  ) {
    const count = integer(filters.count, DEFAULT_MATCH_COUNT)
    const offset = integer(filters.offset, DEFAULT_OFFSET)
    const escapedPuuid = escapeClickhouseString(puuid)

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

    // `match_id` breaks ties, so both readers see the same window even when
    // two games share a start timestamp on the offset boundary.
    const matchWindow = `
      SELECT match_id
      FROM participants
      PREWHERE puuid = '${escapedPuuid}'
      WHERE 1=1 ${whereSql}
      ORDER BY game_start_ms DESC, match_id DESC
      LIMIT ${count} OFFSET ${offset}
    `

    // An `IN` set, never a join: ClickHouse builds the set first and then
    // prunes granules with the primary key and the match_id bloom filter.
    // Joining `participants` against the window instead streams the entire
    // table through the join.
    const participantPlan =
      filters.view === 'summary' ? summaryParticipantPlan : fullParticipantPlan
    const matchIdAt = participantPlan.at('match_id')

    const [matches, participantRows] = await Promise.all([
      readRows<any>(
        `WITH match_window AS (${matchWindow})
         SELECT ${matchPlan.select}
         FROM matches
         WHERE match_id IN (SELECT match_id FROM match_window)`,
        matchPlan
      ),
      rawRows(
        `WITH match_window AS (${matchWindow})
         SELECT ${participantPlan.select}
         FROM participants
         WHERE match_id IN (SELECT match_id FROM match_window)`
      ),
    ])

    if (!matches.length) return []

    const byMatchId = new Map<string, any>()
    for (const match of matches) {
      match.participants = []
      byMatchId.set(asString(match.matchId), match)
    }

    for (const row of participantRows) {
      const match = byMatchId.get(asString(row[matchIdAt]))
      if (match) match.participants.push(participantPlan.read(row))
    }

    // The reads come back unordered, so newest-first is imposed here.
    return matches.sort(
      (a, b) =>
        Number(b.gameStartMs) - Number(a.gameStartMs) ||
        (a.matchId < b.matchId ? 1 : a.matchId > b.matchId ? -1 : 0)
    )
  }

  /**
   * Load full match details (including timeline) by match id.
   *
   * Three parallel flat reads, no joins and no GROUP BY. The timeline arrives
   * ordered by frame, so nothing downstream has to sort it.
   */
  async getById(matchId: string) {
    const escapedMatchId = escapeClickhouseString(matchId)

    const [matches, participants, timeline] = await Promise.all([
      readRows<any>(
        `SELECT ${matchPlan.select}
         FROM matches
         PREWHERE match_id = '${escapedMatchId}'
         LIMIT 1`,
        matchPlan
      ),
      readRows<any>(
        `SELECT ${fullParticipantPlan.select}
         FROM participants
         PREWHERE match_id = '${escapedMatchId}'`,
        fullParticipantPlan
      ),
      readRows<any>(
        `SELECT ${timelinePlan.select}
         FROM match_timeline
         PREWHERE match_id = '${escapedMatchId}'
         ORDER BY frame_ms ASC`,
        timelinePlan
      ),
    ])

    const base = matches[0]
    if (!base?.matchId) return null

    return { ...base, participants, timeline }
  }

  /**
   * Get recent match participants for upsert operations.
   *
   * Same reason as the match list for using an `IN` set rather than a join:
   * a join here streams every participant row we have ever ingested.
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
    const rows = await rawRows(`
      WITH my_matches AS (
        SELECT match_id
        FROM participants
        PREWHERE puuid = '${escapedPuuid}'
        ORDER BY game_start_ms DESC, match_id DESC
        LIMIT ${integer(limit, DEFAULT_MATCH_COUNT)}
      )
      SELECT
        puuid,
        argMax(riot_id_game_name, game_start_ms),
        argMax(riot_id_tag_line, game_start_ms),
        argMax(profile_icon_id, game_start_ms),
        argMax(summoner_level, game_start_ms)
      FROM participants
      WHERE match_id IN (SELECT match_id FROM my_matches)
      GROUP BY puuid
    `)

    return rows.map((row) => ({
      puuid: asString(row[0]),
      gameName: asString(row[1]),
      tagLine: asString(row[2]),
      profileIconId: Number(row[3]) || 0,
      summonerLevel: Number(row[4]) || 0,
    }))
  }
}

export default new MatchRepository()
