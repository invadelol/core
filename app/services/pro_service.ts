import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import buildStatsService from '#services/build_stats_service'
import { AnswerCache, RANKED_SOLO } from '#services/ranked_stats'
import { latestPatch, rows } from '#services/ranked_games_service'
import { StatsCache } from '#services/stats_cache'
import matchRepository from '#services/analytics/match_repository'
import type { Match } from '../../inertia/lib/types.js'
import { catalog, leagueCatalog, leagueRef, type LeagueRef } from '#services/pro_leagues'
import proLadderService, { placesBefore, rankScore } from '#services/pro_ladder_service'
import proPhotoService from '#services/pro_photo_service'

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
/**
 * Pro pages and games are fresh half an hour (the crawler links pro games all day), then served
 * while one refresh runs, for a day at most.
 */
const PRO_CACHE = { freshMs: 30 * 60_000, keepMs: 86_400_000 }
/**
 * The shape of the answers the pro caches hold, part of their keys. Redis keeps answers across
 * deploys and serves a stale one while its refresh runs, so a release that changes what a page
 * reads must bump it: otherwise the pages get the previous release's answers for up to a day.
 */
export const PRO_SHAPE = 4
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
  /** Their photo's version (`/cdn/pro/:slug?v=`), when they have one. */
  photo?: string
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
  /** The lane opponent's account (never sent to a page: `opponentPro` / `opponentName` are). */
  opponentPuuid?: string
  /** The lane opponent's Riot ID name, when they are not a pro. */
  opponentName?: string
  /** The lane opponent, when they are a pro. */
  opponentPro?: ProTag | null
  /** The other pros of the game: their tag, champion and side. */
  pros?: { pro: ProTag; champion: number; ally: boolean }[]
  /** Skill points in order (1 Q, 2 W, 3 E, 4 R), only read for a pro's own builds. */
  skillOrder?: number[]
  /** Set on a champion's pro games: who played it. */
  pro?: ProTag
}

/** The league of a team, by its slug (after `leagueCatalog()`). */
const leagueOf = (teamSlug: string | null | undefined): LeagueRef | null => {
  const l = catalog().ofTeam(teamSlug)
  return l ? leagueRef(l) : null
}

/** What every page loader reads first: the leagues and which pros have a photo. */
const ready = () => Promise.all([leagueCatalog(), proPhotoService.index()])

/** A photo version, only when there is one (most tags are sent without). */
const photoOf = (slug: string) => {
  const photo = proPhotoService.of(slug)
  return photo ? { photo } : {}
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
  ...photoOf(r.slug),
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
  #pages = new StatsCache(`pro-pages@${PRO_SHAPE}`, PRO_CACHE)
  #games = new StatsCache(`pro-games@${PRO_SHAPE}`, PRO_CACHE)
  #boards = new StatsCache(`pro-boards@${PRO_SHAPE}`, {
    freshMs: 86_400_000,
    keepMs: 7 * 86_400_000,
  })

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
    if (term.length < 2) return { pros: [], teams: [], accounts: [] }
    const like = `${escapeLike(term.toLowerCase())}%`
    await ready()
    const [pros, teams, accounts] = await Promise.all([
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
      // Pro accounts by Riot ID: the search marks them among the players it finds.
      db.rawQuery(
        `SELECT a.game_name, a.tag_line, a.platform, p.slug, p.name
         FROM pro_account a JOIN pro_player p ON p.id = a.player_id
         WHERE lower(a.game_name) LIKE ? ESCAPE '\\'
         LIMIT 20`,
        [like]
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
      accounts: accounts.rows.map((r: Record<string, any>) => ({
        gameName: r.game_name,
        tagLine: r.tag_line,
        platform: r.platform,
        slug: r.slug,
        name: r.name,
      })),
    }
  }

  /** A pro's page: who, their accounts, their teams, and their games of the last 30 days. */
  async player(slug: string) {
    return this.#pages.get(`player:${slug}`, async () => {
      await ready()
      const { rows: found } = await db.rawQuery(
        `SELECT p.id, p.slug, p.name, p.role, p.country, p.socials, ct.*
         FROM pro_player p ${CURRENT_TEAM} WHERE p.slug = ? LIMIT 1`,
        [slug]
      )
      const row = found[0]
      if (!row) return null
      const [accounts, history, about] = await Promise.all([
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
        this.about(row.id),
      ])
      const games = await this.games([row.id])
      return {
        ...tagOf(row),
        id: row.id as string,
        socials: (row.socials ?? {}) as Record<string, string>,
        league: leagueOf(row.team_slug),
        about,
        accounts: accounts.rows.map(accountOf),
        teams: history.rows.map((r: Record<string, any>) => ({
          team: teamOf(r)!,
          league: leagueOf(r.team_slug),
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
      await ready()
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
        ...(m.slug ? photoOf(m.slug) : {}),
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
      // Where former players play now.
      const formerIds = roster
        .filter((m: { current: boolean; playerId: string | null }) => !m.current && m.playerId)
        .map((m: { playerId: string }) => m.playerId)
      const now = await this.tags([...new Set(formerIds)] as string[])
      const league = catalog().ofTeam(team.slug)
      const standing = league ? await this.league(league.slug) : null
      const place = standing?.teams.findIndex((t) => t.id === team.id) ?? -1
      return {
        id: team.id as string,
        slug: team.slug as string,
        name: team.name as string,
        shortName: team.short_name as string | null,
        region: team.region as string | null,
        active: team.active as boolean,
        socials: (team.socials ?? {}) as Record<string, string>,
        league: league ? leagueRef(league) : null,
        /** Average LP of the starters in Master and above, and the team's place in its league by it. */
        lp: place >= 0 ? (standing!.teams[place].lp ?? null) : null,
        place: place >= 0 && standing!.teams[place].lp !== null ? place + 1 : null,
        roster: roster.map((m: Record<string, any>) => ({
          ...m,
          now: !m.current && m.playerId ? (now.get(m.playerId)?.team ?? null) : null,
        })),
        ...games,
      }
    })
  }

  /** Active teams by region, and the best ranked pros now. */
  async directory() {
    return this.#pages.get('directory', async () => {
      await ready()
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
        await ready()
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
        const recent = games.slice(0, 20)
        await this.whoPlayed(recent, new Set(playerIds)).catch((error) =>
          logger.warn({ err: error }, 'pro game players failed')
        )
        const summary = await summarizeGames(games)
        const kinds = playerIds.length === 1 ? await itemKinds() : null
        return {
          games: recent.map(publicGame),
          ...summary,
          builds: kinds ? buildsOf(games, kinds, summary.champions.slice(0, 8)) : [],
          pools: playerIds.length > 1 ? poolsOf(games) : {},
        }
      })
      .catch((error) => {
        logger.warn({ err: error }, 'pro games failed')
        return { games: [] as ProGame[], ...emptySummary(), builds: [] as ProBuild[], pools: {} }
      })
  }

  /**
   * A pro's recent games as stored matches, each with the pro's own side (`puuid`, Riot ID), so
   * the page lists and opens them like a profile's games. Games no longer stored are left out.
   */
  async recentMatches(
    games: Pick<ProGame, 'matchId' | 'account' | 'champion' | 'win' | 'startMs'>[]
  ) {
    if (!games.length) return []
    return this.#games
      .get(`matches:${games.map((g) => g.matchId).join(',')}`, async () => {
        const since = Math.min(...games.map((g) => g.startMs))
        const found = (await matchRepository.getByIds(
          games.map((g) => g.matchId),
          since
        )) as Match[]
        const byId = new Map(found.map((m) => [m.matchId, m]))
        return games.flatMap((g) => {
          const match = byId.get(g.matchId)
          if (!match) return []
          const at = g.account.lastIndexOf('#')
          const name = (at > 0 ? g.account.slice(0, at) : g.account).toLowerCase()
          const tag = (at > 0 ? g.account.slice(at + 1) : '').toLowerCase()
          const self =
            match.participants.find(
              (p) => p.gameName?.toLowerCase() === name && p.tagLine?.toLowerCase() === tag
            ) ?? match.participants.find((p) => p.championId === g.champion && p.win === g.win)
          return self
            ? [{ match, puuid: self.puuid, gameName: self.gameName, tagLine: self.tagLine }]
            : []
        })
      })
      .catch((error) => {
        logger.warn({ err: error }, 'pro recent matches failed')
        return []
      })
  }

  /** The games pros played on a champion, the last 14 days, newest first. */
  async championGames(champion: number, position?: string) {
    return this.#games
      .get(`champion:${champion}:${position ?? ''}`, async () => {
        await ready()
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

  /**
   * A league's page: its teams (logo, players, average LP of the starters in Master and above) and
   * its current players, ranked by their best account, with their last 24 hours on that ranking,
   * their ranked record of the last 30 days and the champions they play most.
   */
  async league(slug: string) {
    const leagues = await leagueCatalog()
    const league = leagues.bySlug(slug)
    if (!league) return null
    return this.#pages.get(`league:${league.slug}`, async () => {
      await ready()
      const { rows: found } = await db.rawQuery(
        `SELECT t.id AS team_id, t.slug AS team_slug, t.name AS team_name, t.short_name AS team_short,
                t.region AS team_region, m.title, m.role AS member_role,
                p.id AS player_id, p.slug, p.name, p.role, p.country,
                a.id AS account_id, a.platform, a.tier AS best_tier, a.division AS best_division,
                a.lp AS best_lp,
                (SELECT count(*)::int FROM pro_account x WHERE x.player_id = p.id) AS accounts
         FROM pro_team t
         JOIN pro_team_member m ON m.team_id = t.id AND m.current AND m.title IN ('player', 'sub')
         JOIN pro_player p ON p.id = m.player_id
         LEFT JOIN LATERAL (
           SELECT a.id, a.platform, a.tier, a.division, a.lp FROM pro_account a
           WHERE a.player_id = p.id AND a.tier IS NOT NULL
           ORDER BY ${TIER_SQL} NULLS LAST, a.division NULLS LAST, a.lp DESC NULLS LAST LIMIT 1
         ) a ON true
         WHERE ${leagues.fromTable ? 't.league_slug = ?' : 't.slug = ANY(?)'}`,
        [leagues.fromTable ? league.slug : league.teams]
      )
      const players = found.map((r: Record<string, any>) => ({
        ...tagOf(r),
        playerId: r.player_id as string,
        starter: r.title === 'player',
        role: r.member_role ?? r.role ?? null,
        accounts: r.accounts as number,
        best: r.account_id
          ? {
              id: r.account_id as string,
              platform: r.platform as string,
              tier: r.best_tier as string,
              division: r.best_division as number | null,
              lp: (r.best_lp ?? 0) as number,
            }
          : null,
      }))
      const [records, moves] = await Promise.all([
        this.records(players.map((p: { playerId: string }) => p.playerId)),
        proLadderService
          .movement(
            players.flatMap((p: { best: { id: string } | null }) => (p.best ? [p.best.id] : []))
          )
          .catch(() => new Map()),
      ])
      const score = (p: (typeof players)[number]) =>
        p.best ? (rankScore(p.best.tier, p.best.division, p.best.lp) ?? -1) : -1
      players.sort(
        (a: (typeof players)[number], b: (typeof players)[number]) => score(b) - score(a)
      )
      const before = placesBefore(
        players.map((p: (typeof players)[number]) => ({
          score: score(p),
          lp: p.best ? moves.get(p.best.id)?.lp : null,
        }))
      )
      const rowsOut = players.map((p: (typeof players)[number], i: number) => {
        const move = p.best ? moves.get(p.best.id) : undefined
        const rec = records.get(p.playerId)
        return {
          slug: p.slug,
          name: p.name,
          ...photoOf(p.slug),
          role: p.role,
          country: p.country,
          starter: p.starter,
          team: p.team,
          best: p.best
            ? {
                platform: p.best.platform,
                tier: p.best.tier,
                division: p.best.division,
                lp: p.best.lp,
              }
            : null,
          move: move && p.best ? { places: before[i] - (i + 1), lp: move.lp } : null,
          record: rec ? { games: rec.games, wins: rec.wins } : null,
          champions: rec?.champions.slice(0, 3) ?? [],
        }
      })
      const teams = new Map<string, { team: TeamRef; players: number; apex: number[] }>()
      for (const p of players) {
        if (!p.team) continue
        const t = teams.get(p.team.id) ?? { team: p.team, players: 0, apex: [] as number[] }
        t.players++
        if (p.starter && p.best && rankScore(p.best.tier, p.best.division, p.best.lp)! >= 2800) {
          t.apex.push(p.best.lp)
        }
        teams.set(p.team.id, t)
      }
      return {
        league: leagueRef(league),
        teams: [...teams.values()]
          .map((t) => ({
            ...t.team,
            players: t.players,
            lp: t.apex.length
              ? Math.round(t.apex.reduce((n, x) => n + x, 0) / t.apex.length)
              : null,
          }))
          .sort((a, b) => (b.lp ?? -1) - (a.lp ?? -1) || a.name.localeCompare(b.name)),
        players: rowsOut,
        counts: {
          teams: teams.size,
          players: players.length,
          accounts: players.reduce((n: number, p: (typeof players)[number]) => n + p.accounts, 0),
        },
      }
    })
  }

  /** Every league with its teams (logo, players, average LP of the starters in Master and above). */
  async leagueTeams() {
    const { listed } = await leagueCatalog()
    const all = await Promise.all(listed.map((l) => this.league(l.slug)))
    return all
      .filter((l): l is NonNullable<typeof l> => Boolean(l))
      .map((l) => ({ league: l.league, teams: l.teams }))
  }

  /**
   * Each player's ranked record of the last 30 days and the champions they played most, from one
   * read of their accounts' games (`participants` is keyed by player).
   */
  async records(playerIds: string[]) {
    const out = new Map<
      string,
      { games: number; wins: number; champions: { champion: number; games: number }[] }
    >()
    if (!playerIds.length) return out
    const found = await this.puuids(playerIds).catch(() => [])
    if (!found.length) return out
    const playerOf = new Map(found.map((f) => [f.puuid, f.player_id]))
    const counted = await rows(
      `SELECT puuid, champion_id, count(), sum(win) FROM (
         SELECT match_id, puuid, champion_id, win FROM participants
         WHERE puuid IN {puuids:Array(String)} AND queue_id = ${RANKED_SOLO}
           AND game_start_ms >= {since:UInt64}
         LIMIT 1 BY match_id, puuid
       )
       GROUP BY puuid, champion_id`,
      { puuids: [...playerOf.keys()], since: Date.now() - GAMES_DAYS * 86_400_000 }
    ).catch((error) => {
      logger.warn({ err: error }, 'pro records failed')
      return []
    })
    const champs = new Map<string, Map<number, number>>()
    for (const [puuid, champion, games, wins] of counted) {
      const player = playerOf.get(String(puuid))
      if (!player) continue
      const rec = out.get(player) ?? { games: 0, wins: 0, champions: [] }
      rec.games += Number(games)
      rec.wins += Number(wins)
      out.set(player, rec)
      const c = champs.get(player) ?? new Map<number, number>()
      c.set(Number(champion), (c.get(Number(champion)) ?? 0) + Number(games))
      champs.set(player, c)
    }
    for (const [player, rec] of out) {
      rec.champions = [...(champs.get(player) ?? [])]
        .map(([champion, games]) => ({ champion, games }))
        .sort((a, b) => b.games - a.games)
    }
    return out
  }

  /**
   * Who played some games: for each, the lane opponent when a pro, and every other pro in it with
   * their champion and side. One read of the games' players and their pro accounts.
   */
  private async whoPlayed(games: ProGame[], self: Set<string>) {
    if (!games.length) return
    const found = await rows(
      `SELECT p.match_id, p.team_id, p.champion_id, p.puuid, toString(k.player_id)
       FROM (
         SELECT match_id, team_id, champion_id, puuid FROM participants
         WHERE match_id IN {ids:Array(String)} AND queue_id = ${RANKED_SOLO}
         LIMIT 1 BY match_id, puuid
       ) AS p
       INNER JOIN (
         SELECT puuid, any(player_id) AS player_id FROM pro_puuids FINAL
         WHERE puuid IN (
           SELECT puuid FROM participants WHERE match_id IN {ids:Array(String)}
         )
         GROUP BY puuid
       ) AS k USING (puuid)`,
      { ids: games.map((g) => g.matchId) }
    )
    const tags = await this.tags([...new Set(found.map((r) => String(r[4])))])
    const byMatch = new Map<
      string,
      { team: number; champion: number; puuid: string; player: string }[]
    >()
    for (const [m, team, champion, puuid, player] of found) {
      const list = byMatch.get(String(m)) ?? []
      list.push({
        team: Number(team),
        champion: Number(champion),
        puuid: String(puuid),
        player: String(player),
      })
      byMatch.set(String(m), list)
    }
    for (const g of games) {
      const list = byMatch.get(g.matchId) ?? []
      const mine = list.find((x) => x.champion === g.champion && self.has(x.player))
      const myTeam = mine?.team
      g.pros = list
        .filter((x) => x !== mine && tags.has(x.player))
        .map((x) => ({ pro: tags.get(x.player)!, champion: x.champion, ally: x.team === myTeam }))
      const opp = list.find((x) => x.puuid === g.opponentPuuid)
      g.opponentPro = opp ? (tags.get(opp.player) ?? null) : null
    }
  }

  /**
   * One game's ten players for a pro's page, as two teams: champion, name (the pro's, or the Riot
   * ID name), score, items. Stored games never change, so it is kept for a day.
   */
  async board(matchId: string) {
    if (!/^[A-Z0-9]{2,5}_\d{5,14}$/.test(matchId)) return null
    return this.#boards.get(matchId, async () => {
      const found = await rows(
        `SELECT p.team_id, p.team_position, p.champion_id, p.riot_id_game_name, p.kills, p.deaths,
                p.assists, p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.win, p.gold_earned,
                toString(k.player_id)
         FROM (
           SELECT * FROM participants
           WHERE match_id = {id:String} AND queue_id = ${RANKED_SOLO}
           LIMIT 1 BY puuid
         ) AS p
         LEFT JOIN (
           SELECT puuid, any(player_id) AS player_id FROM pro_puuids FINAL
           WHERE puuid IN (SELECT puuid FROM participants WHERE match_id = {id:String})
           GROUP BY puuid
         ) AS k USING (puuid)`,
        { id: matchId }
      )
      if (!found.length) return null
      const ids = found.map((r) => String(r[15])).filter((x) => x && !x.startsWith('00000000'))
      const tags = await this.tags([...new Set(ids)])
      const ORDER = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']
      const side = (team: number) => {
        const list = found
          .filter((r) => Number(r[0]) === team)
          .map((r) => {
            const tag = tags.get(String(r[15]))
            return {
              position: String(r[1]),
              champion: Number(r[2]),
              name: tag?.name ?? String(r[3] ?? ''),
              pro: tag ? { slug: tag.slug, team: tag.team } : null,
              kills: Number(r[4]),
              deaths: Number(r[5]),
              assists: Number(r[6]),
              items: r.slice(7, 13).map(Number).filter(Boolean),
              win: Number(r[13]) === 1,
              gold: Number(r[14]),
            }
          })
          .sort((a, b) => ORDER.indexOf(a.position) - ORDER.indexOf(b.position))
        return {
          win: list[0]?.win ?? false,
          kills: list.reduce((n, p) => n + p.kills, 0),
          gold: list.reduce((n, p) => n + p.gold, 0),
          players: list,
        }
      }
      return { blue: side(100), red: side(200) }
    })
  }

  /**
   * A pro's real name, nationality and birthday (`yyyy-mm-dd`), when the esports data has them;
   * null before the columns' migration or when none is known.
   */
  private async about(playerId: string) {
    try {
      const { rows: found } = await db.rawQuery(
        `SELECT first_name, last_name, nationality, to_char(birthday, 'YYYY-MM-DD') AS birthday
         FROM pro_player WHERE id = ?`,
        [playerId]
      )
      const r = found[0]
      const about = {
        firstName: (r?.first_name as string | null) || null,
        lastName: (r?.last_name as string | null) || null,
        nationality: (r?.nationality as string | null) || null,
        birthday: (r?.birthday as string | null) || null,
      }
      return Object.values(about).some(Boolean) ? about : null
    } catch {
      return null
    }
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
                spell1, spell2, keystone, secondary_style, skill_order
         FROM participants
         WHERE queue_id = ${RANKED_SOLO} AND platform IN ('EUW1','NA1','BR1')
           AND puuid IN {puuids:Array(String)} AND game_start_ms >= {since:UInt64}
           ${opts.champion ? 'AND champion_id = {champion:UInt16}' : ''}
           ${opts.position ? 'AND team_position = {position:String}' : ''}
         ORDER BY game_start_ms DESC
         LIMIT 1 BY match_id
         LIMIT {limit:UInt32}
       )
       SELECT me.*, m.duration_sec, arrayFirst(s -> s.1 != me.team_id, o.sides) AS opp
       FROM me
       LEFT JOIN (
         SELECT match_id, any(duration_sec) AS duration_sec FROM matches
         WHERE match_id IN (SELECT match_id FROM me) GROUP BY match_id
       ) AS m ON m.match_id = me.match_id
       LEFT JOIN (
         SELECT match_id, team_position,
                groupArray((team_id, champion_id, puuid, riot_id_game_name)) AS sides
         FROM participants
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
      const [s1, s2, keystone, secondary] = rest.slice(6, 10).map(Number)
      const skills = (rest[10] as unknown[] | null) ?? []
      const duration = Number(rest[11])
      const opp = (rest[12] as unknown[] | null) ?? []
      const opponent = Number(opp[1] ?? 0)
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
        opponentPuuid: opponent ? String(opp[2] ?? '') : '',
        opponentName: opponent ? String(opp[3] ?? '') : '',
        skillOrder: skills.slice(0, 18).map(Number),
      }
    })
  }
}

/** What a page shows of a game: no account identifier of the lane opponent, no skill order. */
function publicGame(g: ProGame): ProGame {
  const { opponentPuuid, skillOrder, ...rest } = g
  return rest
}

/** Which item ids are boots and which are finished items, on the newest patch. */
async function itemKinds() {
  const patch = await latestPatch()
  const kinds = patch ? await buildStatsService.kinds(patch).catch(() => null) : null
  return { legendary: new Set(kinds?.legendary ?? []), boots: new Set(kinds?.boots ?? []) }
}

/** A pro's build on one champion, from their own games of the last 30 days. */
export interface ProBuild {
  champion: number
  games: number
  wins: number
  kda: number
  /** The boots they buy most, or null. */
  boots: number | null
  /** Their three most bought finished items, most bought first, and the games holding all of them. */
  core: number[]
  coreGames: number
  keystone: number | null
  secondaryStyle: number | null
  spells: [number, number] | null
  /** The order they max Q, W and E (`['Q', 'W', 'E']`), when their games have a skill order. */
  max: string[]
  /** Their last games on it, newest first (true for a win). */
  form: boolean[]
}

const top = <K>(counts: Map<K, number>): K | null => {
  let best: K | null = null
  let n = 0
  for (const [k, c] of counts) if (c > n) [best, n] = [k, c]
  return best
}
const bump = <K>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) ?? 0) + 1)

/** The order Q, W and E reach five points in one game's skill order (1 Q, 2 W, 3 E, 4 R). */
export function maxOrder(order: number[]): string[] {
  const points = [0, 0, 0, 0, 0]
  const done: string[] = []
  for (const k of order) {
    if (k < 1 || k > 3) continue
    points[k]++
    if (points[k] === 5) done.push(['', 'Q', 'W', 'E'][k])
  }
  for (const k of [1, 2, 3])
    if (!done.includes(['', 'Q', 'W', 'E'][k])) done.push(['', 'Q', 'W', 'E'][k])
  return order.length >= 13 ? done : []
}

/** A pro's builds on their most played champions. */
export function buildsOf(
  games: ProGame[],
  kinds: { legendary: Set<number>; boots: Set<number> },
  champions: { champion: number; games: number; wins: number; kda: number }[]
): ProBuild[] {
  return champions.map((c) => {
    const mine = games.filter((g) => g.champion === c.champion)
    const items = new Map<number, number>()
    const boots = new Map<number, number>()
    const keystones = new Map<number, number>()
    const spells = new Map<string, number>()
    const orders = new Map<string, number>()
    for (const g of mine) {
      for (const id of new Set(g.items)) {
        if (kinds.boots.has(id)) bump(boots, id)
        else if (!kinds.legendary.size || kinds.legendary.has(id)) bump(items, id)
      }
      if (g.keystone) bump(keystones, g.keystone)
      if (g.spells[0] && g.spells[1]) bump(spells, [...g.spells].sort((a, b) => a - b).join(','))
      const max = maxOrder(g.skillOrder ?? [])
      if (max.length) bump(orders, max.join(','))
    }
    const core = [...items]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id)
    const keystone = top(keystones)
    const secondary = new Map<number, number>()
    for (const g of mine)
      if (g.keystone === keystone && g.secondaryStyle) bump(secondary, g.secondaryStyle)
    const pair = top(spells)
    const order = top(orders)
    return {
      champion: c.champion,
      games: c.games,
      wins: c.wins,
      kda: c.kda,
      boots: top(boots),
      core,
      coreGames: core.length
        ? mine.filter((g) => core.every((id) => g.items.includes(id))).length
        : 0,
      keystone,
      secondaryStyle: top(secondary),
      spells: pair ? (pair.split(',').map(Number) as [number, number]) : null,
      max: order ? order.split(',') : [],
      form: mine.slice(0, 10).map((g) => g.win),
    }
  })
}

/** Each player's most played champions in a team's games (`pro.slug` → champions). */
function poolsOf(games: ProGame[]) {
  const by = new Map<string, Map<number, { games: number; wins: number }>>()
  for (const g of games) {
    if (!g.pro) continue
    const m = by.get(g.pro.slug) ?? new Map()
    const c = m.get(g.champion) ?? { games: 0, wins: 0 }
    c.games++
    c.wins += g.win ? 1 : 0
    m.set(g.champion, c)
    by.set(g.pro.slug, m)
  }
  const out: Record<string, { champion: number; games: number; wins: number }[]> = {}
  for (const [slug, m] of by) {
    out[slug] = [...m]
      .map(([champion, c]) => ({ champion, ...c }))
      .sort((a, b) => b.games - a.games)
      .slice(0, 6)
  }
  return out
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
