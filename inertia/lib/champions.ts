/**
 * What the champion pages share between the server and the browser: addresses, roles, tiers
 * and the filter menus.
 */

/** A champion's address: `Miss Fortune` → `miss-fortune`, `Kai'Sa` → `kaisa`. */
export function championSlug(name: string) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’.]/g, '')
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export type Lane = 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT'

/** Riot's positions with the site's address, lane name (the shared role icons) and label. */
export const ROLES = [
  { position: 'TOP', slug: 'top', lane: 'TOP', label: 'Top' },
  { position: 'JUNGLE', slug: 'jungle', lane: 'JUNGLE', label: 'Jungle' },
  { position: 'MIDDLE', slug: 'mid', lane: 'MID', label: 'Mid' },
  { position: 'BOTTOM', slug: 'bot', lane: 'ADC', label: 'Bot' },
  { position: 'UTILITY', slug: 'support', lane: 'SUPPORT', label: 'Support' },
] as const satisfies readonly { position: string; slug: string; lane: Lane; label: string }[]

export type Position = (typeof ROLES)[number]['position']

export const roleOf = (position: string) => ROLES.find((r) => r.position === position) ?? ROLES[0]

export const TIERS = ['S+', 'S', 'A', 'B', 'C', 'D'] as const

/** The rank menu: one tier, or a tier and above. */
export const BRACKETS = [
  { value: 'all', label: 'All ranks', crest: null },
  { value: 'iron', label: 'Iron', crest: 'iron' },
  { value: 'bronze', label: 'Bronze', crest: 'bronze' },
  { value: 'silver', label: 'Silver', crest: 'silver' },
  { value: 'gold', label: 'Gold', crest: 'gold' },
  { value: 'platinum', label: 'Platinum', crest: 'platinum' },
  { value: 'emerald', label: 'Emerald', crest: 'emerald' },
  { value: 'diamond', label: 'Diamond', crest: 'diamond' },
  { value: 'emerald_plus', label: 'Emerald+', crest: 'emerald' },
  { value: 'diamond_plus', label: 'Diamond+', crest: 'diamond' },
  { value: 'master_plus', label: 'Master+', crest: 'master' },
] as const

export const bracketOf = (value: string) => BRACKETS.find((b) => b.value === value) ?? BRACKETS[8]

/** The region menu (`match_seed.platform` groups on the server). */
export const REGIONS = [
  { value: '', label: 'All regions' },
  { value: 'euw', label: 'EUW' },
  { value: 'eune', label: 'EUNE' },
  { value: 'na', label: 'NA' },
  { value: 'kr', label: 'KR' },
  { value: 'br', label: 'BR' },
  { value: 'lan', label: 'LAN' },
  { value: 'las', label: 'LAS' },
  { value: 'tr', label: 'TR' },
  { value: 'jp', label: 'JP' },
  { value: 'oce', label: 'OCE' },
  { value: 'vn', label: 'VN' },
] as const

/** The rank groups of the "by rank" view. */
export const RANK_GROUPS = [
  { value: 'iron', label: 'Iron', crest: 'iron' },
  { value: 'bronze', label: 'Bronze', crest: 'bronze' },
  { value: 'silver', label: 'Silver', crest: 'silver' },
  { value: 'gold', label: 'Gold', crest: 'gold' },
  { value: 'platinum', label: 'Platinum', crest: 'platinum' },
  { value: 'emerald', label: 'Emerald', crest: 'emerald' },
  { value: 'diamond', label: 'Diamond', crest: 'diamond' },
  { value: 'master_plus', label: 'Master+', crest: 'master' },
] as const

/** A champion page's tabs and their addresses. */
export const CHAMPION_TABS = [
  { key: 'build', label: 'Build' },
  { key: 'runes', label: 'Runes' },
  { key: 'items', label: 'Items' },
  { key: 'matchups', label: 'Matchups' },
  { key: 'statistics', label: 'Statistics' },
  { key: 'pros', label: 'Pro builds' },
] as const

export type ChampionTab = (typeof CHAMPION_TABS)[number]['key']

/** The query string of the filters, without the defaults. */
export function filterQuery(
  f: { rank?: string; patch?: string; region?: string | null; role?: string },
  latest?: string
) {
  const q = new URLSearchParams()
  if (f.role) q.set('role', f.role)
  if (f.rank && f.rank !== 'emerald_plus') q.set('rank', f.rank)
  if (f.patch && f.patch !== latest) q.set('patch', f.patch)
  if (f.region) q.set('region', f.region)
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const pct = (x: number | null | undefined, digits = 1) =>
  x === null || x === undefined ? '—' : `${(x * 100).toFixed(digits)}%`

/* ── What the server sends (app/services/*_stats.ts, pro_service.ts) ── */

export interface RoleStat {
  champion: number
  position: Position
  games: number
  win: number
  pick: number
  ban: number
  roleShare: number
  tier: number | null
  rank: number | null
  level: number
}

export interface Summary {
  patch: string
  bracket: string
  region: string | null
  games: number
  roles: RoleStat[]
  ranked: Record<Position, number>
}

export interface Filter {
  patch: string
  bracket: string
  region: string | null
}

export interface ChampionEntry {
  id: number
  name: string
  alias: string
  roles: string[]
  slug: string
}

export interface ItemSet {
  items: number[]
  games: number
  win: number
  share: number
  level: number
  tie: boolean
}

export interface ItemStat {
  item: number
  games: number
  win: number
  share: number
  level: number
}

export interface BuildStats {
  games: number
  win: number
  starters: ItemSet[]
  boots: ItemSet[]
  cores: ItemSet[]
  slots: ItemStat[][]
  items: ItemStat[]
}

export interface RunePage {
  primaryStyle: number
  keystone: number
  primary: number[]
  secondaryStyle: number
  secondary: number[]
  shards: number[]
}

export interface RuneStats {
  games: number
  win: number
  pages: { page: RunePage; games: number; win: number; share: number; level: number }[]
  keystones: { keystone: number; primaryStyle: number; games: number; win: number; share: number }[]
}

export interface RuneTrees {
  styles: Record<number, { name: string; rows: number[][] }>
  shards: number[][]
}

export interface SpellStats {
  games: number
  pairs: { spells: [number, number]; games: number; win: number; share: number; level: number }[]
}

export interface Skills {
  games: number
  orders: { order: string[]; games: number; win: number; share: number; level: number }[]
  max: string[]
}

export interface Matchup {
  champion: number
  games: number
  win: number
  level: number
}

export type Teammates = Record<Position, Matchup[]>

export interface TeamRef {
  id: string
  slug: string
  name: string
  shortName: string | null
  region: string | null
}

export interface ProTag {
  slug: string
  name: string
  role: string | null
  country: string | null
  staff: boolean
  team: TeamRef | null
}

export interface ProGame {
  matchId: string
  account: string
  platform: string
  startMs: number
  champion: number
  position: string
  win: boolean
  kills: number
  deaths: number
  assists: number
  cs: number
  items: number[]
  spells: [number, number]
  keystone: number
  secondaryStyle: number
  durationSec: number
  opponent: number | null
  pro?: ProTag
}

export interface GamesSummary {
  games: ProGame[]
  record: { games: number; wins: number; kills: number; deaths: number; assists: number }
  champions: { champion: number; games: number; wins: number; kda: number }[]
  roles: { position: string; games: number }[]
  items: { item: number; games: number; wins: number }[]
}

export const champIconUrl = (id: number) => `/cdn/champion/${id}.png`
export const splashUrl = (id: number) => `/cdn/centered/${id}.jpg`
export const itemUrl = (id: number) => `/cdn/item/${id}.png`
export const perkUrl = (id: number) => `/cdn/perk/${id}.png`
export const styleUrl = (id: number) => `/cdn/perkstyle/${id}.png`
export const spellUrl = (id: number) => `/cdn/spell/${id}.png`
export const abilityUrl = (champion: number, key: string) =>
  `/cdn/ability/${champion}-${key.toLowerCase()}.png`

/** Riot's position names as the role icons name them. */
export const laneOf = (position: string) =>
  ({
    TOP: 'TOP',
    JUNGLE: 'JUNGLE',
    MIDDLE: 'MID',
    BOTTOM: 'ADC',
    UTILITY: 'SUPPORT',
    MID: 'MID',
    ADC: 'ADC',
    SUPPORT: 'SUPPORT',
  })[position] ?? null

export const thousands = (n: number) => Math.round(n).toLocaleString('en-US')
export const compact = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : thousands(n)

/** "Challenger 1,412 LP", "Diamond II 64 LP". */
export function rankLabel(
  tier: string | null | undefined,
  division?: number | null,
  lp?: number | null
) {
  if (!tier) return 'Unranked'
  const name = tier.charAt(0) + tier.slice(1).toLowerCase()
  const apex = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier)
  const div = !apex && division ? ` ${['', 'I', 'II', 'III', 'IV'][division] ?? ''}` : ''
  return `${name}${div}${lp !== null && lp !== undefined ? ` · ${thousands(lp)} LP` : ''}`
}

/** "3 h ago", "2 d ago". */
export function ago(ms: number) {
  const min = Math.max(1, Math.round((Date.now() - ms) / 60_000))
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 48) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}
