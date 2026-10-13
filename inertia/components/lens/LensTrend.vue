<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { monotone } from './tone.js'

/**
 * A rating over the games, oldest first: one violet line over a soft fade, a faint dashed
 * benchmark, a single end dot. Hover (or a tap) shows the game under the pointer.
 */
const props = withDefaults(
  defineProps<{
    /** One value per game; null where the game said nothing. */
    values: (number | null)[]
    /** What each game is, for the hover: "Darius · Win". */
    labels: string[]
    /** Average the line over this many games, so form reads through noise. */
    smooth?: number
    /** A benchmark drawn dashed, and its name. */
    baseline?: number | null
    baselineLabel?: string
    height?: number
    /** What the values are, for screen readers. */
    label: string
  }>(),
  { smooth: 5, baseline: null, baselineLabel: '', height: 64 }
)

const gradient = `lv-trend-${useId()}`
const PAD = 6

const points = computed(() =>
  props.values.flatMap((value, game) => (value === null ? [] : [{ game, value }]))
)

const series = computed(() => {
  const list = points.value
  return list.map((point, i) => {
    const window = list.slice(Math.max(0, i - props.smooth + 1), i + 1)
    return { ...point, line: window.reduce((s, p) => s + p.value, 0) / window.length }
  })
})

const geometry = computed(() => {
  const list = series.value
  if (list.length < 2) return null
  const values = list.map((p) => p.line)
  if (props.baseline !== null) values.push(props.baseline)
  const centre = (Math.min(...values) + Math.max(...values)) / 2
  const half = Math.max((Math.max(...values) - Math.min(...values)) / 2 + 6, 20)
  const lo = Math.max(0, centre - half)
  const hi = Math.min(100, centre + half)
  const h = props.height
  const y = (v: number) => PAD + (1 - (v - lo) / Math.max(1, hi - lo)) * (h - PAD * 2)
  const x = (i: number) => (i / (list.length - 1)) * 100
  const xy = list.map((p, i) => [x(i), y(p.line)] as [number, number])
  const line = monotone(xy)
  return {
    line,
    area: `${line}L100 ${h}L0 ${h}Z`,
    base: props.baseline === null ? null : y(props.baseline),
    xy,
  }
})

const active = ref<number | null>(null)
function point(event: PointerEvent) {
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const n = series.value.length
  if (n < 2 || !box.width) return
  active.value = Math.round(((event.clientX - box.left) / box.width) * (n - 1))
}

/* A mouse leaving clears the hover; a tap's game stays shown until the next tap. */
function leave(event: PointerEvent) {
  if (event.pointerType === 'mouse') active.value = null
}

const shown = computed(() => {
  const i = active.value ?? series.value.length - 1
  const p = series.value[i]
  const at = geometry.value?.xy[i]
  if (!p || !at) return null
  return { ...p, x: at[0], y: at[1], label: props.labels[p.game] ?? '' }
})
</script>

<template>
  <div
    v-if="geometry"
    class="lv-trend"
    role="img"
    :aria-label="label"
    :style="{ height: `${height}px` }"
    @pointermove="point"
    @pointerdown="point"
    @pointerleave="leave"
  >
    <svg :viewBox="`0 0 100 ${height}`" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient :id="gradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="var(--brand)" stop-opacity="0.18" />
          <stop offset="1" stop-color="var(--brand)" stop-opacity="0" />
        </linearGradient>
      </defs>
      <line
        v-if="geometry.base !== null"
        class="lv-trend-base"
        x1="0"
        x2="100"
        :y1="geometry.base"
        :y2="geometry.base"
      />
      <path :d="geometry.area" :fill="`url(#${gradient})`" />
      <path class="lv-trend-line" :d="geometry.line" />
    </svg>
    <span
      v-if="geometry.base !== null && baselineLabel"
      class="lv-trend-base-label"
      :style="{ top: `${geometry.base}px` }"
      >{{ baselineLabel }}</span
    >
    <template v-if="shown">
      <i v-if="active !== null" class="lv-trend-guide" :style="{ left: `${shown.x}%` }" />
      <i class="lv-trend-dot" :style="{ left: `${shown.x}%`, top: `${shown.y}px` }" />
      <span
        v-if="active !== null"
        class="lv-trend-tip num"
        :class="{ end: shown.x > 70, start: shown.x < 30 }"
        :style="{ left: `${shown.x}%` }"
      >
        <span class="text-ink-3">{{ shown.label }}</span>
        <b>{{ Math.round(shown.value) }}</b>
        <span v-if="smooth > 1" class="text-ink-3">· {{ Math.round(shown.line) }} avg</span>
      </span>
    </template>
  </div>
  <p v-else class="lv-trend-empty">Not enough games for a trend yet.</p>
</template>

<style scoped>
.lv-trend {
  position: relative;
  touch-action: pan-y;
  cursor: crosshair;
}

.lv-trend svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.lv-trend-line {
  fill: none;
  stroke: var(--brand);
  stroke-width: 1.75;
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

.lv-trend-base {
  stroke: var(--line-3);
  stroke-width: 1;
  stroke-dasharray: 3 4;
  vector-effect: non-scaling-stroke;
}

.lv-trend-base-label {
  position: absolute;
  right: 0;
  transform: translateY(-100%);
  padding-bottom: 2px;
  font-size: 11px;
  line-height: 14px;
  color: var(--text-4);
  pointer-events: none;
}

.lv-trend-dot {
  position: absolute;
  width: 7px;
  height: 7px;
  margin: -3.5px 0 0 -3.5px;
  border-radius: 50%;
  background: var(--brand);
  box-shadow: 0 0 0 2px var(--solid-1);
  pointer-events: none;
}

.lv-trend-guide {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  margin-left: -0.5px;
  background: var(--line-2);
  pointer-events: none;
}

.lv-trend-tip {
  position: absolute;
  bottom: calc(100% + 6px);
  display: flex;
  gap: 6px;
  align-items: baseline;
  padding: 4px 8px;
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
  color: var(--text-1);
  background: var(--solid-2);
  border-radius: var(--r-sm);
  box-shadow: var(--shadow-2);
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 2;
}

.lv-trend-tip.end {
  transform: translateX(-100%);
}

.lv-trend-tip.start {
  transform: none;
}

.lv-trend-tip b {
  font-weight: 600;
}

.lv-trend-empty {
  font-size: 12px;
  color: var(--text-4);
}
</style>
