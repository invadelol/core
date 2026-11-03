/**
 * What the champion, stats and pro pages share in the browser: logo and art addresses, number
 * formats, role and rank labels, and the sorting of a table.
 */

export const teamLogo = (id: string, size: number) => `/cdn/team/${id}?s=${size}`
export const leagueLogo = (slug: string, size: number) => `/cdn/league/${slug}?s=${size}&v=1`

/** "52.1%", "-" when unknown. */
export const pct = (x: number | null | undefined, digits = 1) =>
  x === null || x === undefined || Number.isNaN(x) ? '-' : `${(x * 100).toFixed(digits)}%`

/** A gap with its sign: "+0.4", "−83" (a minus sign, not a hyphen). */
export function signed(x: number | null | undefined, digits = 0) {
  if (x === null || x === undefined || Number.isNaN(x)) return '-'
  const v = Math.abs(x).toFixed(digits)
  if (Number(v) === 0) return v
  return `${x > 0 ? '+' : '−'}${v}`
}

/** A percentage point gap: "+0.4", "−1.2". */
export const points = (x: number | null | undefined, digits = 1) =>
  x === null || x === undefined ? '-' : signed(x * 100, digits)

/** The class a gap reads in: blue ahead, red behind (for the one it is about). */
export const gapClass = (x: number | null | undefined) => (!x ? 'q' : x > 0 ? 'up' : 'down')

export const thousands = (n: number) => Math.round(n).toLocaleString('en-US')
/** "25.4k", "1.2M". */
export const short = (n: number) =>
  n >= 1e6
    ? `${(n / 1e6).toFixed(1)}M`
    : n >= 1e3
      ? `${(n / 1e3).toFixed(1)}k`
      : String(Math.round(n))

/** "31:12" from seconds. */
export const clock = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

/** "3 h ago", "Yesterday", "4 d ago". */
export function ago(ms: number, now = Date.now()) {
  const min = Math.max(1, Math.round((now - ms) / 60_000))
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'Yesterday' : `${d} d ago`
}

/** The pro data's roles (TOP, JUNGLE, MID, ADC, SUPPORT) as the role icons and pages say them. */
export const PRO_ROLES = [
  { role: 'TOP', lane: 'TOP', label: 'Top', slug: 'top' },
  { role: 'JUNGLE', lane: 'JUNGLE', label: 'Jungle', slug: 'jungle' },
  { role: 'MID', lane: 'MID', label: 'Mid', slug: 'mid' },
  { role: 'ADC', lane: 'ADC', label: 'Bot', slug: 'bot' },
  { role: 'SUPPORT', lane: 'SUPPORT', label: 'Support', slug: 'support' },
] as const

export const proRole = (role: string | null | undefined) =>
  PRO_ROLES.find((r) => r.role === role) ?? null

const TIER_NAMES: Record<string, string> = {
  CHALLENGER: 'Challenger',
  GRANDMASTER: 'Grandmaster',
  MASTER: 'Master',
  DIAMOND: 'Diamond',
  EMERALD: 'Emerald',
  PLATINUM: 'Platinum',
  GOLD: 'Gold',
  SILVER: 'Silver',
  BRONZE: 'Bronze',
  IRON: 'Iron',
}
const APEX = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER'])

/** "Challenger 1,402", "Diamond II 64". */
export function rankText(
  tier: string | null | undefined,
  division?: number | null,
  lp?: number | null
) {
  if (!tier) return 'Unranked'
  const div = !APEX.has(tier) && division ? ` ${['', 'I', 'II', 'III', 'IV'][division] ?? ''}` : ''
  return `${TIER_NAMES[tier] ?? tier}${div}${lp !== null && lp !== undefined ? ` ${thousands(lp)}` : ''}`
}
export const tierName = (tier: string | null | undefined) =>
  tier ? (TIER_NAMES[tier] ?? tier) : ''
/** A tier's colour, for its name next to its crest. */
export const tierColor = (tier: string | null | undefined) =>
  tier
    ? `color: color-mix(in srgb, var(--tier-${tier.toLowerCase()}) var(--tier-ink, 100%), var(--text-1))`
    : 'color: var(--nb-quiet, var(--text-3))'

/** A country code as a name ("FR" → "France"), or the code when unknown. */
let regionNames: Intl.DisplayNames | null = null
/**
 * Names that differ between runtimes' locale data (Node's against the browsers'): fixed here, so
 * the server's render and the browser's agree.
 */
const COUNTRY_NAMES: Record<string, string> = {
  FK: 'Falkland Islands',
  HK: 'Hong Kong',
  MO: 'Macao',
  PS: 'Palestine',
}

export function countryName(code: string | null | undefined) {
  if (!code) return ''
  if (COUNTRY_NAMES[code.toUpperCase()]) return COUNTRY_NAMES[code.toUpperCase()]
  try {
    regionNames ??= new Intl.DisplayNames(['en'], { type: 'region' })
    return regionNames.of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}

/** Riot platforms as players say them. */
export const SERVER: Record<string, string> = { EUW1: 'EUW', NA1: 'NA', BR1: 'BR' }

/** A table's sort: a column and a direction. */
export interface Sort<K extends string> {
  key: K
  dir: 'asc' | 'desc'
}

/** Sorts a copy of `rows` by `value` (unknown values last, whatever the direction). */
export function sortRows<T>(
  rows: readonly T[],
  value: (row: T) => number | string | null,
  dir: 'asc' | 'desc'
) {
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const va = value(a)
    const vb = value(b)
    if (va === null || va === undefined) return vb === null || vb === undefined ? 0 : 1
    if (vb === null || vb === undefined) return -1
    if (typeof va === 'string' || typeof vb === 'string')
      return String(va).localeCompare(String(vb)) * sign
    return (va - vb) * sign
  })
}

/** `aria-sort` of a header. */
export const ariaSort = <K extends string>(sort: Sort<K>, key: K) =>
  sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
