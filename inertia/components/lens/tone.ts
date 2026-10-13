import { PACE_RATING } from '../../lib/lens.js'

/**
 * The colour of a rating on the Invade score's scale: a calm muted violet at the Emerald pace,
 * sliding to the theme's blue above it and gold from 80, as PerfDial colours a score. Below the
 * pace it only grows quieter, towards muted ink: a weakness is said in words, never in red. Mixed
 * from the tokens, so it follows the theme.
 */
export function tone(rating: number | null): string {
  if (rating === null) return 'var(--text-4)'
  if (rating >= 90) return 'rgb(var(--score-peak-rgb))'
  if (rating >= 80) return 'rgb(var(--score-gold-rgb))'
  const calm = 'color-mix(in oklab, rgb(var(--brand-rgb)) 58%, var(--text-3))'
  const share = (t: number) => Math.round(Math.max(0, Math.min(1, t)) * 100)
  if (rating < PACE_RATING)
    return `color-mix(in oklab, var(--text-4) ${share((PACE_RATING - rating) / 25)}%, ${calm})`
  return `color-mix(in oklab, rgb(var(--win-rgb)) ${share((rating - PACE_RATING) / 35)}%, ${calm})`
}

/** A marker for a rating: filled at or above the pace, a hollow ring of quiet ink below it. */
export function dot(rating: number): Record<string, string> {
  const colour = tone(rating)
  return rating >= PACE_RATING - 0.5
    ? { background: colour }
    : { background: 'transparent', boxShadow: `inset 0 0 0 1.5px ${colour}` }
}

/** Monotone cubic path through points (no overshoot), as the shared charts draw. */
export function monotone(points: Array<[number, number]>): string {
  const f = (n: number) => n.toFixed(2)
  if (points.length < 3)
    return points.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join('')
  const slope = (i: number) =>
    (points[i + 1][1] - points[i][1]) / (points[i + 1][0] - points[i][0] || 1)
  const m = points.map((_, i) => {
    if (i === 0 || i === points.length - 1) return 0
    const a = slope(i - 1)
    const b = slope(i)
    if (a * b <= 0) return 0
    const dx0 = points[i][0] - points[i - 1][0]
    const dx1 = points[i + 1][0] - points[i][0]
    return (3 * (dx0 + dx1)) / ((2 * dx1 + dx0) / a + (dx1 + 2 * dx0) / b)
  })
  m[0] = slope(0)
  m[points.length - 1] = slope(points.length - 2)
  let d = `M${f(points[0][0])} ${f(points[0][1])}`
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[i + 1]
    const h = (x1 - x0) / 3
    d += `C${f(x0 + h)} ${f(y0 + m[i] * h)} ${f(x1 - h)} ${f(y1 - m[i + 1] * h)} ${f(x1)} ${f(y1)}`
  }
  return d
}
