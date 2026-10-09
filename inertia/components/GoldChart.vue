<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import ObjectiveGlyph from './ObjectiveGlyph.vue'
import { champIcon, championName } from '../lib/assets.js'
import { mmss, num, relation, short as compact, signedK as signedGold } from '../lib/match_view.js'
import type { MatchView, PlayerView, TimelineView } from '../lib/match_view.js'
import { leadFor, storyOf } from '../lib/match_story.js'

/**
 * All ten players over the game, on one chart. Lines are faint by default; the selected player
 * (brand) and their lane opponent are pinned, and the line nearest the pointer lights up with a
 * tooltip. The legend on the right is a live readout: every value follows the minute under the
 * pointer (or the end of the game), each with a bar on the lobby's scale at that minute, so the
 * comparison is read without hunting. Below the lines, the epic objectives and the team lead on
 * the same time axis explain the swings. Arrow keys move through the minutes.
 */
const props = defineProps<{
  detail: MatchView
  timeline: TimelineView
  selected: number
  me?: PlayerView
}>()

const METRICS = [
  { id: 'gold', label: 'Gold' },
  { id: 'xp', label: 'XP' },
  { id: 'cs', label: 'CS' },
] as const
type Metric = (typeof METRICS)[number]['id']
const metric = shallowRef<Metric>('gold')

const players = computed(() => props.detail.players)
const us = computed(() => props.me?.teamId ?? players.value[0]?.teamId ?? 100)
/** Blue against red: a team lead only means something with exactly these two sides (not Arena). */
const twoSides = computed(() => {
  const teams = new Set(players.value.map((p) => p.teamId))
  return teams.size === 2 && teams.has(100) && teams.has(200)
})
const series = computed(() =>
  players.value.map((_, i) => (props.timeline[metric.value][i] ?? []) as number[])
)
const times = computed(() => props.timeline.t)
const last = computed(() => Math.max(0, times.value.length - 1))
const fmt = (v: number) => (metric.value === 'cs' ? num(Math.round(v)) : compact(Math.round(v)))
const fmtSigned = (v: number) =>
  metric.value === 'cs'
    ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${num(Math.abs(Math.round(v)))}`
    : signedGold(Math.round(v))
/** Axis labels: round steps read better without a trailing ".0" (15k, not 15.0k). */
const tick = (v: number) =>
  metric.value !== 'cs' && Math.abs(v) >= 1000 && v % 1000 === 0 ? `${num(v / 1000)}k` : fmt(v)
const tickSigned = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + tick(Math.abs(v))
const unit = computed(() =>
  metric.value === 'gold' ? 'gold' : metric.value === 'xp' ? 'XP' : 'CS'
)

/** Lead of the viewed player's team in the current metric, per frame. */
const lead = computed(() => {
  if (metric.value === 'gold') return leadFor(props.timeline, us.value)
  if (metric.value === 'xp')
    return us.value === 200 ? props.timeline.xpDiff.map((v) => -v) : props.timeline.xpDiff
  return times.value.map((_, k) =>
    series.value.reduce(
      (s, row, i) => s + (players.value[i].teamId === us.value ? 1 : -1) * (row[k] ?? 0),
      0
    )
  )
})

// --- who is drawn how --------------------------------------------------------------------------------

const opponentIndex = (i: number) =>
  players.value.findIndex((p) => p.participantId === players.value[i]?.opponent)
const pinned = shallowRef<number[]>([])
watch(
  () => props.selected,
  (i) => {
    const opp = opponentIndex(i)
    pinned.value = opp >= 0 ? [i, opp] : [i]
  },
  { immediate: true }
)
const togglePin = (i: number) =>
  (pinned.value = pinned.value.includes(i)
    ? pinned.value.filter((x) => x !== i)
    : [...pinned.value, i])
/** The line under the pointer (chart, legend or end portrait). */
const hot = shallowRef<number | null>(null)
const colorOf = (i: number) =>
  i === props.selected
    ? 'var(--brand)'
    : relation(players.value[i].teamId, props.me) === 'ally'
      ? 'var(--win)'
      : 'var(--loss)'

// --- geometry ----------------------------------------------------------------------------------------

const plot = shallowRef<HTMLElement | null>(null)
const W = shallowRef(560)
let ro: ResizeObserver | undefined
onMounted(() => {
  ro = new ResizeObserver(([e]) => {
    const w = Math.round(e.contentRect.width)
    if (w > 0) W.value = w
  })
  if (plot.value) ro.observe(plot.value)
})
onBeforeUnmount(() => ro?.disconnect())

const L = 40
const R = 30
const MAIN_T = 10
const MAIN_H = 236
const LANE_Y = MAIN_T + MAIN_H + 22
const LEAD_T = LANE_Y + 16
const LEAD_H = 56
const AXIS_Y = LEAD_T + LEAD_H + 16
const H = AXIS_Y + 4

function niceStep(range: number, count: number) {
  const raw = range / count || 1
  const mag = 10 ** Math.floor(Math.log10(raw))
  const n = raw / mag
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag
}

const geo = computed(() => {
  const ts = times.value
  const n = ts.length
  if (n < 2) return null
  const tmax = ts[n - 1] || 1
  const w = W.value
  const x = (sec: number) => L + (sec / tmax) * (w - L - R)
  let hi = 1
  for (const row of series.value) for (const v of row) hi = Math.max(hi, v)
  const step = niceStep(hi, 4)
  hi = Math.ceil(hi / step) * step
  const y = (v: number) => MAIN_T + (1 - v / hi) * MAIN_H
  const yTicks: { y: number; label: string }[] = []
  for (let v = 0; v <= hi + 1e-9; v += step) yTicks.push({ y: y(v), label: v ? tick(v) : '0' })
  const every = tmax > 2700 ? 600 : 300
  const xTicks: { x: number; label: string }[] = []
  for (let s = every; s < tmax - every / 3; s += every) xTicks.push({ x: x(s), label: mmss(s) })

  const paths = series.value.map((row) => {
    let d = ''
    for (let k = 0; k < Math.min(n, row.length); k++)
      d += `${k ? 'L' : 'M'}${x(ts[k]).toFixed(1)} ${y(row[k]).toFixed(1)}`
    return d
  })

  // The lead band: its own symmetric scale, ahead above the line.
  const lv = lead.value
  const peak = Math.max(1, ...lv.map(Math.abs))
  const lstep = niceStep(peak, 3)
  const lmax = Math.ceil(peak / lstep) * lstep
  const zero = LEAD_T + LEAD_H / 2
  const ly = (v: number) => zero - (v / lmax) * (LEAD_H / 2)
  let leadLine = ''
  lv.forEach(
    (v, k) => (leadLine += `${k ? 'L' : 'M'}${x(ts[k] ?? 0).toFixed(1)} ${ly(v).toFixed(1)}`)
  )
  const leadArea = leadLine
    ? `${leadLine}L${x(ts[lv.length - 1] ?? 0).toFixed(1)} ${zero}L${L} ${zero}Z`
    : ''

  // End portraits: one per line, nudged apart so they never sit on each other.
  const ends = series.value
    .map((row, i) => ({ i, y: y(row[Math.min(n, row.length) - 1] ?? 0) }))
    .sort((a, b) => a.y - b.y)
  for (let k = 1; k < ends.length; k++) ends[k].y = Math.max(ends[k].y, ends[k - 1].y + 15)
  const overflow = (ends[ends.length - 1]?.y ?? 0) - (MAIN_T + MAIN_H)
  if (overflow > 0) for (const e of ends) e.y -= overflow

  return { x, y, ly, zero, lmax, tmax, w, paths, yTicks, xTicks, leadLine, leadArea, ends }
})

/** Epic objectives on the time axis (towers would only be noise here). */
const marks = computed(() => {
  const g = geo.value
  if (!g) return []
  const ICON = {
    dragon: 'dragon',
    baron: 'baron',
    herald: 'herald',
    grubs: 'grubs',
    monster: 'dragon',
    inhibitor: 'inhib',
  } as const
  return storyOf(props.detail, props.timeline)
    .events.filter((e) => e.kind === 'objective' && e.obj.kind !== 'tower')
    .map((e) => {
      const o = e.kind === 'objective' ? e : null!
      return {
        key: o.key,
        x: g.x(o.t),
        icon: ICON[o.obj.kind as keyof typeof ICON],
        side: relation(o.team, props.me),
        title: `${mmss(o.t)} · ${o.team === us.value ? 'Your team' : 'Enemy team'}`,
      }
    })
})

// --- the pointer ---------------------------------------------------------------------------------------

/** Frame index under the pointer (`null` = the end of the game is read). */
const cursor = shallowRef<number | null>(null)
const pointerY = shallowRef(0)
function frameAt(px: number) {
  const g = geo.value!
  const sec = ((px - L) / (g.w - L - R)) * g.tmax
  let best = 0
  for (let k = 1; k < times.value.length; k++)
    if (Math.abs(times.value[k] - sec) < Math.abs(times.value[best] - sec)) best = k
  return best
}
function move(e: PointerEvent) {
  const g = geo.value
  if (!g) return
  const r = (e.currentTarget as Element).getBoundingClientRect()
  const px = e.clientX - r.left
  const py = e.clientY - r.top
  const k = frameAt(px)
  cursor.value = k
  pointerY.value = py
  // The nearest line within reach lights up; elsewhere (the lead band) nothing does.
  if (py > MAIN_T + MAIN_H + 6) return (hot.value = null)
  let best: number | null = null
  let dist = 18
  series.value.forEach((row, i) => {
    const d = Math.abs(g.y(row[k] ?? 0) - py)
    if (d < dist) {
      dist = d
      best = i
    }
  })
  hot.value = best
}
function leave() {
  cursor.value = null
  hot.value = null
}
function key(e: KeyboardEvent) {
  const k = cursor.value ?? last.value
  if (e.key === 'ArrowLeft') cursor.value = Math.max(0, k - 1)
  else if (e.key === 'ArrowRight') cursor.value = Math.min(last.value, k + 1)
  else if (e.key === 'Home') cursor.value = 0
  else if (e.key === 'End') cursor.value = last.value
  else if (e.key === 'Escape') return leave()
  else return
  e.preventDefault()
}

const at = computed(() => cursor.value ?? last.value)
const value = (i: number, k = at.value) => series.value[i]?.[k] ?? 0

/** Lines in drawing order: faint ones first, then pinned, then the hot one on top. */
const order = computed(() => {
  const rank = (i: number) =>
    i === hot.value ? 3 : i === props.selected ? 2 : pinned.value.includes(i) ? 1 : 0
  return players.value.map((_, i) => i).sort((a, b) => rank(a) - rank(b))
})
const dots = computed(() => {
  const g = geo.value
  if (!g || cursor.value === null) return []
  const ids = new Set([...pinned.value, ...(hot.value !== null ? [hot.value] : [])])
  return [...ids].map((i) => ({ i, y: g.y(value(i)), color: colorOf(i) }))
})

/** Legend: both teams with their total at the minute read, and each player on the lobby's scale. */
const legend = computed(() => {
  const k = at.value
  const top = Math.max(1, ...players.value.map((_, i) => value(i, k)))
  const named = props.me ? ['Your team', 'Enemy team'] : ['Blue side', 'Red side']
  const teams = [us.value, ...(players.value.some((p) => p.teamId !== us.value) ? [-1] : [])]
  return teams.map((team, n) => {
    const rows = players.value
      .map((p, i) => ({ p, i, v: value(i, k) }))
      .filter((r) => (team === -1 ? r.p.teamId !== us.value : r.p.teamId === team))
      .map((r) => ({ ...r, w: (r.v / top) * 100 }))
    return {
      team,
      label: named[n],
      side: n ? 'enemy' : 'ally',
      total: rows.reduce((s, r) => s + r.v, 0),
      rows,
    }
  })
})
const leadNow = computed(() => lead.value[at.value] ?? 0)

/** The tooltip of the hot line: its value, its place in the lobby, its last minute, its lane duel. */
const tip = computed(() => {
  const g = geo.value
  const i = hot.value
  const k = cursor.value
  if (!g || i === null || k === null) return null
  const p = players.value[i]
  const v = value(i, k)
  const place = 1 + players.value.filter((_, j) => value(j, k) > v).length
  const opp = opponentIndex(i)
  const x = g.x(times.value[k])
  return {
    p,
    v,
    place,
    gained: k > 0 ? v - value(i, k - 1) : null,
    vs: opp >= 0 ? duel(i, opp, k) : null,
    left: x,
    top: Math.max(MAIN_T, Math.min(MAIN_T + MAIN_H - 40, g.y(v))),
    flip: x > g.w * 0.58,
  }
})
/** A lane duel, coloured for the viewed player: blue when it favours their side. */
function duel(i: number, opp: number, k: number) {
  const d = value(i, k) - value(opp, k)
  const good = relation(players.value[i].teamId, props.me) === 'ally' ? d > 0 : d < 0
  return { p: players.value[opp], d, tone: d === 0 ? '' : good ? 'ally' : 'enemy' }
}
const ordinal = (n: number) => `${n} of ${players.value.length}`
</script>

<template>
  <div class="gch">
    <header class="gch-head">
      <p class="gch-read" aria-live="polite">
        <span class="gch-when">{{ cursor === null ? 'End of game' : mmss(times[at]) }}</span>
        <template v-if="twoSides">
          <span class="gch-who">{{ me ? 'Your team' : 'Blue side' }}</span>
          <b :class="leadNow > 0 ? 'ally' : leadNow < 0 ? 'enemy' : ''">{{
            leadNow === 0 ? 'even' : fmtSigned(leadNow)
          }}</b>
          <span class="gch-unit">{{ unit }}</span>
        </template>
      </p>
      <div class="seg seg-sm">
        <button
          v-for="m in METRICS"
          :key="m.id"
          type="button"
          :data-active="metric === m.id"
          @click="metric = m.id"
        >
          {{ m.label }}
        </button>
      </div>
    </header>

    <div class="gch-main">
      <div
        ref="plot"
        class="gch-plot"
        tabindex="0"
        role="img"
        :aria-label="`${METRICS.find((m) => m.id === metric)!.label} of each player over the game`"
        @keydown="key"
      >
        <svg
          v-if="geo"
          :viewBox="`0 0 ${geo.w} ${H}`"
          :height="H"
          :class="{ 'has-hot': hot !== null }"
          @pointermove="move"
          @pointerleave="leave"
        >
          <g class="gch-grid">
            <template v-for="tk in geo.yTicks" :key="`y${tk.y}`">
              <line :x1="L" :x2="geo.w - R" :y1="tk.y" :y2="tk.y" />
              <text :x="L - 8" :y="tk.y + 3.5" text-anchor="end">{{ tk.label }}</text>
            </template>
            <line
              v-for="tk in geo.xTicks"
              :key="`x${tk.x}`"
              class="v"
              :x1="tk.x"
              :x2="tk.x"
              :y1="MAIN_T"
              :y2="LEAD_T + LEAD_H"
            />
            <text
              v-for="tk in geo.xTicks"
              :key="`xl${tk.x}`"
              :x="tk.x"
              :y="AXIS_Y"
              text-anchor="middle"
            >
              {{ tk.label }}
            </text>
            <text :x="geo.w - R" :y="AXIS_Y" text-anchor="end">{{ mmss(geo.tmax) }}</text>
          </g>

          <g :key="metric" class="gch-lines">
            <path
              v-for="i in order"
              :key="i"
              :d="geo.paths[i]"
              pathLength="1"
              class="gch-line"
              :class="{ pin: pinned.includes(i), self: i === selected, hot: i === hot }"
              :style="{ '--c': colorOf(i) }"
            />
          </g>

          <!-- The team lead, on its own band and scale. -->
          <g v-if="twoSides" class="gch-lead">
            <defs>
              <clipPath id="gch-up">
                <rect :x="L" :y="LEAD_T" :width="Math.max(0, geo.w - L - R)" :height="LEAD_H / 2" />
              </clipPath>
              <clipPath id="gch-down">
                <rect
                  :x="L"
                  :y="geo.zero"
                  :width="Math.max(0, geo.w - L - R)"
                  :height="LEAD_H / 2"
                />
              </clipPath>
            </defs>
            <text :x="L - 8" :y="LEAD_T + 9" text-anchor="end">{{ tickSigned(geo.lmax) }}</text>
            <text :x="L - 8" :y="LEAD_T + LEAD_H" text-anchor="end">
              {{ tickSigned(-geo.lmax) }}
            </text>
            <path class="up" :d="geo.leadArea" clip-path="url(#gch-up)" />
            <path class="down" :d="geo.leadArea" clip-path="url(#gch-down)" />
            <line class="zero" :x1="L" :x2="geo.w - R" :y1="geo.zero" :y2="geo.zero" />
            <path class="line" :d="geo.leadLine" />
          </g>

          <g v-if="cursor !== null">
            <line
              class="gch-cross"
              :x1="geo.x(times[cursor])"
              :x2="geo.x(times[cursor])"
              :y1="MAIN_T"
              :y2="LEAD_T + LEAD_H"
            />
            <circle
              v-for="d in dots"
              :key="d.i"
              class="gch-dot"
              :class="{ hot: d.i === hot }"
              :cx="geo.x(times[cursor])"
              :cy="d.y"
              :r="d.i === hot ? 4.5 : 3.5"
              :style="{ fill: d.color }"
            />
            <circle
              v-if="twoSides"
              class="gch-dot"
              :cx="geo.x(times[cursor])"
              :cy="geo.ly(lead[cursor] ?? 0)"
              r="3"
              :style="{ fill: 'var(--text-1)' }"
            />
          </g>
        </svg>

        <template v-if="geo">
          <span class="gch-band-label" :style="{ top: `${LEAD_T - 13}px`, left: `${L}px` }"
            >Team lead</span
          >
          <span
            v-for="m in marks"
            :key="m.key"
            class="gch-mark"
            :class="m.side"
            :style="{ left: `${m.x}px`, top: `${LANE_Y}px` }"
            :title="m.title"
            ><ObjectiveGlyph :name="m.icon" :size="12"
          /></span>
          <img
            v-for="e in geo.ends"
            :key="e.i"
            class="gch-end"
            :class="{
              pin: pinned.includes(e.i),
              self: e.i === selected,
              hot: e.i === hot,
              dim: hot !== null && e.i !== hot,
            }"
            :src="champIcon(players[e.i].championId)"
            :style="{ 'left': `${geo.w - R + 8}px`, 'top': `${e.y}px`, '--c': colorOf(e.i) }"
            :title="players[e.i].gameName || championName(players[e.i].championId)"
            alt=""
            @pointerenter="hot = e.i"
            @pointerleave="hot = null"
            @click="togglePin(e.i)"
          />
          <span
            v-if="cursor !== null && !tip"
            class="gch-chip"
            :style="{ left: `${geo.x(times[cursor])}px` }"
            >{{ mmss(times[cursor]) }}</span
          >
          <div
            v-if="tip"
            class="gch-tip"
            :class="{ flip: tip.flip }"
            :style="{ 'left': `${tip.left}px`, 'top': `${tip.top}px`, '--c': colorOf(hot!) }"
          >
            <p class="gch-tip-who">
              <img :src="champIcon(tip.p.championId)" alt="" />
              <b>{{ tip.p.gameName || championName(tip.p.championId) }}</b>
              <small>{{ championName(tip.p.championId) }}</small>
            </p>
            <p class="gch-tip-v">
              <b>{{ num(tip.v) }}</b> <span>{{ unit }}</span>
              <span class="gch-tip-place">{{ ordinal(tip.place) }}</span>
            </p>
            <p v-if="tip.gained !== null" class="gch-tip-row">
              <span>Last minute</span><b>{{ fmtSigned(tip.gained) }}</b>
            </p>
            <p v-if="tip.vs" class="gch-tip-row">
              <span>vs {{ championName(tip.vs.p.championId) }}</span>
              <b :class="tip.vs.tone">{{ fmtSigned(tip.vs.d) }}</b>
            </p>
            <p class="gch-tip-time">{{ mmss(times[cursor!]) }}</p>
          </div>
        </template>
      </div>

      <aside class="gch-legend" @pointerleave="hot = null">
        <section v-for="g in legend" :key="g.team" class="gch-team" :class="g.side">
          <h5>
            <span>{{ g.label }}</span>
            <b>{{ fmt(g.total) }}</b>
          </h5>
          <button
            v-for="r in g.rows"
            :key="r.i"
            type="button"
            class="gch-row"
            :class="{ pin: pinned.includes(r.i), self: r.i === selected, hot: r.i === hot }"
            :style="{ '--c': colorOf(r.i), '--w': `${r.w}%` }"
            :aria-pressed="pinned.includes(r.i)"
            @pointerenter="hot = r.i"
            @focus="hot = r.i"
            @blur="hot = null"
            @click="togglePin(r.i)"
          >
            <img :src="champIcon(r.p.championId)" alt="" />
            <span class="gch-name">{{ r.p.gameName || championName(r.p.championId) }}</span>
            <b>{{ fmt(r.v) }}</b>
          </button>
        </section>
        <p class="gch-hint">Click a player to pin their line</p>
      </aside>
    </div>
  </div>
</template>
