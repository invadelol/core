import { tierOf } from '#services/champion_stats'
import { BRACKETS, platformSql, round, type Bracket } from '#services/ranked_stats'

/**
 * What the tier lists of items, runes, duos and ARAM share (the champions' own is
 * `champion_stats.ts`): the champion classes, how a sample is pulled toward its group's average
 * before it is ranked, and the tiers by place, as the champion tier list gives them.
 */

/** Community Dragon's champion classes, the first of a champion's `roles` (its main class). */
export const CLASSES = ['mage', 'assassin', 'fighter', 'marksman', 'tank', 'support'] as const
export type ChampionClass = (typeof CLASSES)[number]

export function classOf(value: unknown): ChampionClass | null {
  const s = String(value ?? '').toLowerCase()
  return (CLASSES as readonly string[]).includes(s) ? (s as ChampionClass) : null
}

/** Each champion's main class, from the champion list (`roles`, lower case, main first). */
export function championClasses(list: { id: number; roles: string[] }[]) {
  const out = new Map<number, ChampionClass>()
  for (const c of list) {
    const found = c.roles.map(classOf).find(Boolean)
    if (found) out.set(c.id, found)
  }
  return out
}

/** A win rate pulled toward `mean` by `prior` games of it: a small sample says less. */
export function shrunk(games: number, wins: number, mean: number, prior: number) {
  return (wins + mean * prior) / (games + prior)
}

/**
 * Tiers by place (0 S+ … 5 D, `tierOf`) of the rows with at least `minGames`, best shrunk win
 * rate first, against the games-weighted average of those rows. The others get `null`.
 */
export function placeTiers<T extends { games: number; wins: number }>(
  rows: T[],
  minGames: number,
  prior: number
): Map<T, number> {
  const ranked = rows.filter((r) => r.games >= minGames)
  const games = ranked.reduce((n, r) => n + r.games, 0)
  const mean = games ? ranked.reduce((n, r) => n + r.wins, 0) / games : 0.5
  const scored = ranked
    .map((r) => ({ r, score: shrunk(r.games, r.wins, mean, prior) }))
    .sort((a, b) => b.score - a.score || b.r.games - a.r.games)
  return new Map(scored.map(({ r }, i) => [r, tierOf(i, scored.length)]))
}

/**
 * How many games a row needs to be listed: `share` of the games behind the list, never fewer
 * than `floor` (a busy patch asks more of a row than a thin one).
 */
export function gate(total: number, share: number, floor: number) {
  return Math.max(floor, Math.round(total * share))
}

/** The change of a win rate since the patch before, null when either side has too few games. */
export function delta(
  now: { games: number; wins: number } | undefined,
  was: { games: number; wins: number } | undefined,
  minGames: number
) {
  if (!now || !was || now.games < minGames || was.games < minGames) return null
  return round(now.wins / now.games - was.wins / was.games)
}

/** `[key, games]` pairs, most first, at most `top`. */
export function topOf<K>(counts: Map<K, number>, top: number): [K, number][] {
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, top)
}

/** Adds `n` to `key` of a counting map. */
export function bump<K>(counts: Map<K, number>, key: K, n: number) {
  counts.set(key, (counts.get(key) ?? 0) + n)
}

/**
 * The crawler's seed tiers (`match_seed.seed_tier`), lowest first. The tier lists read a patch
 * once for every tier (a row per tier), then any rank bracket is the sum of its tiers' rows.
 */
export const SEED_TIERS = [
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'EMERALD',
  'DIAMOND',
  'MASTER',
  'GRANDMASTER',
  'CHALLENGER',
] as const

/** A seed tier's index in `SEED_TIERS`, -1 for none. */
export const tierIndex = (name: unknown) => (SEED_TIERS as readonly string[]).indexOf(String(name))

/** The `SEED_TIERS` indexes a bracket sums (every tier for all ranks). */
export function bracketTiers(bracket: Bracket): Set<number> {
  const tiers = BRACKETS[bracket] as readonly string[] | null
  return new Set(tiers ? tiers.map(tierIndex).filter((i) => i >= 0) : SEED_TIERS.map((_, i) => i))
}

/**
 * The crawled games of one patch (`{patch:String}`) with their seed tier, one row per game, for a
 * join on `match_id` (`s.seed_tier`); a region keeps its platforms' games only.
 */
export function seedTierJoinSql(region: string | null) {
  return `INNER JOIN (
        SELECT match_id, seed_tier FROM match_seed FINAL
        WHERE patch = {patch:String} ${platformSql(region)}
      ) AS s USING (match_id)`
}
