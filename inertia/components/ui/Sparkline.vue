<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    values: number[]
    label: string
    width?: number
    height?: number
    /** Draw a soft area under the line. */
    fill?: boolean
    /** Mark the zero line, for series that swing either side of it. */
    baseline?: boolean
  }>(),
  { width: 140, height: 38, fill: true, baseline: false }
)

const geometry = computed(() => {
  const values = props.values
  if (values.length < 2) return null
  const min = props.baseline ? Math.min(0, ...values) : Math.min(...values)
  const max = props.baseline ? Math.max(0, ...values) : Math.max(...values)
  const span = Math.max(1e-6, max - min)
  const pad = 3
  const h = props.height - pad * 2
  const point = (value: number, index: number) => {
    const x = (index * props.width) / (values.length - 1)
    const y = pad + h - ((value - min) / span) * h
    return [x, y] as const
  }
  const points = values.map(point)
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} ${props.width},${props.height} 0,${props.height}`
  const zero = pad + h - ((0 - min) / span) * h
  const last = points[points.length - 1]
  return { line, area, zero, last }
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
      v-if="baseline"
      :x1="0"
      :x2="width"
      :y1="geometry.zero"
      :y2="geometry.zero"
      stroke="currentColor"
      stroke-width="1"
      opacity="0.25"
      stroke-dasharray="3 3"
    />
    <polyline
      :points="geometry.line"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linejoin="round"
      stroke-linecap="round"
      vector-effect="non-scaling-stroke"
    />
    <circle :cx="geometry.last[0]" :cy="geometry.last[1]" r="2.5" fill="currentColor" />
  </svg>
  <span v-else class="text-[11px] text-ink-4">Not enough games</span>
</template>
