import {
  RANKED_SOLO,
  gamesSql,
  ranked,
  round,
  scopeSql,
  type Bracket,
  type Scope,
} from '#services/ranked_stats'

/**
 * Rune pages players really run, per champion and role (the pure half of
 * `rune_stats_service.ts`: the query and the counting).
 *
 * A page is identified by meaning, like the app's pipeline (docs/data-pipeline.md in the app):
 * keystone and runes per row, secondary tree and its two runes in any order, shards per row.
 */

/** Pages and keystones returned. */
const TOP_PAGES = 5
const TOP_KEYSTONES = 4

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
  bracket: Bracket
  games: number
  win: number
  pages: RunePageStat[]
  keystones: { keystone: number; primaryStyle: number; games: number; win: number; share: number }[]
}

/** One row of the page query: the page's eleven ids, then games and wins. */
export type PageRow = [...number[]]

/** Pages and keystones from the grouped rows, most played first. */
export function summarize(rows: PageRow[]) {
  const pages = rows.map((r) => ({
    value: {
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
  const games = pages.reduce((n, p) => n + p.games, 0)
  const wins = pages.reduce((n, p) => n + p.wins, 0)

  const byKeystone = new Map<
    number,
    { keystone: number; primaryStyle: number; games: number; wins: number }
  >()
  for (const p of [...pages].sort((a, b) => b.games - a.games)) {
    const k = byKeystone.get(p.value.keystone) ?? {
      keystone: p.value.keystone,
      primaryStyle: p.value.primaryStyle,
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
    pages: ranked(pages, games, TOP_PAGES).map(({ value, ...stat }) => ({ page: value, ...stat })),
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

/**
 * The page query: the runes and shards of the players in `scope`, straight from their participant
 * rows, from the patch's first game on (`{patchStart:UInt64}`, so the `by_champion` projection of
 * `participants` reads one champion's recent games only), in the bracket's games of the patch
 * (`gamesSql`). Rows without runes (`rune1` is the keystone; 0 on rows stored before runes were
 * kept) are skipped. Every champion and role at once (`scope` null) prefixes each row with the
 * champion and Riot's position.
 */
export function pageRowsSql(bracket: Bracket, scope: Scope) {
  const by = scope ? '' : 'champion_id, team_position, '
  return `
          SELECT ${by}primary_style, rune1, rune2, rune3, rune4, secondary_style,
                 least(rune5, rune6), greatest(rune5, rune6), stat_offense, stat_flex, stat_defense,
                 count(), sum(win)
          FROM participants
          WHERE queue_id = ${RANKED_SOLO} ${scopeSql(scope)} AND rune1 != 0
            AND game_start_ms >= {patchStart:UInt64} AND match_id IN (${gamesSql(bracket, scope)})
          GROUP BY ALL
        `
}
