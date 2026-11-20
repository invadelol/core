/**
 * Laying out a scatter of round portraits so that none covers another: each marker starts on its
 * point and is pushed off its neighbours until they all stand apart, pulled back toward its point
 * on the way, so a crowd spreads around where it is (a marker moved off its point keeps a hairline
 * back to it). Then each name is put beside its marker (right, left, above or below) only where it
 * covers no marker and no other name. Pure and deterministic: the server and the browser lay out
 * the same chart the same way for the same size.
 */

export interface PlotInput {
  key: string
  /** Where the point is, in px from the plot's top left. */
  x: number
  y: number
  /** The name written beside it, when it fits. */
  label: string
}

export interface PlotLabel {
  /** The label box's top left, in px. */
  x: number
  y: number
  width: number
  side: 'right' | 'left' | 'top' | 'bottom'
}

export interface PlotMarker {
  key: string
  /** The point. */
  x: number
  y: number
  /** The marker's centre. */
  mx: number
  my: number
  /** Whether the marker stands away from its point (a hairline joins them). */
  moved: boolean
  label: PlotLabel | null
}

export interface PlotOptions {
  width: number
  height: number
  /** The markers' radius. */
  radius: number
  /** The least space between two markers. */
  gap?: number
  /** A label's height and its width for a text. */
  labelHeight?: number
  labelWidth: (text: string) => number
  /** Space between a marker and its label. */
  labelGap?: number
}

const ITERATIONS = 400
/** How far each step pulls a marker back toward its point. */
const PULL = 0.04
/** A marker this far from its point is drawn as moved. */
const MOVED = 3

interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** From a label's box to a marker's centre (0 inside). */
const near = (b: Box, m: { x: number; y: number }) =>
  Math.hypot(
    Math.max(b.x, Math.min(m.x, b.x + b.w)) - m.x,
    Math.max(b.y, Math.min(m.y, b.y + b.h)) - m.y
  )

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** Whether a box comes within `r` of a circle's centre. */
function touchesCircle(b: Box, cx: number, cy: number, r: number) {
  const nx = Math.max(b.x, Math.min(cx, b.x + b.w))
  const ny = Math.max(b.y, Math.min(cy, b.y + b.h))
  return (nx - cx) ** 2 + (ny - cy) ** 2 < r * r
}

/**
 * The markers, in the order given (the first ones get their labels first: put the points that
 * matter most first).
 */
export function layoutPlot(points: PlotInput[], options: PlotOptions): PlotMarker[] {
  const { width, height, radius } = options
  const gap = options.gap ?? 4
  const labelHeight = options.labelHeight ?? 16
  const labelGap = options.labelGap ?? 6
  const clampX = (v: number) => Math.min(width - radius, Math.max(radius, v))
  const clampY = (v: number) => Math.min(height - radius, Math.max(radius, v))

  const home = points.map((p) => ({ x: clampX(p.x), y: clampY(p.y) }))
  const at = home.map((p) => ({ ...p }))
  const least = 2 * radius + gap

  for (let step = 0; step < ITERATIONS; step++) {
    let crowded = false
    for (let i = 0; i < at.length; i++) {
      for (let j = i + 1; j < at.length; j++) {
        let dx = at[j].x - at[i].x
        let dy = at[j].y - at[i].y
        let d = Math.hypot(dx, dy)
        if (d >= least) continue
        crowded = true
        if (d < 0.01) {
          // Two markers on one spot part along a fixed angle of their pair, the same each time.
          const angle = ((i * 7 + j * 13) % 12) * (Math.PI / 6)
          dx = Math.cos(angle)
          dy = Math.sin(angle)
          d = 1
        }
        const push = (least - d) / 2
        const ux = dx / d
        const uy = dy / d
        at[i].x = clampX(at[i].x - ux * push)
        at[i].y = clampY(at[i].y - uy * push)
        at[j].x = clampX(at[j].x + ux * push)
        at[j].y = clampY(at[j].y + uy * push)
      }
    }
    // The pull home stops in the last steps, so the markers end apart.
    if (step < ITERATIONS - 80)
      for (let i = 0; i < at.length; i++) {
        at[i].x += (home[i].x - at[i].x) * PULL
        at[i].y += (home[i].y - at[i].y) * PULL
      }
    else if (!crowded) break
  }

  const placed: Box[] = []
  const round = (v: number) => Math.round(v * 100) / 100
  return points.map((p, i) => {
    const mx = at[i].x
    const my = at[i].y
    const w = Math.ceil(options.labelWidth(p.label))
    const diag = radius * 0.72 + 2
    const tries: { side: PlotLabel['side']; box: Box }[] = [
      {
        side: 'right',
        box: { x: mx + radius + labelGap, y: my - labelHeight / 2, w, h: labelHeight },
      },
      {
        side: 'left',
        box: { x: mx - radius - labelGap - w, y: my - labelHeight / 2, w, h: labelHeight },
      },
      { side: 'top', box: { x: mx - w / 2, y: my - radius - 3 - labelHeight, w, h: labelHeight } },
      { side: 'bottom', box: { x: mx - w / 2, y: my + radius + 3, w, h: labelHeight } },
      // Then off a corner, the label's own corner on the marker's diagonal.
      { side: 'right', box: { x: mx + diag, y: my - diag - labelHeight, w, h: labelHeight } },
      { side: 'right', box: { x: mx + diag, y: my + diag, w, h: labelHeight } },
      { side: 'left', box: { x: mx - diag - w, y: my - diag - labelHeight, w, h: labelHeight } },
      { side: 'left', box: { x: mx - diag - w, y: my + diag, w, h: labelHeight } },
    ]
    const fits = (b: Box) =>
      b.x >= 0 &&
      b.y >= 0 &&
      b.x + b.w <= width &&
      b.y + b.h <= height &&
      at.every((m) => !touchesCircle(b, m.x, m.y, radius + 3)) &&
      // Nearer its own marker than any other, by a clear margin: never read as another's name.
      at.every((m, j) => j === i || near(b, m) > near(b, at[i]) + radius * 0.4) &&
      placed.every((o) => !overlaps(b, { x: o.x - 4, y: o.y - 2, w: o.w + 8, h: o.h + 4 }))
    const found = tries.find((t) => fits(t.box)) ?? null
    if (found) placed.push(found.box)
    return {
      key: p.key,
      x: round(home[i].x),
      y: round(home[i].y),
      mx: round(mx),
      my: round(my),
      moved: Math.hypot(mx - home[i].x, my - home[i].y) > MOVED,
      label: found
        ? { x: round(found.box.x), y: round(found.box.y), width: w, side: found.side }
        : null,
    }
  })
}
