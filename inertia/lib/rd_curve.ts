/**
 * SVG path through points sorted by x: a monotone cubic (d3's `curveMonotoneX`), smooth without
 * ever bulging past a point, so a chart never shows a value that was not reached. The same curve
 * as the shared package's charts.
 */
export function monotone(points: ReadonlyArray<readonly [number, number]>): string {
  const f = (n: number) => n.toFixed(1)
  if (points.length < 3)
    return points.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join('')
  const slope = (i: number) =>
    (points[i + 1][1] - points[i][1]) / (points[i + 1][0] - points[i][0] || 1)
  const tangents = points.map((_, i) => {
    if (i === 0 || i === points.length - 1) return Number.NaN
    const h0 = points[i][0] - points[i - 1][0]
    const h1 = points[i + 1][0] - points[i][0]
    const s0 = slope(i - 1)
    const s1 = slope(i)
    const p = (s0 * h1 + s1 * h0) / (h0 + h1)
    return (
      (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0
    )
  })
  const last = points.length - 1
  tangents[0] = (3 * slope(0) - tangents[1]) / 2
  tangents[last] = (3 * slope(last - 1) - tangents[last - 1]) / 2
  let d = `M${f(points[0][0])} ${f(points[0][1])}`
  for (let i = 0; i < last; i++) {
    const dx = (points[i + 1][0] - points[i][0]) / 3
    d += `C${f(points[i][0] + dx)} ${f(points[i][1] + tangents[i] * dx)} ${f(points[i + 1][0] - dx)} ${f(points[i + 1][1] - tangents[i + 1] * dx)} ${f(points[i + 1][0])} ${f(points[i + 1][1])}`
  }
  return d
}
