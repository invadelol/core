<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import { shortDate } from '../lib/format.js'

/**
 * A duo's form over their games together: one violet line over a soft fade, the player's win rate
 * without them as a faint dashed line, hairline guides, one end dot. Pointing (or tapping) at a
 * game shows its date, result and the form at that point.
 */
const props = withDefaults(
  defineProps<{
    /** 0–1, one per game, oldest first. */
    values: number[]
    /** Each game's start (epoch ms) and result, in the same order. */
    games: Array<{ t: number; win: boolean }>
    /** 0–1, drawn dashed. */
    baseline: number | null
    height?: number
    label: string
  }>(),
  { height: 150 }
)

const box = useTemplateRef<HTMLElement>('box')
const width = ref(0)
let observer: ResizeObserver | undefined
onMounted(() => {
  if (!box.value) return
  width.value = box.value.clientWidth
  observer = new ResizeObserver(([entry]) => (width.value = entry.contentRect.width))
  observer.observe(box.value)
})
onBeforeUnmount(() => observer?.disconnect())

/** The top band holds the tooltip, so it never covers the line or the text above the chart. */
const PAD = { top: 30, right: 10, bottom: 22, left: 34 }

/** Monotone cubic through points sorted by x: smooth, never past a value that was not reached. */
function monotone(points: Array<[number, number]>) {
  const n = points.length
  if (n < 2) return ''
  if (n === 2) return `M${points[0][0]},${points[0][1]}L${points[1][0]},${points[1][1]}`
  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1][0] - points[i][0])
    slope.push((points[i + 1][1] - points[i][1]) / (dx[i] || 1))
  }
  const tangent: number[] = [slope[0]]
  for (let i = 1; i < n - 1; i++) {
    const a = slope[i - 1]
    const b = slope[i]
    tangent.push(
      a * b <= 0
        ? 0
        : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / a + (dx[i] + 2 * dx[i - 1]) / b)
    )
  }
  tangent.push(slope[n - 2])
  let path = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[i + 1]
    const h = dx[i] / 3
    path += `C${(x0 + h).toFixed(1)},${(y0 + tangent[i] * h).toFixed(1)} ${(x1 - h).toFixed(1)},${(y1 - tangent[i + 1] * h).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`
  }
  return path
}

const chart = computed(() => {
  const w = width.value
  const values = props.values
  if (!w || values.length < 2) return null
  const h = props.height
  const all = props.baseline === null ? values : [...values, props.baseline]
  // At least 30 points tall, so ordinary swings read as the gentle variation they are.
  let low = Math.min(...all)
  let high = Math.max(...all)
  const middle = (low + high) / 2
  const half = Math.max((high - low) / 2 + 0.04, 0.15)
  low = Math.max(0, middle - half)
  high = Math.min(1, middle + half)
  if (high - low < 0.3) {
    if (low === 0) high = 0.3
    else low = 0.7
  }
  const x = (i: number) => PAD.left + (i / (values.length - 1)) * (w - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - (v - low) / (high - low)) * (h - PAD.top - PAD.bottom)
  const points = values.map((v, i) => [x(i), y(v)] as [number, number])
  const line = monotone(points)
  const floor = h - PAD.bottom
  // Guides every ten points inside the domain, at most three of them.
  const step = high - low > 0.45 ? 0.2 : 0.1
  const guides: number[] = []
  for (let v = Math.ceil(low / step) * step; v <= high + 1e-9; v += step) guides.push(v)
  return {
    w,
    h,
    line,
    area: `${line}L${points[points.length - 1][0].toFixed(1)},${floor}L${points[0][0].toFixed(1)},${floor}Z`,
    points,
    guides: guides.slice(0, 4).map((v) => ({ v, y: y(v) })),
    base: props.baseline === null ? null : y(props.baseline),
    floor,
  }
})

const hover = ref<number | null>(null)
function point(event: PointerEvent) {
  const c = chart.value
  if (!c || !box.value) return
  const rect = box.value.getBoundingClientRect()
  const px = event.clientX - rect.left
  const span = c.w - PAD.left - PAD.right
  const i = Math.round(((px - PAD.left) / span) * (props.values.length - 1))
  hover.value = Math.max(0, Math.min(props.values.length - 1, i))
}

/** A mouse leaving hides the tip; a finger lifting keeps it, as a tap shows it. */
function leave(event: PointerEvent) {
  if (event.pointerType === 'mouse') hover.value = null
}

const tip = computed(() => {
  const c = chart.value
  const i = hover.value
  if (!c || i === null) return null
  const game = props.games[i]
  const [px, py] = c.points[i]
  return {
    x: px,
    y: py,
    left: Math.min(Math.max(px, 70), c.w - 70),
    date: game ? shortDate(game.t) : '',
    result: game?.win ? 'Win' : 'Loss',
    form: Math.round(props.values[i] * 100),
  }
})

const id = `fr-fade-${Math.random().toString(36).slice(2, 8)}`
</script>

<template>
  <div
    ref="box"
    class="fr-trend"
    :style="{ height: `${height}px` }"
    role="img"
    :aria-label="label"
    @pointermove="point"
    @pointerdown="point"
    @pointerleave="leave"
  >
    <svg v-if="chart" :width="chart.w" :height="chart.h" aria-hidden="true">
      <defs>
        <linearGradient :id="id" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="var(--brand)" stop-opacity="0.18" />
          <stop offset="1" stop-color="var(--brand)" stop-opacity="0" />
        </linearGradient>
      </defs>

      <g class="fr-trend-guides">
        <template v-for="guide in chart.guides" :key="guide.v">
          <line :x1="34" :x2="chart.w - 10" :y1="guide.y" :y2="guide.y" />
          <text :x="26" :y="guide.y" dy="0.32em" text-anchor="end">
            {{ Math.round(guide.v * 100) }}%
          </text>
        </template>
      </g>

      <line
        v-if="chart.base !== null"
        class="fr-trend-base"
        :x1="34"
        :x2="chart.w - 10"
        :y1="chart.base"
        :y2="chart.base"
      />

      <path :d="chart.area" :fill="`url(#${id})`" />
      <path :d="chart.line" class="fr-trend-line" />

      <g class="fr-trend-axis">
        <text :x="34" :y="chart.h - 4">{{ shortDate(games[0]?.t ?? 0) }}</text>
        <text :x="chart.w - 10" :y="chart.h - 4" text-anchor="end">
          {{ shortDate(games[games.length - 1]?.t ?? 0) }}
        </text>
      </g>

      <template v-if="tip">
        <line class="fr-trend-cursor" :x1="tip.x" :x2="tip.x" :y1="28" :y2="chart.floor" />
        <circle class="fr-trend-dot" :cx="tip.x" :cy="tip.y" r="3.5" />
      </template>
      <circle
        v-else
        class="fr-trend-dot"
        :cx="chart.points[chart.points.length - 1][0]"
        :cy="chart.points[chart.points.length - 1][1]"
        r="3.5"
      />
    </svg>

    <div v-if="tip" class="fr-trend-tip num" :style="{ left: `${tip.left}px` }">
      <span class="text-ink-3">{{ tip.date }} · {{ tip.result }}</span>
      <b>{{ tip.form }}%</b>
    </div>
  </div>
</template>

<style scoped>
.fr-trend {
  position: relative;
  width: 100%;
  touch-action: pan-y;
  user-select: none;
}

.fr-trend svg {
  display: block;
  overflow: visible;
}

.fr-trend-guides line {
  stroke: var(--line);
  stroke-width: 1;
}

.fr-trend-guides text,
.fr-trend-axis text {
  font-size: 11px;
  font-weight: 500;
  fill: var(--text-4);
  font-variant-numeric: tabular-nums;
}

.fr-trend-base {
  stroke: var(--text-4);
  stroke-width: 1;
  stroke-dasharray: 3 4;
  opacity: 0.8;
}

.fr-trend-line {
  fill: none;
  stroke: var(--brand);
  stroke-width: 1.75;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.fr-trend-dot {
  fill: var(--brand);
  stroke: var(--solid-1);
  stroke-width: 2;
}

.fr-trend-cursor {
  stroke: var(--line-2);
  stroke-width: 1;
}

.fr-trend-tip {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 5px 8px;
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
  color: var(--text-1);
  background: var(--solid-2);
  border-radius: var(--r-sm);
  box-shadow: var(--shadow-2);
  pointer-events: none;
  animation: fr-tip-in 120ms var(--ease) both;
}

.fr-trend-tip b {
  font-weight: 600;
}

@keyframes fr-tip-in {
  from {
    opacity: 0;
  }
}
</style>
