/**
 * Packs circles whose AREA is proportional to a value into a wide, tight cloud: the biggest near
 * the middle, smaller ones in the gaps around them. Pure and deterministic (the same values and
 * width always give the same picture), and cheap enough to run again on a resize.
 *
 * Two steps. A front-chain packing (as in d3-hierarchy's `packSiblings`) lays each circle
 * tangent to two on the cloud's edge, choosing the spot nearest the centre of mass, measured
 * flatter horizontally so the cloud grows wide. Then a short relaxation pulls everything toward
 * the centre, harder vertically, while overlapping pairs push apart: the cloud evens out into an
 * ellipse of the box's aspect without opening holes. The picture is then scaled to the width.
 */

export interface BubbleInput {
  id: number
  value: number
}

export interface Bubble extends BubbleInput {
  x: number
  y: number
  r: number
}

export interface BubbleLayout {
  bubbles: Bubble[]
  width: number
  height: number
}

export interface PackOptions {
  /** The width to fill, in px. */
  width: number
  /** Width over height of the cloud: 2 is twice as wide as tall. */
  aspect: number
  /** Space between two circles, in px. */
  gap?: number
  /** The smallest radius drawn, in px, so the long tail stays visible. */
  minRadius?: number
}

/** Share of the box the circles cover (about half is a tight cloud). */
const FILL = 0.5
/** No circle's radius grows past this share of the box's height (a pool of one or two). */
const MAX_RADIUS = 0.36
/** How far the picture may grow to fill the width, and how much taller than the box it may get. */
const MAX_SCALE = 1.6
const MAX_OVERFLOW = 1.08

export function packBubbles(items: BubbleInput[], options: PackOptions): BubbleLayout {
  const { width, aspect, gap = 2, minRadius = 6 } = options
  const list = items.filter((item) => item.value > 0).sort((a, b) => b.value - a.value)
  if (!list.length || width <= 0) return { bubbles: [], width, height: 0 }

  const boxHeight = width / aspect
  const total = list.reduce((sum, item) => sum + item.value, 0)
  const k = Math.sqrt((FILL * width * boxHeight) / (Math.PI * total))
  // Packed with half the gap on every radius, which leaves the whole gap between two circles.
  const half = gap / 2
  const nodes: Bubble[] = list.map((item) => ({
    ...item,
    r: Math.max(Math.min(k * Math.sqrt(item.value), boxHeight * MAX_RADIUS), minRadius) + half,
    x: 0,
    y: 0,
  }))

  // The biggest first, then the rest alternately from both ends: small circles land between
  // bigger ones all around the cloud, not as a crust on one side.
  const order = nodes.slice(0, 3)
  const rest = nodes.slice(3)
  for (let lo = 0, hi = rest.length - 1; lo <= hi; lo++, hi--) {
    order.push(rest[lo])
    if (hi !== lo) order.push(rest[hi])
  }
  frontChain(order, aspect)
  relax(nodes, aspect)
  for (const node of nodes) node.r -= half

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const node of nodes) {
    minX = Math.min(minX, node.x - node.r)
    maxX = Math.max(maxX, node.x + node.r)
    minY = Math.min(minY, node.y - node.r)
    maxY = Math.max(maxY, node.y + node.r)
  }
  const largest = Math.max(...nodes.map((node) => node.r))
  const scale = Math.min(
    width / (maxX - minX),
    (boxHeight * MAX_OVERFLOW) / (maxY - minY),
    (boxHeight * MAX_RADIUS) / largest,
    MAX_SCALE
  )
  const offsetX = (width - (maxX - minX) * scale) / 2
  for (const node of nodes) {
    node.x = (node.x - minX) * scale + offsetX
    node.y = (node.y - minY) * scale
    node.r *= scale
  }
  return { bubbles: nodes, width, height: (maxY - minY) * scale }
}

/** The bubble under a point, or the nearest one within `slack` px of its edge (small ones on touch). */
export function bubbleAt(bubbles: Bubble[], x: number, y: number, slack = 0): Bubble | null {
  let best: Bubble | null = null
  let bestGap = Infinity
  for (const bubble of bubbles) {
    const gap = Math.hypot(bubble.x - x, bubble.y - y) - bubble.r
    if (gap <= 0) return bubble
    if (gap < bestGap) {
      best = bubble
      bestGap = gap
    }
  }
  return bestGap <= slack ? best : null
}

/* ── Front-chain packing ─────────────────────────────────────── */

interface Link {
  circle: Bubble
  next: Link
  previous: Link
}

/** Places `c` tangent to `a` and `b`, on the left of a → b. */
function place(b: Bubble, a: Bubble, c: Bubble) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const d2 = dx * dx + dy * dy
  if (!d2) {
    c.x = a.x + c.r
    c.y = a.y
    return
  }
  const a2 = (a.r + c.r) ** 2
  const b2 = (b.r + c.r) ** 2
  if (a2 > b2) {
    const x = (d2 + b2 - a2) / (2 * d2)
    const y = Math.sqrt(Math.max(0, b2 / d2 - x * x))
    c.x = b.x - x * dx - y * dy
    c.y = b.y - x * dy + y * dx
  } else {
    const x = (d2 + a2 - b2) / (2 * d2)
    const y = Math.sqrt(Math.max(0, a2 / d2 - x * x))
    c.x = a.x + x * dx - y * dy
    c.y = a.y + x * dy + y * dx
  }
}

function intersects(a: Bubble, b: Bubble) {
  const reach = a.r + b.r - 1e-6
  const dx = b.x - a.x
  const dy = b.y - a.y
  return reach > 0 && reach * reach > dx * dx + dy * dy
}

function frontChain(circles: Bubble[], aspect: number) {
  const count = circles.length
  const [first, second, third] = circles
  if (count < 2) return
  first.x = -second.r
  second.x = first.r
  if (count < 3) return
  place(second, first, third)

  // The centre of mass so far, which the cloud grows evenly around.
  let mass = 0
  let cx = 0
  let cy = 0
  const add = (circle: Bubble) => {
    const weight = circle.r * circle.r
    cx = (cx * mass + circle.x * weight) / (mass + weight)
    cy = (cy * mass + circle.y * weight) / (mass + weight)
    mass += weight
  }
  // How near the spot between a link and the next is to that centre, flatter horizontally.
  const score = (link: Link) => {
    const a = link.circle
    const b = link.next.circle
    const ab = a.r + b.r
    const x = ((a.x * b.r + b.x * a.r) / ab - cx) / aspect
    const y = (a.y * b.r + b.y * a.r) / ab - cy
    return x * x + y * y
  }
  add(first)
  add(second)
  add(third)

  const link = (circle: Bubble) => ({ circle }) as Link
  let a = link(first)
  let b = link(second)
  let c = link(third)
  a.next = c.previous = b
  b.next = a.previous = c
  c.next = b.previous = a

  pack: for (let i = 3; i < count; i++) {
    place(a.circle, b.circle, circles[i])
    c = link(circles[i])
    // The nearest circle of the chain that the new one would overlap, if any, ahead or behind.
    let ahead = b.next
    let behind = a.previous
    let reachAhead = b.circle.r
    let reachBehind = a.circle.r
    do {
      if (reachAhead <= reachBehind) {
        if (intersects(ahead.circle, c.circle)) {
          b = ahead
          a.next = b
          b.previous = a
          i--
          continue pack
        }
        reachAhead += ahead.circle.r
        ahead = ahead.next
      } else {
        if (intersects(behind.circle, c.circle)) {
          a = behind
          a.next = b
          b.previous = a
          i--
          continue pack
        }
        reachBehind += behind.circle.r
        behind = behind.previous
      }
    } while (ahead !== behind.next)

    // It fits: insert it between a and b, then start again from the best spot of the chain.
    c.previous = a
    c.next = b
    a.next = b.previous = b = c
    add(c.circle)
    let best = score(a)
    while ((c = c.next) !== b) {
      const value = score(c)
      if (value < best) {
        a = c
        best = value
      }
    }
    b = a.next
  }
}

/* ── Relaxation ──────────────────────────────────────────────── */

const RELAX_STEPS = 70
const PULL = 0.01

function relax(nodes: Bubble[], aspect: number) {
  let mass = 0
  let cx = 0
  let cy = 0
  for (const node of nodes) {
    const weight = node.r * node.r
    cx += node.x * weight
    cy += node.y * weight
    mass += weight
  }
  for (const node of nodes) {
    node.x -= cx / mass
    node.y -= cy / mass
  }
  const pullY = Math.min(PULL * aspect * aspect, 0.2)
  for (let step = 0; step < RELAX_STEPS; step++) {
    for (const node of nodes) {
      node.x -= node.x * PULL
      node.y -= node.y * pullY
    }
    separate(nodes)
    separate(nodes)
  }
  // Nothing overlaps at the end, whatever the pull left.
  for (let pass = 0; pass < 80; pass++) if (!separate(nodes)) break
}

/** Pushes every overlapping pair apart once (the smaller circle moves more); whether any moved. */
function separate(nodes: Bubble[]) {
  let moved = false
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i]
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const reach = a.r + b.r
      const squared = dx * dx + dy * dy
      if (squared >= reach * reach - 1e-6) continue
      moved = true
      const distance = Math.sqrt(squared)
      const overlap = reach - distance
      // Coincident centres part along a fixed direction, so the result stays deterministic.
      const nx = distance ? dx / distance : 1
      const ny = distance ? dy / distance : 0
      const share = (b.r * b.r) / (a.r * a.r + b.r * b.r)
      a.x -= nx * overlap * share
      a.y -= ny * overlap * share
      b.x += nx * overlap * (1 - share)
      b.y += ny * overlap * (1 - share)
    }
  }
  return moved
}
