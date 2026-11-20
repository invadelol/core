import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { AnswerCache } from '#services/ranked_stats'
import proMatchService, { isLive, matchOf, type ProMatch } from '#services/pro_match_service'
import proLadderService from '#services/pro_ladder_service'
import { catalog, leagueCatalog, leagueRef } from '#services/pro_leagues'

/**
 * The esports overview's matches: the match to watch now, the next ones, the last results between
 * seasons, and the leagues; a league's results; a pro's place on their league's ladder. Every
 * figure comes from the stored pro data (`pro_league`, `pro_team`, `pro_match`: refreshed every 15
 * minutes, three weeks ahead and 30 days back) and the pro ladder. Nothing here is a standing or a
 * season result: those are not stored.
 */

/** A match with each team's league, for the headline. */
export type HeadlineMatch = ProMatch & {
  leagues: [string | null, string | null]
  /** The game being played now (score + 1) while it runs. */
  game: number | null
}

const SELECT = `
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

/** The match the overview leads with: a live one, else the next, else the last result. */
export function headlineOf(
  live: ProMatch[],
  next: ProMatch[],
  results: ProMatch[],
  now = Date.now()
): ProMatch | null {
  return (
    live.find((m) => isLive(m, now)) ??
    next.find((m) => Date.parse(m.at) >= now - 3_600_000) ??
    results[0] ??
    null
  )
}

export class EsportsService {
  #answers = new AnswerCache(64, 60_000)

  /** A league's finished matches of the last two weeks, newest first. */
  results(slug: string, limit = 10): Promise<ProMatch[]> {
    return this.#answers.get(`results:${slug}:${limit}`, async () => {
      try {
        const { rows } = await db.rawQuery(
          `${SELECT}
           WHERE m.league_slug = ? AND m.status = 'finished'
             AND m.begin_at >= now() - interval '15 days'
           ORDER BY m.begin_at DESC, m.external_id DESC
           LIMIT ?`,
          [slug, limit]
        )
        return (rows as Record<string, any>[]).map(matchOf)
      } catch (error) {
        logger.debug({ err: error, slug }, 'league results unreadable')
        return []
      }
    })
  }

  /**
   * The international events' and major leagues' finished matches of the last `days` days (three
   * by default, the home's; the overview reads the table's two weeks), the events first.
   */
  recentResults(limit = 6, days = 3): Promise<ProMatch[]> {
    return this.#answers.get(`recent:${limit}:${days}`, async () => {
      try {
        const { rows } = await db.rawQuery(
          `${SELECT}
           WHERE l.tier <= 1 AND m.status = 'finished'
             AND m.begin_at >= now() - make_interval(days => ?)
           ORDER BY l.tier, m.begin_at DESC, m.external_id DESC
           LIMIT ?`,
          [days, limit]
        )
        return (rows as Record<string, any>[]).map(matchOf)
      } catch (error) {
        logger.debug({ err: error }, 'recent results unreadable')
        return []
      }
    })
  }

  /** The headline match with each team's league code and the game being played. */
  private headline(match: ProMatch | null): HeadlineMatch | null {
    if (!match) return null
    const code = (slug: string | null) => (slug ? (catalog().ofTeam(slug)?.code ?? null) : null)
    const played = (match.teams[0].score ?? 0) + (match.teams[1].score ?? 0)
    return {
      ...match,
      leagues: [code(match.teams[0].slug), code(match.teams[1].slug)],
      game: isLive(match) ? played + 1 : null,
    }
  }

  /** The overview's matches: live, next, or between seasons the last results, and the leagues. */
  async overview() {
    const leagues = await leagueCatalog()
    const [international, upcoming, recent] = await Promise.all([
      proMatchService.international(6),
      proMatchService.headline(6),
      this.recentResults(8, 15),
    ])
    const live = [...international.next, ...upcoming].filter((m) => isLive(m))
    const headline = this.headline(
      headlineOf(live, [...international.next, ...upcoming], [...international.results, ...recent])
    )
    const coming = dedupe([...international.next, ...upcoming])
      .filter((m) => !isLive(m) && m.id !== headline?.id)
      .slice(0, 6)
    return {
      headline,
      /** Matches running now, international events first. */
      live: dedupe(live).filter((m) => m.id !== headline?.id),
      /** The next matches of the international events and major leagues. */
      next: coming,
      /**
       * While nothing is planned (between seasons), their results of the last two weeks, the
       * international events first, without the headline.
       */
      results: coming.length
        ? []
        : dedupe([...international.results, ...recent])
            .filter((m) => m.id !== headline?.id)
            .slice(0, 6),
      leagues: leagues.listed.map(leagueRef),
    }
  }

  /** A pro's place on their league's ladder ("#1 of 55 ranked pros"), or null. */
  async leaguePlace(slug: string, league: string | null | undefined) {
    if (!league) return null
    const ladder = await proLadderService.ladder({ league }).catch(() => null)
    const row = ladder?.rows.find((r) => r.pro.slug === slug)
    return row && ladder ? { place: row.place, total: ladder.total } : null
  }
}

function dedupe(matches: ProMatch[]) {
  const seen = new Set<number>()
  return matches.filter((m) => !seen.has(m.id) && seen.add(m.id))
}

const esportsService = new EsportsService()
export default esportsService
