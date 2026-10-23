import {
  BRACKETS,
  RANKED_SOLO,
  evidenceLevel,
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
export const REGIONS: Record<string, { label: string; platforms: string[] }> = {
  euw: { label: 'EUW', platforms: ['EUW1'] },
  eune: { label: 'EUNE', platforms: ['EUN1'] },
  na: { label: 'NA', platforms: ['NA1'] },
  kr: { label: 'KR', platforms: ['KR'] },
  br: { label: 'BR', platforms: ['BR1'] },
  lan: { label: 'LAN', platforms: ['LA1'] },
  las: { label: 'LAS', platforms: ['LA2'] },
  tr: { label: 'TR', platforms: ['TR1'] },
  jp: { label: 'JP', platforms: ['JP1'] },
  oce: { label: 'OCE', platforms: ['OC1'] },
  vn: { label: 'VN', platforms: ['VN2'] },
}

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

const regionSql = (filter: Filter) => {
  const platforms = filter.region ? REGIONS[filter.region]?.platforms : null
  return platforms ? `AND platform IN (${platforms.map((p) => `'${p}'`).join(',')})` : ''
}

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

/** The games of one champion in one role (`{champion:UInt16}`, `{position:String}`). */
const mineSql = (filter: Filter) => `
    SELECT match_id, participant_id, team_id, win FROM participant_items FINAL
    WHERE ${itemsWhere(filter)} AND champion_id = {champion:UInt16} AND team_position = {position:String}
  `

/** The lane opponent of each game: opponent, games, wins. */
export function matchupsSql(filter: Filter) {
  return `
    WITH me AS (${mineSql(filter)})
    SELECT o.champion_id, count(), sum(me.win)
    FROM me
    INNER JOIN (
      SELECT match_id, team_id, champion_id FROM participant_items FINAL
      WHERE patch = {patch:String} AND queue_id = ${RANKED_SOLO} AND team_position = {position:String}
        AND match_id IN (SELECT match_id FROM me)
    ) AS o ON o.match_id = me.match_id
    WHERE o.team_id != me.team_id
    GROUP BY o.champion_id
  `
}

/** Each teammate by role: position, champion, games, wins. */
export function teammatesSql(filter: Filter) {
  return `
    WITH me AS (${mineSql(filter)})
    SELECT t.team_position, t.champion_id, count(), sum(me.win)
    FROM me
    INNER JOIN (
      SELECT match_id, team_id, team_position, champion_id FROM participant_items FINAL
      WHERE patch = {patch:String} AND queue_id = ${RANKED_SOLO}
        AND team_position NOT IN ('', {position:String})
        AND match_id IN (SELECT match_id FROM me)
    ) AS t ON t.match_id = me.match_id
    WHERE t.team_id = me.team_id
    GROUP BY t.team_position, t.champion_id
  `
}

/**
 * The first 15 skill points of each game (1 Q, 2 W, 3 E, 4 R) from the player's skill order on
 * their participant row, joined to the game by one hash of (match, participant): order, games,
 * wins. Games stored without a timeline have no skill order and are skipped.
 */
export function skillOrderSql(filter: Filter) {
  return `
    WITH me AS (${mineSql(filter)})
    SELECT o, count(), sum(me.win) FROM (
      SELECT cityHash64(match_id, participant_id) AS k, arraySlice(skill_order, 1, 15) AS o
      FROM participants
      WHERE match_id IN (SELECT match_id FROM me) AND participant_id != 0
        AND length(skill_order) >= 15
      LIMIT 1 BY match_id, participant_id
    ) AS t
    INNER JOIN (SELECT cityHash64(match_id, participant_id) AS k, win FROM me) AS me USING (k)
    GROUP BY o
    ORDER BY count() DESC
    LIMIT 12
  `
}

/** Games by length, five-minute buckets: bucket (0 = under 5 min), games, wins. */
export function lengthSql(filter: Filter) {
  return `
    WITH me AS (${mineSql(filter)})
    SELECT intDiv(m.duration_sec, 300) AS b, count(), sum(me.win)
    FROM me
    INNER JOIN (
      SELECT match_id, duration_sec FROM matches
      WHERE queue_id = ${RANKED_SOLO} AND patch = {patch:String} AND match_id IN (SELECT match_id FROM me)
    ) AS m USING (match_id)
    GROUP BY b ORDER BY b
  `
}

/** Averages per game: games, kills, deaths, assists, CS a minute, gold, damage, vision, length. */
export function averagesSql(filter: Filter) {
  return `
    WITH me AS (${mineSql(filter)})
    SELECT count(), avg(p.kills), avg(p.deaths), avg(p.assists),
           sum(p.total_cs) / greatest(sum(m.duration_sec) / 60, 1),
           avg(p.gold_earned), avg(p.dmg_to_champ), avg(p.vision_score), avg(m.duration_sec)
    FROM (
      SELECT match_id, kills, deaths, assists, total_cs, gold_earned, dmg_to_champ, vision_score
      FROM participants
      WHERE queue_id = ${RANKED_SOLO} AND champion_id = {champion:UInt16} AND team_position = {position:String}
        AND match_id IN (SELECT match_id FROM me)
    ) AS p
    INNER JOIN (
      SELECT match_id, duration_sec FROM matches
      WHERE queue_id = ${RANKED_SOLO} AND patch = {patch:String} AND match_id IN (SELECT match_id FROM me)
    ) AS m USING (match_id)
  `
}

/**
 * One champion in one role, a day at a time from `{since:UInt64}` (any patch): day, games,
 * wins, games that day, bans that day.
 */
export function trendSql(filter: Filter) {
  const tiers = seedTiers(filter.bracket)
  const seeds = `SELECT match_id FROM match_seed WHERE game_start_ms >= {since:UInt64}
      ${tiers ? `AND seed_tier IN (${tiers})` : ''} ${regionSql(filter)}`
  const day = 'toDate(toDateTime(intDiv(game_start_ms, 1000)))'
  return `
    SELECT d, sum(g), sum(w), sum(total), sum(bans) FROM (
      SELECT ${day} AS d, count() AS g, sum(win) AS w, 0 AS total, 0 AS bans
      FROM participant_items FINAL
      WHERE queue_id = ${RANKED_SOLO} AND champion_id = {champion:UInt16} AND team_position = {position:String}
        AND game_start_ms >= {since:UInt64} AND match_id IN (${seeds})
      GROUP BY d
      UNION ALL
      SELECT ${day} AS d, 0, 0, count(), countIf(has(t1_bans, {champion:UInt16}) OR has(t2_bans, {champion:UInt16}))
      FROM matches
      WHERE queue_id = ${RANKED_SOLO} AND game_start_ms >= {since:UInt64} AND match_id IN (${seeds})
      GROUP BY d
    )
    GROUP BY d ORDER BY d
  `
}

/** Patches with crawled games, newest first: patch, games. */
export function patchesSql() {
  return `
    SELECT patch, count() FROM match_seed
    GROUP BY patch ORDER BY max(game_start_ms) DESC LIMIT 6
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
    .sort((a, b) => b.games - a.games)
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
      .sort((a, b) => b.games - a.games)
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

export function averages(row: number[] | undefined) {
  if (!row || !row[0]) return null
  const [games, kills, deaths, assists, csMin, gold, damage, vision, length] = row.map(Number)
  return {
    games,
    kills: round(kills, 1),
    deaths: round(deaths, 1),
    assists: round(assists, 1),
    kda: round((kills + assists) / Math.max(deaths, 0.1), 2),
    csPerMin: round(csMin, 1),
    gold: Math.round(gold),
    damage: Math.round(damage),
    vision: round(vision, 1),
    length: Math.round(length),
  }
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
