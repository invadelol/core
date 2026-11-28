<script setup lang="ts">
import { computed, ref } from 'vue'
import { rankFromCore, rankLabel } from '@invadelol/ui/logic'
import RankEmblem from '../ui/RankEmblem.vue'
import Select from '../ui/Select.vue'
import { tierVar } from './rank.js'
import {
  firstRangeWithLine,
  inRange,
  lpPath,
  lpPoints,
  lpScale,
  peakOf,
  LP_RANGES,
  type LpRange,
} from '../../lib/lp_line.js'
import { ordinalSuffix } from '../../lib/format.js'
import type { Rank } from '../../lib/types.js'

/**
 * One ranked queue in the rail, rank and LP history together: the emblem, the rank and its LP, the
 * season's record and, on the apex ladder, the player's place in it; then the LP the stored
 * snapshots saw, one point per change joined by straight lines, with the tiers' emblems as guides
 * on the axis; under it the peak of everything stored and what the range changed, and the Flex
 * rank when there is one.
 */
const props = defineProps<{
  title: string
  queue: string
  rank: Rank | null
  history: ReadonlyArray<Rank>
  /** The player's place on their server's apex ladder, when they are on it. */
  ladder?: { position: number; server: string } | null
  /** Their Flex rank, one quiet line at the foot of the card (Flex has no card of its own). */
  flex?: Rank | null
}>()

const label = (r: Rank) => rankLabel(rankFromCore(r), false)
const time = (r: Rank) => new Date(r.fetchedAt ?? 0).getTime()

/** The record, from the rank itself or the newest snapshot of the queue that had one. */
const record = computed(() => {
  const r = props.rank
  if (!r) return null
  if (r.losses !== null && r.losses !== undefined) return { wins: r.wins, losses: r.losses }
  const basis = props.history
    .filter((h) => h.queueType === r.queueType && h.losses !== null && h.losses !== undefined)
    .sort((a, b) => time(b) - time(a))[0]
  return basis ? { wins: basis.wins, losses: basis.losses as number } : null
})
const pct = (r: { wins: number; losses: number }) =>
  r.wins + r.losses ? Math.round((r.wins / (r.wins + r.losses)) * 100) : 0

const points = computed(() => (props.rank ? lpPoints(props.history, props.queue) : []))
/** The range the player picked; until then the shortest one that has a line. */
const picked = ref<LpRange | null>(null)
const auto = computed(() => firstRangeWithLine(points.value))
const range = computed<LpRange>(() => picked.value ?? auto.value ?? '30d')
const rangeName = computed(() => LP_RANGES.find((r) => r.value === range.value)!.name)
const rangeOptions = LP_RANGES.map((r) => ({ value: r.value, label: r.name }))
function pick(r: LpRange) {
  picked.value = r
  hover.value = null
}

const W = 220
const H = 112
const thisYear = new Date().getFullYear()
const dayMonth = (t: number) =>
  new Date(t).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    ...(new Date(t).getFullYear() !== thisYear ? { year: 'numeric' } : {}),
  })
const lp = (n: number) => n.toLocaleString('en-US')
const signedLp = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${lp(Math.abs(n))} LP`
/** What a range with no change says it covered. */
const SPANS: Record<LpRange, string> = {
  '30d': 'the last 30 days',
  '120d': 'the last 120 days',
  '1y': 'the last year',
  'all': 'everything stored',
}

const line = computed(() => {
  const drawn = inRange(points.value, range.value)
  if (drawn.length < 2) return null
  const values = drawn.map((p) => p.v)
  const scale = lpScale(Math.min(...values), Math.max(...values))
  const path = lpPath(drawn, W, H, scale)
  const pc = (y: number) => (y / H) * 100
  return {
    d: path.d,
    area: path.area,
    guides: scale.guides.map((g) => ({ ...g, y: pc(path.y(g.v)) })),
    dots: drawn.map((p, i) => ({
      x: (path.xy[i][0] / W) * 100,
      y: pc(path.xy[i][1]),
      date: new Date(p.t).toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        ...(new Date(p.t).getFullYear() !== thisYear ? { year: 'numeric' } : {}),
      }),
      name: `${label(p.rank)} ${lp(p.rank.leaguePoints)} LP`,
      delta: i ? p.v - drawn[i - 1].v : null,
    })),
    start: dayMonth(drawn[0].t),
    end: dayMonth(drawn.at(-1)!.t),
    gain: drawn.at(-1)!.v - drawn[0].v,
  }
})
/** The peak of everything stored for the queue, once there is more than one reading. */
const peak = computed(() => (points.value.length > 1 ? peakOf(points.value) : null))

/* The point under the pointer (a tap on touch), read from where it is across the plot. */
const hover = ref<number | null>(null)
function at(event: PointerEvent) {
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const n = line.value?.dots.length ?? 0
  if (n < 2 || !box.width) return
  const f = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))
  hover.value = Math.round(f * (n - 1))
}
function leave(event: PointerEvent) {
  if (event.pointerType === 'mouse') hover.value = null
}
const tip = computed(() => (hover.value === null ? null : (line.value?.dots[hover.value] ?? null)))
const ordinal = (n: number) => `${n.toLocaleString('en-US')}${ordinalSuffix(n)}`
</script>

<template>
  <section class="card pl-sec pl-q">
    <div class="pl-sec-h">
      <h2 class="h4">{{ title }}</h2>
      <Select
        v-if="auto"
        :model-value="range"
        :options="rangeOptions"
        width="10rem"
        align="right"
        class="lpr"
        aria-label="LP history range"
        @update:model-value="pick"
      />
    </div>
    <div class="pl-rk">
      <RankEmblem :tier="rank?.tier" :size="64" />
      <div class="col" style="gap: 2px; min-width: 0">
        <span class="h3 pl-tier" :style="{ color: rank ? tierVar(rank.tier) : 'var(--t2)' }">{{
          rank ? label(rank) : 'Unranked'
        }}</span>
        <span v-if="record" class="meta num"
          ><b class="wn">{{ record.wins }}W</b> <b class="ls">{{ record.losses }}L</b>,
          {{ pct(record) }}%</span
        >
        <span v-if="ladder" class="meta num"
          >{{ ordinal(ladder.position) }} on {{ ladder.server }}</span
        >
      </div>
      <span v-if="rank" class="fg-s num">{{ lp(rank.leaguePoints) }}<span class="u">LP</span></span>
    </div>

    <template v-if="line">
      <div class="lpg">
        <div class="lpg-ax" aria-hidden="true">
          <span v-for="g in line.guides" :key="g.v" class="lpg-m" :style="{ top: `${g.y}%` }"
            ><RankEmblem v-if="g.emblem" :tier="g.tier" :size="20" /><i v-else class="lpg-e" /><b
              :style="{ color: tierVar(g.tier) }"
              >{{ g.label }}</b
            ></span
          >
        </div>
        <div
          class="lpg-plot chart"
          role="img"
          :aria-label="`LP from ${line.start} to ${line.end}, ${signedLp(line.gain)}`"
          @pointermove="at"
          @pointerdown="at"
          @pointerleave="leave"
        >
          <i v-for="g in line.guides" :key="g.v" class="lpg-l" :style="{ top: `${g.y}%` }" />
          <svg
            class="fade"
            :viewBox="`0 0 ${W} ${H}`"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path class="area" :d="line.area" />
          </svg>
          <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
            <path class="ln" :d="line.d" />
          </svg>
          <template v-if="tip">
            <i class="lpg-x" :style="{ left: `${tip.x}%` }" />
            <i class="dot" :style="{ left: `${tip.x}%`, top: `${tip.y}%` }" />
            <div
              class="lpg-tip"
              :class="{ r: tip.x > 60, l: tip.x < 25 }"
              :style="{ left: `${tip.x}%` }"
            >
              <span class="meta">{{ tip.date }}</span>
              <b>{{ tip.name }}</b>
              <span
                v-if="tip.delta !== null"
                :class="tip.delta > 0 ? 'wn' : tip.delta < 0 ? 'ls' : 'meta'"
                >{{ signedLp(tip.delta) }}</span
              >
            </div>
          </template>
          <i
            v-else
            class="dot lpg-end"
            :style="{ left: `${line.dots.at(-1)!.x}%`, top: `${line.dots.at(-1)!.y}%` }"
          />
        </div>
      </div>
      <div class="row meta lpg-d">
        <span>{{ line.start }}</span>
        <span>{{ line.end }}</span>
      </div>
    </template>
    <p v-else-if="auto" class="meta lpg-none">No LP change stored in {{ SPANS[range] }}</p>

    <div v-if="peak" class="pl-q-f">
      <div class="pl-q-s">
        <span class="lab">Peak</span>
        <span class="pl-q-v num"
          ><RankEmblem :tier="peak.rank.tier" :size="20" /><b
            :style="{ color: tierVar(peak.rank.tier) }"
            >{{ label(peak.rank) }}</b
          >{{ ' ' }}{{ lp(peak.rank.leaguePoints) }} LP</span
        >
      </div>
      <div v-if="line" class="pl-q-s r">
        <span class="lab">{{ rangeName }}</span>
        <b class="pl-q-v num" :class="line.gain > 0 ? 'wn' : line.gain < 0 ? 'ls' : ''">{{
          signedLp(line.gain)
        }}</b>
      </div>
    </div>
    <div v-if="flex" class="pl-q-fx" :class="{ top: !peak }">
      <span class="lab">Flex</span>
      <span class="pl-q-v num"
        ><RankEmblem :tier="flex.tier" :size="18" /><span>{{ label(flex) }}</span
        >{{ ' ' }}{{ lp(flex.leaguePoints) }} LP</span
      >
      <span v-if="flex.losses !== null && flex.losses !== undefined" class="meta num"
        >{{ flex.wins }}W {{ flex.losses }}L</span
      >
    </div>
  </section>
</template>

<style scoped>
.pl-sec-h .h4 {
  white-space: nowrap;
}
/* the range: a small select in the header */
.lpr {
  align-self: center;
  flex: none;
  margin: -6px 0 -6px auto;
}
.lpr :deep(.sel) {
  height: 28px;
  gap: 4px;
  padding: 0 7px 0 10px;
  font-size: 12px;
  font-weight: 600;
}
.lpr :deep(.sel-chev) {
  width: 12px;
  height: 12px;
}
.lpg {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 6px;
  margin-top: 18px;
}
.lpg-ax {
  position: relative;
  height: 112px;
}
/* a guide's emblem and numeral, centred on its line */
.lpg-m {
  position: absolute;
  left: 0;
  display: flex;
  align-items: center;
  gap: 1px;
  transform: translateY(-50%);
}
.lpg-e {
  width: 20px;
  height: 20px;
}
.lpg-m b {
  font-size: 10px;
  font-weight: 600;
}
.lpg-plot {
  height: 112px;
  min-width: 0;
  touch-action: pan-y;
  cursor: crosshair;
}
.lpg-l {
  position: absolute;
  left: 0;
  right: 0;
  height: 0;
  border-top: 1px dashed var(--line-2);
}
.lpg-plot .dot {
  width: 8px;
  height: 8px;
  margin: -4px 0 0 -4px;
  pointer-events: none;
}
.lpg-x {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--line-3);
  pointer-events: none;
}
.lpg-tip {
  position: absolute;
  bottom: calc(100% + 8px);
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 128px;
  padding: 8px 10px;
  border-radius: var(--r-sm);
  background: var(--solid-2);
  box-shadow: var(--shadow-2);
  font-size: 12px;
  white-space: nowrap;
  transform: translateX(-50%);
  pointer-events: none;
}
.lpg-tip.r {
  transform: translateX(-92%);
}
.lpg-tip.l {
  transform: translateX(-8%);
}
.lpg-tip b {
  font-size: 13px;
  font-weight: 600;
  color: var(--t1);
}
.lpg-tip .meta {
  font-size: 12px;
}
.lpg-d {
  justify-content: space-between;
  margin: 6px 0 0 42px;
  font-size: 12px;
  white-space: nowrap;
}
.lpg-none {
  margin-top: 14px;
}
/* the peak and what the range changed, under a hairline: a label above each value */
.pl-q-f {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}
.pl-q-s {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.pl-q-s.r {
  flex: none;
  justify-items: end;
  text-align: right;
}
.pl-q-v {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 20px;
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  text-overflow: ellipsis;
}
span.pl-q-v {
  color: var(--t2);
}
/* Flex: one line under the peak, label, emblem and rank, the record at the end */
.pl-q-fx {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}
.pl-q-fx.top {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}
.pl-q-fx .pl-q-v {
  min-width: 0;
}
.pl-q-fx .meta {
  flex: none;
  margin-left: auto;
}
.pl-q-v b,
b.pl-q-v {
  font-weight: 600;
}
.pl-q-v .rk-emb {
  flex: none;
}
</style>
