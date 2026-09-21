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

/** Same scale, but always carrying its sign: "+1.2k", "−340", "even". */
export function signed(value: number, zero = '0') {
  const rounded = Math.round(value)
  if (rounded === 0) return zero
  return `${rounded > 0 ? '+' : '−'}${compact(Math.abs(value))}`
}

export function percent(ratio: number, decimals = 0) {
  return `${(ratio * 100).toFixed(decimals)}%`
}

export function kda(kills: number, deaths: number, assists: number) {
  return (kills + assists) / Math.max(1, deaths)
}

/** Match duration in seconds → "32:07". */
export function duration(seconds: number) {
  const total = Math.max(Math.floor(seconds), 0)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Timeline offset in milliseconds → "14:00". */
export function clock(ms: number) {
  return duration(Math.floor(ms / 1000))
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

export function shortDate(value: string | number | Date) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function longDate(value: string | number | Date) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** "Sat 20 Sep", the heading a day of matches sits under. */
export function dayLabel(ms: number) {
  return new Date(Number(ms)).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function ordinal(value: number) {
  if (!value) return '-'
  const mod10 = value % 10
  const mod100 = value % 100
  if (mod10 === 1 && mod100 !== 11) return `${value}st`
  if (mod10 === 2 && mod100 !== 12) return `${value}nd`
  if (mod10 === 3 && mod100 !== 13) return `${value}rd`
  return `${value}th`
}

/**
 * Route params reach the page still percent-encoded, so a name with a space
 * arrives as "MRS%20PauluX-KCWIN". Decode once here and keep the plain value
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
