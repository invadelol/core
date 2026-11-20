/**
 * Small pieces of the Facet look that are logic rather than CSS, shared by components/ui.
 */

const hex = (c: string) => [1, 3, 5].map((i) => Number.parseInt(c.slice(i, i + 2), 16))
function mix(a: string, b: string, t: number) {
  const x = hex(a)
  const y = hex(b)
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(' ')})`
}

/**
 * The score dial's colour: pink up to 25, then towards a quiet grey at 50 and the win blue at 75,
 * gold from 80 and a paler gold from 90 (the canvas's `dial_color`).
 */
export function dialColor(v: number) {
  if (v >= 90) return '#f6d88a'
  if (v >= 80) return '#e9c46a'
  if (v <= 25) return '#ec5f78'
  if (v <= 50) return mix('#ec5f78', '#9d96c8', (v - 25) / 25)
  return mix('#9d96c8', '#6c9bff', Math.min(1, (v - 50) / 25))
}

/** Rank tiers in the order of the ladder, lower case as /cdn names them. */
export const RANK_TIERS = [
  'iron',
  'bronze',
  'silver',
  'gold',
  'platinum',
  'emerald',
  'diamond',
  'master',
  'grandmaster',
  'challenger',
] as const
export type RankTier = (typeof RANK_TIERS)[number]

/**
 * Where each tier's crest sits in its /cdn/emblem picture (16:9, the crest in the middle), as
 * fractions of the picture's width and height: x0, y0, x1, y1. Measured on the art of 2026-11.
 */
const CREST_BOX: Record<RankTier, [number, number, number, number]> = {
  iron: [0.4242, 0.4125, 0.5773, 0.5778],
  bronze: [0.4102, 0.3833, 0.5922, 0.5958],
  silver: [0.4008, 0.3444, 0.5992, 0.5944],
  gold: [0.3992, 0.3306, 0.5992, 0.6292],
  platinum: [0.3977, 0.3111, 0.6023, 0.6188],
  emerald: [0.3879, 0.3194, 0.6137, 0.6174],
  diamond: [0.3789, 0.3667, 0.6227, 0.6236],
  master: [0.3844, 0.3306, 0.6172, 0.6306],
  grandmaster: [0.3789, 0.3361, 0.6219, 0.6431],
  challenger: [0.3758, 0.3056, 0.6258, 0.6375],
}

/**
 * The background that shows a tier's crest from /cdn/emblem filling a `size` px square (its
 * longer side at `fill` of it, centred): one image per tier for every size, nothing to crop.
 */
export function emblemBackground(tier: string, size: number, fill = 0.92) {
  const t = tier.toLowerCase() as RankTier
  const box = CREST_BOX[t]
  if (!box) return null
  const [x0, y0, x1, y1] = box
  const ratio = 9 / 16
  const k = Math.min((fill * size) / (x1 - x0), (fill * size) / ((y1 - y0) * ratio))
  const x = size / 2 - ((x0 + x1) / 2) * k
  const y = size / 2 - ((y0 + y1) / 2) * ratio * k
  const r = (n: number) => Math.round(n * 100) / 100
  return `url(/cdn/emblem/${t}.png) ${r(x)}px ${r(y)}px / ${r(k)}px auto no-repeat`
}

/**
 * The same crest in percentages of its box, so it stays framed at whatever size the stylesheet
 * gives the box (a page that shrinks its emblems on a phone).
 */
export function emblemBackgroundFluid(tier: string, fill = 0.92) {
  const t = tier.toLowerCase() as RankTier
  const box = CREST_BOX[t]
  if (!box) return null
  const [x0, y0, x1, y1] = box
  const ratio = 9 / 16
  // The picture's width in box widths, and where its corner sits, as background-position reads it.
  const k = Math.min(fill / (x1 - x0), fill / ((y1 - y0) * ratio))
  const x = 0.5 - ((x0 + x1) / 2) * k
  const y = 0.5 - ((y0 + y1) / 2) * ratio * k
  const r = (n: number) => Math.round(n * 100) / 100
  return `url(/cdn/emblem/${t}.png) ${r((x / (1 - k)) * 100)}% ${r((y / (1 - k * ratio)) * 100)}% / ${r(k * 100)}% auto no-repeat`
}
