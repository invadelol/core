import clickhouse from 'adonisjs-clickhouse/services/main'

/**
 * Rune pages players really run, per champion and role, from the ranked games in our own
 * ClickHouse (the crawler fills the same tables as the site). It answers the picks the bundled
 * OP.GG data leaves out: a champion in a role OP.GG does not list (Seraphine mid, Cho'Gath
 * support, a mage top) gets that role's page rather than its main role's.
 *
 * A page is identified by meaning, like the app's pipeline (docs/data-pipeline.md in the app):
 * keystone and runes per row, secondary tree and its two runes in any order, shards per row.
 * Evidence levels use the same precision targets.
 */

export const RUNE_ROLES = {
  top: 'TOP',
  jungle: 'JUNGLE',
  mid: 'MIDDLE',
  middle: 'MIDDLE',
  adc: 'BOTTOM',
  bottom: 'BOTTOM',
  support: 'UTILITY',
  utility: 'UTILITY',
} as const

/** Seed tiers each bracket reads (the crawler's `match_seed.seed_tier`: the lobby it was found in). */
export const RUNE_BRACKETS = {
  all: null,
  emerald_plus: ['EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'],
  diamond_plus: ['DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'],
  master_plus: ['MASTER', 'GRANDMASTER', 'CHALLENGER'],
} as const

export type RuneBracket = keyof typeof RUNE_BRACKETS

const RANKED_SOLO = 420
/** A patch is the default once it holds this many ranked games. */
const PATCH_READY_GAMES = 50_000
/** Pages and keystones returned. */
const TOP_PAGES = 5
const TOP_KEYSTONES = 4
const TTL_MS = 30 * 60_000
/** Answers kept at most (every champion and role in two brackets fits), oldest dropped first. */
const MAX_CACHED = 2048

export interface RunePage {
  primaryStyle: number
  keystone: number
  /** Rows 1–3 of the primary tree. */
  primary: [number, number, number]
  secondaryStyle: number
  /** The two secondary runes, smallest id first. */
  secondary: [number, number]
  /** Offense, flex, defense. */
  shards: [number, number, number]
}

export interface RunePageStat {
  page: RunePage
  games: number
  win: number
  /** Share of the champion's games in the role. */
  share: number
  /**
   * 0 insufficient, 1 low, 2 medium, 3 high (95 % half-width ≤ 10 / 5 / 2.5 points), at most 2
   * when `tie`.
   */
  level: number
  /** Not clearly more played than the next page (one-sided z < 1.645): the app shows "or …". */
  tie: boolean
}

export interface RuneStats {
  champion: number
  role: string
  patch: string
  bracket: RuneBracket
  games: number
  win: number
  pages: RunePageStat[]
  keystones: { keystone: number; primaryStyle: number; games: number; win: number; share: number }[]
}

/** Agresti–Coull 95 % half-width of a win rate, as the app's pipeline computes it. */
export function halfWidth(games: number, wins: number) {
  const p = (wins + 2) / (games + 4)
  return 1.96 * Math.sqrt((p * (1 - p)) / (games + 4))
}

export function evidenceLevel(games: number, wins: number) {
  const h = halfWidth(games, wins)
  return h <= 0.025 ? 3 : h <= 0.05 ? 2 : h <= 0.1 ? 1 : 0
}

/** One-sided 95 %: the page is more played than the runner-up (the pipeline's identity test). */
const IDENTITY_Z = 1.645

/** Whether a page with `n1` games is not clearly more played than one with `n2`. */
export function isTie(n1: number, n2: number) {
  return n1 + n2 > 0 && (n1 - n2) / Math.sqrt(n1 + n2) < IDENTITY_Z
}

/** One row of the page query: the page's eleven ids, then games and wins. */
export type PageRow = [...number[]]

const round = (n: number, digits = 4) => Math.round(n * 10 ** digits) / 10 ** digits

/** Pages and keystones from the grouped rows, most played first. */
export function summarize(rows: PageRow[]) {
  const pages = rows
    .map((r) => ({
      page: {
        primaryStyle: r[0],
        keystone: r[1],
        primary: [r[2], r[3], r[4]],
        secondaryStyle: r[5],
        secondary: [r[6], r[7]],
        shards: [r[8], r[9], r[10]],
      } as RunePage,
      games: r[11],
      wins: r[12],
    }))
    .sort((a, b) => b.games - a.games)
  const games = pages.reduce((n, p) => n + p.games, 0)
  const wins = pages.reduce((n, p) => n + p.wins, 0)

  const byKeystone = new Map<
    number,
    { keystone: number; primaryStyle: number; games: number; wins: number }
  >()
  for (const p of pages) {
    const k = byKeystone.get(p.page.keystone) ?? {
      keystone: p.page.keystone,
      primaryStyle: p.page.primaryStyle,
      games: 0,
      wins: 0,
    }
    k.games += p.games
    k.wins += p.wins
    byKeystone.set(k.keystone, k)
  }

  return {
    games,
    win: games ? round(wins / games) : 0,
    pages: pages.slice(0, TOP_PAGES).map((p, i) => {
      const tie = isTie(p.games, pages[i + 1]?.games ?? 0)
      const level = evidenceLevel(p.games, p.wins)
      return {
        page: p.page,
        games: p.games,
        win: round(p.wins / p.games),
        share: round(p.games / games),
        level: tie ? Math.min(level, 2) : level,
        tie,
      }
    }),
    keystones: [...byKeystone.values()]
      .sort((a, b) => b.games - a.games)
      .slice(0, TOP_KEYSTONES)
      .map((k) => ({
        keystone: k.keystone,
        primaryStyle: k.primaryStyle,
        games: k.games,
        win: round(k.wins / k.games),
        share: round(k.games / games),
      })),
  }
}

export class RuneStatsService {
  #cache = new Map<string, { at: number; value: Promise<unknown> }>()

  private cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.#cache.get(key)
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value as Promise<T>
    const value = load()
    this.#cache.delete(key)
    if (this.#cache.size >= MAX_CACHED) this.#cache.delete(this.#cache.keys().next().value!)
    this.#cache.set(key, { at: Date.now(), value })
    value.catch(() => this.#cache.delete(key))
    return value
  }

  /** The newest patch with enough ranked games. */
  latestPatch(): Promise<string | null> {
    return this.cached('patch', async () => {
      const result = await clickhouse.query({
        query: `
          SELECT patch FROM matches
          WHERE queue_id = ${RANKED_SOLO}
          GROUP BY patch HAVING count() >= ${PATCH_READY_GAMES}
          ORDER BY max(game_start_ms) DESC LIMIT 1
        `,
        format: 'JSONCompactEachRow',
      })
      const [row] = ((await result.json<unknown[]>()) ?? []) as unknown[][]
      return row ? String(row[0]) : null
    })
  }

  async forRole(
    champion: number,
    role: keyof typeof RUNE_ROLES,
    bracket: RuneBracket = 'all',
    patch?: string
  ): Promise<RuneStats | null> {
    const resolvedPatch = patch ?? (await this.latestPatch())
    if (!resolvedPatch) return null
    const position = RUNE_ROLES[role]
    const key = `${champion}:${position}:${bracket}:${resolvedPatch}`
    return this.cached(key, async () => {
      const result = summarize(await this.pageRows(champion, position, bracket, resolvedPatch))
      return { champion, role: position, patch: resolvedPatch, bracket, ...result }
    })
  }

  private pageRows(champion: number, position: string, bracket: RuneBracket, patch: string) {
    const tiers = RUNE_BRACKETS[bracket]
    const games = `
      SELECT match_id FROM matches
      WHERE queue_id = ${RANKED_SOLO} AND patch = {patch:String}
      ${tiers ? `AND match_id IN (SELECT match_id FROM match_seed WHERE seed_tier IN (${tiers.map((t) => `'${t}'`).join(',')}))` : ''}
    `
    const players = `
      SELECT match_id, puuid, win FROM participants
      WHERE queue_id = ${RANKED_SOLO} AND champion_id = {champion:UInt16}
        AND team_position = {position:String} AND match_id IN (${games})
    `
    // Both sides keyed by one hash of (match, player): the join stays a few MB however many games.
    return clickhouse
      .query({
        query: `
          WITH p AS (SELECT cityHash64(match_id, puuid) AS k, win FROM (${players}))
          SELECT primary_style, keystone, rune2, rune3, rune4, secondary_style,
                 least(rune5, rune6), greatest(rune5, rune6), stat_offense, stat_flex, stat_defense,
                 count(), sum(p.win)
          FROM (
            SELECT cityHash64(match_id, puuid) AS k, primary_style, keystone, rune2, rune3, rune4,
                   secondary_style, rune5, rune6, stat_offense, stat_flex, stat_defense
            FROM match_timeline
            WHERE frame_ms = 0 AND keystone != 0
              AND match_id IN (SELECT match_id FROM (${players}))
            LIMIT 1 BY match_id, puuid
          ) AS t
          INNER JOIN p USING (k)
          GROUP BY ALL
        `,
        query_params: { champion, position, patch },
        format: 'JSONCompactEachRow',
      })
      .then(async (result) =>
        ((await result.json<unknown[]>()) ?? []).map((row) => (row as unknown[]).map(Number))
      )
  }
}

export default new RuneStatsService()
