/** A tier's colour token ("var(--emerald)"), for rank names on the profile. */
export const tierVar = (tier: string | undefined | null) =>
  tier
    ? `var(--${({ PLATINUM: 'plat', GRANDMASTER: 'gm', CHALLENGER: 'chall' } as Record<string, string>)[tier] ?? tier.toLowerCase()}, var(--t1))`
    : 'var(--t1)'

/** "+4", "−3", "±0": a sign, never a colour. */
export function signed(value: number, digits = 0) {
  const rounded = Number(value.toFixed(digits))
  if (!rounded) return '±0'
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(digits)}`
}

/** A smooth path through points (x, y), as the boards draw their lines. */
export function smooth(points: ReadonlyArray<readonly [number, number]>) {
  const n = points.length
  if (!n) return ''
  let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(i + 2, n - 1)]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d
}

/**
 * A sparkline's line and fade for `values` in a `w` × `h` box: the mean of each run of `span`
 * values, so one game's swing reads as the gentle variation it is.
 */
export function spark(values: number[], w: number, h: number, span = 4, pad = 3) {
  const clean = values.filter((v) => Number.isFinite(v))
  if (clean.length < 3) return null
  const rolled = clean.map((_, i) => {
    const run = clean.slice(Math.max(0, i - span + 1), i + 1)
    return run.reduce((s, v) => s + v, 0) / run.length
  })
  const lo = Math.min(...rolled)
  const hi = Math.max(...rolled)
  const range = hi - lo || 1
  const pts = rolled.map(
    (v, i) => [(i / (rolled.length - 1)) * w, pad + (h - 2 * pad) * (1 - (v - lo) / range)] as const
  )
  const d = smooth(pts)
  return { d, area: `${d} L${w} ${h} L0 ${h} Z`, w, h }
}
