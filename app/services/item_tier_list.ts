import { POSITIONS, type Position } from '#services/champion_stats'
import { RANKED_SOLO, round } from '#services/ranked_stats'
import type { DdItem, ItemKinds } from '#services/build_stats'
import {
  bump,
  delta,
  gate,
  placeTiers,
  seedTierJoinSql,
  tierIndex,
  topOf,
  type ChampionClass,
} from '#services/tier_lists'

/**
 * The item tier list (`/tier-list/items`), the pure half of `tier_lists_service.ts`: one read of
 * the purchase order the crawler stores (`participant_items`) for every champion in every role,
 * then the views a role and an item class ask for.
 *
 * An item is counted where players finish it among their first three legendary items: the
 * 4th to 6th item is bought by players already ahead, so its win rate says more about the game
 * than about the item. Each item carries the slot it is finished in, who builds it, and the
 * order its components are bought in. Boots are counted apart, with when they are finished.
 */

/** The legendary items counted per player: the first three, the core of a build. */
export const CORE_SLOTS = 3

/** When tier-2 boots are finished: before the 1st legendary item, after the 1st, 2nd, 3rd (or later), never. */
export const BOOTS_TIMING = ['before', 'first', 'second', 'third', 'never'] as const

/** A class's items: the classes behind at least this share of an item's games (its top one always). */
const CLASS_SHARE = 0.25

/** An item is listed from this share of the role's games (and `MIN_ITEM_GAMES`). */
const ITEM_SHARE = 0.001
const MIN_ITEM_GAMES = 50
/** A win rate is pulled toward its class's average by this many games before it is ranked. */
const PRIOR_GAMES = 1000
/** "Since the patch before" needs this many games on both patches. */
const MIN_DELTA_GAMES = 200

/** Data Dragon's `item.json` entry, with the fields the item tier list shows. */
export interface DdItemDetail extends DdItem {
  name?: string
  description?: string
}

/** Ids as `purchases` stores them (UInt16): anything else never matches. */
const ids = (list: Iterable<number>) =>
  [...new Set([...list].map(Math.trunc))].filter((id) => id > 0 && id < 65536).sort((a, b) => a - b)

const inList = (expr: string, list: number[]) =>
  list.length ? `${expr} IN (${list.join(',')})` : '0'

/** Each legendary item's direct components (Data Dragon's `from`), each id once. */
export function recipesOf(items: Record<string, DdItem>, legendary: number[]) {
  const out: Record<number, number[]> = {}
  for (const id of legendary) {
    const from = ids((items[id]?.from ?? []).map(Number))
    if (from.length) out[id] = from
  }
  return out
}

/** The kinds of `itemRowsSql`'s rows. */
export const ITEM_KINDS = { slot: 1, boots: 2, order: 3, games: 4 } as const

/**
 * Every player of one role (`{position:String}`) in one patch's crawled games (`{patch:String}`),
 * in one pass: rows of seed tier, kind (`ITEM_KINDS`), champion, item, slot, components, games,
 * wins. Kinds:
 * - `slot`: the champion finished `item` as its `slot`-th legendary item (1 to 3).
 * - `boots`: its first finished boots (`item`, 0 without) and when (`slot`: `BOOTS_TIMING`'s index).
 * - `order`: one of the first three legendary items (`item`, any champion) and its components
 *   in the order first bought since the legendary item before (`components`), when every one of
 *   them was bought in that window.
 * - `games`: the champion's games in the role.
 *
 * A row per seed tier: any rank bracket is a sum of them, and a range of patches a sum of
 * patches, so one read per patch and role serves every filter of the region. Every key is a
 * number (the components grouped by their hash): a patch's players are tens of millions of rows.
 */
export function itemRowsSql(
  region: string | null,
  kinds: ItemKinds,
  recipes: Record<number, number[]>
) {
  const legendary = ids(kinds.legendary)
  const boots = ids(kinds.boots)
  const entries = Object.entries(recipes)
    .map(([item, parts]) => [Number(item), ids(parts)] as const)
    .filter(([item, parts]) => item > 0 && item < 65536 && parts.length)
  const recipeMap = `CAST(map(${entries.map(([item, parts]) => `${item}, [${parts.join(',')}]`).join(', ')}), 'Map(UInt16, Array(UInt16))')`
  const none = 'CAST([] AS Array(UInt16))'
  const k = ITEM_KINDS
  // The components of the k-th core item bought since the (k-1)-th, each once, first bought first.
  const window = `arrayFilter(x -> has(recipes[purchases[n]], x), arraySlice(purchases, if(k = 1, 1, core[k - 1] + 1), n - if(k = 1, 1, core[k - 1] + 1)))`
  return `
    WITH ${recipeMap} AS recipes
    SELECT tier, o.1, o.2, o.3, o.4, any(o.5), count(), sum(win)
    FROM (
      SELECT s.seed_tier AS tier, p.champion_id AS champion, p.win AS win, p.purchases AS purchases,
        arrayFilter(n -> ${inList('purchases[n]', legendary)} AND indexOf(purchases, purchases[n]) = n,
                    arrayEnumerate(purchases)) AS legs,
        arraySlice(legs, 1, ${CORE_SLOTS}) AS core,
        arrayFirstIndex(i -> ${inList('i', boots)}, purchases) AS bpos
      FROM (
        SELECT match_id, champion_id, win, purchases FROM participant_items FINAL
        WHERE patch = {patch:String} AND queue_id = ${RANKED_SOLO} AND team_position = {position:String}
      ) AS p
      ${seedTierJoinSql(region)}
    )
    ARRAY JOIN arrayConcat(
      arrayMap((n, k) -> tuple(${k.slot}, champion, purchases[n], toUInt8(k), ${none}), core, arrayEnumerate(core)),
      [tuple(${k.boots}, champion, if(bpos = 0, toUInt16(0), purchases[bpos]),
             toUInt8(if(bpos = 0, 4, least(length(arrayFilter(n -> n < bpos, legs)), 3))), ${none})],
      arrayFilter(t -> length(t.5) > 0 AND length(t.5) = length(recipes[t.3]),
        arrayMap((n, k) -> tuple(${k.order}, toUInt16(0), purchases[n], toUInt8(0),
          arrayMap(w -> arrayFilter((x, j) -> indexOf(w, x) = j, w, arrayEnumerate(w)), [${window}])[1]),
          core, arrayEnumerate(core))),
      [tuple(${k.games}, champion, toUInt16(0), toUInt8(0), ${none})]
    ) AS o
    GROUP BY tier, o.1, o.2, o.3, o.4, cityHash64(o.5)
  `
}

/** One row of `itemRowsSql`: seed tier, kind, champion, item, slot, components, games, wins. */
export type ItemRow = [string, number, number, number, number, number[], number, number]

/** One patch's counts of one role, per seed tier (`SEED_TIERS`' index first), cached as they are. */
export interface ItemBlob {
  /** Tier, champion, games, wins. */
  champions: [number, number, number, number][]
  /** Tier, champion, item, slot (1 to 3), games, wins. */
  slots: [number, number, number, number, number, number][]
  /** Tier, champion, boots (0 without), timing (`BOOTS_TIMING`'s index), games. */
  boots: [number, number, number, number, number][]
  /** Tier, item, components in the order bought, games. */
  orders: [number, number, number[], number][]
}

/** `itemRowsSql`'s rows as a blob (rows of an unknown tier are left out). */
export function itemBlob(rows: ItemRow[]): ItemBlob {
  const out: ItemBlob = { champions: [], slots: [], boots: [], orders: [] }
  for (const [name, kind, champion, item, slot, parts, games, wins] of rows) {
    const t = tierIndex(name)
    if (t < 0) continue
    if (kind === ITEM_KINDS.games) out.champions.push([t, champion, games, wins])
    else if (kind === ITEM_KINDS.slot) out.slots.push([t, champion, item, slot, games, wins])
    else if (kind === ITEM_KINDS.boots) out.boots.push([t, champion, item, slot, games])
    else if (kind === ITEM_KINDS.order) out.orders.push([t, item, parts, games])
  }
  return out
}

/** The counts of one role, per champion: a filter's sum of patches and seed tiers. */
export interface RoleItemCounts {
  /** Champion, games, wins: every champion's games in the role. */
  champions: [number, number, number][]
  /** Champion, item, slot (1 to 3), games, wins. */
  slots: [number, number, number, number, number][]
  /** Champion, boots (0 without), timing (`BOOTS_TIMING`'s index), games. */
  boots: [number, number, number, number][]
  /** Item, components in the order bought, games. */
  orders: [number, number[], number][]
}

/** The counts of a filter: each role's. */
export interface ItemCounts {
  roles: Partial<Record<Position, RoleItemCounts>>
}

/** Sums rows by their key (every column but the last `sums`). */
function sumBy<R extends unknown[]>(rows: Iterable<R>, sums: number): R[] {
  const out = new Map<string, R>()
  for (const r of rows) {
    const at = JSON.stringify(r.slice(0, r.length - sums))
    const was = out.get(at)
    if (!was) out.set(at, [...r] as R)
    else for (let i = r.length - sums; i < r.length; i++) (was[i] as number) += r[i] as number
  }
  return [...out.values()]
}

/** One role's counts for a filter: its patches' blobs summed over the bracket's seed tiers. */
export function roleItemCounts(blobs: ItemBlob[], tiers: Set<number>): RoleItemCounts {
  const keep = <R extends unknown[]>(list: R[]) =>
    list.filter((r) => tiers.has(r[0] as number)).map((r) => r.slice(1))
  return {
    champions: sumBy(blobs.flatMap((b) => keep(b.champions)) as [number, number, number][], 2),
    slots: sumBy(
      blobs.flatMap((b) => keep(b.slots)) as [number, number, number, number, number][],
      2
    ),
    boots: sumBy(blobs.flatMap((b) => keep(b.boots)) as [number, number, number, number][], 1),
    orders: sumBy(blobs.flatMap((b) => keep(b.orders)) as [number, number[], number][], 1),
  }
}

/** An item as the tier list shows it. */
export interface ItemTierRow {
  item: number
  /** Games it was finished in among the first three legendary items, and their win rate. */
  games: number
  win: number
  /** Share of the role's games it was finished in (first three items). */
  pick: number
  /** 0 S+ … 5 D among the items of the view; null under the view's `minGames`. */
  tier: number | null
  /** Share of its games it was the 1st, 2nd and 3rd legendary item. */
  slots: [number, number, number]
  /** Who builds it most: champion and games, most first. */
  champions: { champion: number; games: number }[]
  /** How many champions built it in the view. */
  championCount: number
  /** The champion classes behind its games (`CLASS_SHARE` or more, its top one always). */
  classes: ChampionClass[]
  /** Change of its win rate since the patch before (0.012 is 1.2 points); null without enough games. */
  delta: number | null
}

/** What a class's champions build in the role, in order (the "build" card). */
export interface ItemBuildCard {
  class: ChampionClass | null
  /** Champions of the class that played the role, and their games. */
  champions: number
  games: number
  /** Per core slot (1st, 2nd, 3rd item): the most finished items with their share of the games. */
  slots: { item: number; share: number }[][]
  /** The most finished boots, with their share of the games. */
  boots: { item: number; share: number }[]
  /** When the boots are finished (`BOOTS_TIMING`), shares of the games. */
  timing: Record<(typeof BOOTS_TIMING)[number], number>
}

export interface ItemView {
  /** The role's games (every role: every player's game). */
  games: number
  rows: ItemTierRow[]
  build: ItemBuildCard
  /** Per listed item, its components in the order most bought, and the games of that order. */
  orders: Record<number, { components: number[]; games: number; of: number }>
  /** Games an item needs to be listed and ranked, and to show a change since the patch before. */
  minGames: number
  minDeltaGames: number
}

/** The counts of one role, or every role summed (`null`). */
function roleCounts(counts: ItemCounts, position: Position | null) {
  const list = position ? [counts.roles[position]] : POSITIONS.map((p) => counts.roles[p])
  return list.filter((r): r is NonNullable<typeof r> => Boolean(r))
}

/** Per item: games, wins, games by slot, games by champion. */
function perItem(counts: ItemCounts, position: Position | null) {
  const out = new Map<
    number,
    { games: number; wins: number; slots: [number, number, number]; by: Map<number, number> }
  >()
  for (const role of roleCounts(counts, position)) {
    for (const [champion, item, slot, games, wins] of role.slots) {
      const i = out.get(item) ?? { games: 0, wins: 0, slots: [0, 0, 0], by: new Map() }
      i.games += games
      i.wins += wins
      if (slot >= 1 && slot <= CORE_SLOTS) i.slots[slot - 1] += games
      bump(i.by, champion, games)
      out.set(item, i)
    }
  }
  return out
}

/**
 * The view of a role (`null`: every role) and an item class (`null`: every item): its items
 * ranked against each other, what the class's champions build in order, and the components'
 * order. `previous` is the patch before's counts (same filter), for the change of each item.
 */
export function itemView(
  counts: ItemCounts,
  previous: ItemCounts | null,
  position: Position | null,
  cls: ChampionClass | null,
  classes: Map<number, ChampionClass>,
  kinds: Pick<ItemKinds, 'legendary'>
): ItemView {
  const roles = roleCounts(counts, position)
  const games = roles.reduce((n, r) => n + r.champions.reduce((m, c) => m + c[1], 0), 0)
  const minGames = gate(games, ITEM_SHARE, MIN_ITEM_GAMES)
  const legendary = new Set(kinds.legendary)
  const now = perItem(counts, position)
  const was = previous ? perItem(previous, position) : new Map()

  const all = [...now]
    .filter(([item, i]) => legendary.has(item) && i.games >= minGames)
    .map(([item, i]) => {
      const byClass = new Map<ChampionClass, number>()
      for (const [champion, g] of i.by) {
        const c = classes.get(champion)
        if (c) bump(byClass, c, g)
      }
      const sorted = topOf(byClass, byClass.size)
      const itemClasses = sorted
        .filter(([, g], k) => k === 0 || g >= i.games * CLASS_SHARE)
        .map(([c]) => c)
      return { item, i, classes: itemClasses }
    })
  const shown = cls ? all.filter((r) => r.classes.includes(cls)) : all
  const tiers = placeTiers(
    shown.map((r) => ({ ...r, games: r.i.games, wins: r.i.wins })),
    minGames,
    PRIOR_GAMES
  )
  const rows: ItemTierRow[] = [...tiers].map(([r, tier]) => ({
    item: r.item,
    games: r.i.games,
    win: round(r.i.wins / r.i.games),
    pick: games ? round(r.i.games / games) : 0,
    tier,
    slots: r.i.slots.map((g) => round(g / r.i.games)) as [number, number, number],
    champions: topOf(r.i.by, 5).map(([champion, g]) => ({ champion, games: g })),
    championCount: r.i.by.size,
    classes: r.classes,
    delta: delta(r.i, was.get(r.item), MIN_DELTA_GAMES),
  }))
  rows.sort((a, b) => (a.tier ?? 9) - (b.tier ?? 9) || b.games - a.games)

  // Component orders, every champion of the view.
  const orders = new Map<number, Map<string, number>>()
  for (const role of roles) {
    for (const [item, parts, g] of role.orders) {
      const byOrder = orders.get(item) ?? new Map<string, number>()
      bump(byOrder, parts.join(','), g)
      orders.set(item, byOrder)
    }
  }
  const listed = new Set(rows.map((r) => r.item))
  const orderOf: ItemView['orders'] = {}
  for (const [item, byOrder] of orders) {
    if (!listed.has(item)) continue
    const [best] = topOf(byOrder, 1)
    if (!best) continue
    const of = [...byOrder.values()].reduce((n, g) => n + g, 0)
    orderOf[item] = { components: best[0].split(',').map(Number), games: best[1], of }
  }

  return {
    games,
    rows,
    build: buildCard(roles, cls, classes),
    orders: orderOf,
    minGames,
    minDeltaGames: MIN_DELTA_GAMES,
  }
}

/** What the champions of `cls` (every champion: `null`) build in the role's games, in order. */
function buildCard(
  roles: ReturnType<typeof roleCounts>,
  cls: ChampionClass | null,
  classes: Map<number, ChampionClass>
): ItemBuildCard {
  const mine = (champion: number) => !cls || classes.get(champion) === cls
  const champions = new Set<number>()
  let games = 0
  const slots = [0, 1, 2].map(() => new Map<number, number>())
  const boots = new Map<number, number>()
  const timing = BOOTS_TIMING.map(() => 0)
  for (const role of roles) {
    for (const [champion, g] of role.champions) {
      if (!mine(champion)) continue
      champions.add(champion)
      games += g
    }
    for (const [champion, item, slot, g] of role.slots) {
      if (mine(champion) && slot >= 1 && slot <= CORE_SLOTS) bump(slots[slot - 1], item, g)
    }
    for (const [champion, item, when, g] of role.boots) {
      if (!mine(champion)) continue
      if (item) bump(boots, item, g)
      if (when >= 0 && when < timing.length) timing[when] += g
    }
  }
  const share = (g: number) => (games ? round(g / games) : 0)
  const timed = timing.reduce((n, g) => n + g, 0)
  return {
    class: cls,
    champions: champions.size,
    games,
    slots: slots.map((s) => topOf(s, 4).map(([item, g]) => ({ item, share: share(g) }))),
    boots: topOf(boots, 4).map(([item, g]) => ({ item, share: share(g) })),
    timing: Object.fromEntries(
      BOOTS_TIMING.map((k, i) => [k, timed ? round(timing[i] / timed) : 0])
    ) as ItemBuildCard['timing'],
  }
}

/** A recipe as a tree: the item, its price, and what it is built from. */
export interface RecipeNode {
  item: number
  gold: number
  from: RecipeNode[]
}

/** What an item gives, from Data Dragon's description: its stats, then its passives and actives. */
export interface ItemText {
  name: string
  gold: number
  recipe: RecipeNode
  stats: { value: string; stat: string }[]
  effects: { kind: 'passive' | 'active'; name: string; text: string }[]
}

/** The recipe tree of `item`, three levels at most (Data Dragon's `from`, in its order). */
export function recipeTree(items: Record<string, DdItem>, item: number, depth = 3): RecipeNode {
  const it = items[item]
  return {
    item,
    gold: it?.gold?.total ?? 0,
    from: depth > 1 ? (it?.from ?? []).map((c) => recipeTree(items, Number(c), depth - 1)) : [],
  }
}

const strip = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Data Dragon's item description (`<stats>…</stats>`, then `<passive>Name</passive><br>text`
 * blocks) as plain stat lines and effects.
 */
export function itemText(items: Record<string, DdItemDetail>, item: number): ItemText {
  const it = items[item] ?? {}
  const description = it.description ?? ''
  const statsBlock = /<stats>([\s\S]*?)<\/stats>/i.exec(description)?.[1] ?? ''
  const stats = statsBlock
    .split(/<br\s*\/?>/i)
    .map((line) => {
      const value = /<attention>([\s\S]*?)<\/attention>/i.exec(line)?.[1]
      const text = strip(line.replace(/<attention>[\s\S]*?<\/attention>/i, ''))
      return value !== undefined && text ? { value: strip(value), stat: text } : null
    })
    .filter((s): s is { value: string; stat: string } => s !== null)
  const effects: ItemText['effects'] = []
  const rest = description.replace(/<stats>[\s\S]*?<\/stats>/i, '')
  const pattern =
    /<(passive|active)>([\s\S]*?)<\/\1>([\s\S]*?)(?=<(?:passive|active)>|<\/mainText>|$)/gi
  for (const m of rest.matchAll(pattern)) {
    const text = strip(m[3])
    effects.push({ kind: m[1].toLowerCase() as 'passive' | 'active', name: strip(m[2]), text })
  }
  return {
    name: it.name ?? '',
    gold: it.gold?.total ?? 0,
    recipe: recipeTree(items, item),
    stats,
    effects,
  }
}
