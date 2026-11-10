<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import { champIcon } from '../../lib/assets.js'

/**
 * A role's champions as a field: win rate up, pick rate across (on a square-root scale, so the
 * many rare picks do not pile up at the left), each one its portrait. S+ is ringed in violet and
 * named, the lowest tiers are quieter. Every portrait links to the champion's page.
 */
const props = defineProps<{
  points: Array<{
    champion: number
    name: string
    href: string
    /** 0‥1 */
    win: number
    /** 0‥1 */
    pick: number
    tier: number | null
  }>
}>()

/** Nice steps for the axes: the win rate in whole points, the pick rate in a few round shares. */
const PICK_TICKS = [0.002, 0.005, 0.01, 0.02, 0.04, 0.07, 0.1, 0.15, 0.2, 0.3]

const frame = computed(() => {
  const wins = props.points.map((p) => p.win * 100)
  const picks = props.points.map((p) => p.pick)
  const yLo = Math.floor(Math.min(...wins, 50) - 0.5)
  const yHi = Math.ceil(Math.max(...wins, 50) + 0.5)
  const xLo = Math.sqrt(Math.max(0.0005, Math.min(...picks)))
  const xHi = Math.sqrt(Math.max(...picks, 0.01))
  const y = (w: number) => ((yHi - w) / (yHi - yLo)) * 100
  const x = (p: number) => ((Math.sqrt(Math.max(p, 0.0005)) - xLo) / (xHi - xLo || 1)) * 94 + 3
  const step = yHi - yLo > 8 ? 4 : 2
  const ys: number[] = []
  for (let v = Math.ceil(yLo / step) * step; v <= yHi; v += step) ys.push(v)
  if (!ys.includes(50)) ys.push(50)
  const xs = PICK_TICKS.filter((t) => Math.sqrt(t) >= xLo && Math.sqrt(t) <= xHi)
  return { y, x, ys, xs }
})

const dots = computed(() =>
  [...props.points]
    // The strongest drawn last, on top.
    .sort((a, b) => (b.tier ?? 9) - (a.tier ?? 9))
    .map((p) => ({
      ...p,
      left: `${frame.value.x(p.pick).toFixed(2)}%`,
      top: `${frame.value.y(p.win * 100).toFixed(2)}%`,
    }))
)
const named = computed(() => dots.value.filter((d) => d.tier === 0))
const tick = (t: number) => `${+(t * 100).toFixed(1)}%`
</script>

<template>
  <div class="tp" role="img" :aria-label="`Win rate against pick rate, ${points.length} champions`">
    <template v-for="v in frame.ys" :key="`y${v}`">
      <span class="gl" :class="{ mid: v === 50 }" :style="{ top: `${frame.y(v)}%` }" />
      <span class="yl num" :style="{ top: `${frame.y(v)}%` }">{{ v }}%</span>
    </template>
    <span v-for="t in frame.xs" :key="`x${t}`" class="xl num" :style="{ left: `${frame.x(t)}%` }">{{
      tick(t)
    }}</span>
    <span class="ax">Pick rate</span>
    <span class="q tl">Strong, rarely picked</span>
    <span class="q tr">Strong and popular</span>
    <span class="q br">Popular, losing</span>
    <Link
      v-for="d in dots"
      :key="d.champion"
      :href="d.href"
      class="pt"
      :class="{ s: d.tier === 0, lo: (d.tier ?? 5) >= 4 }"
      :style="{ left: d.left, top: d.top }"
      :title="`${d.name}, ${(d.win * 100).toFixed(1)}% win rate, ${(d.pick * 100).toFixed(1)}% pick rate`"
      prefetch="hover"
      tabindex="-1"
      aria-hidden="true"
    >
      <img :src="champIcon(d.champion)" alt="" loading="lazy" decoding="async" />
    </Link>
    <span
      v-for="d in named"
      :key="`n${d.champion}`"
      class="lb"
      :style="{ left: d.left, top: d.top }"
      aria-hidden="true"
      >{{ d.name }}</span
    >
  </div>
</template>

<style scoped>
.tp {
  position: relative;
  height: 380px;
  margin: 18px 22px 46px 56px;
}

.gl {
  position: absolute;
  right: 0;
  left: 0;
  height: 1px;
  background: var(--rd-line);
}

.gl.mid {
  background: none;
  border-top: 1px dashed color-mix(in srgb, var(--text-3) 45%, transparent);
}

.yl {
  position: absolute;
  left: -48px;
  width: 38px;
  font-size: 11px;
  text-align: right;
  color: var(--text-3);
  transform: translateY(-50%);
}

.xl {
  position: absolute;
  bottom: -26px;
  font-size: 11px;
  color: var(--text-3);
  transform: translateX(-50%);
}

.ax {
  position: absolute;
  right: 0;
  bottom: -42px;
  font-size: 11px;
  color: var(--text-4);
}

.q {
  position: absolute;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-4);
}

.q.tl {
  top: 6px;
  left: 8px;
}

.q.tr {
  top: 6px;
  right: 8px;
}

.q.br {
  right: 8px;
  bottom: 6px;
}

.pt {
  position: absolute;
  width: 26px;
  height: 26px;
  margin: -13px 0 0 -13px;
  overflow: hidden;
  border-radius: 999px;
  box-shadow:
    0 0 0 1.5px var(--rd-card),
    0 0 0 2.5px color-mix(in srgb, var(--text-1) 14%, transparent);
  transition: transform var(--t-fast) var(--ease);
}

.pt:hover {
  z-index: 4;
  transform: scale(1.35);
}

.pt img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.12);
}

.pt.s {
  z-index: 2;
  width: 34px;
  height: 34px;
  margin: -17px 0 0 -17px;
  box-shadow:
    0 0 0 2px var(--rd-card),
    0 0 0 4px var(--rd-violet);
}

.pt.lo {
  opacity: 0.5;
}

.lb {
  position: absolute;
  z-index: 3;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--text-1);
  text-shadow:
    0 1px 4px var(--rd-card),
    0 0 8px var(--rd-card);
  transform: translate(-50%, -36px);
  pointer-events: none;
}

@media (max-width: 47.99rem) {
  .tp {
    height: 300px;
    margin: 14px 14px 46px 48px;
  }

  .q {
    display: none;
  }
}
</style>
