import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { AnswerCache } from '#services/ranked_stats'
import { matchOf } from '#services/pro_match_service'
import proLadderService, { type LadderRow } from '#services/pro_ladder_service'
import proService from '#services/pro_service'
import proPhotoService from '#services/pro_photo_service'
import { catalog, leagueCatalog, leagueRef, type LeagueRef } from '#services/pro_leagues'

/**
 * The esports overview's and the teams page's figures beyond the matches, all from the stored pro
 * data: the best pro of each league in solo queue, the pros who won the most LP in 24 hours (the
 * pro ladder), the last international event's champion and the five who won it, the roster moves
 * of the last weeks (`pro_team_member`'s joined and left dates), and every team's starting five.
 *
 * The match table keeps 30 days of results (the esports sync deletes older matches), so the last
 * champion shows for about a month after the final and then leaves the page with its match.
 * Season dates are not stored: a league's next game only shows once it is three weeks away.
 */

/** A pro as these blocks draw them: picture, name, role, country. */
export interface ProFace {
  slug: string
  name: string
  photo?: string
  role: string | null
  country: string | null
}

export interface TeamTag {
  id: string
  slug: string
  name: string
  shortName: string | null
}

/** A league's player as `proService.league()` gives them. */
interface LeaguePlayer {
  slug: string
  name: string
  photo?: string
  role: string | null
  country: string | null
  starter: boolean
  team: { id: string; slug: string; name: string } | null
  best: { tier: string; lp: number } | null
}

/** How far back roster moves are read. */
const MOVE_DAYS = 60
/** How far back a final is looked for: the match table keeps 30 days. */
const EVENT_DAYS = 31
const ROLES = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT']

const MATCH_SELECT = `
  SELECT m.external_id, m.tournament, m.name, m.begin_at, m.status, m.best_of,
         m.team1_id, m.team2_id, m.team1_name, m.team1_code, m.team2_name, m.team2_code,
         m.score1, m.score2, m.winner, m.stream_url,
         l.slug AS league_slug, l.code AS league_code, l.name AS league_name,
         t1.slug AS t1_slug, t1.name AS t1_name, t1.short_name AS t1_short,
         t2.slug AS t2_slug, t2.name AS t2_name, t2.short_name AS t2_short
  FROM pro_match m
  LEFT JOIN pro_league l ON l.slug = m.league_slug
  LEFT JOIN pro_team t1 ON t1.id = m.team1_id
  LEFT JOIN pro_team t2 ON t2.id = m.team2_id`

const face = (r: Record<string, any>): ProFace => {
  const photo = proPhotoService.of(r.slug)
  return {
    slug: r.slug,
    name: r.name,
    ...(photo ? { photo } : {}),
    role: r.member_role ?? r.role ?? null,
    country: r.country ?? null,
  }
}

const byRole = (a: { role: string | null }, b: { role: string | null }) =>
  (ROLES.indexOf(a.role ?? '') + 1 || 9) - (ROLES.indexOf(b.role ?? '') + 1 || 9)

/** The year an event's tournament names ("2026, Playoffs" → 2026), or null. */
export const eventYear = (tournament: string | null | undefined) => {
  const y = /\b(20\d\d)\b/.exec(tournament ?? '')
  return y ? Number(y[1]) : null
}

/** A final's name: "Grand Final: BLG vs GEN", "Final", "Grand final". */
export const isFinal = (name: string | null | undefined) =>
  /^\s*(grand\s+)?finals?\b/i.test(name ?? '')

/** A ladder row as the overview's lists draw it. */
const ladderPro = (r: LadderRow) => ({
  pro: {
    slug: r.pro.slug,
    name: r.pro.name,
    ...(r.pro.photo ? { photo: r.pro.photo } : {}),
    team: r.pro.team
      ? {
          id: r.pro.team.id,
          slug: r.pro.team.slug,
          name: r.pro.team.name,
          shortName: r.pro.team.shortName,
        }
      : null,
  },
  lp: r.account.lp,
  gained: r.move?.lp ?? 0,
})

class EsportsLandingService {
  #answers = new AnswerCache(32, 5 * 60_000)

  /**
   * The last international event's final (a tier 0 league's final of the last month), its
   * champion and the champion's five starters on the day of the final (members then, whatever
   * moved since). Null while an event runs, before its final is stored, and once it has left the
   * match table.
   */
  lastEvent() {
    return this.#answers.get('event', async () => {
      try {
        await Promise.all([leagueCatalog(), proPhotoService.index()])
        const { rows } = await db.rawQuery(
          `${MATCH_SELECT}
           WHERE l.tier = 0 AND m.status = 'finished' AND m.winner IN (1, 2)
             AND m.begin_at >= now() - make_interval(days => ?)
           ORDER BY m.begin_at DESC, m.external_id DESC
           LIMIT 40`,
          [EVENT_DAYS]
        )
        const found = rows as Record<string, any>[]
        const last = found.find((r) => isFinal(r.name))
        // A later match of an international event means a newer one runs: no champion to show.
        if (!last || found[0].external_id !== last.external_id) return null
        const final = matchOf(last)
        const won = final.teams[final.winner === 1 ? 0 : 1]
        if (!won.id || !won.slug) return null
        const { rows: members } = await db.rawQuery(
          `SELECT p.slug, p.name, p.role, p.country, m.role AS member_role
           FROM pro_team_member m JOIN pro_player p ON p.id = m.player_id
           WHERE m.team_id = ? AND m.title = 'player'
             AND (m.joined_at IS NULL OR m.joined_at <= ?)
             AND (m.left_at IS NULL OR m.left_at >= ?::timestamptz - interval '1 day')
           ORDER BY m.joined_at DESC NULLS LAST`,
          [won.id, last.begin_at, last.begin_at]
        )
        const seen = new Set<string>()
        const lineup = (members as Record<string, any>[])
          .map(face)
          .filter((p) => {
            const key = p.role ?? p.slug
            return !seen.has(key) && seen.add(key)
          })
          .sort(byRole)
          .slice(0, 5)
        const league = catalog().bySlug(last.league_slug)
        return {
          league: league ? leagueRef(league) : null,
          year: eventYear(last.tournament),
          final,
          champion: { id: won.id, slug: won.slug, name: won.name, code: won.code },
          lineup,
        }
      } catch (error) {
        logger.debug({ err: error }, 'last event unreadable')
        return null
      }
    })
  }

  /**
   * The roster moves of the last weeks in the listed leagues' teams, newest first: a player who
   * joined (from where they were before, when that is stored) or left (for where they are now,
   * when that is stored). Players who left one team the same day are one move.
   */
  moves(limit = 8) {
    return this.#answers.get(`moves:${limit}`, async () => {
      try {
        const leagues = await leagueCatalog()
        await proPhotoService.index()
        const teams = leagues.listed.flatMap((l) => l.teams)
        if (!teams.length) return []
        const { rows } = await db.rawQuery(
          `SELECT m.player_id, m.role AS member_role, m.title, m.current, m.joined_at, m.left_at,
                  p.slug, p.name, p.role, p.country,
                  t.id AS team_id, t.slug AS team_slug, t.name AS team_name, t.short_name AS team_short,
                  prev.team_id AS other_id, prev.team_slug AS other_slug, prev.team_name AS other_name,
                  prev.team_short AS other_short
           FROM pro_team_member m
           JOIN pro_team t ON t.id = m.team_id
           JOIN pro_player p ON p.id = m.player_id
           LEFT JOIN LATERAL (
             -- Joined: the team they left last before. Left: the team they play for now.
             SELECT o.team_id, ot.slug AS team_slug, ot.name AS team_name, ot.short_name AS team_short
             FROM pro_team_member o JOIN pro_team ot ON ot.id = o.team_id
             WHERE o.player_id = m.player_id AND o.team_id <> m.team_id AND o.title IN ('player', 'sub')
               AND CASE WHEN m.left_at IS NULL
                 THEN o.left_at IS NOT NULL AND o.left_at <= m.joined_at + interval '1 day'
                      AND o.left_at >= m.joined_at - interval '120 days'
                 ELSE o.current AND o.joined_at >= m.left_at - interval '30 days'
               END
             ORDER BY o.left_at DESC NULLS FIRST, o.joined_at DESC NULLS LAST
             LIMIT 1
           ) prev ON true
           WHERE t.slug = ANY(?) AND m.title IN ('player', 'sub')
             AND ((m.left_at IS NULL AND m.current AND m.joined_at >= now() - make_interval(days => ?))
               OR (m.left_at >= now() - make_interval(days => ?)))
           ORDER BY coalesce(m.left_at, m.joined_at) DESC
           LIMIT 200`,
          [teams, MOVE_DAYS, MOVE_DAYS]
        )
        const tag = (id: string, slug: string, name: string, short: string | null): TeamTag => ({
          id,
          slug,
          name,
          shortName: short ?? null,
        })
        type Move = {
          at: string
          kind: 'joined' | 'left'
          team: TeamTag
          other: TeamTag | null
          players: ProFace[]
        }
        const out: Move[] = []
        const seenPlayer = new Set<string>()
        for (const r of rows as Record<string, any>[]) {
          const left = r.left_at !== null
          const at = new Date(left ? r.left_at : r.joined_at).toISOString()
          // A transfer between two listed teams shows once, as the arrival.
          if (left && r.other_id && teams.includes(r.other_slug)) continue
          if (seenPlayer.has(`${r.player_id}:${at.slice(0, 10)}`)) continue
          seenPlayer.add(`${r.player_id}:${at.slice(0, 10)}`)
          const kind = left ? 'left' : 'joined'
          const other = r.other_id
            ? tag(r.other_id, r.other_slug, r.other_name, r.other_short)
            : null
          const same = out.find(
            (m) =>
              m.kind === kind &&
              m.team.id === r.team_id &&
              m.at.slice(0, 10) === at.slice(0, 10) &&
              m.other?.id === other?.id
          )
          if (same) same.players.push(face(r))
          else
            out.push({
              at,
              kind,
              team: tag(r.team_id, r.team_slug, r.team_name, r.team_short),
              other,
              players: [face(r)],
            })
        }
        for (const m of out) m.players.sort(byRole)
        return out.slice(0, limit)
      } catch (error) {
        logger.debug({ err: error }, 'roster moves unreadable')
        return []
      }
    })
  }

  /** The pros who won the most LP in 24 hours, most first (the pro ladder's moves). */
  async climbers(limit = 5) {
    const ladder = await proLadderService.ladder({}).catch(() => null)
    return (ladder?.rows ?? [])
      .filter((r) => (r.move?.lp ?? 0) > 0)
      .sort((a, b) => b.move!.lp - a.move!.lp)
      .slice(0, limit)
      .map(ladderPro)
  }

  /** The best pro of each listed league by their best account, in the leagues' order. */
  async leaders() {
    const { listed } = await leagueCatalog()
    const boards = await Promise.all(listed.map((l) => proService.league(l.slug).catch(() => null)))
    return boards.flatMap((board, i) => {
      const best = ((board?.players ?? []) as LeaguePlayer[]).find((p) => p.best)
      if (!best) return []
      const l = listed[i]
      return [
        {
          slug: best.slug,
          name: best.name,
          ...(best.photo ? { photo: best.photo } : {}),
          team: best.team ? { id: best.team.id, name: best.team.name } : null,
          tier: best.best!.tier,
          lp: best.best!.lp,
          league: { slug: l.slug, code: l.code },
        },
      ]
    })
  }

  /**
   * Every listed league's teams with their starting five (one per role, by their best account;
   * the players who joined in the last weeks marked), each team's country, its starters' average
   * LP against Master 0 LP (team_lp.ts) and how many starters it counts.
   */
  teams() {
    return this.#answers.get('teams', async () => {
      const leagues = await leagueCatalog()
      const slugs = leagues.listed.flatMap((l) => l.teams)
      const [boards, info] = await Promise.all([
        Promise.all(leagues.listed.map((l) => proService.league(l.slug).catch(() => null))),
        slugs.length
          ? db
              .rawQuery(
                `SELECT t.id, t.location,
                        coalesce(array_agg(p.slug) FILTER (
                          WHERE m.joined_at >= now() - make_interval(days => ?)), '{}') AS fresh
                 FROM pro_team t
                 LEFT JOIN pro_team_member m ON m.team_id = t.id AND m.current
                   AND m.title IN ('player', 'sub')
                 LEFT JOIN pro_player p ON p.id = m.player_id
                 WHERE t.slug = ANY(?)
                 GROUP BY t.id`,
                [MOVE_DAYS, slugs]
              )
              .then((r) => r.rows as { id: string; location: string | null; fresh: string[] }[])
              .catch(() => [])
          : Promise.resolve([]),
      ])
      const byTeam = new Map(info.map((r) => [r.id, r]))
      return boards.flatMap((board) => {
        if (!board) return []
        const league: LeagueRef = board.league
        const all = board.players as LeaguePlayer[]
        const teams = board.teams.map((t) => {
          const starters = all.filter((p) => p.team?.id === t.id && p.starter)
          const fresh = new Set(byTeam.get(t.id)?.fresh ?? [])
          const five = ROLES.flatMap((role) => {
            const p = starters.find((s) => s.role === role)
            return p
              ? [
                  {
                    slug: p.slug,
                    name: p.name,
                    ...(p.photo ? { photo: p.photo } : {}),
                    role,
                    fresh: fresh.has(p.slug),
                  },
                ]
              : []
          })
          return {
            id: t.id,
            slug: t.slug,
            name: t.name,
            country: byTeam.get(t.id)?.location ?? null,
            lp: t.lp,
            counted: t.counted,
            starters: t.starters,
            five,
          }
        })
        return [{ league, teams }]
      })
    })
  }
}

const esportsLandingService = new EsportsLandingService()
export default esportsLandingService
