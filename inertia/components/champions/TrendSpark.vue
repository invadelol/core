<script setup lang="ts">
import { computed, ref } from 'vue'
import { sparkPaths } from '../../lib/tier_lists.js'

/**
 * A row's daily win rate over the last two weeks: one violet line with its fade over a dashed
 * hairline at 50 %, an end dot, and the last day's figure beside it. Hovering a day shows a
 * hairline, a dot and that day's figure.
 */
const props = defineProps<{
  /** Daily win rates, oldest first (null on a day with too few games). */
  values: (number | null)[]
  /** The days, `YYYY-MM-DD`, as many as the values. */
  days: string[]
}>()

const W = 160
const H = 30
const paths = computed(() => sparkPaths(props.values, W, H))

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dayText = (iso: string | undefined) => {
  const [, m, d] = (iso ?? '').split('-').map(Number)
  return m && d ? `${d} ${MONTHS[m - 1]}` : ''
}
const pct = (v: number) => `${(v * 100).toFixed(1)}%`

/** The day under the pointer: the nearest one with a figure. */
const at = ref<number | null>(null)
function move(e: PointerEvent) {
  const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const n = props.values.length
  if (!box.width || n < 2 || !paths.value) return
  const i = Math.round(Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)) * (n - 1))
  let best: number | null = null
  for (let k = 0; k < n; k++) {
    if (paths.value.points[k] && (best === null || Math.abs(k - i) < Math.abs(best - i))) best = k
  }
  at.value = best
}
const hover = computed(() => {
  const p = at.value === null ? null : paths.value?.points[at.value]
  if (!p) return null
  return {
    left: `${(p.x / W) * 100}%`,
    top: `${(p.y / H) * 100}%`,
    text: pct(p.v),
    day: dayText(props.days[at.value!]),
  }
})
const end = computed(() => {
  const p = paths.value?.last
  return p ? { left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` } : null
})
</script>

<template>
  <div v-if="paths" class="tl-tr">
    <div class="chart spark tl-tr-c" @pointermove="move" @pointerleave="at = null">
      <svg class="fade" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
        <path class="area" :d="paths.area" />
      </svg>
      <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
        <path class="dash" :d="`M0 ${paths.pivot} H${W}`" />
        <path class="ln" :d="paths.line" />
      </svg>
      <i v-if="end && !hover" class="tl-tr-dot" :style="end" />
      <template v-if="hover">
        <i class="tl-tr-hl" :style="{ left: hover.left }" />
        <i class="tl-tr-dot" :style="{ left: hover.left, top: hover.top }" />
        <span class="tl-tr-tip" :style="{ left: hover.left }"
          ><b>{{ hover.text }}</b
          >{{ hover.day }}</span
        >
      </template>
    </div>
    <span v-if="paths.last" class="fg-xs t2 tl-tr-v"
      >{{ (paths.last.v * 100).toFixed(0) }}<span class="u">%</span></span
    >
  </div>
  <span v-else class="spark" />
</template>

<style scoped>
.tl-tr {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 40px;
  align-items: center;
  gap: 10px;
  width: 100%;
}
.tl-tr-c {
  cursor: crosshair;
}
.tl-tr-v {
  text-align: right;
}
.tl-tr-dot {
  position: absolute;
  width: 5px;
  height: 5px;
  margin: -2.5px 0 0 -2.5px;
  border-radius: 50%;
  background: var(--v400);
  pointer-events: none;
}
.tl-tr-hl {
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 1px;
  background: var(--line-3);
  pointer-events: none;
}
.tl-tr-tip {
  position: absolute;
  bottom: calc(100% + 8px);
  z-index: 4;
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 5px 8px 6px;
  border-radius: var(--r2);
  background: var(--s2);
  box-shadow:
    inset 0 0 0 1px var(--line-2),
    var(--drop);
  font-size: 12px;
  font-weight: 500;
  color: var(--t3);
  white-space: nowrap;
  transform: translateX(-50%);
  pointer-events: none;
}
.tl-tr-tip b {
  font-weight: 650;
  color: var(--t1);
  font-variant-numeric: tabular-nums;
}
</style>
