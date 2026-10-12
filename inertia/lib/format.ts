/** 1 234 → "1.2k", 12 345 → "12k". Keeps dense tables readable. */
export function compact(value: number) {
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  // Each threshold sits where the finer format would round up into the next
  // band, so 9,970 prints as "10k" rather than a four-character "10.0k".
  if (abs >= 999_950) return `${(value / 1_000_000).toFixed(1)}m`
  if (abs >= 9_950) return `${Math.round(value / 1000)}k`
  if (abs >= 1000) return `${(value / 1000).toFixed(1)}k`
  return `${Math.round(value)}`
}

/** Match duration in seconds → "32:07". */
export function duration(seconds: number) {
  const total = Math.max(Math.floor(seconds), 0)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Seconds → "1h 24m", for totals rather than a game clock. */
export function hours(seconds: number) {
  const total = Math.max(Math.floor(seconds), 0)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  if (!h) return `${m}m`
  return `${h}h ${m}m`
}

export function timeAgo(ms: number) {
  const value = Number(ms)
  if (!value || Number.isNaN(value)) return 'unknown'
  const diff = Date.now() - value
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hoursAgo = Math.floor(minutes / 60)
  if (hoursAgo < 24) return `${hoursAgo}h ago`
  const days = Math.floor(hoursAgo / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

/**
 * The site is written in English, so dates are too. Formatting with the
 * browser's own locale printed "sam. 19 sept." on an English page.
 */
export const UI_LOCALE = 'en-US'

export function shortDate(value: string | number | Date) {
  return new Date(Number(value) || value).toLocaleDateString(UI_LOCALE, {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Route params reach the page still percent-encoded, so a name with a space
 * arrives as "Aster%20Vale-EUW". Decode once here and keep the plain value
 * in the page; encode again only when building a URL from it.
 */
export function decodeSlug(slug: string) {
  try {
    return decodeURIComponent(slug)
  } catch {
    return slug
  }
}

/** Splits a "GameName-TagLine" slug back into its two halves. */
export function parseSlug(slug: string) {
  const decoded = decodeSlug(slug)
  const lastDash = decoded.lastIndexOf('-')
  if (lastDash === -1) return { gameName: decoded, tagLine: 'EUW' }
  return {
    gameName: decoded.slice(0, lastDash),
    tagLine: decoded.slice(lastDash + 1),
  }
}

/** The profile URL for a Riot ID, encoded exactly once. */
export function profilePath(gameName: string, tagLine: string) {
  return `/${encodeURIComponent(`${gameName}-${tagLine}`)}`
}
