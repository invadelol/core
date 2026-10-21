import {
  RANKED_SOLO,
  ranked,
  round,
  scopeSql,
  seedTiers,
  type Bracket,
  type Counted,
  type Scope,
} from '#services/ranked_stats'

/**
 * Item builds players really buy, per champion and role, from the purchase order the crawler
 * stores (`participant_items`: every purchase of a ranked game, in order, with its game time).
 * The pure half of `build_stats_service.ts`: the item kinds, the query and the counting.
 *
 * Shaped like the app's build (docs/data-pipeline.md in the app): starting items, tier-2 boots,
 * a core of the first three legendary items (a set: its permutations are one core, shown in the
 * order most played), the options of the 4th, 5th and 6th item, and every legendary item the
 * champion finishes (the situational options). Each option carries games, win rate, share,
 * evidence level and tie flag, as the rune pages do.
 */

/**
 * Purchases before this game time (seconds) are the starting items: nearly all are made in the
 * first 20 seconds, and the next ones only come at the first back, after a minute.
 */
export const START_SEC = 60
const TOP_OPTIONS = 5
const TOP_ITEMS = 12

const BASIC_BOOTS = 1001

/** Data Dragon's `item.json` entry, the fields read. */
export interface DdItem {
  from?: string[]
  into?: string[]
  gold?: { total?: number; purchasable?: boolean }
  tags?: string[]
  maps?: Record<string, boolean>
}

/** The item ids the counting tells apart, from one patch's Data Dragon items. */
export interface ItemKinds {
  /** Finished items that are not boots: what a core and the later slots hold. */
  legendary: number[]
  /** Finished boots (tier 2). */
  boots: number[]
  /** Never a starting item: the trinkets every player holds. */
  trinkets: number[]
  /** Total price, to show the main starting item before the potions. */
  gold: Record<number, number>
}

/**
 * Summoner's Rift items, as the app tells them apart (`engine/build.rs`): boots are Boots and
 * what is built from them; an item is finished when nothing on the Rift builds out of it and it
 * has a recipe or costs 1600 or more (starters, consumables and trinkets never are).
 */
export function itemKinds(items: Record<string, DdItem>): ItemKinds {
  const rift = new Map<number, DdItem>()
  for (const [id, it] of Object.entries(items)) {
    if (it.maps?.['11'] && it.gold?.purchasable) rift.set(Number(id), it)
  }
  const contains = (id: number, target: number, depth = 6): boolean =>
    depth > 0 &&
    (rift.get(id)?.from ?? []).some(
      (c) => Number(c) === target || contains(Number(c), target, depth - 1)
    )
  const isBoots = (id: number) => id === BASIC_BOOTS || contains(id, BASIC_BOOTS)
  const tagged = (it: DdItem, tag: string) => it.tags?.includes(tag) ?? false
  const kinds: ItemKinds = { legendary: [], boots: [], trinkets: [], gold: {} }
  for (const [id, it] of rift) {
    kinds.gold[id] = it.gold?.total ?? 0
    if (tagged(it, 'Trinket')) kinds.trinkets.push(id)
    if (id === BASIC_BOOTS || tagged(it, 'Trinket') || tagged(it, 'Consumable')) continue
    const into = (it.into ?? []).filter((c) => rift.has(Number(c)))
    const finished =
      into.length === 0 && ((it.from ?? []).length > 0 || (it.gold?.total ?? 0) >= 1600)
    if (isBoots(id)) kinds.boots.push(id)
    else if (finished) kinds.legendary.push(id)
  }
  for (const list of [kinds.legendary, kinds.boots, kinds.trinkets]) list.sort((a, b) => a - b)
  return kinds
}

const ids = (list: number[]) =>
  `CAST([${list.map((id) => Math.trunc(id)).join(',')}] AS Array(UInt16))`

/**
 * One row per option and how often it was played, for the players in `scope`:
 * `kind` (`start`, `boots`, `core`, `slot`, `item`, `games`), the item ids, the slot (4th item
 * = 1 …), games, wins. Every champion and role at once (`scope` null) prefixes each row with
 * the champion and Riot's position.
 */
export function buildRowsSql(bracket: Bracket, scope: Scope, kinds: ItemKinds) {
  const tiers = seedTiers(bracket)
  const by = scope ? '' : 'champion_id, team_position, '
  // Per player: starting items (a multiset), the legendary items in the order first bought,
  // the first finished boots (0 without).
  const players = `
      SELECT ${by}win,
        arraySort(arrayFilter((i, s) -> s < ${START_SEC} AND NOT has(${ids(kinds.trinkets)}, i), purchases, purchase_sec)) AS opening,
        arrayFilter(i -> has(${ids(kinds.legendary)}, i), purchases) AS bought,
        arrayFilter((i, n) -> indexOf(bought, i) = n, bought, arrayEnumerate(bought)) AS legs,
        arrayFilter(i -> has(${ids(kinds.boots)}, i), purchases)[1] AS boots
      FROM participant_items FINAL
      WHERE patch = {patch:String} AND queue_id = ${RANKED_SOLO} ${scopeSql(scope)}
      ${tiers ? `AND match_id IN (SELECT match_id FROM match_seed WHERE patch = {patch:String} AND seed_tier IN (${tiers}))` : ''}
    `
  const none = 'CAST([] AS Array(UInt16))'
  return `
          WITH g AS (${players})
          SELECT ${by}'start', opening, 0, count(), sum(win) FROM g WHERE length(opening) > 0 GROUP BY ALL
          UNION ALL
          SELECT ${by}'boots', [boots], 0, count(), sum(win) FROM g WHERE boots != 0 GROUP BY ALL
          UNION ALL
          SELECT ${by}'core', arraySlice(legs, 1, 3), 0, count(), sum(win) FROM g WHERE length(legs) >= 3 GROUP BY ALL
          UNION ALL
          SELECT ${by}'slot', [item], slot, count(), sum(win) FROM g
          ARRAY JOIN arraySlice(legs, 4, 3) AS item, arrayEnumerate(arraySlice(legs, 4, 3)) AS slot
          GROUP BY ALL
          UNION ALL
          SELECT ${by}'item', [item], 0, count(), sum(win) FROM g ARRAY JOIN legs AS item GROUP BY ALL
          UNION ALL
          SELECT ${by}'games', ${none}, 0, count(), sum(win) FROM g GROUP BY ALL
        `
}

/** One row of the build query (the per-champion form): kind, items, slot, games, wins. */
export type BuildRow = [string, number[], number, number, number]

export interface ItemSetStat {
  /** In buy order (a core: the order most played); starting items: the main item first. */
  items: number[]
  games: number
  win: number
  /** Of the games that have this component at all (a core: games with three legendary items). */
  share: number
  /** 0..3, at most 2 when `tie`. */
  level: number
  /** Not clearly more played than the next option: the app shows "or …". */
  tie: boolean
}

export interface ItemStat {
  item: number
  games: number
  win: number
  /** Of the games reaching that slot; for `items`, of all the champion's games in the role. */
  share: number
  level: number
}

export interface BuildStats {
  champion: number
  role: string
  patch: string
  bracket: Bracket
  games: number
  win: number
  starters: ItemSetStat[]
  boots: ItemSetStat[]
  cores: ItemSetStat[]
  /** The options of the 4th, 5th and 6th legendary item. */
  slots: ItemStat[][]
  /** Every legendary item the champion finishes, most played first. */
  items: ItemStat[]
}

/** The build from the rows of one champion in one role, most played options first. */
export function summarizeBuilds(rows: BuildRow[], kinds: Pick<ItemKinds, 'gold'>) {
  const of = (kind: string) => rows.filter((r) => r[0] === kind)
  const total = (list: BuildRow[]) => list.reduce((n, r) => n + r[3], 0)
  const sets = (list: BuildRow[]) => {
    const options = list.map((r): Counted<number[]> => ({ value: r[1], games: r[3], wins: r[4] }))
    return ranked(options, total(list), TOP_OPTIONS).map(({ value, ...stat }) => ({
      items: value,
      ...stat,
    }))
  }
  const singles = (list: BuildRow[], games: number, top: number): ItemStat[] =>
    ranked(
      list.map((r) => ({ value: r[1][0], games: r[3], wins: r[4] })),
      games,
      top
    ).map((s) => ({ item: s.value, games: s.games, win: s.win, share: s.share, level: s.level }))

  const [games, wins] = of('games').reduce(([g, w], r) => [g + r[3], w + r[4]], [0, 0])
  const price = (id: number) => kinds.gold[id] ?? 0
  const starters = sets(of('start')).map((s) => ({
    ...s,
    items: [...s.items].sort((a, b) => price(b) - price(a) || a - b),
  }))

  // A core is a set: its orders are merged, the most played one stands for it.
  const cores = new Map<string, { order: number[]; best: number; games: number; wins: number }>()
  for (const [, items, , g, w] of of('core')) {
    const key = [...items].sort((a, b) => a - b).join(',')
    const core = cores.get(key) ?? { order: items, best: 0, games: 0, wins: 0 }
    if (g > core.best) Object.assign(core, { order: items, best: g })
    core.games += g
    core.wins += w
    cores.set(key, core)
  }
  const coreOptions = [...cores.values()].map((c) => ({
    value: c.order,
    games: c.games,
    wins: c.wins,
  }))

  const slots = [1, 2, 3].map((n) => {
    const list = of('slot').filter((r) => r[2] === n)
    return singles(list, total(list), TOP_OPTIONS)
  })

  return {
    games,
    win: games ? round(wins / games) : 0,
    starters,
    boots: sets(of('boots')),
    cores: ranked(coreOptions, total(of('core')), TOP_OPTIONS).map(({ value, ...stat }) => ({
      items: value,
      ...stat,
    })),
    slots: slots.some((s) => s.length) ? slots : [],
    items: singles(of('item'), games, TOP_ITEMS),
  }
}
