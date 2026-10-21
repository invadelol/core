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
 * Summoner spells players really take, per champion and role (the pure half of
 * `spell_stats_service.ts`). A pair is the two spells in either order (Flash on D or on F is the
 * same choice); it is shown in the order most played, and how often Flash sits on D is given
 * apart: the app keeps Flash on the player's own key.
 */

export const FLASH = 4
const TOP_PAIRS = 5

/**
 * One row per pair (smallest id first): games, wins, games with that order (smallest on D),
 * games with Flash on D, games with Flash on F. Every champion and role at once (`scope` null)
 * prefixes each row with the champion and Riot's position.
 */
export function spellRowsSql(bracket: Bracket, scope: Scope) {
  const by = scope ? '' : 'champion_id, team_position, '
  return `
          SELECT ${by}least(spell1, spell2) AS a, greatest(spell1, spell2) AS b,
                 count(), sum(win), countIf(spell1 = a), countIf(spell1 = ${FLASH}), countIf(spell2 = ${FLASH})
          FROM participants
          WHERE queue_id = ${RANKED_SOLO} ${scopeSql(scope)} AND spell1 != 0 AND spell2 != 0
            AND match_id IN (${gamesSql(bracket)})
          GROUP BY ALL
        `
}

/** One row of the spell query (the per-champion form). */
export type SpellRow = [number, number, number, number, number, number, number]

export interface SpellPairStat {
  /** D then F, as most played. */
  spells: [number, number]
  games: number
  win: number
  /** Share of the champion's games in the role. */
  share: number
  /** 0..3, at most 2 when `tie`. */
  level: number
  /** Not clearly more played than the next pair: the app shows "or …". */
  tie: boolean
}

export interface SpellStats {
  champion: number
  role: string
  patch: string
  bracket: Bracket
  games: number
  win: number
  /** Share of the games with Flash that have it on D (`null` without Flash). */
  flashOnD: number | null
  pairs: SpellPairStat[]
}

/** Pairs from the grouped rows, most played first. */
export function summarizeSpells(rows: SpellRow[]) {
  const games = rows.reduce((n, r) => n + r[2], 0)
  const wins = rows.reduce((n, r) => n + r[3], 0)
  const flashD = rows.reduce((n, r) => n + r[5], 0)
  const flashF = rows.reduce((n, r) => n + r[6], 0)
  const options = rows.map(([a, b, g, w, first]) => ({
    value: (first * 2 >= g ? [a, b] : [b, a]) as [number, number],
    games: g,
    wins: w,
  }))
  return {
    games,
    win: games ? round(wins / games) : 0,
    flashOnD: flashD + flashF ? round(flashD / (flashD + flashF)) : null,
    pairs: ranked(options, games, TOP_PAIRS).map(({ value, ...stat }) => ({
      spells: value,
      ...stat,
    })),
  }
}
