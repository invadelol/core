/**
 * A build the desktop app shares as an invade.lol link (the app's `builds/link.rs`). Version 1,
 * which 0.3.4 writes, and the app still writes for a build that fits it:
 *
 *   /desktop/build/1/shyvana/jungle/1101,2003-3006-6672,2510,3053-6665,3075-3143?n=Kraken
 *                  │ │       │      │           │    │                │         └ 5th item
 *                  │ │       │      │           │    │                └ 4th item, then its alternatives
 *                  │ │       │      │           │    └ core, in buy order
 *                  │ │       │      │           └ boots (empty: none)
 *                  │ │       │      └ starting items
 *                  │ │       └ role: top, jungle, mid, adc, support
 *                  │ └ champion: its Data Dragon id, lower case
 *                  └ format version
 *
 * Version 2 holds every row of a build, each group led by its row's letter, empty rows left out:
 *
 *   /desktop/build/2/zac/jungle/s1101,2003.1102-e1082-b3047,3111-c6665,3068-l3075,3143-l4401-o3110-x2138-t3364-mqew
 *     s starting sets (`.` between sets)   e early buys   b boots   c core   l a later slot (repeated)
 *     o situational   x elixirs   t trinkets   m max order of Q, W and E
 *
 * Everything is checked on the way in, as the app does: the version, the champion and every
 * item against the live game data, the role, the size of each row, each item once per row. The
 * name is the player's own text: cleaned, capped, and never put in markup by hand.
 */

export const SITE = 'https://invade.lol'
export const MAX_NAME = 40
const MAX_STARTS = 4
const MAX_START = 6
const MAX_ROW = 16
/** Core and later slots: an inventory's six items. */
const MAX_ROUTE = 6
/** Version 1's rows: three core items, three later slots of up to three items. */
const V1_ROW = 3
/** Longer input is not a link the app made. */
const MAX_LEN = 2000
const MAX_ORDERS = ['QWE', 'QEW', 'WQE', 'WEQ', 'EQW', 'EWQ']

export type BuildLane = 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT'

const LANES: Record<string, BuildLane> = {
  top: 'TOP',
  jungle: 'JUNGLE',
  mid: 'MID',
  middle: 'MID',
  adc: 'ADC',
  bot: 'ADC',
  bottom: 'ADC',
  support: 'SUPPORT',
  utility: 'SUPPORT',
}

/** The role as the link writes it. */
const SEGMENT: Record<BuildLane, string> = {
  TOP: 'top',
  JUNGLE: 'jungle',
  MID: 'mid',
  ADC: 'adc',
  SUPPORT: 'support',
}

export const LANE_LABELS: Record<BuildLane, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MID: 'Mid',
  ADC: 'Bot',
  SUPPORT: 'Support',
}

/** Every row of a build, as the app keeps it (`builds::Items`). */
export interface BuildItems {
  /** Starting sets: the one to start with, then alternatives. */
  start: number[][]
  /** Dark Seal, Cull, Tear: bought before the first item. */
  early: number[]
  /** The route's boots, then alternatives. */
  boots: number[]
  core: number[]
  /** The slots after the core: the route's pick first, then its alternatives. */
  later: number[][]
  situational: number[]
  elixirs: number[]
  trinkets: number[]
  /** Max order of Q, W and E (`QEW`), `''`: the most popular one. */
  max: string
}

/** The route as the page and the card draw it: the first starting set and boots, the core, the later slots. */
export interface BuildRoute {
  start: number[]
  boots: number | null
  core: number[]
  later: number[][]
}
export const routeOf = (items: BuildItems): BuildRoute => ({
  start: items.start[0] ?? [],
  boots: items.boots[0] ?? null,
  core: items.core,
  later: items.later,
})

const emptyItems = (): BuildItems => ({
  start: [],
  early: [],
  boots: [],
  core: [],
  later: [],
  situational: [],
  elixirs: [],
  trinkets: [],
  max: '',
})

/** A link read without game data: its shape only. */
export interface BuildLink {
  /** Lower case Data Dragon id (`monkeyking`). */
  champion: string
  lane: BuildLane
  name: string
  items: BuildItems
}

/** A name as the app keeps it: control characters out, spaces collapsed, at most 40 characters. */
export function cleanName(raw: unknown) {
  if (typeof raw !== 'string') return ''
  const words = raw
    .slice(0, 400)
    .split(/[\s\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/u)
    .filter(Boolean)
  return [...words.join(' ')].slice(0, MAX_NAME).join('').trimEnd()
}

function ids(group: string): number[] | null {
  if (!group) return []
  const out: number[] = []
  for (const id of group.split(',')) {
    if (!/^[1-9]\d{0,5}$/.test(id)) return null
    out.push(Number(id))
  }
  return out
}

const unique = (list: number[]) => new Set(list).size === list.length

/** Version 1: starting items, boots, core, later slots, with version 1's own limits. */
function itemsV1(groups: string): BuildItems | null {
  const parts = groups.split('-')
  if (parts.length > 3 + V1_ROW) return null
  const lists: number[][] = []
  for (const part of parts) {
    const list = ids(part)
    if (!list) return null
    lists.push(list)
  }
  const [start = [], boots = [], core = [], ...rest] = lists
  const later = rest.filter((o) => o.length)
  if (start.length > MAX_START || boots.length > 1 || core.length > V1_ROW) return null
  if (later.some((o) => o.length > V1_ROW)) return null
  return { ...emptyItems(), start: start.length ? [start] : [], boots, core, later }
}

/** Version 2: each group its row's letter then its items; later slots repeat `l`. */
function itemsV2(groups: string): BuildItems | null {
  const items = emptyItems()
  const seen = new Set<string>()
  const rows = {
    e: 'early',
    b: 'boots',
    c: 'core',
    o: 'situational',
    x: 'elixirs',
    t: 'trinkets',
  } as const
  for (const group of groups.split('-')) {
    const letter = group.charAt(0)
    const body = group.slice(1)
    if (!body || (letter !== 'l' && seen.has(letter))) return null
    seen.add(letter)
    if (letter === 's') {
      for (const set of body.split('.')) {
        const list = ids(set)
        if (!list?.length) return null
        items.start.push(list)
      }
    } else if (letter === 'l') {
      const list = ids(body)
      if (!list) return null
      items.later.push(list)
    } else if (letter === 'm') {
      if (!MAX_ORDERS.includes(body.toUpperCase())) return null
      items.max = body.toUpperCase()
    } else if (Object.hasOwn(rows, letter)) {
      const list = ids(body)
      if (!list) return null
      items[rows[letter as keyof typeof rows]] = list
    } else return null
  }
  return items
}

/** The link's shape, or `null` for anything the app would not have made. */
export function parseBuildLink(
  version: unknown,
  champion: unknown,
  role: unknown,
  groups: unknown,
  name?: unknown
): BuildLink | null {
  if ((version !== '1' && version !== '2') || typeof champion !== 'string') return null
  if (typeof role !== 'string' || typeof groups !== 'string' || groups.length > MAX_LEN) return null
  if (!/^[a-z0-9]{1,32}$/i.test(champion)) return null
  const lane = Object.hasOwn(LANES, role.toLowerCase()) ? LANES[role.toLowerCase()] : null
  if (!lane) return null
  const items = version === '1' ? itemsV1(groups) : itemsV2(groups)
  if (!items || !items.core.length) return null
  const rows = [
    items.early,
    items.boots,
    items.core,
    items.situational,
    items.elixirs,
    items.trinkets,
    ...items.later,
  ]
  if (items.start.length > MAX_STARTS || items.start.some((s) => s.length > MAX_START)) return null
  if (items.core.length + items.later.length > MAX_ROUTE) return null
  if (rows.some((r) => r.length > MAX_ROW || !unique(r))) return null
  return { champion: champion.toLowerCase(), lane, name: cleanName(name), items }
}

/** What 0.3.4 reads: its rows, its sizes, the route holding each item once. */
function fitsV1(i: BuildItems) {
  const route = [...i.core, ...i.later.map((o) => o[0])]
  return (
    i.start.length <= 1 &&
    i.boots.length <= 1 &&
    !i.early.length &&
    !i.situational.length &&
    !i.elixirs.length &&
    !i.trinkets.length &&
    !i.max &&
    i.core.length <= V1_ROW &&
    i.later.length <= V1_ROW &&
    i.later.every(
      (o) => o.length <= V1_ROW && unique(o) && !o.slice(1).some((id) => route.includes(id))
    ) &&
    unique(route)
  )
}

/** The link's version and item groups, as the app writes them: version 1 when the build fits it. */
export function groupsOf(items: BuildItems): { version: 1 | 2; groups: string } {
  if (fitsV1(items)) {
    const groups = [
      (items.start[0] ?? []).join(','),
      items.boots.length ? String(items.boots[0]) : '',
      items.core.join(','),
      ...items.later.map((o) => o.join(',')),
    ]
    while (groups.length && !groups[groups.length - 1]) groups.pop()
    return { version: 1, groups: groups.join('-') }
  }
  const groups = [
    ['s', items.start.map((set) => set.join(',')).join('.')],
    ['e', items.early.join(',')],
    ['b', items.boots.join(',')],
    ['c', items.core.join(',')],
    ...items.later.map((o) => ['l', o.join(',')]),
    ['o', items.situational.join(',')],
    ['x', items.elixirs.join(',')],
    ['t', items.trinkets.join(',')],
    ['m', items.max.toLowerCase()],
  ]
  return {
    version: 2,
    groups: groups
      .filter(([, body]) => body)
      .map(([letter, body]) => letter + body)
      .join('-'),
  }
}

/** Every item of the build, once. */
export const allItems = (items: BuildItems) => [
  ...new Set([
    ...items.start.flat(),
    ...items.early,
    ...items.boots,
    ...items.core,
    ...items.later.flat(),
    ...items.situational,
    ...items.elixirs,
    ...items.trinkets,
  ]),
]

/** The path of the build's page or picture, with its name: `/desktop/build/1/ahri/mid/…?n=…`. */
export function buildPath(prefix: string, link: BuildLink, extra = '') {
  const { version, groups } = groupsOf(link.items)
  const path = `${prefix}/${version}/${link.champion}/${SEGMENT[link.lane]}/${groups}${extra}`
  const query = new URLSearchParams()
  if (link.name) query.set('n', link.name)
  return { path, query }
}

export const withQuery = (path: string, query: URLSearchParams) => {
  const q = query.toString().replace(/\+/g, '%20')
  return q ? `${path}?${q}` : path
}
