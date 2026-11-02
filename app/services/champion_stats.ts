import {
  BRACKETS,
  RANKED_SOLO,
  evidenceLevel,
  platformSql,
  round,
  seedTiers,
  type Bracket,
} from '#services/ranked_stats'

/**
 * Champion statistics from our own crawled ranked games (the pure half of
 * `champion_stats_service.ts`: the queries and the counting): every champion's record in every
 * role, its tier, its record at each rank, against each lane opponent and with each teammate,
 * its skill order, how it does by game length and its averages.
 *
 * Every figure reads the games of `match_seed` (the crawler's games, which all carry an item
 * order), so a champion's win rate, its build and its runes count the same games.
 */

/** Riot's positions, as `team_position` stores them. */
export const POSITIONS = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as const
export type Position = (typeof POSITIONS)[number]

/** The address of a role (`/champions/jinx/build?role=bot`) and the shared views' lane names. */
export const ROLE_OF: Record<Position, { slug: string; lane: string; label: string }> = {
  TOP: { slug: 'top', lane: 'TOP', label: 'Top' },
  JUNGLE: { slug: 'jungle', lane: 'JUNGLE', label: 'Jungle' },
  MIDDLE: { slug: 'mid', lane: 'MID', label: 'Mid' },
  BOTTOM: { slug: 'bot', lane: 'ADC', label: 'Bot' },
  UTILITY: { slug: 'support', lane: 'SUPPORT', label: 'Support' },
}

export function positionOf(slug: unknown): Position | null {
  const s = String(slug ?? '').toLowerCase()
  const found = POSITIONS.find((p) => ROLE_OF[p].slug === s || p.toLowerCase() === s)
  if (found) return found
  if (s === 'adc' || s === 'bottom') return 'BOTTOM'
  if (s === 'middle') return 'MIDDLE'
  if (s === 'utility' || s === 'sup') return 'UTILITY'
  return null
}

/** Regions a page can be narrowed to (`match_seed.platform`). */
export { REGIONS } from '#services/ranked_stats'

/** The filters every query shares: a patch, a rank bracket, maybe a region. */
export interface Filter {
  patch: string
  bracket: Bracket
  region: string | null
}

/** The rank groups of the "by rank" view, each a bracket. */
export const RANK_GROUPS = [
  'iron',
  'bronze',
  'silver',
  'gold',
  'platinum',
  'emerald',
  'diamond',
  'master_plus',
] as const satisfies readonly Bracket[]

/** A role is listed for a champion from this share of the role's games (0.4 %). */
export const MIN_PICK = 0.004
/** Fewer games than this and a champion is not ranked (its record is still shown). */
export const MIN_GAMES = 100
/** Prior strength of the role's average win rate, in games: a small sample is pulled toward it. */
const PRIOR_GAMES = 400

/** Tiers by place in the role, best first: the share of the role each one covers, cumulated. */
export const TIER_CUTS = [0.05, 0.18, 0.42, 0.7, 0.88] as const
export const TIERS = ['S+', 'S', 'A', 'B', 'C', 'D'] as const

const regionSql = (filter: Filter) => platformSql(filter.region).trimEnd()

/** The crawled games of the filter (`{patch:String}` is a parameter). */
export function seedGamesSql(filter: Filter, bracket: Bracket = filter.bracket) {
  const tiers = seedTiers(bracket)
  return `SELECT match_id FROM match_seed WHERE patch = {patch:String}
      ${tiers ? `AND seed_tier IN (${tiers})` : ''} ${regionSql(filter)}`
}

const itemsWhere = (filter: Filter) =>
  `patch = {patch:String} AND queue_id = ${RANKED_SOLO} AND match_id IN (${seedGamesSql(filter)})`

/** Every champion in every role: champion, position, games, wins. */
export function summarySql(filter: Filter) {
  return `
    SELECT champion_id, team_position, count(), sum(win)
    FROM participant_items FINAL
    WHERE ${itemsWhere(filter)} AND team_position != ''
    GROUP BY champion_id, team_position
  `
}

/** The games of the filter (`games`, 0) and how many of them banned each champion (`ban`, id). */
export function totalsSql(filter: Filter) {
  return `
    SELECT 'games', 0, uniqExact(match_id) FROM match_seed
    WHERE match_id IN (${seedGamesSql(filter)})
    UNION ALL
    SELECT 'ban', ban, count() FROM matches
    ARRAY JOIN arrayDistinct(arrayConcat(t1_bans, t2_bans)) AS ban
    WHERE queue_id = ${RANKED_SOLO} AND patch = {patch:String} AND ban != 0
      AND match_id IN (${seedGamesSql(filter)})
    GROUP BY ban
  `
}

/** Every champion in every role at every rank group: tier, champion, position, games, wins. */
export function summaryByRankSql(filter: Filter) {
  const groups = RANK_GROUPS.map((g) => {
    const tiers = BRACKETS[g]!
    return `WHEN seed_tier IN (${tiers.map((t) => `'${t}'`).join(',')}) THEN '${g}'`
  }).join(' ')
  return `
    WITH s AS (
      SELECT match_id, CASE ${groups} ELSE '' END AS grp FROM match_seed
      WHERE patch = {patch:String} ${regionSql(filter)}
      LIMIT 1 BY match_id
    )
    SELECT s.grp, p.champion_id, p.team_position, count(), sum(p.win)
    FROM (
      SELECT match_id, champion_id, team_position, win FROM participant_items FINAL
      WHERE patch = {patch:String} AND queue_id = ${RANKED_SOLO} AND team_position != ''
    ) AS p
    INNER JOIN s USING (match_id)
    WHERE s.grp != ''
    GROUP BY s.grp, p.champion_id, p.team_position
    UNION ALL
    SELECT grp, 0, '', count(), 0 FROM s WHERE grp != '' GROUP BY grp
  `
}

/** One champion in one role (`{champion:UInt16}`, `{position:String}`). */
const ONE_SQL = 'champion_id = {champion:UInt16} AND team_position = {position:String}'

/**
 * The games of one champion in one role. The filter's crawled games are only looked up among the
 * champion's own: `IN` builds its set before reading, and a champion's few thousand games make a
 * far smaller set than every crawled game of the patch.
 */
const mineSql = (filter: Filter) => `
    SELECT match_id, participant_id, team_id, win FROM participant_items FINAL
    WHERE patch = {patch:String} AND queue_id = ${RANKED_SOLO} AND ${ONE_SQL}
      AND match_id IN (${seedGamesSql(filter)}
        AND match_id IN (SELECT match_id FROM participant_items
          WHERE patch = {patch:String} AND queue_id = ${RANKED_SOLO} AND ${ONE_SQL}))
  `

/**
 * The lane opponents (`opponent`, Riot's position) and teammates (`teammate`, their position) of
 * one champion in one role, from each game's lineup (`match_lineups`, one row per game): kind,
 * position, champion, games, wins.
 */
export function laneSql(filter: Filter) {
  return `
    WITH me AS (${mineSql(filter)})
    SELECT if(o.2 = me.team_id, 'teammate', 'opponent') AS kind, o.3 AS pos, o.4 AS champion,
           count(), sum(me.win)
    FROM me
    INNER JOIN (
      SELECT match_id, groupUniqArrayArray(players) AS players FROM match_lineups
      WHERE patch = {patch:String} AND match_id IN (SELECT match_id FROM me)
      GROUP BY match_id
    ) AS l USING (match_id)
    ARRAY JOIN l.players AS o
    WHERE (o.2 != me.team_id AND o.3 = {position:String})
       OR (o.2 = me.team_id AND o.3 NOT IN ('', {position:String}))
    GROUP BY kind, pos, champion
  `
}

/**
 * Every lane pair of the filter's games at once, each game read once: position, champion,
 * opponent (the other team's player in that position), games, wins of the champion. The same
 * games and the same pairs as `laneSql` (one champion's opponents), for every champion: the
 * lineups merged as they are read (`FINAL`, one row per game), joined to each game's winner by
 * match id (both sides sorted on it, so neither is held in memory).
 */
export function lanePairsSql(filter: Filter) {
  return `
    SELECT a.3 AS pos, a.4 AS champion, b.4 AS opponent, count(),
           sum(if(a.2 = 100, m.t1_win, m.t2_win))
    FROM (
      SELECT match_id, players FROM match_lineups FINAL
      WHERE patch = {patch:String} AND match_id IN (${seedGamesSql(filter)})
    ) AS l
    INNER JOIN (
      SELECT match_id, t1_win, t2_win FROM matches
      WHERE patch = {patch:String} AND queue_id = ${RANKED_SOLO}
    ) AS m USING (match_id)
    ARRAY JOIN l.players AS a
    ARRAY JOIN arrayFilter(x -> x.3 = a.3 AND x.2 != a.2, l.players) AS b
    WHERE a.3 != ''
    GROUP BY pos, champion, opponent
    SETTINGS join_algorithm = 'full_sorting_merge', max_threads = 2
  `
}

/* ── Pre-counted cells (migration 0013, `stats_cells.ts`) ──────── */

/**
 * The seed tier and platform cells of a filter in the pre-counted tables: a bracket is a set of
 * seed tiers, a region a set of platforms.
 */
const cellsSql = (filter: Filter) => {
  const tiers = seedTiers(filter.bracket)
  return `${tiers ? `AND seed_tier IN (${tiers})` : ''} ${regionSql(filter)}`
}

/** The crawled games of a patch with their cell (`{patch:String}`), one row per game. */
const seedCellsSql = (platform = false) => `
    SELECT match_id, seed_tier, platform FROM match_seed FINAL
    WHERE patch = {patch:String} ${platform ? 'AND platform = {platform:String}' : ''}`

/**
 * Every lane pair of one platform's crawled games of a patch (`{patch:String}`,
 * `{platform:String}`, `{prefix:String}`: the platform and `_`), counted per cell: the rows of
 * `stats_lane_pairs`. The pairs of `lanePairsSql`; a platform at a time keeps each pass small
 * (every table is read by the game ids, which start with the platform).
 */
export function lanePairCellsSql() {
  return `
    SELECT {patch:String}, s.seed_tier, s.platform, a.3, a.4, b.4, toUInt32(count()),
           toUInt32(sum(if(a.2 = 100, m.t1_win, m.t2_win)))
    FROM (
      SELECT match_id, players FROM match_lineups FINAL
      WHERE patch = {patch:String} AND startsWith(match_id, {prefix:String})
    ) AS l
    INNER JOIN (${seedCellsSql(true)}) AS s USING (match_id)
    INNER JOIN (
      SELECT match_id, t1_win, t2_win FROM matches
      WHERE patch = {patch:String} AND queue_id = ${RANKED_SOLO}
        AND startsWith(match_id, {prefix:String})
    ) AS m USING (match_id)
    ARRAY JOIN l.players AS a
    ARRAY JOIN arrayFilter(x -> x.3 = a.3 AND x.2 != a.2, l.players) AS b
    WHERE a.3 != ''
    GROUP BY s.seed_tier, s.platform, a.3, a.4, b.4
  `
}

/** Every champion in every role of a patch's crawled games, per cell: the rows of `stats_champion_roles` (`summarySql`'s counts). */
export function roleCellsSql() {
  return `
    SELECT {patch:String}, s.seed_tier, s.platform, p.team_position, p.champion_id,
           toUInt32(count()), toUInt32(sum(p.win))
    FROM (
      SELECT match_id, champion_id, team_position, win FROM participant_items FINAL
      WHERE patch = {patch:String} AND queue_id = ${RANKED_SOLO} AND team_position != ''
    ) AS p
    INNER JOIN (${seedCellsSql()}) AS s USING (match_id)
    GROUP BY s.seed_tier, s.platform, p.team_position, p.champion_id
  `
}

/**
 * A patch's crawled games per cell (`champion` 0) and the games each champion was banned in
 * (a game counts once per champion, whichever team banned it): the rows of `stats_cell_counts`
 * (`totalsSql`'s counts), stamped with the time of the count.
 */
export function cellCountsSql() {
  return `
    SELECT {patch:String}, seed_tier, platform, toUInt16(0), toUInt32(count()), now()
    FROM (${seedCellsSql()})
    GROUP BY seed_tier, platform
    UNION ALL
    SELECT {patch:String}, s.seed_tier, s.platform, ban, toUInt32(count()), now()
    FROM (
      SELECT match_id, arrayDistinct(arrayConcat(t1_bans, t2_bans)) AS bans FROM matches
      WHERE queue_id = ${RANKED_SOLO} AND patch = {patch:String}
    ) AS m
    INNER JOIN (${seedCellsSql()}) AS s USING (match_id)
    ARRAY JOIN m.bans AS ban
    WHERE ban != 0
    GROUP BY s.seed_tier, s.platform, ban
  `
}

/** `summarySql` from the counted cells: champion, position, games, wins. */
export function summaryCellsSql(filter: Filter) {
  return `
    SELECT champion, position, sum(games), sum(wins) FROM stats_champion_roles
    WHERE patch = {patch:String} ${cellsSql(filter)}
    GROUP BY champion, position
  `
}

/** `totalsSql` from the counted cells: `games`, 0, games; `ban`, champion, games banned in. */
export function totalsCellsSql(filter: Filter) {
  return `
    SELECT if(champion = 0, 'games', 'ban'), champion, sum(games) FROM stats_cell_counts
    WHERE patch = {patch:String} ${cellsSql(filter)}
    GROUP BY champion
  `
}

/** One champion's lane opponents from the counted cells (`{champion:UInt16}`, `{position:String}`): opponent, games, wins. */
export function laneOpponentsSql(filter: Filter) {
  return `
    SELECT opponent, sum(games), sum(wins) FROM stats_lane_pairs
    WHERE patch = {patch:String} AND position = {position:String} AND champion = {champion:UInt16}
      ${cellsSql(filter)}
    GROUP BY opponent
  `
}

/** The patches counted into the cells, with when each was last counted (seconds). */
export function countedPatchesSql() {
  return `SELECT patch, toUnixTimestamp(max(refreshed)) FROM stats_cell_counts GROUP BY patch`
}

/**
 * The first 15 skill points of each game (1 Q, 2 W, 3 E, 4 R) from the player's skill order on
 * their participant row, joined to the game by one hash of (match, participant): order, games,
 * wins. Games stored without a timeline have no skill order and are skipped. The champion, role
 * and patch start let the `by_champion` projection of `participants` read that champion's games.
 */
export function skillOrderSql(filter: Filter) {
  return `
    WITH me AS (${mineSql(filter)})
    SELECT o, count(), sum(me.win) FROM (
      SELECT cityHash64(match_id, participant_id) AS k, arraySlice(skill_order, 1, 15) AS o
      FROM participants
      WHERE queue_id = ${RANKED_SOLO} AND champion_id = {champion:UInt16}
        AND team_position = {position:String} AND game_start_ms >= {patchStart:UInt64}
        AND match_id IN (SELECT match_id FROM me) AND participant_id != 0
        AND length(skill_order) >= 15
      LIMIT 1 BY match_id, participant_id
    ) AS t
    INNER JOIN (SELECT cityHash64(match_id, participant_id) AS k, win FROM me) AS me USING (k)
    GROUP BY o
    ORDER BY count() DESC, o
    LIMIT 12
  `
}

/** A team's epic monsters and towers in `matches`, in the order `profileSql` sums them. */
const OBJECTIVES = ['dragons', 'heralds', 'barons', 'towers'] as const

/**
 * The Statistics tab in one query: games by length (five-minute buckets, 0 = under 5 min) and the
 * sums the averages are made of. A bucket row: bucket, games, wins, then over the games that have
 * the player's participant row (one per game): those games, kills, deaths, assists, CS, gold,
 * damage, vision, seconds played; then over every game, the dragons, heralds, barons and towers
 * the champion's team took, and the same for the other team.
 */
export function profileSql(filter: Filter) {
  const side = (mine: boolean) =>
    OBJECTIVES.map(
      (o) => `sum(if(me.team_id = 100, m.${mine ? 't1' : 't2'}_${o}, m.${mine ? 't2' : 't1'}_${o}))`
    ).join(', ')
  // Each source read once (a CTE named twice is run twice): the patch's games on the left, the
  // champion's few thousand on the right, where ClickHouse builds its hash tables.
  return `
    SELECT intDiv(m.duration_sec, 300) AS b, count(), sum(me.win),
           countIf(p.found = 1), sum(p.kills), sum(p.deaths), sum(p.assists), sum(p.total_cs),
           sum(p.gold_earned), sum(p.dmg_to_champ), sum(p.vision_score),
           sumIf(m.duration_sec, p.found = 1),
           ${side(true)},
           ${side(false)}
    FROM (
      SELECT match_id, duration_sec, ${OBJECTIVES.map((o) => `t1_${o}, t2_${o}`).join(', ')}
      FROM matches WHERE queue_id = ${RANKED_SOLO} AND patch = {patch:String}
    ) AS m
    INNER JOIN (${mineSql(filter)}) AS me USING (match_id)
    LEFT JOIN (
      SELECT match_id, 1 AS found, kills, deaths, assists, total_cs, gold_earned, dmg_to_champ, vision_score
      FROM participants
      WHERE queue_id = ${RANKED_SOLO} AND champion_id = {champion:UInt16} AND team_position = {position:String}
        AND game_start_ms >= {patchStart:UInt64}
      LIMIT 1 BY match_id
    ) AS p USING (match_id)
    GROUP BY b ORDER BY b
  `
}

/**
 * What a champion's participant rows hold beyond `profileSql`'s averages, in one row: games,
 * then the sums of damage taken, damage to turrets, damage to objectives, wards placed, wards
 * cleared, control wards bought, level at the end, damage to champions (physical, magic, true)
 * and jungle monsters killed.
 *
 * These columns are not in the `by_champion` projection, so the rows are found by game: the
 * champion's games of the filter (its ids from the projection, then the crawled games among
 * them, as `mineSql` does) and its participant rows of those games (the `by_match` projection).
 */
export function detailSql(filter: Filter) {
  const own = `queue_id = ${RANKED_SOLO} AND ${ONE_SQL} AND game_start_ms >= {patchStart:UInt64}`
  return `
    SELECT count(), sum(dmg_taken), sum(dmg_to_turrets), sum(dmg_to_objectives), sum(wards_placed),
           sum(wards_killed), sum(vision_wards_bought), sum(champ_level),
           sum(physical_dmg_to_champ), sum(magic_dmg_to_champ), sum(true_dmg_to_champ),
           sum(neutral_minions_killed)
    FROM (
      SELECT match_id, dmg_taken, dmg_to_turrets, dmg_to_objectives, wards_placed, wards_killed,
             vision_wards_bought, champ_level, physical_dmg_to_champ, magic_dmg_to_champ,
             true_dmg_to_champ, neutral_minions_killed
      FROM participants
      WHERE ${own}
        AND match_id IN (${seedGamesSql(filter)}
          AND match_id IN (SELECT match_id FROM participants WHERE ${own}))
      LIMIT 1 BY match_id
    )
  `
}

/** The minutes of the early game: the timeline frames read at 10:00 and 15:00. */
export const EARLY_MINUTES = [10, 15] as const

/**
 * The champion against its lane opponent at 10 and 15 minutes, from the games with a timeline:
 * minute, games, the champion's CS (lane and jungle), gold and experience summed, the same three
 * as gaps to the opponent (signed), then the games it led in gold with their wins and the games
 * it trailed with theirs. The opponent is the other team's player in the role (`match_lineups`);
 * a game missing either frame is left out.
 */
export function earlySql(filter: Filter) {
  return `
    WITH me AS (${mineSql(filter)})
    SELECT minute, count(), sum(a.2), sum(a.3), sum(a.4),
           sum(toInt64(a.2) - toInt64(b.2)), sum(toInt64(a.3) - toInt64(b.3)),
           sum(toInt64(a.4) - toInt64(b.4)),
           countIf(a.3 > b.3), sumIf(win, a.3 > b.3), countIf(a.3 < b.3), sumIf(win, a.3 < b.3)
    FROM (
      SELECT f.minute AS minute, p.win AS win,
             arrayFirst(x -> x.1 = p.mine, f.players) AS a,
             arrayFirst(x -> x.1 = p.theirs, f.players) AS b
      FROM (
        SELECT match_id, minute,
               groupArray((participant_id, toUInt32(cs + jungle_cs), gold_total, xp)) AS players
        FROM (
          SELECT match_id, participant_id, intDiv(frame_ms, 60000) AS minute, cs, jungle_cs,
                 gold_total, xp
          FROM match_timeline
          WHERE match_id IN (SELECT match_id FROM me)
            AND intDiv(frame_ms, 60000) IN (${EARLY_MINUTES.join(', ')})
          LIMIT 1 BY match_id, participant_id, minute
        )
        GROUP BY match_id, minute
      ) AS f
      INNER JOIN (
        SELECT me.match_id AS match_id, me.participant_id AS mine, me.win AS win, o.1 AS theirs
        FROM me
        INNER JOIN (
          SELECT match_id, groupUniqArrayArray(players) AS players FROM match_lineups
          WHERE patch = {patch:String} AND match_id IN (SELECT match_id FROM me)
          GROUP BY match_id
        ) AS l USING (match_id)
        ARRAY JOIN l.players AS o
        WHERE o.2 != me.team_id AND o.3 = {position:String}
      ) AS p USING (match_id)
    )
    WHERE a.1 != 0 AND b.1 != 0
    GROUP BY minute ORDER BY minute
  `
}

/**
 * First blood in the champion's games with kill events (`match_events`): games, games it took
 * first blood, games it assisted it, games it died first, and the wins of the games it was part
 * of (killer or assist).
 */
export function firstBloodSql(filter: Filter) {
  return `
    WITH me AS (${mineSql(filter)})
    SELECT count(), countIf(fb.killer = me.participant_id),
           countIf(has(fb.assists, me.participant_id)), countIf(fb.victim = me.participant_id),
           sumIf(me.win, fb.killer = me.participant_id OR has(fb.assists, me.participant_id))
    FROM me
    INNER JOIN (
      SELECT match_id, argMin(killer, t_ms) AS killer, argMin(victim, t_ms) AS victim,
             argMin(assists, t_ms) AS assists
      FROM (
        SELECT DISTINCT match_id, t_ms, killer, victim, assists FROM match_events
        WHERE match_id IN (SELECT match_id FROM me) AND kind = 'kill'
      )
      GROUP BY match_id
    ) AS fb USING (match_id)
  `
}

/** The crawled games of the trend's days (`{since:UInt64}` to `{until:UInt64}`), any patch. */
const trendSeedsSql = (filter: Filter) => {
  const tiers = seedTiers(filter.bracket)
  return `SELECT match_id FROM match_seed
      WHERE game_start_ms >= {since:UInt64} AND game_start_ms < {until:UInt64}
      ${tiers ? `AND seed_tier IN (${tiers})` : ''} ${regionSql(filter)}`
}

const DAY_SQL = 'toDate(toDateTime(intDiv(game_start_ms, 1000)))'

/**
 * Every champion's side of the trend, a day at a time from `{since:UInt64}` to `{until:UInt64}`:
 * day, games that day, and the champions banned that day with their counts (a game counts once
 * per champion, whichever team banned it). The same for every champion, so it is asked once.
 */
export function trendDaysSql(filter: Filter) {
  return `
    SELECT toString(d), count(), sumMap(b, arrayMap(x -> toUInt32(1), b))
    FROM (
      SELECT ${DAY_SQL} AS d, arrayDistinct(arrayConcat(t1_bans, t2_bans)) AS b FROM matches
      WHERE queue_id = ${RANKED_SOLO} AND game_start_ms >= {since:UInt64} AND game_start_ms < {until:UInt64}
        AND match_id IN (${trendSeedsSql(filter)})
    )
    GROUP BY d ORDER BY d
  `
}

/**
 * One champion in one role, a day at a time from `{since:UInt64}` to `{until:UInt64}` (any
 * patch): day, games, wins. The month's crawled games are on the left of the join and the
 * champion's few thousand on the right, where ClickHouse builds its hash table.
 */
export function trendGamesSql(filter: Filter) {
  return `
    SELECT toString(${DAY_SQL}) AS d, count(), sum(win)
    FROM (${trendSeedsSql(filter)}) AS s
    INNER JOIN (
      SELECT match_id, game_start_ms, win FROM participant_items FINAL
      WHERE queue_id = ${RANKED_SOLO} AND champion_id = {champion:UInt16} AND team_position = {position:String}
        AND game_start_ms >= {since:UInt64} AND game_start_ms < {until:UInt64}
    ) AS mine USING (match_id)
    GROUP BY d ORDER BY d
  `
}

/* ── Counting ─────────────────────────────────────────────────── */

/** One champion in one role. */
export interface RoleStat {
  champion: number
  position: Position
  games: number
  win: number
  /** Share of the filter's games it was picked in, in this role. */
  pick: number
  /** Share of the filter's games it was banned in (whatever the role). */
  ban: number
  /** Share of the champion's own games played in this role. */
  roleShare: number
  /** 0 S+ … 5 D; null when not ranked (too few games). */
  tier: number | null
  /** Place in the role, from 1; null when not ranked. */
  rank: number | null
  level: number
}

export interface Summary {
  patch: string
  bracket: Bracket
  region: string | null
  games: number
  /** Every champion in every role it was picked in (MIN_PICK of the role or more). */
  roles: RoleStat[]
  /** Champions ranked in each role. */
  ranked: Record<Position, number>
}

/** Rows of `summarySql` and `totalsSql` into every role's ranked list. */
export function summarize(
  filter: Filter,
  rows: [number, string, number, number][],
  totals: [string, number, number][]
): Summary {
  const games = totals.find((t) => t[0] === 'games')?.[2] ?? 0
  const bans = new Map(totals.filter((t) => t[0] === 'ban').map((t) => [t[1], t[2]]))
  const perChampion = new Map<number, number>()
  for (const [c, , g] of rows) perChampion.set(c, (perChampion.get(c) ?? 0) + g)

  const roles: RoleStat[] = []
  const ranked = {} as Record<Position, number>
  for (const position of POSITIONS) {
    const list = rows.filter((r) => r[1] === position)
    const roleGames = list.reduce((n, r) => n + r[2], 0)
    const roleWins = list.reduce((n, r) => n + r[3], 0)
    const mean = roleGames ? roleWins / roleGames : 0.5
    const stats = list
      .map(([champion, , g, w]): RoleStat & { score: number } => {
        const pick = games ? g / games : 0
        const ban = games ? (bans.get(champion) ?? 0) / games : 0
        // A small sample is pulled toward the role's average before it is compared.
        const adjusted = (w + PRIOR_GAMES * mean) / (g + PRIOR_GAMES)
        const score =
          (adjusted - mean) * 100 * 2 + Math.sqrt(pick * 100) * 0.9 + Math.sqrt(ban * 100) * 0.35
        return {
          champion,
          position,
          games: g,
          win: round(w / g),
          pick: round(pick),
          ban: round(ban),
          roleShare: round(g / (perChampion.get(champion) ?? g)),
          tier: null,
          rank: null,
          level: evidenceLevel(g, w),
          score,
        }
      })
      .filter((s) => s.pick >= MIN_PICK)
    const rankable = stats.filter((s) => s.games >= MIN_GAMES).sort((a, b) => b.score - a.score)
    rankable.forEach((s, i) => {
      s.rank = i + 1
      s.tier = tierOf(i, rankable.length)
    })
    ranked[position] = rankable.length
    for (const { score, ...s } of stats) {
      void score
      roles.push(s)
    }
  }
  return {
    patch: filter.patch,
    bracket: filter.bracket,
    region: filter.region,
    games,
    roles,
    ranked,
  }
}

/** The tier of the champion at `index` (0 = best) among `count`. */
export function tierOf(index: number, count: number) {
  const place = (index + 0.5) / count
  const cut = TIER_CUTS.findIndex((c) => place < c)
  return cut === -1 ? TIER_CUTS.length : cut
}

/** One champion's record at each rank group, with its tier among that group's champions. */
export function byRank(
  rows: [string, number, string, number, number][],
  champion: number,
  position: Position
) {
  return RANK_GROUPS.map((group) => {
    const inGroup = rows.filter((r) => r[0] === group)
    const games = inGroup.find((r) => r[1] === 0 && r[2] === '')?.[3] ?? 0
    const filter = { patch: '', bracket: group, region: null }
    const summary = summarize(
      filter,
      inGroup.filter((r) => r[1] !== 0).map((r) => [r[1], r[2], r[3], r[4]]),
      [['games', 0, games]]
    )
    const stat = summary.roles.find((s) => s.champion === champion && s.position === position)
    return {
      group,
      games: stat?.games ?? 0,
      win: stat?.win ?? null,
      pick: stat?.pick ?? 0,
      tier: stat?.tier ?? null,
    }
  })
}

const sumGames = (rows: { games: number }[]) => rows.reduce((n, r) => n + r.games, 0)

/** Lane opponents, most played first, each with its evidence level. */
export function matchups(rows: [number, number, number][]) {
  return rows
    .map(([champion, games, wins]) => ({
      champion,
      games,
      win: round(wins / games),
      level: evidenceLevel(games, wins),
    }))
    .sort((a, b) => b.games - a.games || a.champion - b.champion)
}

/**
 * `lanePairsSql`'s rows by `position:champion`, each a flat list of opponent, games, wins (a
 * patch holds ~100k pairs: flat lists keep the cached answer small).
 */
export function lanePairs(rows: [string, number, number, number, number][]) {
  const out: Record<string, number[]> = {}
  for (const [pos, champion, opponent, games, wins] of rows) {
    ;(out[`${pos}:${champion}`] ??= []).push(opponent, games, wins)
  }
  return out
}

/** One champion's opponents from `lanePairs`: champion, games, wins. */
export function opponentsOf(pairs: Record<string, number[]>, champion: number, position: Position) {
  const flat = pairs[`${position}:${champion}`] ?? []
  const out: [number, number, number][] = []
  for (let i = 0; i + 2 < flat.length; i += 3) out.push([flat[i], flat[i + 1], flat[i + 2]])
  return out
}

/** Teammates per role, the ones with enough games, most played first. */
export function teammates(rows: [string, number, number, number][]) {
  const out = {} as Record<
    string,
    { champion: number; games: number; win: number; level: number }[]
  >
  for (const position of POSITIONS) {
    const list = rows.filter((r) => r[0] === position)
    const total = sumGames(list.map((r) => ({ games: r[2] })))
    out[position] = list
      .filter((r) => r[2] >= Math.max(30, total * 0.01))
      .map(([, champion, games, wins]) => ({
        champion,
        games,
        win: round(wins / games),
        level: evidenceLevel(games, wins),
      }))
      .sort((a, b) => b.games - a.games || a.champion - b.champion)
  }
  return out
}

const KEYS = ['', 'Q', 'W', 'E', 'R'] as const

/**
 * Skill orders, most played first, as letters; and the order skills are maxed in, from the
 * most played one: the first of Q, W, E to reach five points comes first.
 */
export function skillOrders(rows: [number[], number, number][]) {
  const total = rows.reduce((n, r) => n + r[1], 0)
  const orders = rows.map(([order, games, wins]) => ({
    order: order.map((slot) => KEYS[slot] ?? '?'),
    games,
    win: round(wins / games),
    share: total ? round(games / total) : 0,
    level: evidenceLevel(games, wins),
  }))
  const top = orders[0]?.order ?? []
  const done: string[] = []
  const counts: Record<string, number> = { Q: 0, W: 0, E: 0 }
  for (const k of top) {
    if (!(k in counts)) continue
    counts[k]++
    if (counts[k] === 5 && !done.includes(k)) done.push(k)
  }
  for (const k of ['Q', 'W', 'E']) if (!done.includes(k)) done.push(k)
  return { games: total, orders: orders.slice(0, 3), max: done }
}

/** Win rate by game length from the 5-minute buckets, the ones with enough games. */
export function byLength(rows: [number, number, number][]) {
  return rows
    .filter(([b, games]) => b >= 3 && games >= 30)
    .map(([b, games, wins]) => ({ minutes: b * 5, games, win: round(wins / games) }))
}

/** The averages of `profileSql`'s bucket rows (null without a game). */
export function averages(rows: number[][]) {
  const sum = (i: number) => rows.reduce((total, row) => total + Number(row[i] ?? 0), 0)
  const games = sum(3)
  if (!games) return null
  const [kills, deaths, assists, cs, gold, damage, vision, seconds] = [
    4, 5, 6, 7, 8, 9, 10, 11,
  ].map(sum)
  const per = (total: number) => total / games
  return {
    games,
    kills: round(per(kills), 1),
    deaths: round(per(deaths), 1),
    assists: round(per(assists), 1),
    kda: round((per(kills) + per(assists)) / Math.max(per(deaths), 0.1), 2),
    csPerMin: round(cs / Math.max(seconds / 60, 1), 1),
    gold: Math.round(per(gold)),
    damage: Math.round(per(damage)),
    vision: round(per(vision), 1),
    length: Math.round(per(seconds)),
  }
}

/** A team's dragons, heralds, barons and towers per game. */
export interface TeamObjectives {
  dragons: number
  heralds: number
  barons: number
  towers: number
}

/**
 * What the champion's team took per game, and the other team, from `profileSql`'s bucket rows;
 * null without a game, or when no game has any objective stored.
 */
export function objectives(rows: number[][]) {
  const sum = (i: number) => rows.reduce((total, row) => total + Number(row[i] ?? 0), 0)
  const games = sum(1)
  const team = (from: number) =>
    Object.fromEntries(
      OBJECTIVES.map((o, i) => [o, games ? round(sum(from + i) / games, 2) : 0])
    ) as unknown as TeamObjectives
  const own = team(12)
  const enemy = team(12 + OBJECTIVES.length)
  const any = OBJECTIVES.some((o) => own[o] > 0 || enemy[o] > 0)
  return games && any ? { games, ...own, enemy } : null
}

/** A sample this small says little: a block counted on fewer games is left out. */
const MIN_SAMPLE = 30

/** `detailSql`'s row as averages per game and the split of damage to champions; null without games. */
export function details(row: number[]) {
  const [
    games,
    taken,
    turrets,
    objective,
    placed,
    cleared,
    control,
    level,
    physical,
    magic,
    pure,
    jungle,
  ] = Array.from({ length: 12 }, (_, i) => Number(row[i] ?? 0))
  if (games < MIN_SAMPLE) return null
  const per = (total: number, digits = 1) => round(total / games, digits)
  const damage = physical + magic + pure
  const share = (part: number) => (damage ? round(part / damage, 3) : 0)
  return {
    games,
    damageTaken: Math.round(taken / games),
    damageToTurrets: Math.round(turrets / games),
    damageToObjectives: Math.round(objective / games),
    wardsPlaced: per(placed),
    wardsCleared: per(cleared),
    controlWards: per(control),
    level: per(level),
    jungleMonsters: per(jungle),
    damageSplit: { physical: share(physical), magic: share(magic), true: share(pure) },
  }
}

/** One minute of `earlySql`. */
export interface EarlyMinute {
  minute: number
  games: number
  cs: number
  gold: number
  xp: number
  /** The gaps to the lane opponent, per game (positive: ahead). */
  csDiff: number
  goldDiff: number
  xpDiff: number
  /** Share of the games it led in gold. */
  ahead: number
  /** Win rate in the games it led, and in the games it trailed (null without such games). */
  aheadWin: number | null
  behindWin: number | null
}

/** `earlySql`'s rows as averages per game, the minutes with enough games; null without one. */
export function early(rows: number[][]): EarlyMinute[] | null {
  const minutes = rows
    .filter(([minute, games]) => EARLY_MINUTES.includes(minute as 10 | 15) && games >= MIN_SAMPLE)
    .map(
      ([
        minute,
        games,
        cs,
        gold,
        xp,
        csDiff,
        goldDiff,
        xpDiff,
        ahead,
        aheadWins,
        behind,
        behindWins,
      ]) => ({
        minute,
        games,
        cs: round(cs / games, 1),
        gold: Math.round(gold / games),
        xp: Math.round(xp / games),
        csDiff: round(csDiff / games, 1),
        goldDiff: Math.round(goldDiff / games),
        xpDiff: Math.round(xpDiff / games),
        ahead: round(ahead / games),
        aheadWin: ahead ? round(aheadWins / ahead) : null,
        behindWin: behind ? round(behindWins / behind) : null,
      })
    )
  return minutes.length ? minutes : null
}

/** `firstBloodSql`'s row as shares of the games; null with too few games. */
export function firstBlood(row: number[]) {
  const [games, kills, assists, deaths, involvedWins] = Array.from({ length: 5 }, (_, i) =>
    Number(row[i] ?? 0)
  )
  if (games < MIN_SAMPLE) return null
  const involved = kills + assists
  return {
    games,
    kill: round(kills / games),
    assist: round(assists / games),
    victim: round(deaths / games),
    /** Win rate in the games it took part in first blood. */
    involvedWin: involved ? round(involvedWins / involved) : null,
  }
}

/**
 * One champion's trend days from every champion's (`trendDaysSql`: day, games, [champions, bans])
 * and its own (`trendGamesSql`: day, games, wins): day, games, wins, games that day, bans.
 */
export function trendRows(
  days: [string, number, [number[], number[]]][],
  mine: [string, number, number][],
  champion: number
): [string, number, number, number, number][] {
  const own = new Map(mine.map(([day, games, wins]) => [day, [games, wins]]))
  return days.map(([day, total, [ids, bans]]) => {
    const at = ids.indexOf(champion)
    const [games, wins] = own.get(day) ?? [0, 0]
    return [day, games, wins, total, at >= 0 ? bans[at] : 0]
  })
}

/** Day rows into rates, the days with enough games of the filter. */
export function trend(rows: [string, number, number, number, number][]) {
  return rows
    .filter(([, , , total]) => total >= 200)
    .map(([day, games, wins, total, bans]) => ({
      day,
      games,
      win: games ? round(wins / games) : null,
      pick: round(games / total),
      ban: round(bans / total),
    }))
}
