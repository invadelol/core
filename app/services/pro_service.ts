import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import buildStatsService from '#services/build_stats_service'
import { AnswerCache, RANKED_SOLO } from '#services/ranked_stats'
import { latestPatch, rows } from '#services/ranked_games_service'

/**
 * Professional players, their teams and their accounts (`pro_*` tables), and what their games
 * say: the "Pro" tag of a profile, the search's pros and teams, the pro and team pages, and the
 * pro games of a champion. Games are found by PUUID: the ones our keys resolved for each account
 * (`pro_account_puuid`, `pro_puuids` in ClickHouse) and the site's own players with the same
 * Riot ID.
 */

/** Best first, for sorting accounts and players. */
const TIER_ORDER = [
  'CHALLENGER',
  'GRANDMASTER',
  'MASTER',
  'DIAMOND',
  'EMERALD',
  'PLATINUM',
  'GOLD',
  'SILVER',
  'BRONZE',
  'IRON',
]
const TIER_SQL = `array_position(ARRAY[${TIER_ORDER.map((t) => `'${t}'`).join(',')}]::text[], a.tier)`

/** The platforms pro accounts are on. */
export const PRO_PLATFORMS = ['EUW1', 'NA1', 'BR1']
/** How far back a pro's games are read. */
const GAMES_DAYS = 30
const CHAMPION_GAMES_DAYS = 14
const STAFF = new Set(['COACH', 'MANAGER', 'ANALYST', 'STAFF', 'OWNER', 'CEO'])

export interface TeamRef {
  id: string
  slug: string
  name: string
  shortName: string | null
  region: string | null
}

export interface ProTag {
  slug: string
  name: string
  role: string | null
  country: string | null
  staff: boolean
  team: TeamRef | null
}

export interface ProAccount {
  id: string
  platform: string
  gameName: string
  tagLine: string
  tier: string | null
  division: number | null
  lp: number | null
  wins: number | null
  losses: number | null
  peakTier: string | null
  peakDivision: number | null
  peakLp: number | null
}

export interface ProGame {
  matchId: string
  account: string
  platform: string
  startMs: number
  champion: number
  position: string
  win: boolean
  kills: number
  deaths: number
  assists: number
  cs: number
  items: number[]
  spells: [number, number]
  keystone: number
  secondaryStyle: number
  durationSec: number
  opponent: number | null
  /** Set on a champion's pro games: who played it. */
  pro?: ProTag
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

const teamOf = (r: Record<string, any>): TeamRef | null =>
  r.team_id
    ? {
        id: r.team_id,
        slug: r.team_slug,
        name: r.team_name,
        shortName: r.team_short ?? null,
        region: r.team_region ?? null,
      }
    : null

const tagOf = (r: Record<string, any>): ProTag => ({
  slug: r.slug,
  name: r.name,
  role: r.role ?? null,
  country: r.country ?? null,
  staff: STAFF.has(String(r.role ?? '').toUpperCase()),
  team: teamOf(r),
})

/** A player's current team (an active one first, the newest). */
const CURRENT_TEAM = `
  LEFT JOIN LATERAL (
    SELECT t.id AS team_id, t.slug AS team_slug, t.name AS team_name, t.short_name AS team_short,
           t.region AS team_region
    FROM pro_team_member m JOIN pro_team t ON t.id = m.team_id
    WHERE m.player_id = p.id AND m.current
    ORDER BY t.active DESC, m.joined_at DESC NULLS LAST
    LIMIT 1
  ) ct ON true`

/** A player's best ranked account now. */
const BEST_ACCOUNT = `
  LEFT JOIN LATERAL (
    SELECT a.tier AS best_tier, a.division AS best_division, a.lp AS best_lp
    FROM pro_account a WHERE a.player_id = p.id AND a.tier IS NOT NULL
    ORDER BY ${TIER_SQL} NULLS LAST, a.division NULLS LAST, a.lp DESC NULLS LAST
    LIMIT 1
  ) ba ON true`

const accountOf = (r: Record<string, any>): ProAccount => ({
  id: r.id,
  platform: r.platform,
  gameName: r.game_name,
  tagLine: r.tag_line,
  tier: r.tier ?? null,
  division: r.division ?? null,
  lp: r.lp ?? null,
  wins: r.wins ?? null,
  losses: r.losses ?? null,
  peakTier: r.peak_tier ?? null,
  peakDivision: r.peak_division ?? null,
  peakLp: r.peak_lp ?? null,
})

const bestOf = (r: Record<string, any>) =>
  r.best_tier ? { tier: r.best_tier, division: r.best_division, lp: r.best_lp } : null

export class ProService {
  #tags = new AnswerCache(4096)
  #pages = new AnswerCache(512)
  #games = new AnswerCache(512)

  /** The pro behind a Riot ID, or null. Never throws: a profile renders without its tag. */
  async byRiotId(gameName: string, tagLine: string): Promise<ProTag | null> {
    const key = `${gameName}#${tagLine}`.toLowerCase()
    return this.#tags
      .get(key, async () => {
        const { rows: found } = await db.rawQuery(
          `SELECT p.slug, p.name, p.role, p.country, ct.*
           FROM pro_account a JOIN pro_player p ON p.id = a.player_id ${CURRENT_TEAM}
           WHERE a.game_name = ?::citext AND a.tag_line = ?::citext
           LIMIT 1`,
          [gameName, tagLine]
        )
        return found[0] ? tagOf(found[0]) : null
      })
      .catch((error) => {
        logger.warn({ err: error }, 'pro tag lookup failed')
        return null
      })
  }

  /** Pros and teams whose name starts with `q` (a team's short name matches whole). */
  async search(q: string, limit = 5) {
    const term = q.trim()
    if (term.length < 2) return { pros: [], teams: [] }
    const like = `${escapeLike(term.toLowerCase())}%`
    const [pros, teams] = await Promise.all([
      db.rawQuery(
        `SELECT p.id, p.slug, p.name, p.role, p.country, ct.*, ba.*
         FROM pro_player p ${CURRENT_TEAM} ${BEST_ACCOUNT}
         WHERE lower(p.name) LIKE ? ESCAPE '\\'
         ORDER BY (lower(p.name) = lower(?)) DESC, (ct.team_id IS NOT NULL) DESC,
                  array_position(ARRAY[${TIER_ORDER.map((t) => `'${t}'`).join(',')}]::text[], ba.best_tier) NULLS LAST,
                  ba.best_lp DESC NULLS LAST, length(p.name)
         LIMIT ?`,
        [like, term, limit]
      ),
      db.rawQuery(
        `SELECT t.id, t.slug, t.name, t.short_name, t.region, t.active,
                (SELECT count(*)::int FROM pro_team_member m WHERE m.team_id = t.id AND m.current) AS members
         FROM pro_team t
         WHERE lower(t.name) LIKE ? ESCAPE '\\' OR lower(t.short_name) = lower(?)
         ORDER BY (lower(t.short_name) = lower(?) OR lower(t.name) = lower(?)) DESC, t.active DESC,
                  members DESC, length(t.name)
         LIMIT ?`,
        [like, term, term, term, Math.min(limit, 4)]
      ),
    ])
    return {
      pros: pros.rows.map((r: Record<string, any>) => ({ ...tagOf(r), best: bestOf(r) })),
      teams: teams.rows.map((r: Record<string, any>) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        shortName: r.short_name,
        region: r.region,
        active: r.active,
        members: r.members,
      })),
    }
  }

  /** A pro's page: who, their accounts, their teams, and their games of the last 30 days. */
  async player(slug: string) {
    return this.#pages.get(`player:${slug}`, async () => {
      const { rows: found } = await db.rawQuery(
        `SELECT p.id, p.slug, p.name, p.role, p.country, p.socials, ct.*
         FROM pro_player p ${CURRENT_TEAM} WHERE p.slug = ? LIMIT 1`,
        [slug]
      )
      const row = found[0]
      if (!row) return null
      const [accounts, history] = await Promise.all([
        db.rawQuery(
          `SELECT a.* FROM pro_account a WHERE a.player_id = ?
           ORDER BY ${TIER_SQL} NULLS LAST, a.division NULLS LAST, a.lp DESC NULLS LAST, a.game_name`,
          [row.id]
        ),
        db.rawQuery(
          `SELECT t.id AS team_id, t.slug AS team_slug, t.name AS team_name, t.short_name AS team_short,
                  t.region AS team_region, m.title, m.role, m.current, m.joined_at, m.left_at
           FROM pro_team_member m JOIN pro_team t ON t.id = m.team_id
           WHERE m.player_id = ?
           ORDER BY m.current DESC, m.joined_at DESC NULLS LAST`,
          [row.id]
        ),
      ])
      const games = await this.games([row.id])
      return {
        ...tagOf(row),
        id: row.id as string,
        socials: (row.socials ?? {}) as Record<string, string>,
        accounts: accounts.rows.map(accountOf),
        teams: history.rows.map((r: Record<string, any>) => ({
          team: teamOf(r)!,
          title: r.title,
          role: r.role,
          current: r.current,
          joinedAt: r.joined_at,
          leftAt: r.left_at,
        })),
        ...games,
      }
    })
  }

  /** A team's page: who plays there now, who did, and their games of the last 30 days. */
  async team(slug: string) {
    return this.#pages.get(`team:${slug}`, async () => {
      const { rows: found } = await db.rawQuery(
        `SELECT id, slug, name, short_name, region, active, socials FROM pro_team WHERE slug = ? LIMIT 1`,
        [slug]
      )
      const team = found[0]
      if (!team) return null
      const { rows: members } = await db.rawQuery(
        `SELECT m.id AS member_id, m.name AS member_name, m.title, m.role AS member_role, m.current,
                m.joined_at, m.left_at, p.id, p.slug, p.name, p.role, p.country, ba.*
         FROM pro_team_member m
         LEFT JOIN pro_player p ON p.id = m.player_id
         LEFT JOIN LATERAL (
           SELECT a.tier AS best_tier, a.division AS best_division, a.lp AS best_lp
           FROM pro_account a WHERE a.player_id = p.id AND a.tier IS NOT NULL
           ORDER BY ${TIER_SQL} NULLS LAST, a.division NULLS LAST, a.lp DESC NULLS LAST LIMIT 1
         ) ba ON true
         WHERE m.team_id = ?
         ORDER BY m.current DESC, array_position(ARRAY['TOP','JUNGLE','MID','ADC','SUPPORT']::text[], m.role) NULLS LAST,
                  m.joined_at DESC NULLS LAST`,
        [team.id]
      )
      const roster = members.map((m: Record<string, any>) => ({
        name: m.name ?? m.member_name,
        slug: m.slug ?? null,
        role: m.member_role ?? m.role ?? null,
        title: m.title,
        country: m.country ?? null,
        current: m.current,
        joinedAt: m.joined_at,
        leftAt: m.left_at,
        best: bestOf(m),
        playerId: m.id ?? null,
      }))
      const current = roster.filter(
        (m: { current: boolean; playerId: string | null }) => m.current && m.playerId
      )
      const games = await this.games(current.map((m: { playerId: string }) => m.playerId))
      return {
        id: team.id as string,
        slug: team.slug as string,
        name: team.name as string,
        shortName: team.short_name as string | null,
        region: team.region as string | null,
        active: team.active as boolean,
        socials: (team.socials ?? {}) as Record<string, string>,
        roster,
        ...games,
      }
    })
  }

  /** Active teams by region, and the best ranked pros now. */
  async directory() {
    return this.#pages.get('directory', async () => {
      const [teams, players, counts] = await Promise.all([
        db.rawQuery(
          `SELECT t.id, t.slug, t.name, t.short_name, t.region,
                  count(m.id) FILTER (WHERE m.current AND m.title IN ('player', 'sub'))::int AS players
           FROM pro_team t LEFT JOIN pro_team_member m ON m.team_id = t.id
           WHERE t.active
           GROUP BY t.id
           HAVING count(m.id) FILTER (WHERE m.current AND m.title IN ('player', 'sub')) >= 4
           ORDER BY t.region, t.name`
        ),
        db.rawQuery(
          `SELECT p.slug, p.name, p.role, p.country, ct.*, a.tier AS best_tier, a.division AS best_division,
                  a.lp AS best_lp, a.game_name, a.tag_line, a.platform
           FROM pro_account a JOIN pro_player p ON p.id = a.player_id ${CURRENT_TEAM}
           WHERE a.tier IN ('CHALLENGER', 'GRANDMASTER')
           ORDER BY ${TIER_SQL}, a.lp DESC
           LIMIT 60`
        ),
        db.rawQuery(
          `SELECT (SELECT count(*)::int FROM pro_player) AS players,
                  (SELECT count(*)::int FROM pro_account) AS accounts,
                  (SELECT count(*)::int FROM pro_team WHERE active) AS teams`
        ),
      ])
      const seen = new Set<string>()
      const top = players.rows
        .filter((r: Record<string, any>) => !seen.has(r.slug) && seen.add(r.slug))
        .slice(0, 30)
        .map((r: Record<string, any>) => ({
          ...tagOf(r),
          best: bestOf(r),
          account: { gameName: r.game_name, tagLine: r.tag_line, platform: r.platform },
        }))
      return {
        teams: teams.rows.map((r: Record<string, any>) => ({
          id: r.id,
          slug: r.slug,
          name: r.name,
          shortName: r.short_name,
          region: r.region,
          players: r.players,
        })),
        top,
        counts: counts.rows[0] as { players: number; accounts: number; teams: number },
      }
    })
  }

  /** The logo address of a team (never sent to a browser: /cdn/team/:id serves the image). */
  async logoUrl(teamId: string): Promise<string | null> {
    if (!/^[0-9a-f-]{36}$/i.test(teamId)) return null
    const { rows: found } = await db.rawQuery('SELECT logo_url FROM pro_team WHERE id = ?', [
      teamId,
    ])
    return found[0]?.logo_url ?? null
  }

  /** The PUUIDs of some players' accounts: ours under every key, and the site's same Riot IDs. */
  async puuids(playerIds: string[]) {
    if (!playerIds.length) return []
    const { rows: found } = await db.rawQuery(
      `SELECT a.id, a.player_id, a.platform, a.game_name, a.tag_line, k.puuid
       FROM pro_account a JOIN pro_account_puuid k ON k.account_id = a.id
       WHERE a.player_id = ANY(?) AND k.puuid != ''
       UNION
       SELECT a.id, a.player_id, a.platform, a.game_name, a.tag_line, r.puuid
       FROM pro_account a
       JOIN riot_player r ON r.platform = a.platform AND r.game_name = a.game_name AND r.tag_line = a.tag_line
       WHERE a.player_id = ANY(?)`,
      [playerIds, playerIds]
    )
    return found as {
      id: string
      player_id: string
      platform: string
      game_name: string
      tag_line: string
      puuid: string
    }[]
  }

  /** The ranked games of some players, the last 30 days, with what they add up to. */
  async games(playerIds: string[]) {
    const key = [...playerIds].sort().join(',')
    return this.#games
      .get(`games:${key}`, async () => {
        const found = await this.puuids(playerIds)
        const riotIdOf = new Map(found.map((f) => [f.puuid, `${f.game_name}#${f.tag_line}`]))
        const games = found.length
          ? await this.readGames({
              puuids: found.map((f) => f.puuid),
              since: Date.now() - GAMES_DAYS * 86_400_000,
              limit: 400,
              account: (puuid) => riotIdOf.get(puuid) ?? '',
            })
          : []
        // Several players (a team): each game says whose it was.
        if (playerIds.length > 1 && games.length) {
          const playerOfAccount = new Map(
            found.map((f) => [`${f.game_name}#${f.tag_line}`, f.player_id])
          )
          const tags = await this.tags(playerIds)
          for (const g of games) {
            const tag = tags.get(playerOfAccount.get(g.account) ?? '')
            if (tag) g.pro = tag
          }
        }
        return { games: games.slice(0, 20), ...(await summarizeGames(games)) }
      })
      .catch((error) => {
        logger.warn({ err: error }, 'pro games failed')
        return { games: [] as ProGame[], ...emptySummary() }
      })
  }

  /** The games pros played on a champion, the last 14 days, newest first. */
  async championGames(champion: number, position?: string) {
    return this.#games
      .get(`champion:${champion}:${position ?? ''}`, async () => {
        const since = Date.now() - CHAMPION_GAMES_DAYS * 86_400_000
        const found = await rows(
          `SELECT DISTINCT puuid, toString(player_id) FROM pro_puuids FINAL
           WHERE (platform, puuid) IN (
             SELECT platform, puuid FROM participants
             WHERE queue_id = ${RANKED_SOLO} AND champion_id = {champion:UInt16}
               AND platform IN ('EUW1','NA1','BR1') AND game_start_ms >= {since:UInt64}
               ${position ? 'AND team_position = {position:String}' : ''}
           )`,
          { champion, since, position }
        )
        if (!found.length) return { games: [] as ProGame[], players: [] }
        const playerOf = new Map(found.map(([puuid, player]) => [String(puuid), String(player)]))
        const games = await this.readGames({
          puuids: [...playerOf.keys()],
          since,
          limit: 40,
          champion,
          position,
          account: () => '',
        })
        const ids = [...new Set(games.map((g) => playerOf.get(g.account) ?? ''))].filter(Boolean)
        const tags = await this.tags(ids)
        for (const g of games) {
          const tag = tags.get(playerOf.get(g.account) ?? '')
          if (tag) g.pro = tag
          g.account = ''
        }
        const counted = new Map<string, { pro: ProTag; games: number; wins: number }>()
        for (const g of games) {
          if (!g.pro) continue
          const c = counted.get(g.pro.slug) ?? { pro: g.pro, games: 0, wins: 0 }
          c.games++
          c.wins += g.win ? 1 : 0
          counted.set(g.pro.slug, c)
        }
        return {
          games: games.filter((g) => g.pro),
          players: [...counted.values()].sort((a, b) => b.games - a.games).slice(0, 8),
        }
      })
      .catch((error) => {
        logger.warn({ err: error }, 'champion pro games failed')
        return { games: [] as ProGame[], players: [] }
      })
  }

  /** Tags of players by id. */
  private async tags(ids: string[]) {
    const out = new Map<string, ProTag>()
    if (!ids.length) return out
    const { rows: found } = await db.rawQuery(
      `SELECT p.id, p.slug, p.name, p.role, p.country, ct.* FROM pro_player p ${CURRENT_TEAM}
       WHERE p.id = ANY(?)`,
      [ids]
    )
    for (const r of found) out.set(r.id, tagOf(r))
    return out
  }

  /** Ranked games of some PUUIDs from ClickHouse, newest first, with each lane opponent. */
  private async readGames(opts: {
    puuids: string[]
    since: number
    limit: number
    champion?: number
    position?: string
    account: (puuid: string) => string
  }): Promise<ProGame[]> {
    const found = await rows(
      `WITH me AS (
         SELECT match_id, puuid, platform, game_start_ms, champion_id, team_position, team_id, win,
                kills, deaths, assists, total_cs, item0, item1, item2, item3, item4, item5,
                spell1, spell2, keystone, secondary_style
         FROM participants
         WHERE queue_id = ${RANKED_SOLO} AND platform IN ('EUW1','NA1','BR1')
           AND puuid IN {puuids:Array(String)} AND game_start_ms >= {since:UInt64}
           ${opts.champion ? 'AND champion_id = {champion:UInt16}' : ''}
           ${opts.position ? 'AND team_position = {position:String}' : ''}
         ORDER BY game_start_ms DESC
         LIMIT 1 BY match_id
         LIMIT {limit:UInt32}
       )
       SELECT me.*, m.duration_sec, arrayFirst(s -> s.1 != me.team_id, o.sides).2
       FROM me
       LEFT JOIN (
         SELECT match_id, any(duration_sec) AS duration_sec FROM matches
         WHERE match_id IN (SELECT match_id FROM me) GROUP BY match_id
       ) AS m ON m.match_id = me.match_id
       LEFT JOIN (
         SELECT match_id, team_position, groupArray((team_id, champion_id)) AS sides FROM participants
         WHERE match_id IN (SELECT match_id FROM me) AND team_position != ''
         GROUP BY match_id, team_position
       ) AS o ON o.match_id = me.match_id AND o.team_position = me.team_position
       ORDER BY me.game_start_ms DESC`,
      {
        puuids: opts.puuids,
        since: opts.since,
        limit: opts.limit,
        champion: opts.champion,
        position: opts.position,
      }
    )
    return found.map((r) => {
      const [matchId, puuid, platform, start, champion, position, , win, k, d, a, cs, ...rest] = r
      const items = rest.slice(0, 6).map(Number)
      const [s1, s2, keystone, secondary, duration, opponent] = rest.slice(6).map(Number)
      return {
        matchId: String(matchId),
        account: opts.account(String(puuid)) || String(puuid),
        platform: String(platform),
        startMs: Number(start),
        champion: Number(champion),
        position: String(position),
        win: Number(win) === 1,
        kills: Number(k),
        deaths: Number(d),
        assists: Number(a),
        cs: Number(cs),
        items,
        spells: [s1, s2] as [number, number],
        keystone,
        secondaryStyle: secondary,
        durationSec: duration || 0,
        opponent: opponent || null,
      }
    })
  }
}

function emptySummary() {
  return {
    record: { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0 },
    champions: [] as { champion: number; games: number; wins: number; kda: number }[],
    roles: [] as { position: string; games: number }[],
    items: [] as { item: number; games: number; wins: number }[],
  }
}

/** What a set of games adds up to: the record, champions, roles and finished items. */
async function summarizeGames(games: ProGame[]) {
  const out = emptySummary()
  if (!games.length) return out
  const patch = await latestPatch()
  const kinds = patch ? await buildStatsService.kinds(patch).catch(() => null) : null
  const finished = new Set([...(kinds?.legendary ?? []), ...(kinds?.boots ?? [])])

  const champions = new Map<
    number,
    { games: number; wins: number; k: number; d: number; a: number }
  >()
  const roles = new Map<string, number>()
  const items = new Map<number, { games: number; wins: number }>()
  for (const g of games) {
    out.record.games++
    out.record.wins += g.win ? 1 : 0
    out.record.kills += g.kills
    out.record.deaths += g.deaths
    out.record.assists += g.assists
    const c = champions.get(g.champion) ?? { games: 0, wins: 0, k: 0, d: 0, a: 0 }
    c.games++
    c.wins += g.win ? 1 : 0
    c.k += g.kills
    c.d += g.deaths
    c.a += g.assists
    champions.set(g.champion, c)
    if (g.position) roles.set(g.position, (roles.get(g.position) ?? 0) + 1)
    for (const id of new Set(g.items)) {
      if (!id || (finished.size && !finished.has(id))) continue
      const it = items.get(id) ?? { games: 0, wins: 0 }
      it.games++
      it.wins += g.win ? 1 : 0
      items.set(id, it)
    }
  }
  out.champions = [...champions]
    .map(([champion, c]) => ({
      champion,
      games: c.games,
      wins: c.wins,
      kda: Math.round(((c.k + c.a) / Math.max(c.d, 1)) * 100) / 100,
    }))
    .sort((a, b) => b.games - a.games)
  out.roles = [...roles]
    .map(([position, n]) => ({ position, games: n }))
    .sort((a, b) => b.games - a.games)
  out.items = [...items]
    .map(([item, i]) => ({ item, games: i.games, wins: i.wins }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 12)
  return out
}

export default new ProService()
