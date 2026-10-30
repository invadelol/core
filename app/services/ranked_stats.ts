/**
 * What the champion statistics of our own ranked games share (rune pages, builds, summoner
 * spells): roles, rank brackets, the games a bracket reads, evidence levels and ties, and the
 * answer cache. Pure on purpose: no database here, so the same code checks the numbers offline.
 *
 * Evidence levels follow the app's data pipeline (docs/data-pipeline.md in the app): the 95 %
 * half-width of an option's win rate, and a tie against the next option caps the level at 2.
 */

export const ROLES = {
  top: 'TOP',
  jungle: 'JUNGLE',
  mid: 'MIDDLE',
  middle: 'MIDDLE',
  adc: 'BOTTOM',
  bottom: 'BOTTOM',
  support: 'UTILITY',
  utility: 'UTILITY',
} as const

export type Role = keyof typeof ROLES

/**
 * Seed tiers each bracket reads (the crawler's `match_seed.seed_tier`: the lobby it was found in).
 * The app's rank brackets, one for one: a single tier, or that tier and above.
 */
export const BRACKETS = {
  all: null,
  iron: ['IRON'],
  bronze: ['BRONZE'],
  silver: ['SILVER'],
  gold: ['GOLD'],
  platinum: ['PLATINUM'],
  emerald: ['EMERALD'],
  diamond: ['DIAMOND'],
  emerald_plus: ['EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'],
  diamond_plus: ['DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'],
  master_plus: ['MASTER', 'GRANDMASTER', 'CHALLENGER'],
} as const

export type Bracket = keyof typeof BRACKETS

/** Brackets one request of `/api/picks` may ask for (the longest chain a client reads). */
export const MAX_PICK_BRACKETS = 5

export const RANKED_SOLO = 420
/** A patch is the default once it holds this many ranked games. */
export const PATCH_READY_GAMES = 50_000
export const TTL_MS = 30 * 60_000
/** Answers kept at most per kind, oldest dropped first. */
export const MAX_CACHED = 2048

/** One champion in one role (`position` as Riot names it: `MIDDLE`), or every one of them. */
export type Scope = { champion: number; position: string } | null

/** Agresti–Coull 95 % half-width of a win rate, as the app's pipeline computes it. */
export function halfWidth(games: number, wins: number) {
  const p = (wins + 2) / (games + 4)
  return 1.96 * Math.sqrt((p * (1 - p)) / (games + 4))
}

/** 0 insufficient, 1 low, 2 medium, 3 high (95 % half-width ≤ 10 / 5 / 2.5 points). */
export function evidenceLevel(games: number, wins: number) {
  const h = halfWidth(games, wins)
  return h <= 0.025 ? 3 : h <= 0.05 ? 2 : h <= 0.1 ? 1 : 0
}

/** One-sided 95 %: the option is more played than the runner-up (the pipeline's identity test). */
const IDENTITY_Z = 1.645

/** Whether an option with `n1` games is not clearly more played than one with `n2`. */
export function isTie(n1: number, n2: number) {
  return n1 + n2 > 0 && (n1 - n2) / Math.sqrt(n1 + n2) < IDENTITY_Z
}

export const round = (n: number, digits = 4) => Math.round(n * 10 ** digits) / 10 ** digits

/** An option and its record, before it is ranked. */
export interface Counted<T> {
  value: T
  games: number
  wins: number
}

/**
 * The `top` most played options with their share of `total`, evidence level and tie flag (a
 * tie is judged against the next option, listed or not, and caps the level at 2).
 */
export function ranked<T>(options: Counted<T>[], total: number, top: number) {
  const sorted = [...options].sort((a, b) => b.games - a.games)
  return sorted.slice(0, top).map((o, i) => {
    const tie = isTie(o.games, sorted[i + 1]?.games ?? 0)
    const level = evidenceLevel(o.games, o.wins)
    return {
      value: o.value,
      games: o.games,
      win: round(o.wins / o.games),
      share: total ? round(o.games / total) : 0,
      level: tie ? Math.min(level, 2) : level,
      tie,
    }
  })
}

/** SQL list of the bracket's seed tiers, `null` for all ranks. */
export function seedTiers(bracket: Bracket) {
  const tiers = BRACKETS[bracket]
  return tiers ? tiers.map((t) => `'${t}'`).join(',') : null
}

/**
 * The ranked games of the patch (`{patch:String}`) in the bracket: every ranked game of the
 * patch for all ranks (`matches`), the games the crawler found at the bracket's tiers otherwise
 * (`match_seed`, as the builds and the champion pages count them).
 *
 * With a `scope`, only that champion's games from the patch's start (`{patchStart:UInt64}`) on are
 * looked up. ClickHouse builds the set of an `IN` before reading, and the patch holds millions of
 * games against a champion's thousands: the champion's set is built and the patch's games are
 * read against it, instead of hashing every game of the patch for each champion asked.
 */
export function gamesSql(bracket: Bracket, scope: Scope = null) {
  const tiers = seedTiers(bracket)
  const mine = scope
    ? `AND match_id IN (SELECT match_id FROM participants WHERE queue_id = ${RANKED_SOLO} ${scopeSql(scope)} AND game_start_ms >= {patchStart:UInt64})`
    : ''
  return tiers
    ? `SELECT match_id FROM match_seed WHERE patch = {patch:String} AND seed_tier IN (${tiers}) ${mine}`
    : `SELECT match_id FROM matches WHERE queue_id = ${RANKED_SOLO} AND patch = {patch:String} ${mine}`
}

/**
 * When the first game of the patch (`{patch:String}`) started, in ms: the per-champion and
 * per-player tables are sorted by time, so a read skips every older game. The earliest of
 * `matches` and `match_seed`, so a game the crawler is still writing is never left out. Asked
 * once per patch (`patchStart()`), then passed to the queries as `{patchStart:UInt64}`.
 */
export const PATCH_START_SQL = `least(
      (SELECT min(game_start_ms) FROM matches WHERE queue_id = ${RANKED_SOLO} AND patch = {patch:String}),
      (SELECT min(game_start_ms) FROM match_seed WHERE patch = {patch:String}))`

/** The champion filter of a scope (`{champion:UInt16}`, `{position:String}` parameters). */
export function scopeSql(scope: Scope) {
  return scope
    ? 'AND champion_id = {champion:UInt16} AND team_position = {position:String}'
    : "AND team_position != ''"
}

/**
 * In-process answers for half an hour (or `ttlMs`), at most `max`, oldest dropped first. A
 * failure is not kept.
 */
export class AnswerCache {
  #cache = new Map<string, { at: number; value: Promise<unknown> }>()
  #max: number
  #ttlMs: number

  constructor(max = MAX_CACHED, ttlMs = TTL_MS) {
    this.#max = max
    this.#ttlMs = ttlMs
  }

  get<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.#cache.get(key)
    if (hit && Date.now() - hit.at < this.#ttlMs) return hit.value as Promise<T>
    const value = load()
    this.#cache.delete(key)
    if (this.#cache.size >= this.#max) this.#cache.delete(this.#cache.keys().next().value!)
    this.#cache.set(key, { at: Date.now(), value })
    value.catch(() => this.#cache.delete(key))
    return value
  }
}
