/** 75 → "1:15", as the overlay writes timers. */
export function mmss(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** 2140 → "2.1k", the overlay's compact figures. */
export function compactGold(value: number) {
  const n = Math.abs(value)
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n))
}
