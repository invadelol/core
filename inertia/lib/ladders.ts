import { profilePath } from './format.js'

/**
 * What the leaderboards share in the browser: their addresses, role and rank words, record and
 * move texts.
 */

/** The stored roles (TOP…UTILITY, the pro data's MID/ADC/SUPPORT too) as the role glyph names them. */
const LANE: Record<string, 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT'> = {
  TOP: 'TOP',
  JUNGLE: 'JUNGLE',
  MIDDLE: 'MID',
  MID: 'MID',
  BOTTOM: 'ADC',
  ADC: 'ADC',
  UTILITY: 'SUPPORT',
  SUPPORT: 'SUPPORT',
}
const ROLE_LABEL: Record<string, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MID: 'Mid',
  ADC: 'Bot',
  SUPPORT: 'Support',
}
const ROLE_SLUG: Record<string, string> = {
  TOP: 'top',
  JUNGLE: 'jungle',
  MID: 'mid',
  ADC: 'bot',
  SUPPORT: 'support',
}

export const laneOf = (role: string | null | undefined) => (role ? (LANE[role] ?? null) : null)
export const roleLabel = (role: string | null | undefined) => {
  const lane = laneOf(role)
  return lane ? ROLE_LABEL[lane] : ''
}
export const roleSlug = (role: string | null | undefined) => {
  const lane = laneOf(role)
  return lane ? ROLE_SLUG[lane] : ''
}

/** The five roles of a role filter, in lane order. */
export const ROLES = (['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'] as const).map((lane) => ({
  lane,
  label: ROLE_LABEL[lane],
  slug: ROLE_SLUG[lane],
}))

const TIERS: Record<string, string> = {
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
export const tierWord = (tier: string | null | undefined) => (tier ? (TIERS[tier] ?? tier) : '')
/** "Diamond II", "Challenger". */
export const rankWords = (tier: string, division?: string | number | null) => {
  const apex = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier)
  const div =
    typeof division === 'number' ? ['', 'I', 'II', 'III', 'IV'][division] : (division ?? '')
  return apex || !div ? tierWord(tier) : `${tierWord(tier)} ${div}`
}

export const n = (value: number) => Math.round(value).toLocaleString('en-US')
/** "55%" of wins over games, "–" with none. */
export const winPct = (wins: number, games: number) =>
  games ? `${Math.round((wins / games) * 100)}%` : '–'
/** A signed figure with a real minus: "+38", "−14". */
export const signedN = (v: number) => (v > 0 ? `+${n(v)}` : v < 0 ? `−${n(-v)}` : '0')

/** A profile's address, or null without a Riot ID. */
export const playerPath = (gameName: string | null, tagLine: string | null) =>
  gameName && tagLine ? profilePath(gameName, tagLine) : null

/** "4 min ago", "3 h ago", "2 days ago". */
export function since(ms: number | null | undefined, now = Date.now()) {
  if (!ms) return ''
  const min = Math.max(1, Math.round((now - ms) / 60_000))
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`
  const h = Math.round(min / 60)
  if (h < 36) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.round(h / 24)
  return `${d} days ago`
}

/** "15 Nov" (UTC, so the server's render and the browser's agree). */
export const dayMonth = (ms: number) =>
  new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/** An address with some query values replaced (null or '' removes them), `page` reset unless given. */
export function withQuery(
  path: string,
  current: Record<string, string | number | boolean | null | undefined>,
  changes: Record<string, string | number | boolean | null | undefined>
) {
  const merged = { ...current, page: undefined, ...changes }
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(merged)) {
    if (v === null || v === undefined || v === '' || v === false) continue
    if (k === 'page' && Number(v) <= 1) continue
    q.set(k, v === true ? '1' : String(v))
  }
  const s = q.toString()
  return s ? `${path}?${s}` : path
}

/** The ladder's line as a path in a w×h box: one violet line, oldest first. */
export function linePath(points: { at: number; lp: number }[], w: number, h: number, pad = 6) {
  if (points.length < 2)
    return { line: '', area: '', last: null as null | { x: number; y: number } }
  const t0 = points[0].at
  const t1 = points.at(-1)!.at
  const lo = Math.min(...points.map((p) => p.lp))
  const hi = Math.max(...points.map((p) => p.lp))
  const x = (t: number) => (t1 === t0 ? w : ((t - t0) / (t1 - t0)) * w)
  const y = (lp: number) => (hi === lo ? h / 2 : pad + (1 - (lp - lo) / (hi - lo)) * (h - 2 * pad))
  const pts = points.map((p) => `${x(p.at).toFixed(1)} ${y(p.lp).toFixed(1)}`)
  const line = `M${pts.join(' L')}`
  return {
    line,
    area: `${line} L${w} ${h} L0 ${h}Z`,
    last: { x: (x(t1) / w) * 100, y: (y(points.at(-1)!.lp) / h) * 100 },
  }
}
