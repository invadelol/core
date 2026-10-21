<script setup lang="ts">
import { computed, useId } from 'vue'

/**
 * One violet line with a soft fade under it (DESIGN.md §8): near-invisible guides, small labels,
 * one end dot, and a faint dashed line for a benchmark (50 %).
 */
const props = withDefaults(
  defineProps<{
    values: number[]
    labels?: string[]
    height?: number
    /** Values shown as guides on the left, formatted by `format`. */
    guides?: number[]
    bench?: number | null
    format?: (v: number) => string
  }>(),
  {
    labels: () => [],
    height: 120,
    guides: () => [],
    bench: null,
    format: (v: number) => `${Math.round(v * 100)}%`,
  }
)

const W = 600
const id = useId()
const geo = computed(() => {
  const v = props.values
  if (v.length < 2) return null
  const all = [...v, ...props.guides, ...(props.bench === null ? [] : [props.bench])]
  let min = Math.min(...all)
  let max = Math.max(...all)
  const pad = Math.max((max - min) * 0.15, 1e-6)
  min -= pad
  max += pad
  const h = props.height
  const y = (n: number) => 6 + (1 - (n - min) / (max - min)) * (h - 12)
  const x = (i: number) => (i / (v.length - 1)) * W
  const pts = v.map((n, i) => [x(i), y(n)] as const)
  // Monotone cubic: no overshoot between points.
  const t = pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(pts.length - 1, i + 1)]
    return (b[1] - a[1]) / (b[0] - a[0] || 1)
  })
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const k = (pts[i + 1][0] - pts[i][0]) / 3
    d += ` C${pts[i][0] + k},${pts[i][1] + t[i] * k} ${pts[i + 1][0] - k},${pts[i + 1][1] - t[i + 1] * k} ${pts[i + 1][0]},${pts[i + 1][1]}`
  }
  return {
    line: d,
    area: `${d} L${W},${h} L0,${h} Z`,
    end: pts[pts.length - 1],
    guides: props.guides.map((g) => ({ y: y(g), label: props.format(g) })),
    bench: props.bench === null ? null : y(props.bench),
  }
})
</script>

<template>
  <div v-if="geo" class="cs-chart">
    <div class="plot" :style="{ height: `${height}px` }">
      <span v-for="g in geo.guides" :key="g.label" class="g" :style="{ top: `${g.y}px` }"
        ><em>{{ g.label }}</em></span
      >
      <span v-if="geo.bench !== null" class="b" :style="{ top: `${geo.bench}px` }" />
      <svg :viewBox="`0 0 ${W} ${height}`" preserveAspectRatio="none" :height="height" width="100%">
        <defs>
          <linearGradient :id="id" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="var(--brand)" stop-opacity=".22" />
            <stop offset="1" stop-color="var(--brand)" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path :d="geo.area" :fill="`url(#${id})`" />
        <path
          :d="geo.line"
          fill="none"
          stroke="var(--brand)"
          stroke-width="2"
          vector-effect="non-scaling-stroke"
        />
      </svg>
      <span class="dot" :style="{ top: `${geo.end[1]}px` }" />
    </div>
    <div v-if="labels.length" class="x">
      <span v-for="(l, i) in labels" :key="i">{{ l }}</span>
    </div>
  </div>
</template>

<style scoped>
.cs-chart {
  padding-left: 36px;
}
.plot {
  position: relative;
}
.plot svg {
  display: block;
  overflow: visible;
}
.g {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--line);
}
.g em {
  position: absolute;
  left: -36px;
  top: -7px;
  width: 30px;
  text-align: right;
  font: 500 10.5px var(--font);
  font-style: normal;
  color: var(--text-3);
}
.b {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px dashed var(--line-3);
}
.dot {
  position: absolute;
  right: -3.5px;
  width: 7px;
  height: 7px;
  margin-top: -3.5px;
  border-radius: 50%;
  background: var(--brand-hi);
  box-shadow: 0 0 0 1.5px var(--ink-1);
}
.x {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 10.5px;
  color: var(--text-3);
}
</style>
