<script setup lang="ts">
import { computed } from 'vue'
import { rankFromCore, rankLabel, rankValue } from '@invadelol/ui/logic'
import { smooth, tierVar } from './rank.js'
import type { Rank, RanksPayload } from '../../lib/types.js'

/**
 * LP history in the rail: Solo/Duo over the last 30 days as one violet line over a soft fade, the
 * division floors as dashed guides, from the rank snapshots kept each time the profile is read.
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
const H = 110
const line = computed(() => {
  const start = Date.now() - 30 * 864e5
  const pts = (props.ranks?.history ?? [])
    .filter((r) => r.queueType === 'RANKED_SOLO_5x5' && r.tier && r.fetchedAt && time(r) >= start)
    .map((r) => ({ t: time(r), v: ladder(r), r }))
    .filter((p): p is { t: number; v: number; r: Rank } => p.v !== null)
    .sort((a, b) => a.t - b.t)
  const now = solo.value
  const v = now ? ladder(now) : null
  if (now && v !== null && (!pts.length || pts.at(-1)!.v !== v))
    pts.push({ t: Math.max(time(now), pts.at(-1)?.t ?? 0), v, r: now })
  const kept = pts.filter((p, i) => i === 0 || i === pts.length - 1 || p.v !== pts[i - 1].v)
  if (kept.length < 3) return null
  const t0 = kept[0].t
  const t1 = kept.at(-1)!.t
  const lo = Math.min(...kept.map((p) => p.v)) - 20
  const hi = Math.max(...kept.map((p) => p.v)) + 20
  const x = (t: number) => ((t - t0) / Math.max(1, t1 - t0)) * W
  const y = (val: number) => 4 + (H - 8) * (1 - (val - lo) / Math.max(1, hi - lo))
  const d = smooth(kept.map((p) => [x(p.t), y(p.v)] as const))
  const guides: number[] = []
  for (let g = Math.ceil(lo / 100) * 100; g <= hi; g += 100) guides.push(y(g))
  const peak = kept.reduce((a, b) => (b.v > a.v ? b : a))
  const last = kept.at(-1)!
  return {
    d,
    area: `${d} L${W} ${H} L0 ${H} Z`,
    guides: guides.slice(-4),
    end: { x: (x(last.t) / W) * 100, y: (y(last.v) / H) * 100 },
    gain: last.v - kept[0].v,
    peak: `${label(peak.r)} ${peak.r.leaguePoints}`,
    start: new Date(t0).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
  }
})
const gain = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n)} LP in 30 days`
</script>

<template>
  <section v-if="solo" class="card pl-sec">
    <div class="pl-sec-h">
      <h2 class="h4">LP history</h2>
      <span class="meta r">Solo/Duo</span>
    </div>
    <div class="row" style="gap: 8px; align-items: baseline">
      <span class="h5" :style="{ color: tierVar(solo.tier) }">{{ label(solo) }}</span>
      <span class="fg-s num">{{ solo.leaguePoints }}<span class="u">LP</span></span>
      <span v-if="line" class="meta num" style="margin-left: auto">{{ gain(line.gain) }}</span>
    </div>
    <template v-if="line">
      <div class="chart pl-lp">
        <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
          <path v-for="g in line.guides" :key="g" class="dash" :d="`M0 ${g.toFixed(1)} H${W}`" />
        </svg>
        <svg class="fade" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
          <path class="area" :d="line.area" />
        </svg>
        <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
          <path class="ln" :d="line.d" />
        </svg>
        <span class="dot" :style="{ left: `${line.end.x}%`, top: `${line.end.y}%` }" />
      </div>
      <div class="row meta" style="justify-content: space-between; margin-top: 10px">
        <span>{{ line.start }}</span>
        <span
          >Peak <b class="t1">{{ line.peak }}</b></span
        >
      </div>
    </template>
    <p v-else class="meta" style="margin-top: 8px">No LP change stored in the last 30 days</p>
  </section>
</template>
