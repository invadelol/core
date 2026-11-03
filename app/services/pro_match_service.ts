import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { AnswerCache } from '#services/ranked_stats'

/**
 * Pro matches around now (`pro_match`, filled from esports data, about two weeks back and three
 * ahead): a team's next matches and results, a league's next games, the international events
 * running now. Read through a one-minute cache, never with the pages' longer caches, so a live
 * score is never older than a minute behind the table. Every read is empty before the table's
 * migration or when it fails: the pages then leave their blocks out.
 */

export type MatchStatus = 'not_started' | 'running' | 'finished' | 'canceled' | 'postponed'

export interface MatchTeam {
  /** Our team, when the esports data's team is one of ours. */
  id: string | null
  slug: string | null
  name: string
  /** Its short name ("T1", "KC"). */
  code: string | null
  score: number | null
}

export interface ProMatch {
  id: number
  league: { slug: string; code: string; name: string } | null
  tournament: string | null
  name: string | null
  /** When it starts (ISO, UTC). */
  at: string
  status: MatchStatus
  bestOf: number | null
  teams: [MatchTeam, MatchTeam]
  /** 1 or 2, once finished. */
  winner: 1 | 2 | null
  stream: string | null
}

/** A match still "running" this long after its start is stale data, not a live match. */
const LIVE_HOURS = 8
/** A match not started this long after its start time is left out of the next ones. */
const LATE_HOURS = 6
const STATUSES = new Set(['not_started', 'running', 'finished', 'canceled', 'postponed'])

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

const side = (r: Record<string, any>, n: 1 | 2): MatchTeam => {
  const id = (r[`team${n}_id`] as string | null) ?? null
  const ours = Boolean(id && r[`t${n}_slug`])
  const name = (r[`team${n}_name`] as string | null) || (ours ? r[`t${n}_name`] : null) || ''
  return {
    id: ours ? id : null,
    slug: ours ? r[`t${n}_slug`] : null,
    name: name || (r[`team${n}_code`] as string | null) || '',
    code: (r[`team${n}_code`] as string | null) || (ours ? r[`t${n}_short`] : null) || null,
    score: typeof r[`score${n}`] === 'number' ? r[`score${n}`] : null,
  }
}

/** A stream address, always over https (the stream hosts all serve it). */
const stream = (url: unknown) =>
  typeof url === 'string' && /^https?:\/\/[^\s"'<>]+$/.test(url)
    ? url.replace(/^http:/, 'https:')
    : null

export function matchOf(r: Record<string, any>): ProMatch {
  const status = STATUSES.has(r.status) ? (r.status as MatchStatus) : 'not_started'
  const at = new Date(r.begin_at)
  return {
    id: Number(r.external_id),
    league: r.league_slug
      ? { slug: r.league_slug, code: r.league_code, name: r.league_name }
      : null,
    tournament: r.tournament ?? null,
    name: r.name ?? null,
    at: at.toISOString(),
    status,
    bestOf: typeof r.best_of === 'number' && r.best_of > 0 ? r.best_of : null,
    teams: [side(r, 1), side(r, 2)],
    winner: r.winner === 1 || r.winner === 2 ? r.winner : null,
    stream: stream(r.stream_url),
  }
}

/** Running now: "running" and started within the last hours (an older one is stale data). */
export const isLive = (m: ProMatch, now = Date.now()) =>
  m.status === 'running' && now - Date.parse(m.at) < LIVE_HOURS * 3_600_000

/** Still to come (or running): what a "Next" list shows, soonest first. */
export const isNext = (m: ProMatch, now = Date.now()) =>
  isLive(m, now) ||
  ((m.status === 'not_started' || m.status === 'postponed') &&
    Date.parse(m.at) > now - LATE_HOURS * 3_600_000)

/** Played: what a "Results" list shows, newest first. */
export const isResult = (m: ProMatch) => m.status === 'finished'

/** Splits matches (oldest first) into the next ones and the results. */
export function split(matches: ProMatch[], now = Date.now()) {
  return {
    next: matches.filter((m) => isNext(m, now)),
    results: matches.filter(isResult).reverse(),
  }
}

class ProMatchService {
  #answers = new AnswerCache(512, 60_000)

  /** A team's matches of the last two weeks and the next three, oldest first. */
  forTeam(teamId: string): Promise<ProMatch[]> {
    if (!/^[0-9a-f-]{36}$/i.test(teamId)) return Promise.resolve([])
    return this.read(`team:${teamId}`, () =>
      db.rawQuery(
        `${SELECT}
         WHERE (m.team1_id = ? OR m.team2_id = ?)
           AND m.begin_at BETWEEN now() - interval '15 days' AND now() + interval '22 days'
         ORDER BY m.begin_at, m.external_id
         LIMIT 60`,
        [teamId, teamId]
      )
    )
  }

  /** A league's next games (and running ones), soonest first. */
  forLeague(slug: string, limit = 8): Promise<ProMatch[]> {
    return this.read(`league:${slug}:${limit}`, async () =>
      db.rawQuery(
        `${SELECT}
         WHERE m.league_slug = ? AND m.status IN ('not_started', 'running', 'postponed')
           AND m.begin_at BETWEEN now() - interval '${LIVE_HOURS} hours' AND now() + interval '22 days'
         ORDER BY m.begin_at, m.external_id
         LIMIT ?`,
        [slug, limit + 4]
      )
    ).then((list) => list.filter((m) => isNext(m)).slice(0, limit))
  }

  /**
   * The international events running now (tier 0 leagues): their next games, or while none is
   * planned, their results of the last three days.
   */
  async international(limit = 8): Promise<{ next: ProMatch[]; results: ProMatch[] }> {
    const list = await this.read('international', () =>
      db.rawQuery(
        `${SELECT}
         WHERE l.tier = 0
           AND m.begin_at BETWEEN now() - interval '3 days' AND now() + interval '22 days'
         ORDER BY m.begin_at, m.external_id
         LIMIT 80`
      )
    )
    const { next, results } = split(list)
    return {
      next: next.slice(0, limit),
      results: next.length ? [] : results.slice(0, limit),
    }
  }

  /** The next games of the international events and the major leagues, soonest first. */
  async headline(limit = 4): Promise<ProMatch[]> {
    const list = await this.read('headline', () =>
      db.rawQuery(
        `${SELECT}
         WHERE l.tier <= 1 AND m.status IN ('not_started', 'running', 'postponed')
           AND m.begin_at BETWEEN now() - interval '${LIVE_HOURS} hours' AND now() + interval '8 days'
         ORDER BY l.tier, m.begin_at, m.external_id
         LIMIT 40`
      )
    )
    const next = list.filter((m) => isNext(m))
    // The international events first while they run, then the leagues, each soonest first.
    const live = next.filter((m) => isLive(m))
    const rest = next.filter((m) => !isLive(m))
    return [...live, ...rest].slice(0, limit)
  }

  /** One read, kept a minute; an unreadable table reads as no match (kept a minute too). */
  private read(key: string, query: () => Promise<{ rows: Record<string, any>[] }>) {
    return this.#answers.get(key, async (): Promise<ProMatch[]> => {
      try {
        const { rows } = await query()
        return rows.map(matchOf)
      } catch (error) {
        logger.debug({ err: error, key }, 'pro matches unreadable')
        return []
      }
    })
  }
}

const proMatchService = new ProMatchService()
export default proMatchService
