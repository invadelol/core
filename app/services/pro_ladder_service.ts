import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import redis from '@adonisjs/redis/services/main'
import { AnswerCache } from '#services/ranked_stats'
import {
  LEAGUES,
  leagueBySlug,
  leagueOfTeam,
  leagueRef,
  type LeagueRef,
} from '#services/pro_leagues'
import type { ProTag } from '#services/pro_service'

/**
 * Where the pros stand on the ranked ladder and how they moved over the last 24 hours.
 *
 * `pro_account` keeps one rank per account, the newest the crawler read (current team players
 * every 8 hours, the others every two days), so the rank of a day ago is kept here: once an hour
 * the ranks of the accounts that can show a move (Master and above, and every current team
 * player) are written to Redis, kept 26 hours. A move is the rank now against the snapshot taken
 * closest to 24 hours ago (within an hour of it); an account without one shows no move. Until the
 * first snapshots are a day old, the site's own rank history (`riot_rank`, the accounts someone
 * looked up) stands in where it covers the same moment.
 */

const TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND'] as const
const APEX = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER'])
const TIER_ORDER = ['CHALLENGER', 'GRANDMASTER', 'MASTER', 'DIAMOND', 'EMERALD', 'PLATINUM']
const DIVISIONS: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 }

const HOUR = 3_600_000
const DAY = 24 * HOUR
const KEY = 'pro:ranks:'
const KEEP_S = 26 * 3600
const LOCK = 'pro:ranks:lock'

/** One number a rank reads as: 100 per division from Iron IV 0 LP, Master and above on one scale. */
export function rankScore(
  tier: string | null | undefined,
  division: number | string | null | undefined,
  lp: number | null | undefined
): number | null {
  if (!tier) return null
  if (APEX.has(tier)) return 2800 + (lp ?? 0)
  const t = TIERS.indexOf(tier as (typeof TIERS)[number])
  if (t < 0) return null
  const d = typeof division === 'string' ? (DIVISIONS[division] ?? 4) : (division ?? 4)
  return t * 400 + (4 - d) * 100 + (lp ?? 0)
}

/** How one account moved: its LP (on `rankScore`'s scale) since `since` (ms). */
export interface AccountMove {
  lp: number
  since: number
}

export interface LadderAccount {
  id: string
  gameName: string
  tagLine: string
  platform: string
  tier: string
  division: number | null
  lp: number
}

/** A pro on the ladder: their place, best account now, and how they moved in 24 hours. */
export interface LadderRow {
  place: number
  pro: ProTag
  league: LeagueRef | null
  account: LadderAccount
  /** Places gained (positive) or lost on this ladder, and LP, in 24 hours; null when unknown. */
  move: { places: number | null; lp: number } | null
}

export interface LadderOptions {
  /** A league slug (`lec`): its teams' current players only. */
  league?: string | null
  /** `EUW1`, `NA1` or `BR1`: accounts on that server only. */
  platform?: string | null
  /** `TOP`, `JUNGLE`, `MID`, `ADC`, `SUPPORT`. */
  role?: string | null
  /** Master and above only (the ladder that ranks by LP), the default; false for every rank. */
  apexOnly?: boolean
  limit?: number
  offset?: number
}

const STAFF = new Set(['COACH', 'MANAGER', 'ANALYST', 'STAFF', 'OWNER', 'CEO'])

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

const TIER_SQL = `array_position(ARRAY[${TIER_ORDER.map((t) => `'${t}'`).join(',')}]::text[], a.tier)`

export class ProLadderService {
  #ladders = new AnswerCache(64, 5 * 60_000)
  #snapshots = new AnswerCache(4, 10 * 60_000)

  /**
   * The ranks to keep for tomorrow's moves: every ranked account in Master and above, and every
   * account of a current team player. `{ accountId: score }`.
   */
  async ranksNow(): Promise<Record<string, number>> {
    const { rows } = await db.rawQuery(
      `SELECT a.id, a.tier, a.division, a.lp FROM pro_account a
       WHERE a.tier IS NOT NULL
         AND (a.tier IN ('MASTER', 'GRANDMASTER', 'CHALLENGER')
              OR a.player_id IN (SELECT player_id FROM pro_team_member WHERE current))`
    )
    const out: Record<string, number> = {}
    for (const r of rows) {
      const score = rankScore(r.tier, r.division, r.lp)
      if (score !== null) out[r.id] = score
    }
    return out
  }

  /** Writes this hour's snapshot, once across processes. */
  async snapshot(now = Date.now()) {
    const hour = Math.floor(now / HOUR) * HOUR
    const key = `${KEY}${hour}`
    if (await redis.exists(key)) return false
    if ((await redis.set(LOCK, '1', 'PX', 10 * 60_000, 'NX')) !== 'OK') return false
    try {
      const ranks = await this.ranksNow()
      await redis.set(key, JSON.stringify(ranks), 'EX', KEEP_S)
      return true
    } finally {
      await redis.del(LOCK).catch(() => {})
    }
  }

  /** The snapshot taken closest to `at` (within an hour), with when it was taken. */
  private baseline(at: number) {
    const hour = Math.round(at / HOUR) * HOUR
    return this.#snapshots.get(String(hour), async () => {
      for (const h of [hour, hour - HOUR, hour + HOUR]) {
        const raw = await redis.get(`${KEY}${h}`).catch(() => null)
        if (raw) return { at: h, ranks: JSON.parse(raw) as Record<string, number> }
      }
      return null
    })
  }

  /**
   * How some accounts moved in the last 24 hours (`pro_account` ids): LP on `rankScore`'s scale
   * (a promotion counts the LP it took). Accounts without a rank a day ago are left out.
   */
  async movement(accountIds: string[], now = Date.now()): Promise<Map<string, AccountMove>> {
    const out = new Map<string, AccountMove>()
    if (!accountIds.length) return out
    const ids = [...new Set(accountIds)]
    const [current, base] = await Promise.all([
      db.rawQuery(`SELECT id, tier, division, lp FROM pro_account WHERE id = ANY(?)`, [ids]),
      this.baseline(now - DAY).catch(() => null),
    ])
    const scoreNow = new Map<string, number>()
    for (const r of current.rows) {
      const s = rankScore(r.tier, r.division, r.lp)
      if (s !== null) scoreNow.set(r.id, s)
    }
    for (const id of ids) {
      const was = base?.ranks[id]
      const is = scoreNow.get(id)
      if (was !== undefined && is !== undefined) out.set(id, { lp: is - was, since: base!.at })
    }
    const missing = ids.filter((id) => !out.has(id) && scoreNow.has(id))
    if (missing.length) {
      const history = await this.fromHistory(missing, now).catch((error) => {
        logger.warn({ err: error }, 'pro rank history unreadable')
        return new Map<string, { score: number; at: number }>()
      })
      for (const [id, was] of history) {
        out.set(id, { lp: scoreNow.get(id)! - was.score, since: was.at })
      }
    }
    return out
  }

  /**
   * The rank a day ago from the site's own history (`riot_rank`, written when a looked-up
   * account's rank changes): the newest Solo/Duo row at or before then, if no older than 48 h.
   */
  private async fromHistory(accountIds: string[], now: number) {
    const since = new Date(now - DAY)
    const oldest = new Date(now - 2 * DAY)
    const { rows } = await db.rawQuery(
      `SELECT DISTINCT ON (a.id) a.id, r.tier, r.division, r.league_points, r.fetched_at
       FROM pro_account a
       JOIN riot_player p ON p.platform = a.platform AND p.game_name = a.game_name AND p.tag_line = a.tag_line
       JOIN riot_rank r ON r.puuid = p.puuid AND r.queue_type = 'RANKED_SOLO_5x5'
       WHERE a.id = ANY(?) AND r.fetched_at <= ? AND r.fetched_at >= ?
       ORDER BY a.id, r.fetched_at DESC`,
      [accountIds, since, oldest]
    )
    const out = new Map<string, { score: number; at: number }>()
    for (const r of rows) {
      const score = rankScore(r.tier, r.division, r.league_points)
      if (score !== null) out.set(r.id, { score, at: new Date(r.fetched_at).getTime() })
    }
    return out
  }

  /**
   * Pros ranked by their best account (Master and above by default, highest LP first), each with
   * their place and how they moved in the last 24 hours: places on this same ladder and LP.
   * Places a day ago are worked out over the same pros; a pro whose rank a day ago is unknown
   * keeps their place for the others and shows no move.
   */
  async ladder(opts: LadderOptions = {}): Promise<{ total: number; rows: LadderRow[] }> {
    const all = await this.#ladders.get(
      JSON.stringify([opts.league, opts.platform, opts.role, opts.apexOnly !== false]),
      () => this.rank(opts)
    )
    const offset = opts.offset ?? 0
    const limit = opts.limit ?? all.length
    return { total: all.length, rows: all.slice(offset, offset + limit) }
  }

  private async rank(opts: LadderOptions): Promise<LadderRow[]> {
    const league = opts.league ? leagueBySlug(opts.league) : null
    if (opts.league && !league) return []
    const params: unknown[] = []
    const where: string[] = ['a.tier IS NOT NULL']
    if (opts.apexOnly !== false) where.push(`a.tier IN ('MASTER','GRANDMASTER','CHALLENGER')`)
    if (opts.platform) {
      where.push('a.platform = ?')
      params.push(opts.platform)
    }
    if (league) {
      where.push('ct.team_slug = ANY(?)')
      params.push(league.teams)
    }
    if (opts.role) {
      where.push('p.role = ?')
      params.push(opts.role)
    }
    const { rows } = await db.rawQuery(
      `SELECT DISTINCT ON (p.id) p.id AS player_id, p.slug, p.name, p.role, p.country, ct.*,
              a.id AS account_id, a.game_name, a.tag_line, a.platform, a.tier, a.division, a.lp
       FROM pro_account a JOIN pro_player p ON p.id = a.player_id ${CURRENT_TEAM}
       WHERE ${where.join(' AND ')}
       ORDER BY p.id, ${TIER_SQL} NULLS LAST, a.division NULLS LAST, a.lp DESC NULLS LAST`,
      params
    )
    const entries = rows
      .map((r: Record<string, any>) => ({
        r,
        score: rankScore(r.tier, r.division, r.lp) ?? 0,
      }))
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
    const moves = await this.movement(entries.map((e: { r: any }) => e.r.account_id)).catch(
      () => new Map<string, AccountMove>()
    )
    const placeBefore = placesBefore(
      entries.map((e: { r: any; score: number }) => ({
        score: e.score,
        lp: moves.get(e.r.account_id)?.lp,
      }))
    )
    return entries.map((e: { r: Record<string, any> }, i: number) => {
      const r = e.r
      const move = moves.get(r.account_id)
      const team = r.team_id
        ? {
            id: r.team_id,
            slug: r.team_slug,
            name: r.team_name,
            shortName: r.team_short ?? null,
            region: r.team_region ?? null,
          }
        : null
      const ofTeam = leagueOfTeam(team?.slug)
      return {
        place: i + 1,
        pro: {
          slug: r.slug,
          name: r.name,
          role: r.role ?? null,
          country: r.country ?? null,
          staff: STAFF.has(String(r.role ?? '').toUpperCase()),
          team,
        },
        league: ofTeam ? leagueRef(ofTeam) : null,
        account: {
          id: r.account_id,
          gameName: r.game_name,
          tagLine: r.tag_line,
          platform: r.platform,
          tier: r.tier,
          division: r.division ?? null,
          lp: r.lp ?? 0,
        },
        move: move ? { places: placeBefore[i] - (i + 1), lp: move.lp } : null,
      }
    })
  }

  /** The leagues a ladder can be narrowed to. */
  leagues() {
    return LEAGUES.map(leagueRef)
  }
}

/**
 * Each entry's place a day ago, for a list sorted best first now: everyone by their score then
 * (`score - lp`; their score now when `lp` is unknown, so they keep their place for the others).
 */
export function placesBefore(entries: { score: number; lp?: number | null }[]): number[] {
  const order = entries
    .map((e, i) => ({ i, score: e.score - (e.lp ?? 0) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
  const out = new Array<number>(entries.length)
  order.forEach((o, k) => (out[o.i] = k + 1))
  return out
}

const proLadderService = new ProLadderService()
export default proLadderService

/** Writes a rank snapshot now (after `delayMs`) and checks every ten minutes, production only. */
export function startRankSnapshots(delayMs = 60_000) {
  const tick = () =>
    proLadderService
      .snapshot()
      .catch((error) => logger.warn({ err: error }, 'pro rank snapshot failed'))
  setTimeout(tick, delayMs).unref()
  setInterval(tick, 10 * 60_000).unref()
}
