<script setup lang="ts">
import { computed } from 'vue'
import { rankFromCore, rankLabel, rankValue } from '@invadelol/ui/logic'
import { tierVar } from './rank.js'
import type { Rank, RanksPayload } from '../../lib/types.js'

/**
 * LP history in the rail: Solo/Duo over the last 30 days, day by day, from the rank snapshots kept
 * each time the profile is read. The LP at the end of each day as steps (a day with no snapshot
 * keeps the day before), and under it one bar per day for what that day changed: violet when it
 * gained, grey when it lost, a flat tick when nothing moved.
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
const H = 84
const DAYS = 30
const DAY = 864e5
/** Local midnight, so a day is the player's calendar day. */
const dayOf = (t: number) => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const line = computed(() => {
  const first = dayOf(Date.now()) - (DAYS - 1) * DAY
  const pts = (props.ranks?.history ?? [])
    .filter((r) => r.queueType === 'RANKED_SOLO_5x5' && r.tier && r.fetchedAt)
    .map((r) => ({ t: time(r), v: ladder(r), r }))
    .filter((p): p is { t: number; v: number; r: Rank } => p.v !== null)
    .sort((a, b) => a.t - b.t)
  const now = solo.value
  const nv = now ? ladder(now) : null
  if (now && nv !== null) pts.push({ t: Math.max(Date.now(), pts.at(-1)?.t ?? 0), v: nv, r: now })
  const inside = pts.filter((p) => p.t >= first)
  if (inside.length < 2) return null
  const before = pts.filter((p) => p.t < first).at(-1)
  const base = before?.v ?? inside[0].v
  let prev = base
  const ends: number[] = []
  const deltas: number[] = []
  for (let i = 0; i < DAYS; i++) {
    const from = first + i * DAY
    const day = inside.filter((p) => p.t >= from && p.t < from + DAY)
    const end = day.length ? day.at(-1)!.v : prev
    deltas.push(end - prev)
    ends.push(end)
    prev = end
  }
  if (!deltas.some((d) => d !== 0)) return null
  const lo = Math.min(...ends) - 10
  const hi = Math.max(...ends) + 10
  const y = (val: number) => 4 + (H - 8) * (1 - (val - lo) / Math.max(1, hi - lo))
  const cw = W / DAYS
  let d = `M0 ${y(ends[0]).toFixed(1)}`
  ends.forEach((v, i) => (d += ` H${(i * cw).toFixed(1)} V${y(v).toFixed(1)}`))
  d += ` H${W}`
  const most = Math.max(...deltas.map(Math.abs)) || 1
  const peak = inside.reduce((a, b) => (b.v > a.v ? b : a))
  return {
    d,
    area: `${d} V${H} H0 Z`,
    bars: deltas.map((v) => ({
      cls: v > 0 ? 'up' : v < 0 ? 'dn' : 'z',
      h: v ? Math.max(3, (Math.abs(v) / most) * 28) : 2,
    })),
    gain: ends.at(-1)! - base,
    peak: `${label(peak.r)} ${peak.r.leaguePoints}`,
    start: new Date(first).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
  }
})
const gain = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n)} LP`
</script>

<template>
  <section v-if="solo" class="card pl-sec">
    <div class="pl-sec-h">
      <h2 class="h4">LP history</h2>
      <span class="meta r">Solo/Duo, 30 days</span>
    </div>
    <div class="row" style="gap: 8px; align-items: baseline">
      <span class="h5" :style="{ color: tierVar(solo.tier) }">{{ label(solo) }}</span>
      <span class="fg-s num">{{ solo.leaguePoints }}<span class="u">LP</span></span>
      <span v-if="line" class="meta num" style="margin-left: auto"
        ><b :class="line.gain >= 0 ? 'wn' : 'ls'">{{ gain(line.gain) }}</b></span
      >
    </div>
    <template v-if="line">
      <div class="chart lpd">
        <svg class="fade" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
          <path class="area" :d="line.area" />
        </svg>
        <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
          <path class="ln" :d="line.d" />
        </svg>
      </div>
      <div class="lpd-bars" aria-hidden="true">
        <i v-for="(b, i) in line.bars" :key="i" :class="b.cls" :style="{ height: `${b.h}px` }" />
      </div>
      <div class="row meta" style="justify-content: space-between; margin-top: 8px">
        <span>{{ line.start }}</span>
        <span
          >Peak <b class="t1">{{ line.peak }}</b></span
        >
        <span>Today</span>
      </div>
    </template>
    <p v-else class="meta" style="margin-top: 8px">No LP change stored in the last 30 days</p>
  </section>
</template>

<style scoped>
.lpd {
  position: relative;
  height: 84px;
  margin-top: 16px;
}
.lpd .ln {
  stroke-linejoin: round;
}
.lpd-bars {
  display: grid;
  grid-template-columns: repeat(30, 1fr);
  gap: 2px;
  align-items: end;
  height: 30px;
  margin-top: 8px;
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
</style>
