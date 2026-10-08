<script setup lang="ts">
import { computed } from 'vue'

/**
 * A metric over the last games: straight segments in the current colour (the brand for the
 * viewed player), and, when there is one, the value it is compared with as a dashed line.
 */
const props = withDefaults(
  defineProps<{
    values: number[]
    label: string
    width?: number
    height?: number
    /** Draw a soft area under the line. */
    fill?: boolean
    /** The baseline a delta is computed against, drawn dashed. */
    reference?: number | null
    /** Mark the zero line, for series that swing either side of it. */
    baseline?: boolean
  }>(),
  { width: 140, height: 38, fill: false, reference: null, baseline: false }
)

const geometry = computed(() => {
  const values = props.values
  if (values.length < 2) return null
  const extra = [
    ...(props.baseline ? [0] : []),
    ...(props.reference !== null && Number.isFinite(props.reference) ? [props.reference] : []),
  ]
  const min = Math.min(...values, ...extra)
  const max = Math.max(...values, ...extra)
  const span = Math.max(1e-6, max - min)
  const pad = 3
  const h = props.height - pad * 2
  const y = (value: number) => pad + h - ((value - min) / span) * h
  const points = values.map((value, index) => [
    (index * props.width) / (values.length - 1),
    y(value),
  ])
  const line = points.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ')
  const area = `${line} ${props.width},${props.height} 0,${props.height}`
  return {
    line,
    area,
    zero: y(0),
    reference:
      props.reference !== null && Number.isFinite(props.reference) ? y(props.reference) : null,
    last: points[points.length - 1],
  }
})
</script>

<template>
  <svg
    v-if="geometry"
    :viewBox="`0 0 ${width} ${height}`"
    :width="width"
    :height="height"
    role="img"
    :aria-label="label"
    class="overflow-visible"
    preserveAspectRatio="none"
  >
    <polygon v-if="fill" :points="geometry.area" fill="currentColor" opacity="0.1" />
    <line
      v-if="geometry.reference !== null"
      :x1="0"
      :x2="width"
      :y1="geometry.reference"
      :y2="geometry.reference"
      stroke="var(--color-ink-4)"
      stroke-width="1"
      stroke-dasharray="3 3"
      vector-effect="non-scaling-stroke"
    />
    <line
      v-else-if="baseline"
      :x1="0"
      :x2="width"
      :y1="geometry.zero"
      :y2="geometry.zero"
      stroke="var(--color-ink-4)"
      stroke-width="1"
      stroke-dasharray="3 3"
      vector-effect="non-scaling-stroke"
    />
    <polyline
      :points="geometry.line"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
      stroke-linecap="round"
      vector-effect="non-scaling-stroke"
    />
  </svg>
  <span v-else class="text-[12px] text-ink-4">Not enough games</span>
</template>
