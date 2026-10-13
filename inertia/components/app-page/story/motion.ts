/**
 * The story's motion: everything on the stage is a pure function of a chapter's progress (0…1),
 * so scrolling back undoes it exactly and reduced motion is simply progress 1. These helpers turn
 * that progress into the parts of a moment: a segment of it, eased.
 */

export const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x))

/** Where `p` is inside [a, b], from 0 to 1. */
export const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a))

export const lerp = (a: number, b: number, k: number) => a + (b - a) * k

/** A CSS cubic-bezier as a function of x (Newton, then bisection). */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t
  const sy = (t: number) => ((ay * t + by) * t + cy) * t
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 6; i++) {
      const err = sx(t) - x
      const d = dx(t)
      if (Math.abs(err) < 1e-5) return sy(t)
      if (Math.abs(d) < 1e-6) break
      t -= err / d
    }
    let lo = 0
    let hi = 1
    t = x
    for (let i = 0; i < 20; i++) {
      const v = sx(t)
      if (Math.abs(v - x) < 1e-5) break
      if (v < x) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
    return sy(t)
  }
}

/** Arrivals: fast, then a long settle. */
export const out = bezier(0.16, 1, 0.3, 1)
/** Exits: a slow start, then gone. */
export const inn = bezier(0.7, 0, 0.84, 0)
/** Moves from one place to another. */
export const inOut = bezier(0.65, 0, 0.35, 1)

/** A landing with a little give, for what is physical (a key, a plate, a drake): ~6% overshoot. */
export function land(k: number) {
  if (k <= 0) return 0
  if (k >= 1) return 1
  const c1 = 1.2
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2)
}

/** A segment of `p`, eased. */
export const ease = (p: number, a: number, b: number, fn: (k: number) => number = out) =>
  fn(seg(p, a, b))

/** In then out: 0 → 1 over [a, b], 1 until c, 1 → 0 over [c, d]. */
export const span = (p: number, a: number, b: number, c: number, d: number) =>
  Math.min(ease(p, a, b), 1 - ease(p, c, d, inn))

/** 75 → "1:15". */
export function mmss(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** An arrival as a style: fade and rise (or any offset) by `k`. */
export function rise(k: number, dy = 14, dx = 0, scale = 1) {
  const s = scale === 1 ? '' : ` scale(${lerp(scale, 1, k).toFixed(4)})`
  return {
    opacity: k.toFixed(3),
    transform: `translate3d(${((1 - k) * dx).toFixed(2)}px, ${((1 - k) * dy).toFixed(2)}px, 0)${s}`,
  }
}
