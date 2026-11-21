/**
 * Small helpers the tier lists, the champion page, the matchup page and the stats explorer share:
 * addresses that change one filter, figures as the boards print them, and the bars' widths.
 */

/** `url` (a page address) with `changes` applied to its query: a null or empty value drops the key. */
export function withQuery(url: string, changes: Record<string, string | null | undefined>) {
  const [path, search = ''] = url.split('?')
  const query = new URLSearchParams(search)
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === undefined || value === '') query.delete(key)
    else query.set(key, value)
  }
  const text = query.toString()
  return text ? `${path}?${text}` : path
}

/** A share as a percent with one decimal: `0.5234` is "52.3". */
export const p1 = (x: number | null | undefined) => (x === null || x === undefined ? '–' : (x * 100).toFixed(1))

/** A share as a whole percent: `0.5234` is "52". */
export const p0 = (x: number | null | undefined) => (x === null || x === undefined ? '–' : (x * 100).toFixed(0))

/** A signed figure with a true minus sign: "+1.2", "−0.4". */
export function sgn(value: number, digits = 1) {
  const text = Math.abs(value).toFixed(digits)
  return value > 0 ? `+${text}` : value < 0 ? `−${text}` : text
}

/** A signed change of a share in points: `0.012` is "+1.2". */
export const points = (delta: number, digits = 1) => sgn(delta * 100, digits)

/** "12,408" */
export const thousands = (n: number) => Math.round(n).toLocaleString('en-US')

/** A bar's width in percent for `value` on a scale from `lo` to `hi`, never under 3 %. */
export function barWidth(value: number, lo: number, hi: number) {
  if (hi <= lo) return 3
  return Math.max(3, Math.min(100, ((value - lo) / (hi - lo)) * 100))
}

/** "1st", "2nd", "3rd", "4th" */
export const ordinal = (n: number) => (({ 1: '1st', 2: '2nd', 3: '3rd' }) as Record<number, string>)[n] ?? `${n}th`

/** The rows that moved most since the patch before: `up` most first, `down` most first. */
export function movers<T>(rows: T[], change: (r: T) => number | null, up = 6, down = 3) {
  const moved = rows
    .map((r) => ({ r, d: change(r) }))
    .filter((m): m is { r: T; d: number } => m.d !== null && m.d !== 0)
  return {
    up: moved
      .filter((m) => m.d > 0)
      .sort((a, b) => b.d - a.d)
      .slice(0, up),
    down: moved
      .filter((m) => m.d < 0)
      .sort((a, b) => a.d - b.d)
      .slice(0, down),
  }
}

/**
 * A sparkline's line and area in a `w` × `h` box, from values (nulls leave a gap), on a scale
 * that always holds `pivot` (the 50 % line), and that line's height. `points` places each value
 * in the box (null where it is unknown), for a hover; `last` is the last known one.
 */
export function sparkPaths(values: (number | null)[], w = 160, h = 30, pivot = 0.5) {
  const known = values.filter((v): v is number => v !== null)
  if (known.length < 2) return null
  const lo = Math.min(pivot, ...known) - 0.01
  const hi = Math.max(pivot, ...known) + 0.01
  const x = (i: number) => (values.length > 1 ? (i / (values.length - 1)) * w : 0)
  const y = (v: number) => h - ((v - lo) / (hi - lo)) * h
  let line = ''
  let area = ''
  let run: [number, number][] = []
  const flush = () => {
    if (run.length > 1) {
      line += run.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ')
      area +=
        `M${run[0][0].toFixed(1)} ${h} ` +
        run.map(([px, py]) => `L${px.toFixed(1)} ${py.toFixed(1)}`).join(' ') +
        ` L${run[run.length - 1][0].toFixed(1)} ${h} Z`
    }
    run = []
  }
  values.forEach((v, i) => {
    if (v === null) flush()
    else run.push([x(i), y(v)])
  })
  flush()
  const points = values.map((v, i) => (v === null ? null : { x: x(i), y: y(v), v }))
  const last = [...points].reverse().find((p) => p !== null) ?? null
  return { line, area, pivot: y(pivot).toFixed(1), points, last }
}
