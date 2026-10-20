/**
 * A build the desktop app shares as an invade.lol link (the app's `builds/link.rs`):
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
 * Everything is checked on the way in, as the app does: the version, the champion and every
 * item against the live game data, the role, the size of each group, the route holding each item
 * once. The name is the player's own text: cleaned, capped, and never put in markup by hand.
 */

export const SITE = 'https://invade.lol'
export const MAX_NAME = 40
const MAX_START = 6
const MAX_CORE = 3
const MAX_LATER = 3
const MAX_OPTIONS = 3
/** Longer input is not a link the app made. */
const MAX_LEN = 600

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

export interface BuildItems {
  start: number[]
  boots: number | null
  core: number[]
  /** The 4th to 6th item: the route's pick first, then its alternatives. */
  later: number[][]
}

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

/** The link's shape, or `null` for anything the app would not have made. */
export function parseBuildLink(
  version: unknown,
  champion: unknown,
  role: unknown,
  groups: unknown,
  name?: unknown
): BuildLink | null {
  if (version !== '1' || typeof champion !== 'string' || typeof role !== 'string') return null
  if (typeof groups !== 'string' || groups.length > MAX_LEN) return null
  if (!/^[a-z0-9]{1,32}$/i.test(champion)) return null
  const lane = Object.hasOwn(LANES, role.toLowerCase()) ? LANES[role.toLowerCase()] : null
  if (!lane) return null
  const parts = groups.split('-')
  if (parts.length > 3 + MAX_LATER) return null
  const lists: number[][] = []
  for (const part of parts) {
    const list = ids(part)
    if (!list) return null
    lists.push(list)
  }
  const [start = [], boots = [], core = [], ...rest] = lists
  const later = rest.filter((o) => o.length)
  if (start.length > MAX_START || boots.length > 1 || core.length > MAX_CORE) return null
  if (!core.length || later.some((o) => o.length > MAX_OPTIONS)) return null
  const route = [...core, ...later.map((o) => o[0])]
  const unique = (list: number[]) => new Set(list).size === list.length
  if (!unique(route) || !later.every(unique)) return null
  return {
    champion: champion.toLowerCase(),
    lane,
    name: cleanName(name),
    items: { start, boots: boots[0] ?? null, core, later },
  }
}

/** `1101,2003-3006-6672,2510`: the link's item groups, trailing empty ones left out. */
export function groupsOf(items: BuildItems) {
  const groups = [
    items.start.join(','),
    items.boots === null ? '' : String(items.boots),
    items.core.join(','),
    ...items.later.map((o) => o.join(',')),
  ]
  while (groups.length && !groups[groups.length - 1]) groups.pop()
  return groups.join('-')
}

/** The path of the build's page or picture, with its name: `/desktop/build/1/ahri/mid/…?n=…`. */
export function buildPath(prefix: string, link: BuildLink, extra = '') {
  const path = `${prefix}/1/${link.champion}/${SEGMENT[link.lane]}/${groupsOf(link.items)}${extra}`
  const query = new URLSearchParams()
  if (link.name) query.set('n', link.name)
  return { path, query }
}

export const withQuery = (path: string, query: URLSearchParams) => {
  const q = query.toString().replace(/\+/g, '%20')
  return q ? `${path}?${q}` : path
}
