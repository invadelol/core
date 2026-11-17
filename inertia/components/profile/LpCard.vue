<script setup lang="ts">
import { computed, ref } from 'vue'
import { assetUrl } from '../../lib/assets.js'
import { rankFromCore, rankLabel, rankValue } from '@invadelol/ui/logic'
import { tierVar } from './rank.js'
import type { Rank, RanksPayload } from '../../lib/types.js'

/**
 * LP history in the rail: Solo/Duo over a chosen range (30 days by default, 120 days, a year or
 * everything stored), from the rank snapshots kept each time the profile is read. The range is cut
 * into buckets (days for 30 days, weeks for 120 days and a year, months for a longer history) so
 * the bars and the hover stay usable. The LP at the end of each bucket as steps (a bucket with no
 * snapshot keeps the one before), and under it one bar per bucket for what it changed: violet when
 * it gained, grey when it lost, a flat tick when nothing moved.
 */
const props = defineProps<{ ranks: RanksPayload | null }>()

const time = (r: Rank) => new Date(r.fetchedAt ?? 0).getTime()
const label = (r: Rank) => rankLabel(rankFromCore(r), false)
const ladder = (r: Pick<Rank, 'tier' | 'division' | 'leaguePoints'>) => {
  const v = rankValue(rankFromCore(r as Rank))
  return v === null ? null : Math.round(v * 100)
}
const solo = computed(
  () => props.ranks?.current?.find((r) => r.queueType === 'RANKED_SOLO_5x5' && r.tier) ?? null
)

const W = 260
const TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER']
const DIV = ['IV', 'III', 'II', 'I']
const hover = ref<number | null>(null)
const H = 100

type Range = '30d' | '120d' | '1y' | 'all'
type Unit = 'day' | 'week' | 'month'
const RANGES: ReadonlyArray<{ value: Range; label: string; name: string; empty: string }> = [
  { value: '30d', label: '30D', name: '30 days', empty: 'in the last 30 days' },
  { value: '120d', label: '120D', name: '120 days', empty: 'in the last 120 days' },
  { value: '1y', label: '1Y', name: '1 year', empty: 'in the last year' },
  { value: 'all', label: 'All', name: 'All stored history', empty: 'yet' },
]
const range = ref<Range>('30d')
const rangeInfo = computed(() => RANGES.find((r) => r.value === range.value)!)
const pick = (r: Range) => {
  range.value = r
  hover.value = null
}

/** Local midnight, so a day is the player's calendar day. */
const dayOf = (t: number) => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
const addDays = (t: number, n: number) => {
  const d = new Date(t)
  d.setDate(d.getDate() + n)
  return d.getTime()
}
/** The bucket a moment falls in starts here: its day, its week's Monday, its month's 1st. */
const floorTo = (t: number, unit: Unit) => {
  const d = new Date(dayOf(t))
  if (unit === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  if (unit === 'month') d.setDate(1)
  return d.getTime()
}
const stepOf = (t: number, unit: Unit) => {
  if (unit === 'day') return addDays(t, 1)
  if (unit === 'week') return addDays(t, 7)
  const d = new Date(t)
  d.setMonth(d.getMonth() + 1)
  return d.getTime()
}
const thisYear = new Date().getFullYear()
const md = (t: number) => new Date(t).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
const withYear = (t: number) =>
  new Date(t).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    ...(new Date(t).getFullYear() !== thisYear ? { year: 'numeric' } : {}),
  })
/** A bucket's dates for the tooltip: the day, the week's first and last day, or the month. */
function bucketDate(from: number, last: number, unit: Unit) {
  if (unit === 'day') return new Date(from).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
  if (unit === 'month') return new Date(from).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const a = new Date(from)
  const b = new Date(last)
  const end = a.getMonth() === b.getMonth() ? `${b.getDate()}` : md(last)
  if (from === last) return withYear(from)
  return `${md(from)} – ${end}${b.getFullYear() !== thisYear ? `, ${b.getFullYear()}` : ''}`
}

const line = computed(() => {
  const pts = (props.ranks?.history ?? [])
    .filter((r) => r.queueType === 'RANKED_SOLO_5x5' && r.tier && r.fetchedAt)
    .map((r) => ({ t: time(r), v: ladder(r), r }))
    .filter((p): p is { t: number; v: number; r: Rank } => p.v !== null)
    .sort((a, b) => a.t - b.t)
  const now = solo.value
  const nv = now ? ladder(now) : null
  if (now && nv !== null) pts.push({ t: Math.max(Date.now(), pts.at(-1)?.t ?? 0), v: nv, r: now })
  if (!pts.length) return null
  const today = dayOf(Date.now())
  const end = addDays(today, 1)
  /*
   * The range and its bucket: days up to 30 days, weeks for 120 days and a year, and for
   * everything stored whatever keeps it near a year's worth of bars (days, weeks, then months).
   * Weeks and months start on a Monday / the 1st, so every bar is a whole bucket.
   */
  let unit: Unit
  let from: number
  if (range.value === '30d') [unit, from] = ['day', addDays(today, -29)]
  else if (range.value === '120d') [unit, from] = ['week', addDays(today, -119)]
  else if (range.value === '1y') [unit, from] = ['week', addDays(today, -364)]
  else {
    from = dayOf(pts[0].t)
    const span = (today - from) / 864e5
    unit = span < 30 ? 'day' : span <= 400 ? 'week' : 'month'
    if (unit === 'day') from = Math.min(from, addDays(today, -29))
  }
  const first = floorTo(from, unit)
  const buckets: { from: number; to: number }[] = []
  for (let t = first; t < end; ) {
    const to = Math.min(stepOf(t, unit), end)
    buckets.push({ from: t, to })
    t = to
  }
  const n = buckets.length
  const inside = pts.filter((p) => p.t >= first)
  if (inside.length < 2) return null
  const before = pts.filter((p) => p.t < first).at(-1)
  const base = before?.v ?? inside[0].v
  let prev = base
  let prevRank: Rank = (before ?? inside[0]).r
  const ends: number[] = []
  const deltas: number[] = []
  const ranks: Rank[] = []
  let k = 0
  for (const b of buckets) {
    let last = prev
    for (; k < inside.length && inside[k].t < b.to; k++) {
      last = inside[k].v
      prevRank = inside[k].r
    }
    deltas.push(last - prev)
    ends.push(last)
    ranks.push(prevRank)
    prev = last
  }
  if (!deltas.some((d) => d !== 0)) return null
  const min = Math.min(...ends)
  const max = Math.max(...ends)
  /*
   * Guides, whatever the climb:
   *  - inside one tier or two (≤ 5 divisions): a line per division, its numeral, the tier emblem;
   *  - a longer climb: a line per tier (the IV floor), emblem only;
   *  - Master and up share one LP scale (Grandmaster and Challenger are cut-offs, not floors):
   *    the Master floor, then a line every 100/250/500 LP labelled with its LP.
   * Promotions to another tier are marked on the curve with the new emblem.
   */
  const wide = Math.min(max, 2800) - Math.min(min, 2800) > 500 || (max >= 2800 && min < 2800)
  const apexStep = max - 2800 > 1200 ? 500 : max - 2800 > 500 ? 250 : 100
  const levels: number[] = []
  const floorOf = (v: number) => (v >= 2800 ? 2800 + Math.floor((v - 2800) / apexStep) * apexStep : wide ? Math.floor(v / 400) * 400 : Math.floor(v / 100) * 100)
  const next = (v: number) => (v >= 2800 ? v + apexStep : wide ? Math.min(2800, v + 400) : v + 100)
  for (let v = floorOf(min); ; v = next(v)) {
    levels.push(v)
    if (v > max) break
  }
  const lo = levels[0]
  const hi = levels.at(-1)!
  const y = (val: number) => 4 + (H - 8) * (1 - (val - lo) / Math.max(1, hi - lo))
  const cw = W / n
  let d = `M0 ${y(ends[0]).toFixed(1)}`
  ends.forEach((v, i) => (d += ` H${(i * cw).toFixed(1)} V${y(v).toFixed(1)}`))
  d += ` H${W}`
  const most = Math.max(...deltas.map(Math.abs)) || 1
  const peak = inside.reduce((a, b) => (b.v > a.v ? b : a))
  let shown = ''
  const marks = levels.map((v) => {
    const tier = v >= 2800 ? 'MASTER' : TIERS[Math.floor(v / 400)]
    const div = v > 2800 ? `${v - 2800}` : v === 2800 || wide ? '' : DIV[Math.floor(v / 100) % 4]
    // the emblem once per tier, on its lowest line
    const emblem = tier !== shown
    shown = tier
    return { y: (y(v) / H) * 100, tier, div, emblem }
  })
  // tier changes on the curve (Diamond → Master, Master → Grandmaster…)
  const promos = ranks
    .map((r, i) => ({ r, i }))
    .filter(({ r, i }) => i > 0 && r.tier !== ranks[i - 1].tier)
    .map(({ r, i }) => ({ x: (i * cw / W) * 100, y: (y(ends[i]) / H) * 100, tier: r.tier!, up: ends[i] > ends[i - 1] }))
  const days = ends.map((v, i) => ({
    x: ((i + 0.5) / n) * 100,
    y: (y(v) / H) * 100,
    date: bucketDate(buckets[i].from, addDays(buckets[i].to, -1), unit),
    name: `${label(ranks[i])} ${ranks[i].leaguePoints} LP`,
    delta: deltas[i],
  }))
  return {
    n,
    marks,
    promos,
    days,
    d,
    area: `${d} V${H} H0 Z`,
    bars: deltas.map((v) => ({
      cls: v > 0 ? 'up' : v < 0 ? 'dn' : 'z',
      h: v ? Math.max(3, (Math.abs(v) / most) * 28) : 2,
    })),
    gain: ends.at(-1)! - base,
    peak: `${peak.r.tier === 'GRANDMASTER' ? 'GM' : peak.r.tier === 'CHALLENGER' ? 'Challenger' : label(peak.r)} ${peak.r.leaguePoints}`,
    // the day this year; month and year once the range reaches into an earlier one
    start:
      new Date(first).getFullYear() === thisYear
        ? md(first)
        : new Date(first).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
  }
})
const gain = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n)} LP`
</script>

<template>
  <section v-if="solo" class="card pl-sec">
    <div class="pl-sec-h">
      <h2 class="h4">LP history</h2>
      <div class="seg lpr" role="radiogroup" aria-label="Range">
        <button
          v-for="r in RANGES"
          :key="r.value"
          type="button"
          role="radio"
          :class="{ on: range === r.value }"
          :aria-checked="range === r.value"
          :aria-label="r.name"
          :title="r.name"
          @click="pick(r.value)"
        >
          {{ r.label }}
        </button>
      </div>
    </div>
    <div class="row" style="gap: 8px; align-items: baseline">
      <span class="h5" :style="{ color: tierVar(solo.tier) }">{{ label(solo) }}</span>
      <span class="fg-s num">{{ solo.leaguePoints }}<span class="u">LP</span></span>
      <span class="meta lpq">Solo/Duo</span>
      <span v-if="line" class="meta num" style="margin-left: auto"
        ><b :class="line.gain >= 0 ? 'wn' : 'ls'">{{ gain(line.gain) }}</b></span
      >
    </div>
    <template v-if="line">
      <div class="lpg" @mouseleave="hover = null">
        <div class="lpg-ax" aria-hidden="true">
          <span v-for="(m, i) in line.marks" :key="i" class="lpg-m" :style="{ top: `${m.y}%` }"
            ><i class="lpg-e"><img v-if="m.emblem" :src="assetUrl('rank', m.tier)" alt="" /></i><b :style="{ color: tierVar(m.tier) }">{{ m.div }}</b></span
          >
        </div>
        <div class="lpg-plot">
          <div class="chart lpd">
            <i v-for="(m, i) in line.marks" :key="i" class="lpg-l" :style="{ top: `${m.y}%` }" />
            <svg class="fade" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
              <path class="area" :d="line.area" />
            </svg>
            <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
              <path class="ln" :d="line.d" />
            </svg>
            <span
              v-for="(p, i) in line.promos"
              :key="`p${i}`"
              class="lpg-pr"
              :style="{ left: `${p.x}%`, top: `${p.y}%` }"
              :title="`${p.up ? 'Promoted to' : 'Down to'} ${p.tier.charAt(0)}${p.tier.slice(1).toLowerCase()}`"
              ><img :src="assetUrl('rank', p.tier)" alt=""
            /></span>
            <template v-if="hover !== null">
              <i class="lpg-x" :style="{ left: `${line.days[hover].x}%` }" />
              <i class="lpg-dot" :style="{ left: `${line.days[hover].x}%`, top: `${line.days[hover].y}%` }" />
            </template>
          </div>
          <div class="lpd-bars" :class="{ thin: line.n > 31 }" :style="{ gridTemplateColumns: `repeat(${line.n}, 1fr)` }" aria-hidden="true">
            <i v-for="(b, i) in line.bars" :key="i" :class="[b.cls, { on: hover === i }]" :style="{ height: `${b.h}px` }" />
          </div>
          <div class="lpg-hit" :style="{ gridTemplateColumns: `repeat(${line.n}, 1fr)` }">
            <span v-for="i in line.days.length" :key="i" @mouseenter="hover = i - 1" />
          </div>
          <div
            v-if="hover !== null"
            class="lpg-tip"
            :class="{ r: line.days[hover].x > 60 }"
            :style="{ left: `${line.days[hover].x}%` }"
          >
            <span class="meta">{{ line.days[hover].date }}</span>
            <b>{{ line.days[hover].name }}</b>
            <span :class="line.days[hover].delta > 0 ? 'wn' : line.days[hover].delta < 0 ? 'ls' : 'meta'">{{
              line.days[hover].delta ? gain(line.days[hover].delta) : 'No change'
            }}</span>
          </div>
        </div>
      </div>
      <div class="row meta" style="justify-content: space-between; gap: 8px; margin: 8px 0 0 40px; white-space: nowrap">
        <span>{{ line.start }}</span>
        <span
          >Peak <b class="t1">{{ line.peak }}</b></span
        >
        <span>Today</span>
      </div>
    </template>
    <p v-else class="meta" style="margin-top: 8px">No LP change stored {{ rangeInfo.empty }}</p>
  </section>
</template>

<style scoped>
/* the range: a small quiet well in the header, the chosen one lit like every other .seg */
.pl-sec-h .h4 {
  white-space: nowrap;
}
.lpq {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lpr {
  align-self: center;
  flex: none;
  margin: -6px 0 -6px auto;
  padding: 2px;
}
.lpr > * {
  height: 22px;
  padding: 0 7px;
  border-radius: 5px;
  font-size: 11.5px;
  font-weight: 650;
}
.lpg {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  gap: 8px;
  margin-top: 16px;
}
.lpg-ax {
  position: relative;
  height: 100px;
}
.lpg-m {
  position: absolute;
  left: 0;
  display: flex;
  align-items: center;
  gap: 1px;
  transform: translateY(-50%);
}
.lpg-e {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  overflow: hidden;
}
/* the emblem art sits small in a wide transparent square: crop to the crest */
.lpg-e img {
  flex: none;
  width: 46px;
  height: 46px;
  object-fit: contain;
}
.lpg-m b {
  font-size: 10px;
  font-weight: 800;
  opacity: 0.9;
}
.lpg-pr {
  position: absolute;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin: -24px 0 0 -10px;
  overflow: hidden;
  border-radius: 50%;
  background: var(--solid-2, #1c1a27);
  box-shadow: 0 0 0 1px rgb(var(--v-rgb) / 0.5), 0 2px 6px rgb(0 0 0 / 0.5);
}
.lpg-pr img {
  flex: none;
  width: 48px;
  height: 48px;
  object-fit: contain;
}
.lpg-plot {
  position: relative;
  min-width: 0;
}
.lpg-l {
  position: absolute;
  left: 0;
  right: 0;
  height: 0;
  border-top: 1px dashed rgb(214 208 255 / 0.2);
}
.lpg-x {
  position: absolute;
  top: 0;
  bottom: -38px;
  width: 1px;
  background: rgb(214 208 255 / 0.25);
  pointer-events: none;
}
.lpg-dot {
  position: absolute;
  width: 8px;
  height: 8px;
  margin: -4px;
  border-radius: 50%;
  background: var(--v300);
  box-shadow: 0 0 0 3px rgb(var(--v-rgb) / 0.25);
  pointer-events: none;
}
.lpg-hit {
  position: absolute;
  inset: 0;
  display: grid;
}
.lpg-tip {
  position: absolute;
  bottom: calc(100% + 6px);
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 120px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--solid-2, #1c1a27);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.08), 0 8px 24px rgb(0 0 0 / 0.5);
  font-size: 12px;
  white-space: nowrap;
  transform: translateX(-50%);
  pointer-events: none;
}
.lpg-tip.r {
  transform: translateX(-90%);
}
.lpg-tip b {
  font-size: 13px;
  color: var(--t1);
}
.lpd {
  position: relative;
  height: 100px;
}
.lpd .ln {
  stroke-linejoin: round;
}
.lpd-bars {
  display: grid;
  gap: 2px;
  align-items: end;
  height: 30px;
  margin-top: 8px;
}
/* a year of weeks: the bars sit closer so each keeps some width */
.lpd-bars.thin {
  gap: 1px;
}
.lpd-bars i {
  border-radius: 1px;
  background: var(--line-2);
}
.lpd-bars i.up {
  background: var(--v400);
}
.lpd-bars i.dn {
  background: var(--t4);
}
.lpd-bars i.on {
  outline: 1px solid var(--v200);
  outline-offset: 1px;
}
</style>
