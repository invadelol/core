import { leadFor, storyOf } from '@invadelol/ui/logic'
import type { MatchDetail, PlayerView, TimelineView } from '@invadelol/ui/logic'

/**
 * The match Chart tab's model: every player's gold, XP or CS a minute from the stored timeline,
 * the team lead as one bar a minute, the objectives on one row, and the ten portraits stacked at
 * the line ends. Pure numbers and paths; the component draws them.
 */

export type Metric = 'gold' | 'xp' | 'cs'

/** Riot's lane order, so a team's rows never move while the pointer reads the game. */
const LANES = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT']

/** A lead this small (gold or XP; CS uses a tenth of it) is even: a flat tick, not a bar. */
export const EVEN_GOLD = 300
/** A frame this close to the last one gives its bar to the end of the game. */
const END_MERGE = 45

export const evenWithin = (metric: Metric) => (metric === 'cs' ? EVEN_GOLD / 100 : EVEN_GOLD)

/** "18.2k", "771", "306": thousands with one decimal, CS whole. */
export function short(v: number, metric: Metric = 'gold') {
  const a = Math.abs(Math.round(v))
  if (metric === 'cs' || a < 1000) return String(a)
  return `${(a / 1000).toFixed(a >= 100_000 ? 0 : 1)}k`
}
/** An axis label: "5k", "12.5k", "300". */
export const tick = (v: number, metric: Metric = 'gold') =>
  metric === 'cs' || v < 1000 ? String(v) : `${+(v / 1000).toFixed(1)}k`
/** "+3.5k", "−771", "0". */
export const signed = (v: number, metric: Metric = 'gold') =>
  `${Math.round(v) > 0 ? '+' : Math.round(v) < 0 ? '−' : ''}${short(v, metric)}`
/** "34:00", "41:33". */
export const clock = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** The two sides of a 5v5 game (Arena and other modes have no single lead to draw). */
export const twoTeams = (d: MatchDetail) => {
  const ids = new Set(d.players.map((p) => p.teamId))
  return ids.size === 2 && ids.has(100) && ids.has(200)
}

/** Each player's series for the metric, index for index with `detail.players`. */
export const seriesOf = (t: TimelineView, metric: Metric, count: number) =>
  Array.from({ length: count }, (_, i) => t[metric][i] ?? [])

/** The lead of `team` a frame: gold and XP as the timeline gives them, CS summed per side. */
export function leadOf(d: MatchDetail, t: TimelineView, team: number, metric: Metric): number[] {
  if (metric === 'gold') return leadFor(t, team)
  if (metric === 'xp') return team === 200 ? t.xpDiff.map((v) => -v) : t.xpDiff
  const cs = seriesOf(t, 'cs', d.players.length)
  return t.t.map((_, f) =>
    d.players.reduce((s, p, i) => s + (p.teamId === team ? 1 : -1) * (cs[i][f] ?? 0), 0)
  )
}

/**
 * One bar a minute: every frame after the first, except a frame closer than 45 s to the end,
 * whose minute the end of the game takes (a 41:33 game has 41 bars, the last at 41:33).
 */
export function leadBars(times: number[], lead: number[]) {
  const last = times.length - 1
  const bars: { frame: number; t: number; v: number }[] = []
  for (let f = 1; f <= last; f++) {
    if (f < last && times[last] - times[f] < END_MERGE) continue
    bars.push({ frame: f, t: times[f], v: lead[f] ?? 0 })
  }
  return bars
}

/** The bar a frame reads: its own, or the end's when the end took its minute; none at 0:00. */
export function barOf(bars: { frame: number }[], frame: number) {
  if (frame <= 0) return -1
  const i = bars.findIndex((b) => b.frame >= frame)
  return i < 0 ? bars.length - 1 : i
}

/** A round step that cuts `span` in about `count` parts (1, 2, 2.5, 5 × 10ⁿ). */
export function niceStep(span: number, count: number) {
  const raw = span / count || 1
  const p = 10 ** Math.floor(Math.log10(raw))
  const s = raw / p
  return (s <= 1 ? 1 : s <= 2 ? 2 : s <= 2.5 ? 2.5 : s <= 5 ? 5 : 10) * p
}

/** The value axis: hairline guides at round steps, a little room above the highest line. */
export function valueAxis(max: number) {
  const step = niceStep(Math.max(1, max), 4)
  // The guide just above the highest line is drawn when the line comes close to it.
  const reach = max + step * 0.5
  const ticks: number[] = []
  for (let v = step; v <= reach; v += step) ticks.push(v)
  const top = Math.max(max, ticks.at(-1) ?? 0)
  return { step, ticks, hi: top * 1.05 }
}

/** Time ticks every 5 minutes (10 on a narrow chart or a long game), never on the end's label. */
export function timeTicks(duration: number, narrow: boolean) {
  const every = narrow || duration > 2700 ? 600 : 300
  const out: number[] = []
  for (let s = every; s <= duration - 60; s += every) out.push(s)
  return out
}

/** Monotone cubic through the points: smooth, and never past a value the game did not reach. */
export function smoothPath(pts: Array<[number, number]>) {
  const n = pts.length
  if (!n) return ''
  if (n === 1) return `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  const dx: number[] = []
  const sl: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0] || 1e-6)
    sl.push((pts[i + 1][1] - pts[i][1]) / dx[i])
  }
  const m = [sl[0]]
  for (let i = 1; i < n - 1; i++) m.push(sl[i - 1] * sl[i] <= 0 ? 0 : (sl[i - 1] + sl[i]) / 2)
  m.push(sl[n - 2])
  for (let i = 0; i < n - 1; i++) {
    if (sl[i] === 0) {
      m[i] = m[i + 1] = 0
      continue
    }
    const a = m[i] / sl[i]
    const b = m[i + 1] / sl[i]
    const q = a * a + b * b
    if (q > 9) {
      const k = 3 / Math.sqrt(q)
      m[i] = k * a * sl[i]
      m[i + 1] = k * b * sl[i]
    }
  }
  const f = (v: number) => v.toFixed(1)
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += ` C${f(pts[i][0] + h)} ${f(pts[i][1] + m[i] * h)} ${f(pts[i + 1][0] - h)} ${f(pts[i + 1][1] - m[i + 1] * h)} ${f(pts[i + 1][0])} ${f(pts[i + 1][1])}`
  }
  return d
}

/**
 * Labels stacked at the line ends: each at its line's height, pushed down where two meet, then
 * back up from the bottom so the last one stays inside.
 */
export function stack(ys: number[], gap: number, bottom: number) {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y || a.i - b.i)
  for (let k = 1; k < order.length; k++) order[k].y = Math.max(order[k].y, order[k - 1].y + gap)
  const over = (order.at(-1)?.y ?? 0) - bottom
  if (over > 0) {
    order.at(-1)!.y -= over
    for (let k = order.length - 2; k >= 0; k--)
      order[k].y = Math.min(order[k].y, order[k + 1].y - gap)
  }
  const out = new Array<number>(ys.length)
  for (const o of order) out[o.i] = o.y
  return out
}

/**
 * Marks on one row: each at its time, pushed right where they crowd, then back from the end of the
 * game so none passes it. `gap` is the room a mark needs after the one before it.
 */
export function spread(xs: number[], gaps: number[], xmax: number) {
  const out: number[] = []
  xs.forEach((x, j) => out.push(j && x - out[j - 1] < gaps[j] ? out[j - 1] + gaps[j] : x))
  for (let j = out.length - 1; j >= 0; j--)
    out[j] = Math.min(out[j], j === out.length - 1 ? xmax : out[j + 1] - gaps[j + 1])
  return out
}

export type MarkIcon = 'dragon' | 'baron' | 'herald' | 'grubs' | 'inhib' | 'tower'
const ICON: Record<string, MarkIcon> = {
  dragon: 'dragon',
  monster: 'dragon',
  baron: 'baron',
  herald: 'herald',
  grubs: 'grubs',
  inhibitor: 'inhib',
  tower: 'tower',
}

/** The objectives in order (voidgrubs taken together count once), towers marked small. */
export function objectivesOf(d: MatchDetail, t: TimelineView) {
  return storyOf(d, t)
    .events.filter((e) => e.kind === 'objective')
    .map((e) => {
      const o = e.kind === 'objective' ? e : null!
      return {
        key: o.key,
        t: o.t,
        team: o.team,
        icon: ICON[o.obj.kind] ?? 'dragon',
        small: o.obj.kind === 'tower',
      }
    })
}

/** Players of a team in lane order (players without a lane keep their order, after the lanes). */
export function laneOrder(players: PlayerView[], team: number) {
  return players
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.teamId === team)
    .sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i)
    .map(({ i }) => i)
}
const rank = (p: PlayerView) => {
  const r = LANES.indexOf(p.position ?? '')
  return r < 0 ? LANES.length : r
}

/** Index of a player's lane opponent, or -1. */
export function opponentOf(players: PlayerView[], i: number) {
  const id = players[i]?.opponent
  return id ? players.findIndex((p) => p.participantId === id) : -1
}

/** The frame nearest to second `s`. */
export function frameAt(times: number[], s: number) {
  let best = 0
  for (let f = 1; f < times.length; f++)
    if (Math.abs(times[f] - s) < Math.abs(times[best] - s)) best = f
  return best
}
