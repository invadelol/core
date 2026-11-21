import type { Rank } from './types.js'

/**
 * A queue's LP history as the profile's rank card draws it: one point per change the stored rank
 * snapshots saw, joined by straight lines (no smoothing), over a range the player picks, on one
 * ladder axis with the tiers as guides.
 */

export const TIERS = [
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'EMERALD',
  'DIAMOND',
  'MASTER',
  'GRANDMASTER',
  'CHALLENGER',
] as const
const DIVISIONS = ['IV', 'III', 'II', 'I']
/** Master 0 LP on the ladder axis: Master, Grandmaster and Challenger share one LP scale above it. */
export const APEX = 2800

export type LpRange = '30d' | '120d' | '1y' | 'all'
export const LP_RANGES: ReadonlyArray<{ value: LpRange; name: string; days: number | null }> = [
  { value: '30d', name: '30 days', days: 30 },
  { value: '120d', name: '120 days', days: 120 },
  { value: '1y', name: '1 year', days: 365 },
  { value: 'all', name: 'All time', days: null },
]

/** A rank on one axis: Iron IV 0 LP is 0, each division 100 more, Master 0 LP is 2800 and up. */
export function ladderValue(rank: Pick<Rank, 'tier' | 'division' | 'leaguePoints'>) {
  const tier = TIERS.indexOf(rank.tier as (typeof TIERS)[number])
  if (tier < 0) return null
  const lp = Number(rank.leaguePoints) || 0
  if (tier >= 7) return APEX + lp
  const division = DIVISIONS.indexOf(rank.division)
  return tier * 400 + Math.max(0, division) * 100 + lp
}

export interface LpPoint {
  /** When the rank was read, in ms. */
  t: number
  /** Its place on the ladder axis (`ladderValue`). */
  v: number
  rank: Rank
}

/**
 * A queue's stored ranks, oldest first, as the LP it went through: a read that repeats the one
 * before (the same rank seen again) adds nothing, so each point is a change, roughly a game.
 */
export function lpPoints(history: ReadonlyArray<Rank>, queue: string): LpPoint[] {
  const points = history
    .filter((r) => r.queueType === queue && r.tier && r.fetchedAt)
    .map((rank) => ({ t: new Date(rank.fetchedAt).getTime(), v: ladderValue(rank), rank }))
    .filter((p): p is LpPoint => p.v !== null && Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t)
  return points.filter((p, i) => i === 0 || p.v !== points[i - 1].v)
}

/** Local midnight `days - 1` days before `now`: a range of 30 days ends today and holds 30. */
export function rangeStart(range: LpRange, now: number) {
  const days = LP_RANGES.find((r) => r.value === range)?.days
  if (!days) return null
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - (days - 1))
  return d.getTime()
}

/**
 * The points a range draws: the changes inside it, after the last one before it (where the range
 * started from). Fewer than two is no line.
 */
export function inRange(points: ReadonlyArray<LpPoint>, range: LpRange, now = Date.now()) {
  const from = rangeStart(range, now)
  if (from === null) return points.length > 1 ? [...points] : []
  const first = points.findIndex((p) => p.t >= from)
  if (first === -1) return []
  const drawn = points.slice(Math.max(0, first - 1))
  return drawn.length > 1 ? drawn : []
}

/** The shortest range that has a line, so a quiet month does not hide a whole season. */
export function firstRangeWithLine(points: ReadonlyArray<LpPoint>, now = Date.now()) {
  return LP_RANGES.find((r) => inRange(points, r.value, now).length > 1)?.value ?? null
}

/** The highest point of a queue's whole stored history. */
export function peakOf(points: ReadonlyArray<LpPoint>) {
  return points.reduce<LpPoint | null>((best, p) => (!best || p.v > best.v ? p : best), null)
}

export interface LpGuide {
  /** On the axis. */
  v: number
  tier: (typeof TIERS)[number]
  /** The division's numeral, the LP above Master, or nothing for a tier's floor. */
  label: string
  /** The tier's emblem sits on its lowest guide. */
  emblem: boolean
}

/**
 * The axis for values from `min` to `max`, padded out to whole guides so a few LP of noise read as
 * the small moves they are:
 *  - inside a tier or two (up to 5 divisions, a short climb into Master too): a guide per division,
 *    its numeral, the tier emblem;
 *  - a longer climb: a guide per tier (its IV floor), emblem only;
 *  - Master and up: the Master floor, then a guide every 100, 250 or 500 LP, labelled with its LP.
 */
export function lpScale(min: number, max: number) {
  // Divisions while the part under Master spans five at most, unless a long climb into it would
  // crowd the axis.
  const wide =
    Math.min(max, APEX) - Math.min(min, APEX) > 500 ||
    (max >= APEX && min < APEX && max - min > 600)
  const apexStep = max - APEX > 1200 ? 500 : max - APEX > 500 ? 250 : 100
  const floorOf = (v: number) =>
    v >= APEX
      ? APEX + Math.floor((v - APEX) / apexStep) * apexStep
      : wide
        ? Math.floor(v / 400) * 400
        : Math.floor(v / 100) * 100
  const next = (v: number) => (v >= APEX ? v + apexStep : wide ? Math.min(APEX, v + 400) : v + 100)
  const levels: number[] = []
  for (let v = floorOf(min); ; v = next(v)) {
    levels.push(v)
    if (v > max) break
  }
  let shown = ''
  const guides: LpGuide[] = levels.map((v) => {
    const tier = v >= APEX ? 'MASTER' : TIERS[Math.floor(v / 400)]
    const label =
      v > APEX ? `${v - APEX}` : v === APEX || wide ? '' : DIVISIONS[Math.floor(v / 100) % 4]
    const emblem = tier !== shown
    shown = tier
    return { v, tier, label, emblem }
  })
  return { lo: levels[0], hi: levels.at(-1)!, guides }
}

/** The line's path through `points` in a `w` × `h` box: straight segments, evenly spaced changes. */
export function lpPath(
  points: ReadonlyArray<LpPoint>,
  w: number,
  h: number,
  scale: { lo: number; hi: number },
  pad = 4
) {
  const n = points.length
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * w : w)
  const y = (v: number) =>
    pad + (h - 2 * pad) * (1 - (v - scale.lo) / Math.max(1, scale.hi - scale.lo))
  const xy = points.map((p, i) => [x(i), y(p.v)] as const)
  const d = xy.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ')
  return { d, area: `${d} L${w} ${h} L0 ${h} Z`, xy, y }
}
