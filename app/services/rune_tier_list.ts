import { POSITIONS, type Position } from '#services/champion_stats'
import { RANKED_SOLO, round } from '#services/ranked_stats'
import type { RunePage } from '#services/rune_stats'
import {
  bump,
  delta,
  gate,
  placeTiers,
  seedTierJoinSql,
  tierIndex,
  topOf,
} from '#services/tier_lists'

/**
 * The rune tier list (`/tier-list/runes`), the pure half of `tier_lists_service.ts`: one read of
 * every player's rune page (`participants`, as a champion's Runes tab reads them) for every
 * champion in every role, then the view of a role: each keystone ranked against the others, who
 * runs it, the tree it is paired with and its most played full pages; each tree's share, and the
 * shards.
 */

/** A keystone is listed from this share of the view's pages (and `MIN_KEYSTONE_GAMES`). */
const KEYSTONE_SHARE = 0.002
const MIN_KEYSTONE_GAMES = 100
/** A win rate is pulled toward the average by this many games before it is ranked. */
const PRIOR_GAMES = 2000
/** "Since the patch before" needs this many games on both patches. */
const MIN_DELTA_GAMES = 300
/** A champion counts a keystone as its main rune from this many games in the role. */
const MIN_MAIN_GAMES = 30
/** Full pages kept per keystone and role (`LIMIT … BY`). */
const PAGES_PER_KEYSTONE = 6

/** The kinds of `runeRowsSql`'s rows. */
export const RUNE_KINDS = { keystone: 1, shard: 2, page: 3, minor: 4 } as const

/**
 * Every player's rune page in one role (`{position:String}`) of one patch's crawled games
 * (`{patch:String}`, `{patchStart:UInt64}`), in one pass: rows of seed tier, kind
 * (`RUNE_KINDS`), champion, a, b, page, games, wins. Kinds:
 * - `keystone`: the champion ran keystone `a` with secondary tree `b`.
 * - `shard`: shard row `a` (0 offense, 1 flex, 2 defense) held shard `b`.
 * - `page`: a full page of keystone `a` (`page`: tree, keystone, 3 runes, tree, 2 runes smallest
 *   first, 3 shards), the `PAGES_PER_KEYSTONE` most played of each keystone and seed tier.
 * - `minor`: rune `a` taken in primary tree `b` (one row of the tree each).
 *
 * A row per seed tier, every key a number (a page grouped by its hash), as the item tier list.
 * Rows without runes (stored before runes were kept) are left out, as on a champion's page.
 */
export function runeRowsSql(region: string | null) {
  const none = 'CAST([] AS Array(UInt16))'
  const k = RUNE_KINDS
  const page =
    '[primary_style, rune1, rune2, rune3, rune4, secondary_style, r5, r6, stat_offense, stat_flex, stat_defense]'
  return `
    SELECT tier, o.1, o.2, o.3, o.4, any(o.5), count(), sum(win)
    FROM (
      SELECT s.seed_tier AS tier, p.*
      FROM (
        SELECT match_id, champion_id, win, primary_style, rune1, rune2, rune3, rune4,
               secondary_style, least(rune5, rune6) AS r5, greatest(rune5, rune6) AS r6,
               stat_offense, stat_flex, stat_defense
        FROM participants
        WHERE queue_id = ${RANKED_SOLO} AND team_position = {position:String} AND rune1 != 0
          AND game_start_ms >= {patchStart:UInt64}
      ) AS p
      ${seedTierJoinSql(region)}
    )
    ARRAY JOIN [
      tuple(${k.keystone}, champion_id, rune1, secondary_style, ${none}),
      tuple(${k.shard}, toUInt16(0), toUInt16(0), stat_offense, ${none}),
      tuple(${k.shard}, toUInt16(0), toUInt16(1), stat_flex, ${none}),
      tuple(${k.shard}, toUInt16(0), toUInt16(2), stat_defense, ${none}),
      tuple(${k.page}, toUInt16(0), rune1, toUInt16(0), ${page}),
      tuple(${k.minor}, toUInt16(0), rune2, primary_style, ${none}),
      tuple(${k.minor}, toUInt16(0), rune3, primary_style, ${none}),
      tuple(${k.minor}, toUInt16(0), rune4, primary_style, ${none})
    ] AS o
    GROUP BY tier, o.1, o.2, o.3, o.4, cityHash64(o.5)
    ORDER BY count() DESC
    LIMIT ${PAGES_PER_KEYSTONE} BY tier, o.1, o.2, o.3
  `
}

/** One row of `runeRowsSql`: seed tier, kind, champion, a, b, page, games, wins. */
export type RuneRow = [string, number, number, number, number, number[], number, number]

/** One patch's counts of one role, per seed tier (`SEED_TIERS`' index first), cached as they are. */
export interface RuneBlob {
  /** Tier, champion, keystone, secondary tree, games, wins. */
  keystones: [number, number, number, number, number, number][]
  /** Tier, shard row, shard, games. */
  shards: [number, number, number, number][]
  /** Tier, page (11 ids), games, wins. */
  pages: [number, number[], number, number][]
  /** Tier, rune, its primary tree, games: the runes taken under the keystone. */
  minors: [number, number, number, number][]
}

/** `runeRowsSql`'s rows as a blob (rows of an unknown tier are left out). */
export function runeBlob(rows: RuneRow[]): RuneBlob {
  const out: RuneBlob = { keystones: [], shards: [], pages: [], minors: [] }
  for (const [name, kind, champion, a, b, page, games, wins] of rows) {
    const t = tierIndex(name)
    if (t < 0) continue
    if (kind === RUNE_KINDS.keystone) out.keystones.push([t, champion, a, b, games, wins])
    else if (kind === RUNE_KINDS.shard) out.shards.push([t, a, b, games])
    else if (kind === RUNE_KINDS.page && page.length === 11) out.pages.push([t, page, games, wins])
    else if (kind === RUNE_KINDS.minor && a) out.minors.push([t, a, b, games])
  }
  return out
}

/** The counts of a filter (one role or several). */
export interface RuneCounts {
  /** Position, champion, keystone, secondary tree, games, wins. */
  keystones: [Position, number, number, number, number, number][]
  /** Position, shard row (0 offense, 1 flex, 2 defense), shard, games. */
  shards: [Position, number, number, number][]
  /** Position, page (`RunePage` as 11 ids), games, wins. */
  pages: [Position, number[], number, number][]
  /** Position, rune, its primary tree, games. */
  minors: [Position, number, number, number][]
}

/** One role's counts for a filter: its patches' blobs over the bracket's seed tiers. */
export function roleRuneCounts(blobs: RuneBlob[], tiers: Set<number>, position: Position) {
  const out: RuneCounts = { keystones: [], shards: [], pages: [], minors: [] }
  const keystones = new Map<string, [Position, number, number, number, number, number]>()
  const shards = new Map<string, [Position, number, number, number]>()
  const pages = new Map<string, [Position, number[], number, number]>()
  const minors = new Map<string, [Position, number, number, number]>()
  for (const b of blobs) {
    for (const [t, c, k, sec, g, w] of b.keystones) {
      if (!tiers.has(t)) continue
      const at = `${c}:${k}:${sec}`
      const r = keystones.get(at) ?? [position, c, k, sec, 0, 0]
      r[4] += g
      r[5] += w
      keystones.set(at, r)
    }
    for (const [t, row, shard, g] of b.shards) {
      if (!tiers.has(t)) continue
      const at = `${row}:${shard}`
      const r = shards.get(at) ?? [position, row, shard, 0]
      r[3] += g
      shards.set(at, r)
    }
    for (const [t, ids, g, w] of b.pages) {
      if (!tiers.has(t)) continue
      const at = ids.join(',')
      const r = pages.get(at) ?? [position, ids, 0, 0]
      r[2] += g
      r[3] += w
      pages.set(at, r)
    }
    // Blobs cached before the runes under the keystone were counted have none.
    for (const [t, rune, style, g] of b.minors ?? []) {
      if (!tiers.has(t)) continue
      const at = `${rune}:${style}`
      const r = minors.get(at) ?? [position, rune, style, 0]
      r[3] += g
      minors.set(at, r)
    }
  }
  out.keystones = [...keystones.values()]
  out.shards = [...shards.values()]
  out.pages = [...pages.values()]
  out.minors = [...minors.values()]
  return out
}

/** Several roles' counts as one. */
export function mergeRuneCounts(list: RuneCounts[]): RuneCounts {
  return {
    keystones: list.flatMap((c) => c.keystones),
    shards: list.flatMap((c) => c.shards),
    pages: list.flatMap((c) => c.pages),
    minors: list.flatMap((c) => c.minors),
  }
}

/** A page's 11 ids as a rune page. */
export function pageOf(ids: number[]): RunePage {
  return {
    primaryStyle: ids[0],
    keystone: ids[1],
    primary: [ids[2], ids[3], ids[4]],
    secondaryStyle: ids[5],
    secondary: [ids[6], ids[7]],
    shards: [ids[8], ids[9], ids[10]],
  }
}

export interface RunePageRow {
  page: RunePage
  games: number
  win: number
  /** Share of its keystone's pages (in the full pages view: of every page). */
  share: number
}

/** A keystone as the tier list shows it. */
export interface KeystoneRow {
  keystone: number
  /** Its tree. */
  style: number
  games: number
  win: number
  /** Share of the view's rune pages. */
  pick: number
  /** 0 S+ … 5 D among the keystones; null under `minGames`. */
  tier: number | null
  /** Champions whose most played keystone in the role it is (`MIN_MAIN_GAMES` or more). */
  mainOf: number
  /** Who runs it most: champion and games, most first. */
  champions: { champion: number; games: number }[]
  /** Its games in each role, most first. */
  roles: { position: Position; games: number }[]
  /** The trees it is paired with, most first, with their share of its pages. */
  secondary: { style: number; share: number }[]
  /** Its most played full pages. */
  pages: RunePageRow[]
  /** Change of its win rate since the patch before; null without enough games. */
  delta: number | null
}

export interface RuneView {
  /** Rune pages counted (one per player of the view). */
  games: number
  rows: KeystoneRow[]
  /** Each tree's share of the pages (as primary tree), most first. */
  trees: RuneTreeView[]
  /** The shard rows (offense, flex, defense): each shard's share, most first. */
  shards: { shard: number; share: number }[][]
  /** The most played full pages of every keystone (the "Full pages" view). */
  pages: (RunePageRow & { keystone: number })[]
  minGames: number
  minDeltaGames: number
}

/** A rune tree as the page draws it, read like the client's rune page. */
export interface RuneTreeView {
  style: number
  /** Share of the view's pages with it as the primary tree. */
  share: number
  /** The secondary tree its pages take most, with its share of them; null without any. */
  paired: { style: number; share: number } | null
  /**
   * Its rows under the keystones, in the client's order: each rune with its share of the row
   * (the tree's pages that took one of the row's runes). Empty without the tree's layout.
   */
  rows: { rune: number; share: number }[][]
}

/** Per keystone: games, wins, by champion, by role, by secondary tree. */
function perKeystone(counts: RuneCounts, position: Position | null) {
  const out = new Map<
    number,
    {
      games: number
      wins: number
      champions: Map<number, number>
      roles: Map<Position, number>
      secondary: Map<number, number>
    }
  >()
  for (const [pos, champion, keystone, secondary, games, wins] of counts.keystones) {
    if (position && pos !== position) continue
    const k = out.get(keystone) ?? {
      games: 0,
      wins: 0,
      champions: new Map(),
      roles: new Map(),
      secondary: new Map(),
    }
    k.games += games
    k.wins += wins
    bump(k.champions, champion, games)
    bump(k.roles, pos, games)
    bump(k.secondary, secondary, games)
    out.set(keystone, k)
  }
  return out
}

/**
 * The view of a role (`null`: every role): keystones ranked against each other, the trees and
 * shards, the full pages. `treeOf` gives each keystone's tree (`runeTrees`); `previous` is the
 * patch before's counts (same filter), for the change of each keystone.
 */
export function runeView(
  counts: RuneCounts,
  previous: RuneCounts | null,
  position: Position | null,
  treeOf: Map<number, number>,
  styles: Record<number, { rows: number[][] }> = {}
): RuneView {
  const now = perKeystone(counts, position)
  const was = previous ? perKeystone(previous, position) : new Map()
  const games = [...now.values()].reduce((n, k) => n + k.games, 0)
  const minGames = gate(games, KEYSTONE_SHARE, MIN_KEYSTONE_GAMES)

  // Each champion's most played keystone in its role(s) of the view.
  const byChampion = new Map<string, Map<number, number>>()
  for (const [pos, champion, keystone, , g] of counts.keystones) {
    if (position && pos !== position) continue
    const at = `${champion}:${pos}`
    const m = byChampion.get(at) ?? new Map<number, number>()
    bump(m, keystone, g)
    byChampion.set(at, m)
  }
  const mainOf = new Map<number, number>()
  for (const m of byChampion.values()) {
    const total = [...m.values()].reduce((n, g) => n + g, 0)
    const [best] = topOf(m, 1)
    if (best && total >= MIN_MAIN_GAMES) bump(mainOf, best[0], 1)
  }

  // Full pages: per keystone, the view's role or every role ('').
  // Full pages per keystone: every role's are summed (each role keeps its most played ones).
  const summed = new Map<string, [number[], number, number]>()
  for (const [pos, ids, g, w] of counts.pages) {
    if (position && pos !== position) continue
    const at = ids.join(',')
    const p = summed.get(at) ?? [ids, 0, 0]
    p[1] += g
    p[2] += w
    summed.set(at, p)
  }
  const pagesOf = new Map<number, [number[], number, number][]>()
  for (const p of summed.values()) {
    const list = pagesOf.get(p[0][1]) ?? []
    list.push(p)
    pagesOf.set(p[0][1], list)
  }

  const listed = [...now].filter(([, k]) => k.games >= minGames)
  const tiers = placeTiers(
    listed.map(([keystone, k]) => ({ keystone, k, games: k.games, wins: k.wins })),
    minGames,
    PRIOR_GAMES
  )
  const rows: KeystoneRow[] = [...tiers].map(([{ keystone, k }, tier]) => ({
    keystone,
    style: treeOf.get(keystone) ?? 0,
    games: k.games,
    win: round(k.wins / k.games),
    pick: games ? round(k.games / games) : 0,
    tier,
    mainOf: mainOf.get(keystone) ?? 0,
    champions: topOf(k.champions, 5).map(([champion, g]) => ({ champion, games: g })),
    roles: topOf(k.roles, POSITIONS.length).map(([p, g]) => ({ position: p, games: g })),
    secondary: topOf(k.secondary, 2).map(([style, g]) => ({ style, share: round(g / k.games) })),
    pages: (pagesOf.get(keystone) ?? [])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([ids, g, w]) => ({
        page: pageOf(ids),
        games: g,
        win: round(w / g),
        share: round(g / k.games),
      })),
    delta: delta(k, was.get(keystone), MIN_DELTA_GAMES),
  }))
  rows.sort((a, b) => (a.tier ?? 9) - (b.tier ?? 9) || b.win - a.win)

  const trees = new Map<number, number>()
  for (const [keystone, k] of now) bump(trees, treeOf.get(keystone) ?? 0, k.games)
  trees.delete(0)
  // The secondary tree each primary tree is paired with, and the runes taken under it.
  const paired = new Map<number, Map<number, number>>()
  for (const [pos, , keystone, secondary, g] of counts.keystones) {
    if (position && pos !== position) continue
    const style = treeOf.get(keystone)
    if (!style || !secondary) continue
    const m = paired.get(style) ?? new Map<number, number>()
    bump(m, secondary, g)
    paired.set(style, m)
  }
  const taken = new Map<number, number>()
  for (const [pos, rune, , g] of counts.minors) {
    if (position && pos !== position) continue
    bump(taken, rune, g)
  }
  const treeView = (style: number, g: number): RuneTreeView => {
    const [pair] = topOf(paired.get(style) ?? new Map<number, number>(), 1)
    const pairedGames = [...(paired.get(style)?.values() ?? [])].reduce((n, x) => n + x, 0)
    const minorRows = (styles[style]?.rows ?? []).slice(1).map((row) => {
      const total = row.reduce((n, rune) => n + (taken.get(rune) ?? 0), 0)
      return row.map((rune) => ({
        rune,
        share: total ? round((taken.get(rune) ?? 0) / total) : 0,
      }))
    })
    return {
      style,
      share: games ? round(g / games) : 0,
      paired: pair && pairedGames ? { style: pair[0], share: round(pair[1] / pairedGames) } : null,
      rows: minorRows.some((row) => row.some((r) => r.share > 0)) ? minorRows : [],
    }
  }
  const shardRows = [0, 1, 2].map(() => new Map<number, number>())
  for (const [pos, row, shard, g] of counts.shards) {
    if (position && pos !== position) continue
    if (row >= 0 && row < 3 && shard) bump(shardRows[row], shard, g)
  }
  const pages = [...pagesOf.values()]
    .flat()
    .filter(([, g]) => g >= MIN_MAIN_GAMES)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([ids, g, w]) => ({
      keystone: ids[1],
      page: pageOf(ids),
      games: g,
      win: round(w / g),
      share: games ? round(g / games) : 0,
    }))

  return {
    games,
    rows,
    trees: topOf(trees, trees.size).map(([style, g]) => treeView(style, g)),
    shards: shardRows.map((m) => {
      const total = [...m.values()].reduce((n, g) => n + g, 0)
      return topOf(m, m.size).map(([shard, g]) => ({ shard, share: total ? round(g / total) : 0 }))
    }),
    pages,
    minGames,
    minDeltaGames: MIN_DELTA_GAMES,
  }
}

/** Each keystone's tree, from the rune trees (each tree's first row holds its keystones). */
export function keystoneTrees(styles: Record<number, { rows: number[][] }>) {
  const out = new Map<number, number>()
  for (const [style, tree] of Object.entries(styles)) {
    for (const keystone of tree.rows[0] ?? []) out.set(keystone, Number(style))
  }
  return out
}
