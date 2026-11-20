/**
 * The duo tier list's addresses (`/tier-list/duos?lane=`), shared by the page and the server: a
 * duo is two roles, the one the list is read from first (`jungle-support`: the junglers, each with
 * its supports). Bot and support, mid and jungle, top and jungle go by their lane alone (`bot`,
 * `mid`, `top`); no lane is bot and support.
 */

/** The roles as the address names them, and as Riot's positions. */
export const DUO_ROLES = {
  top: 'TOP',
  jungle: 'JUNGLE',
  mid: 'MIDDLE',
  bot: 'BOTTOM',
  support: 'UTILITY',
} as const
export type DuoRole = keyof typeof DUO_ROLES
export type DuoPosition = (typeof DUO_ROLES)[DuoRole]

export type DuoLane = string

/** The three pairs players name by their lane. */
const SHORT: Record<string, string> = {
  'bot-support': 'bot',
  'mid-jungle': 'mid',
  'top-jungle': 'top',
}
const LONG: Record<string, string> = { bot: 'bot-support', mid: 'mid-jungle', top: 'top-jungle' }

/** The duo an address asks for, in its short form; null when it names no two roles. */
export function duoLaneOf(value: unknown): DuoLane | null {
  const s = String(value ?? '').toLowerCase()
  if (s in LONG) return s
  const [a, b, more] = s.split('-')
  if (more !== undefined || !(a in DUO_ROLES) || !(b in DUO_ROLES) || a === b) return null
  return SHORT[s] ?? s
}

/** The address of two roles, the first one first. */
export const duoLane = (a: DuoRole, b: DuoRole): DuoLane => SHORT[`${a}-${b}`] ?? `${a}-${b}`

/** The two roles of a duo, the first one first. */
export function duoRoles(lane: DuoLane): [DuoRole, DuoRole] {
  return (LONG[lane] ?? lane).split('-') as [DuoRole, DuoRole]
}

export function duoPositions(lane: DuoLane): [DuoPosition, DuoPosition] {
  const [a, b] = duoRoles(lane)
  return [DUO_ROLES[a], DUO_ROLES[b]]
}

/** A duo's name: "Bot lane duos", "Jungle and support duos". */
export function duoTitle(lane: DuoLane) {
  if (lane === 'bot') return 'Bot lane duos'
  const [a, b] = duoRoles(lane)
  return `${a.charAt(0).toUpperCase()}${a.slice(1)} and ${b} duos`
}

/** A role as a person: one of them, several. */
export const ROLE_PEOPLE: Record<DuoRole, { one: string; many: string }> = {
  top: { one: 'top laner', many: 'top laners' },
  jungle: { one: 'jungler', many: 'junglers' },
  mid: { one: 'mid laner', many: 'mid laners' },
  bot: { one: 'bot laner', many: 'bot laners' },
  support: { one: 'support', many: 'supports' },
}
