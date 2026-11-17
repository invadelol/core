<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from 'vue'
import { ObjectiveIcon } from '@invadelol/ui'
import type { MatchDetail, PlayerView, TimelineView } from '@invadelol/ui/logic'
import { champIcon, championName } from '../../lib/assets.js'
import {
  barOf,
  clock,
  evenWithin,
  frameAt,
  laneOrder,
  leadBars,
  leadOf,
  objectivesOf,
  opponentOf,
  seriesOf,
  short,
  smoothPath,
  spread,
  stack,
  tick,
  timeTicks,
  twoTeams,
  valueAxis,
  type Metric,
} from '../../lib/match_chart.js'

/**
 * A game's Chart: every player's gold, XP or CS a minute (the viewed player's line in violet with
 * a soft fade, the lane opponent's calm pink, a pinned player's blue, the rest faint by team), the
 * objectives on one row, the team lead as one bar a minute, and both teams on the right. The
 * pointer, a tap or the arrow keys read any minute; a row pins that player's line.
 */
const props = defineProps<{
  detail: MatchDetail
  timeline: TimelineView
  /** Index of the viewed player in `detail.players`. */
  selected: number
  /** The profile's player, when the game is read from their side. */
  me?: PlayerView
}>()

const METRICS: { id: Metric; label: string; unit: string }[] = [
  { id: 'gold', label: 'Gold', unit: 'gold' },
  { id: 'xp', label: 'XP', unit: 'XP' },
  { id: 'cs', label: 'CS', unit: 'CS' },
]
const metric = shallowRef<Metric>('gold')
const unit = computed(() => METRICS.find((m) => m.id === metric.value)!.unit)
const label = computed(() => METRICS.find((m) => m.id === metric.value)!.label)

const players = computed(() => props.detail.players)
const me = computed(() => Math.max(0, Math.min(players.value.length - 1, props.selected)))
const ally = computed(() => (props.me ?? players.value[me.value])?.teamId ?? 100)
const two = computed(() => twoTeams(props.detail))
const opp = computed(() => opponentOf(players.value, me.value))
const pin = shallowRef<number | null>(null)
watch(
  () => [props.detail, props.selected],
  () => (pin.value = null)
)
function toggle(i: number) {
  pin.value = pin.value === i ? null : i
}
type Role = 'me' | 'opp' | 'pin' | 'ally' | 'enemy'
const role = (i: number): Role =>
  i === me.value
    ? 'me'
    : i === opp.value
      ? 'opp'
      : i === pin.value
        ? 'pin'
        : players.value[i].teamId === ally.value
          ? 'ally'
          : 'enemy'
const sideName = (teamId: number) => (teamId === 100 ? 'Blue side' : 'Red side')
const allyLabel = computed(() => (props.me ? 'Your team' : sideName(ally.value)))
const enemyLabel = computed(() =>
  !two.value ? 'Others' : props.me ? 'Enemy team' : sideName(ally.value === 100 ? 200 : 100)
)

const times = computed(() => props.timeline.t)
const last = computed(() => Math.max(0, times.value.length - 1))
const end = computed(() => times.value[last.value] || 1)
const series = computed(() => seriesOf(props.timeline, metric.value, players.value.length))
const lead = computed(() =>
  two.value ? leadOf(props.detail, props.timeline, ally.value, metric.value) : []
)

/* ── Size: the chart draws at its own width, so the type never stretches ── */
const plot = ref<HTMLElement | null>(null)
const width = shallowRef(580)
let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(([e]) => {
    const w = Math.round(e.contentRect.width)
    if (w > 0) width.value = w
  })
  if (plot.value) observer.observe(plot.value)
})
onBeforeUnmount(() => observer?.disconnect())

const geo = computed(() => {
  const W = width.value
  const narrow = W < 460
  const GL = narrow ? 32 : 62
  const ER = 34
  const PW = Math.max(60, W - GL - ER)
  const top = 6
  const H = 192
  const CH = top + H
  const tO = CH + 20
  const tL = tO + 38
  const LH = 20
  const tA = two.value ? tL + LH + 20 : tO + 32
  let max = 1
  for (const s of series.value) for (const v of s) max = Math.max(max, v)
  const axis = valueAxis(max)
  const x = (s: number) => GL + (s / end.value) * PW
  const y = (v: number) => top + ((axis.hi - v) / axis.hi) * H
  return { W, narrow, GL, PW, top, CH, tO, tL, LH, tA, TH: tA + 4, axis, x, y }
})

const lines = computed(() => {
  const { x, y } = geo.value
  return series.value.map((s) => smoothPath(times.value.map((t, f) => [x(t), y(s[f] ?? 0)])))
})
/** Faint lines first, then the opponent, the pinned player and the viewed player on top. */
const drawOrder = computed(() => {
  const z: Record<Role, number> = { ally: 0, enemy: 0, opp: 1, pin: 2, me: 3 }
  return players.value.map((_, i) => i).sort((a, b) => z[role(a)] - z[role(b)])
})
const fade = computed(() => {
  const { x, y, CH } = geo.value
  const s = series.value[me.value] ?? []
  const peak = y(Math.max(0, ...s))
  return {
    d: `${lines.value[me.value]} L${x(end.value).toFixed(1)} ${y(0).toFixed(1)} L${x(times.value[0] ?? 0).toFixed(1)} ${y(0).toFixed(1)} Z`,
    y1: peak,
    y2: CH,
  }
})
const gradId = `mc-fade-${useId()}`

const guides = computed(() => {
  const { GL, PW, y, axis } = geo.value
  return [
    { y: y(0), zero: true, label: '' },
    ...axis.ticks.map((v) => ({ y: y(v), zero: false, label: tick(v, metric.value) })),
  ].map((g) => ({ ...g, x1: GL, x2: GL + PW }))
})
const ticks = computed(() =>
  timeTicks(end.value, geo.value.narrow).map((s) => ({ x: geo.value.x(s), label: clock(s) }))
)

/* ── The team lead: one bar a minute from a hairline zero ── */
const bars = computed(() => {
  if (!two.value) return null
  const { x, PW, tL, LH } = geo.value
  const list = leadBars(times.value, lead.value)
  if (!list.length) return null
  const even = evenWithin(metric.value)
  const most = Math.max(...list.map((b) => Math.abs(b.v)))
  // Thin at any width: on the wide match page the columns grow, the bars don't.
  const w = Math.min(11, Math.max(1, PW / list.length - 2))
  return {
    most,
    list: list.map((b) => {
      const a = Math.abs(b.v)
      const flat = a <= even || most <= even
      const h = flat ? 2 : Math.max(2.5, (a / most) * LH)
      return {
        x: x(b.t) - w / 2,
        w,
        y: flat ? tL - 1 : b.v > 0 ? tL - h : tL,
        h,
        cls: flat ? 'z' : b.v > 0 ? 'up' : 'dn',
      }
    }),
  }
})

/* ── Objectives on one row, nudged apart where they crowd ── */
const marks = computed(() => {
  const { x, GL } = geo.value
  const xmax = x(end.value) + 2
  const room = xmax - GL + 7
  const gap = (o: { small: boolean }) => (o.small ? 11 : 15)
  const need = (l: { small: boolean }[]) => l.reduce((s, o) => s + gap(o), 0)
  let list = objectivesOf(props.detail, props.timeline)
  // A narrow chart keeps the map-changing objectives; the towers go first.
  if (need(list) > room) list = list.filter((o) => !o.small)
  const squeeze = Math.min(1, room / Math.max(1, need(list)))
  const xs = spread(
    list.map((o) => x(o.t)),
    list.map((o) => gap(o) * squeeze),
    xmax
  )
  return list.map((o, j) => ({
    ...o,
    x: xs[j],
    side: o.team === ally.value ? 'ally' : 'enemy',
    title: `${clock(o.t)} · ${o.team === ally.value ? allyLabel.value : enemyLabel.value}`,
  }))
})

/* ── The ten portraits at the line ends ── */
const ends = computed(() => {
  const { y, CH, GL, PW } = geo.value
  const ys = stack(
    series.value.map((s) => y(s.at(-1) ?? 0)),
    18,
    CH - 8
  )
  return players.value.map((p, i) => ({
    i,
    src: champIcon(p.championId),
    left: GL + PW + 12,
    top: ys[i] - 8,
    role: role(i),
  }))
})

/* ── Reading a minute: pointer, tap or arrows ── */
const frame = shallowRef<number | null>(null)
watch([() => props.detail, metric], () => {
  if (frame.value !== null && frame.value > last.value) frame.value = null
})
const shown = computed(() => frame.value ?? last.value)
let touch = false
function read(e: PointerEvent) {
  const el = plot.value
  if (!el) return
  const { GL, PW } = geo.value
  const px = e.clientX - el.getBoundingClientRect().left
  frame.value = frameAt(times.value, Math.max(0, Math.min(1, (px - GL) / PW)) * end.value)
}
function down(e: PointerEvent) {
  touch = e.pointerType === 'touch'
  read(e)
}
function leave() {
  if (!touch) frame.value = null
}
function key(e: KeyboardEvent) {
  const f = frame.value ?? last.value
  if (e.key === 'ArrowLeft') frame.value = Math.max(0, f - 1)
  else if (e.key === 'ArrowRight') frame.value = Math.min(last.value, f + 1)
  else if (e.key === 'Home') frame.value = 0
  else if (e.key === 'End') frame.value = last.value
  else if (e.key === 'Escape') frame.value = null
  else return
  e.preventDefault()
}

const hover = computed(() => {
  const f = frame.value
  if (f === null) return null
  const { x, y, top, tO, tL, LH } = geo.value
  const hx = x(times.value[f] ?? 0)
  const dots = [opp.value, pin.value, me.value]
    .filter((i): i is number => i !== null && i >= 0)
    .map((i) => ({ i, cy: y(series.value[i][f] ?? 0), role: role(i) }))
  return { x: hx, y1: top - 4, y2: two.value ? tL + LH + 2 : tO + 10, dots }
})
const litBar = computed(() =>
  frame.value === null || !bars.value ? -1 : barOf(leadBars(times.value, lead.value), frame.value)
)

/* ── The header line and both teams ── */
const leadNow = computed(() => lead.value[shown.value] ?? 0)
const leadEven = computed(() => short(leadNow.value, metric.value) === '0')
const value = (i: number) => series.value[i]?.[shown.value] ?? 0
const most = computed(() => Math.max(1, ...series.value.map((s) => s.at(-1) ?? 0)))
const teams = computed(() => {
  const others = [...new Set(players.value.map((p) => p.teamId))].filter((t) => t !== ally.value)
  const blocks = [
    { label: allyLabel.value, side: 'ally', rows: laneOrder(players.value, ally.value) },
  ]
  const rest = others.flatMap((t) => laneOrder(players.value, t))
  if (rest.length) blocks.push({ label: enemyLabel.value, side: 'enemy', rows: rest })
  return blocks.map((b) => ({
    ...b,
    total: b.rows.reduce((s, i) => s + value(i), 0),
    rows: b.rows.map((i) => {
      const p = players.value[i]
      const v = value(i)
      return {
        i,
        name: p.gameName || championName(p.championId),
        champ: championName(p.championId),
        src: champIcon(p.championId),
        v,
        w: Math.min(100, (v / most.value) * 100),
        role: role(i),
      }
    }),
  }))
})
const fmt = (v: number) => short(v, metric.value)
</script>

<template>
  <div class="mc">
    <header class="mc-h">
      <p class="mc-read" aria-live="polite">
        <span class="mc-when num">{{
          frame === null ? 'End of game' : clock(times[shown] ?? 0)
        }}</span>
        <template v-if="two">
          <template v-if="leadEven"><span class="meta">Even</span></template>
          <template v-else>
            <span class="meta">{{ leadNow > 0 ? allyLabel : enemyLabel }}</span>
            <b class="mc-lead num" :class="leadNow > 0 ? 'ally' : 'enemy'">+{{ fmt(leadNow) }}</b>
            <span class="meta">{{ unit }}</span>
          </template>
        </template>
      </p>
      <span class="seg sm mc-seg" role="group" aria-label="Value">
        <button
          v-for="m in METRICS"
          :key="m.id"
          type="button"
          :class="{ on: metric === m.id }"
          :aria-pressed="metric === m.id"
          @click="metric = m.id"
        >
          {{ m.label }}
        </button>
      </span>
    </header>

    <div class="mc-g">
      <div
        ref="plot"
        class="mc-c"
        :style="{ height: `${geo.TH}px` }"
        tabindex="0"
        role="group"
        aria-roledescription="chart"
        :aria-label="`${label} of each player over the game`"
        @pointerdown="down"
        @pointermove="read"
        @pointerleave="leave"
        @keydown="key"
        @blur="frame = null"
      >
        <svg :width="geo.W" :height="geo.TH" :viewBox="`0 0 ${geo.W} ${geo.TH}`" aria-hidden="true">
          <defs>
            <linearGradient
              :id="gradId"
              gradientUnits="userSpaceOnUse"
              x1="0"
              x2="0"
              :y1="fade.y1"
              :y2="fade.y2"
            >
              <stop offset="0" class="mc-st0" />
              <stop offset="0.62" class="mc-st1" />
              <stop offset="1" class="mc-st2" />
            </linearGradient>
          </defs>
          <g class="mc-guides">
            <line
              v-for="(g, j) in guides"
              :key="j"
              :x1="g.x1"
              :x2="g.x2"
              :y1="g.y"
              :y2="g.y"
              :class="{ zero: g.zero }"
            />
            <text
              v-for="(g, j) in guides.filter((g) => g.label)"
              :key="`l${j}`"
              class="ax"
              :x="geo.GL - 10"
              :y="g.y + 4"
              text-anchor="end"
            >
              {{ g.label }}
            </text>
          </g>
          <g v-if="bars">
            <line class="mc-zero" :x1="geo.GL" :x2="geo.GL + geo.PW" :y1="geo.tL" :y2="geo.tL" />
            <text v-if="!geo.narrow" class="axl" :x="geo.GL - 10" :y="geo.tL + 4" text-anchor="end">
              Team lead
            </text>
            <text class="ax sm" :x="geo.GL + geo.PW + 8" :y="geo.tL - geo.LH + 7">
              +{{ fmt(bars.most) }}
            </text>
            <text class="ax sm" :x="geo.GL + geo.PW + 8" :y="geo.tL + geo.LH + 1">
              −{{ fmt(bars.most) }}
            </text>
            <rect
              v-for="(b, j) in bars.list"
              :key="j"
              class="mc-bar"
              :class="[b.cls, { dim: litBar >= 0 && j !== litBar }]"
              :x="b.x"
              :y="b.y"
              :width="b.w"
              :height="b.h"
              rx="1"
            />
          </g>
          <text
            v-for="t in ticks"
            :key="t.label"
            class="ax"
            :x="t.x"
            :y="geo.tA"
            text-anchor="middle"
          >
            {{ t.label }}
          </text>
          <path class="mc-fade" :d="fade.d" :fill="`url(#${gradId})`" />
          <path v-for="i in drawOrder" :key="i" class="mc-ln" :class="role(i)" :d="lines[i]" />
          <g v-if="hover">
            <line class="mc-hair" :x1="hover.x" :x2="hover.x" :y1="hover.y1" :y2="hover.y2" />
            <circle
              v-for="d in hover.dots"
              :key="d.i"
              class="mc-dot"
              :class="d.role"
              :cx="hover.x"
              :cy="d.cy"
              r="2.75"
            />
          </g>
        </svg>
        <span
          v-for="o in marks"
          :key="o.key"
          class="mc-ob"
          :class="[o.side, { small: o.small }]"
          :style="{ left: `${o.x}px`, top: `${geo.tO}px` }"
          :title="o.title"
          ><ObjectiveIcon :name="o.icon" :size="o.small ? 10 : 14"
        /></span>
        <img
          v-for="e in ends"
          :key="e.i"
          class="mc-end"
          :class="e.role"
          :src="e.src"
          alt=""
          :style="{ left: `${e.left}px`, top: `${e.top}px` }"
        />
      </div>

      <div class="mc-r">
        <div v-for="b in teams" :key="b.side" class="mc-t">
          <div class="mc-th">
            <span :class="b.side">{{ b.label }}</span
            ><b class="num">{{ fmt(b.total) }}</b>
          </div>
          <template v-for="r in b.rows" :key="r.i">
            <div v-if="r.role === 'me' || r.role === 'opp'" class="mc-row" :class="r.role">
              <img :src="r.src" :alt="r.champ" />
              <span class="ell">{{ r.name }}</span>
              <b class="num">{{ fmt(r.v) }}</b>
              <i class="bar"><i :style="{ width: `${r.w}%` }" /></i>
            </div>
            <button
              v-else
              type="button"
              class="mc-row"
              :class="r.role"
              :aria-pressed="r.role === 'pin'"
              @click="toggle(r.i)"
            >
              <img :src="r.src" :alt="r.champ" />
              <span class="ell">{{ r.name }}</span>
              <b class="num">{{ fmt(r.v) }}</b>
              <i class="bar"><i :style="{ width: `${r.w}%` }" /></i>
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mc {
  --mc-opp: #ee8aa6;
  --mc-ring: #15131d;
  --mc-hair: rgb(255 255 255 / 0.16);
  --mc-faint: 0.2;
  --mc-fade: 0.22;
  --mc-pin-row: rgb(255 255 255 / 0.04);
  container-type: inline-size;
}
[data-theme='light'] .mc {
  --mc-opp: #d95c84;
  --mc-ring: #ffffff;
  --mc-hair: rgb(44 38 112 / 0.2);
  --mc-faint: 0.26;
  --mc-fade: 0.14;
  --mc-pin-row: rgb(44 38 112 / 0.045);
}
@media (prefers-color-scheme: light) {
  [data-theme='system'] .mc {
    --mc-opp: #d95c84;
    --mc-ring: #ffffff;
    --mc-hair: rgb(44 38 112 / 0.2);
    --mc-faint: 0.26;
    --mc-fade: 0.14;
    --mc-pin-row: rgb(44 38 112 / 0.045);
  }
}

/* ── The header line ── */
.mc-h {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.mc-read {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
  margin: 0;
  white-space: nowrap;
}
.mc-when {
  min-width: 92px;
  font-size: 15px;
  font-weight: 650;
  color: var(--t1);
}
.mc-lead {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.mc-lead.ally,
.mc-th .ally {
  color: var(--win);
}
.mc-lead.enemy,
.mc-th .enemy {
  color: var(--loss);
}
.mc-seg {
  margin-left: auto;
  flex: none;
}
.mc-seg > * {
  height: 26px;
  padding: 0 11px;
  font-size: 12.5px;
}

/* ── The chart ── */
.mc-g {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 236px;
  gap: 28px;
  align-items: start;
}
.mc-c {
  position: relative;
  min-width: 0;
  outline: none;
  touch-action: pan-y;
  border-radius: 6px;
  -webkit-tap-highlight-color: transparent;
}
.mc-c:focus-visible {
  box-shadow: var(--focus);
}
.mc-c > svg {
  position: absolute;
  inset: 0;
  overflow: visible;
}
.mc-c text {
  font-family: var(--f);
}
.mc-c .ax {
  font-size: 11px;
  font-weight: 600;
  fill: var(--t4);
  font-variant-numeric: tabular-nums;
}
.mc-c .ax.sm {
  font-size: 10px;
}
.mc-c .axl {
  font-size: 11px;
  font-weight: 650;
  fill: var(--t4);
  letter-spacing: 0.01em;
}
.mc-guides line {
  stroke: var(--line);
  stroke-opacity: 0.6;
  shape-rendering: crispEdges;
}
.mc-guides line.zero {
  stroke-opacity: 1;
}
.mc-zero {
  stroke: var(--line-2);
  shape-rendering: crispEdges;
}
.mc-st0 {
  stop-color: var(--v500);
  stop-opacity: var(--mc-fade);
}
.mc-st1 {
  stop-color: var(--v500);
  stop-opacity: calc(var(--mc-fade) * 0.3);
}
.mc-st2 {
  stop-color: var(--v500);
  stop-opacity: 0;
}
.mc-ln {
  fill: none;
  stroke-width: 1.25;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.mc-ln.ally {
  stroke: var(--win);
  stroke-opacity: var(--mc-faint);
}
.mc-ln.enemy {
  stroke: var(--loss);
  stroke-opacity: var(--mc-faint);
}
.mc-ln.opp {
  stroke: var(--mc-opp);
  stroke-opacity: 0.9;
}
.mc-ln.pin {
  stroke: var(--win);
  stroke-width: 2.25;
}
.mc-ln.me {
  stroke: var(--v400);
  stroke-width: 2.25;
}
.mc-bar {
  fill: var(--line-2);
  transition: fill-opacity var(--m-fast, 120ms) var(--ease);
}
.mc-bar.up {
  fill: var(--v400);
}
.mc-bar.dn {
  fill: var(--t4);
}
.mc-bar.dim {
  fill-opacity: 0.4;
}
.mc-hair {
  stroke: var(--mc-hair);
  shape-rendering: crispEdges;
}
.mc-dot {
  stroke: var(--mc-ring);
  stroke-width: 1.5;
}
.mc-dot.me {
  fill: var(--v400);
}
.mc-dot.opp {
  fill: var(--mc-opp);
}
.mc-dot.pin {
  fill: var(--win);
}
.mc-ob {
  position: absolute;
  display: grid;
  place-items: center;
  transform: translate(-50%, -50%);
  line-height: 0;
}
.mc-ob.ally {
  color: var(--win);
}
.mc-ob.enemy {
  color: var(--loss);
}
.mc-ob.small {
  opacity: 0.45;
}
.mc-end {
  position: absolute;
  width: 16px;
  height: 16px;
  border-radius: 5px;
  opacity: 0.5;
  pointer-events: none;
}
.mc-end.me,
.mc-end.opp,
.mc-end.pin {
  opacity: 1;
  box-shadow:
    0 0 0 1.5px var(--ring),
    0 2px 6px rgb(0 0 0 / 0.45);
}
.mc-end.me {
  --ring: var(--v400);
}
.mc-end.opp {
  --ring: var(--mc-opp);
}
.mc-end.pin {
  --ring: var(--win);
}

/* ── Both teams ── */
.mc-r {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 2px;
}
.mc-t {
  display: flex;
  flex-direction: column;
}
.mc-th {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0 8px 3px;
  font-size: 12.5px;
  font-weight: 650;
}
.mc-th b {
  font-size: 13px;
  font-weight: 700;
  color: var(--t1);
}
.mc-row {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  grid-template-rows: auto 2px;
  column-gap: 9px;
  row-gap: 3px;
  align-items: center;
  width: 100%;
  height: 28px;
  margin: 0;
  padding: 2px 8px 3px;
  border: 0;
  border-radius: 7px;
  background: none;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  color: var(--t2);
}
button.mc-row {
  cursor: pointer;
  transition: background var(--m, 160ms) var(--ease);
}
button.mc-row:hover {
  background: var(--hover-row);
}
button.mc-row:focus-visible {
  outline: none;
  box-shadow: var(--focus);
}
.mc-row img {
  grid-row: 1 / 3;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  box-shadow: var(--d-portrait);
}
.mc-row b {
  font-size: 13px;
  font-weight: 650;
  color: var(--t2);
}
.mc-row .bar {
  grid-column: 2 / 4;
  display: block;
  height: 2px;
  border-radius: 2px;
  background: var(--line);
  box-shadow: none;
}
.mc-row .bar > i {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: var(--line-3);
}
.mc-row.me {
  background: rgb(var(--v-rgb) / 0.09);
  box-shadow: inset 0 0 0 1px rgb(var(--v-rgb) / 0.16);
  color: var(--t1);
}
.mc-row:is(.me, .opp, .pin) b {
  color: var(--t1);
  font-weight: 700;
}
.mc-row.me .bar > i {
  background: var(--v400);
}
.mc-row.opp {
  color: var(--t1);
}
.mc-row.opp img {
  box-shadow:
    0 0 0 1.5px var(--mc-opp),
    0 2px 5px rgb(0 0 0 / 0.4);
}
.mc-row.opp .bar > i {
  background: var(--mc-opp);
}
.mc-row.pin {
  background: var(--mc-pin-row);
  color: var(--t1);
}
.mc-row.pin .bar > i {
  background: var(--win);
}

/* ── Narrow: the teams under the chart ── */
@container (max-width: 640px) {
  .mc-g {
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
  }
  .mc-r {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }
}
@container (max-width: 420px) {
  .mc-h {
    flex-wrap: wrap;
    row-gap: 8px;
  }
  .mc-when {
    min-width: 0;
  }
}
</style>
