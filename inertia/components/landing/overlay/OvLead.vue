<script setup lang="ts">
import { computed, useId } from 'vue'
import { Swords } from 'lucide-vue-next'
import { compactGold } from './clock.js'

/** Win & gold, as the overlay draws it: the team gold lead, the win probability, how the lead moved. */
const props = defineProps<{
  goldDiff: number
  winProb: number
  /** The gold lead over the game, oldest first. */
  history: number[]
  kills: { ally: number; enemy: number }
  /** 0–1: how much of the line is drawn. */
  drawn?: number
}>()

const W = 170
const H = 30
const PAD = 3

/** Monotone cubic through the points (never overshoots), as the overlay's sparkline. */
function smooth(xs: number[], ys: number[]) {
  const n = xs.length
  const d: number[] = []
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]))
  const m = [d[0]]
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2)
  m.push(d[n - 2])
  let path = `M${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const dx = (xs[i + 1] - xs[i]) / 3
    path += `C${(xs[i] + dx).toFixed(1)} ${(ys[i] + m[i] * dx).toFixed(1)} ${(xs[i + 1] - dx).toFixed(1)} ${(ys[i + 1] - m[i + 1] * dx).toFixed(1)} ${xs[i + 1].toFixed(1)} ${ys[i + 1].toFixed(1)}`
  }
  return path
}

const geo = computed(() => {
  const v = props.history
  if (v.length < 2) return null
  const max = Math.max(...v.map(Math.abs), 1)
  const sy = (H - 2 * PAD) / (2 * max)
  const y = (n: number) => H - PAD - (n + max) * sy
  const xs = v.map((_, i) => (i * W) / (v.length - 1))
  const ys = v.map(y)
  const line = smooth(xs, ys)
  const base = y(0)
  return {
    line,
    area: `${line}L${W} ${base}L0 ${base}Z`,
    base,
    end: { x: W, y: ys[ys.length - 1] },
  }
})

const side = computed(() => (props.goldDiff > 0 ? 'ally' : props.goldDiff < 0 ? 'enemy' : 'muted'))
const wp = computed(() => Math.round(props.winProb * 100))
const uid = `lead${useId()}`
</script>

<template>
  <div class="ov-panel lead">
    <div class="lead-top">
      <span class="lead-diff" :class="side">
        <svg v-if="goldDiff" viewBox="0 0 10 10" aria-hidden="true">
          <path :d="goldDiff > 0 ? 'M5 1 9.5 8h-9z' : 'M5 9 .5 2h9z'" />
        </svg>
        {{ compactGold(goldDiff) }}
      </span>
      <span class="lead-win" :class="wp >= 50 ? 'ally' : 'enemy'">{{ wp }}%<small>win</small></span>
    </div>
    <div class="lead-bar"><i :style="{ transform: `scaleX(${winProb})` }" /></div>
    <svg
      class="spark"
      :width="W"
      :height="H"
      :viewBox="`0 0 ${W} ${H}`"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <template v-if="geo">
        <clipPath :id="`${uid}r`"><rect :width="W * (drawn ?? 1)" :height="H" /></clipPath>
        <clipPath :id="`${uid}a`"><rect :width="W" :height="geo.base" /></clipPath>
        <clipPath :id="`${uid}b`">
          <rect :y="geo.base" :width="W" :height="H - geo.base" />
        </clipPath>
        <g :clip-path="`url(#${uid}r)`">
          <path :d="geo.area" class="area ally" :clip-path="`url(#${uid}a)`" />
          <path :d="geo.area" class="area enemy" :clip-path="`url(#${uid}b)`" />
          <path :d="geo.line" class="line" />
        </g>
        <line x1="0" :x2="W" :y1="geo.base" :y2="geo.base" class="baseline" />
        <path v-if="(drawn ?? 1) >= 1" :d="`M${geo.end.x} ${geo.end.y.toFixed(1)}h0`" class="dot" />
      </template>
    </svg>
    <div class="lead-kills">
      <Swords :size="11" :stroke-width="1.8" />
      <b class="ally">{{ kills.ally }}</b
      >–<b class="enemy">{{ kills.enemy }}</b>
    </div>
  </div>
</template>
