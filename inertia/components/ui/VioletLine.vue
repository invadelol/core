<script setup lang="ts">
import { computed } from 'vue'
import { monotone } from '../../lib/rd_curve.js'

/**
 * The site's one chart line (Violet line): a smooth violet curve over a soft fade, with optional
 * dashed guides (a tier line, an average), a dot per point (blue win, red loss) and an end dot
 * labelled with the latest value. It fills its box; the stroke keeps its width at any size.
 */
const props = withDefaults(
  defineProps<{
    values: number[]
    /** Where each point sits across, 0‥1; evenly spread when left out. */
    xs?: number[]
    min?: number
    max?: number
    /** Height of the box in pixels. */
    height: number
    area?: boolean
    /** Space kept above and below the line, in pixels. */
    pad?: number
    guides?: Array<{ value: number; above?: string; below?: string; tone?: string }>
    /** Label of the end dot; `undefined` draws no dot, '' a dot without a label. */
    end?: string
    /** One mark per point: 'w' (blue), 'l' (red), or nothing. */
    dots?: Array<'w' | 'l' | null>
    /** A thin line, for sparklines. */
    thin?: boolean
  }>(),
  { area: true, pad: 8 }
)

const W = 1000

const range = computed(() => {
  const all = [...props.values, ...(props.guides ?? []).map((g) => g.value)]
  let lo = props.min ?? Math.min(...all)
  let hi = props.max ?? Math.max(...all)
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { lo: 0, hi: 1 }
  if (hi - lo < 1e-9) {
    lo -= 1
    hi += 1
  }
  return { lo, hi }
})

const y = (v: number) => {
  const { lo, hi } = range.value
  return props.pad + (1 - (v - lo) / (hi - lo)) * (props.height - props.pad * 2)
}
const x = (i: number) =>
  props.xs?.[i] !== undefined
    ? props.xs[i] * W
    : props.values.length > 1
      ? (i / (props.values.length - 1)) * W
      : W / 2

const points = computed(() => props.values.map((v, i) => [x(i), y(v)] as const))
const line = computed(() => (points.value.length > 1 ? monotone(points.value) : ''))
const fill = computed(() => {
  const p = points.value
  if (p.length < 2) return ''
  return `${line.value}L${p[p.length - 1][0].toFixed(1)} ${props.height}L${p[0][0].toFixed(1)} ${props.height}Z`
})
const last = computed(() => points.value[points.value.length - 1])
</script>

<template>
  <div class="rd-vl" :class="{ thin }" :style="{ height: `${height}px` }" aria-hidden="true">
    <span
      v-for="(g, i) in guides"
      :key="i"
      class="gd"
      :style="{ 'top': `${y(g.value).toFixed(1)}px`, '--tone': g.tone }"
    >
      <span v-if="g.above" class="a">{{ g.above }}</span>
      <span v-if="g.below" class="b">{{ g.below }}</span>
    </span>
    <svg v-if="area && fill" class="ar" :viewBox="`0 0 ${W} ${height}`" preserveAspectRatio="none">
      <path :d="fill" />
    </svg>
    <svg v-if="line" class="ln" :viewBox="`0 0 ${W} ${height}`" preserveAspectRatio="none">
      <path :d="line" vector-effect="non-scaling-stroke" />
    </svg>
    <template v-if="dots">
      <span
        v-for="(d, i) in dots"
        v-show="d"
        :key="`d${i}`"
        class="dot"
        :class="d"
        :style="{
          left: `${(points[i]?.[0] ?? 0) / 10}%`,
          top: `${(points[i]?.[1] ?? 0).toFixed(1)}px`,
        }"
      />
    </template>
    <template v-if="end !== undefined && last">
      <span class="end" :style="{ left: `${last[0] / 10}%`, top: `${last[1].toFixed(1)}px` }" />
      <span
        v-if="end"
        class="endl num"
        :style="{ top: `${last[1].toFixed(1)}px` }"
        :class="{ low: last[1] < 30 }"
        >{{ end }}</span
      >
    </template>
  </div>
</template>

<style>
.rd-vl {
  position: relative;
  min-width: 0;
}
.rd-vl svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.rd-vl .ar {
  opacity: 0.3;
  -webkit-mask-image: linear-gradient(180deg, #000, transparent 92%);
  mask-image: linear-gradient(180deg, #000, transparent 92%);
}
.rd-vl .ar path {
  fill: var(--rd-violet);
}
.rd-vl .ln path {
  fill: none;
  stroke: var(--rd-violet-hi);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.rd-vl.thin .ln path {
  stroke-width: 1.5;
}
.rd-vl .gd {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px dashed var(--line-3, rgb(255 255 255 / 0.18));
}
.rd-vl .gd span {
  position: absolute;
  right: 0;
  font-size: 11px;
  white-space: nowrap;
  color: var(--text-3);
}
.rd-vl .gd .a {
  bottom: 5px;
  font-weight: 600;
  color: var(--tone, var(--text-2));
}
.rd-vl .gd .b {
  top: 5px;
}
.rd-vl .dot {
  position: absolute;
  width: 8px;
  height: 8px;
  margin: -4px 0 0 -4px;
  border-radius: 9px;
  background: var(--loss);
  box-shadow: 0 0 0 2px var(--rd-card);
}
.rd-vl .dot.w {
  background: var(--win);
}
.rd-vl .end {
  position: absolute;
  width: 10px;
  height: 10px;
  margin-left: -5px;
  border-radius: 9px;
  background: var(--text-1);
  box-shadow: 0 0 0 3px rgb(143 131 255 / 0.45);
  transform: translateY(-50%);
}
.rd-vl .endl {
  position: absolute;
  right: 12px;
  transform: translateY(-150%);
  padding: 2px 7px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 650;
  color: var(--text-1);
  background: var(--rd-card-2);
  box-shadow: 0 0 0 1px var(--rd-line);
  white-space: nowrap;
}
.rd-vl .endl.low {
  transform: translateY(50%);
}
</style>
