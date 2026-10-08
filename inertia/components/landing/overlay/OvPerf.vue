<script setup lang="ts">
import type { PerfInput } from './types.js'
import { computed } from 'vue'
import Glyph from '../../ui/Glyph.vue'

/**
 * Performance, as the overlay draws it: one line per metric with the value, the target in small
 * type, and how it moved (a trend) or where it stands (an arrow, for the lane opponent rows).
 */
const props = defineProps<{
  me: PerfInput
  /** The target rank's pace (the overlay's benchmark). */
  bm: { csm: number; gpm: number; kp: number; kda: number }
  rank: string
  /** Series for the trend lines, oldest first. */
  history: { csm: number[]; gpm: number[]; kp: number[]; kda: number[] }
  /** 0–1: how much of each trend line is drawn (the lines draw in when the widget appears). */
  drawn?: number
}>()

type State = 'ahead' | 'behind' | 'even' | 'none'

function state(value: number, target: number, exact = false): State {
  if (exact) return value > target ? 'ahead' : value < target ? 'behind' : 'even'
  const ratio = target > 0 ? value / target : 2
  return ratio >= 1.03 ? 'ahead' : ratio <= 0.97 ? 'behind' : 'even'
}

/** The last minutes of a series as a 36×14 path, as the overlay draws it. */
function trend(series: number[], span: number) {
  const v = series.slice(-20)
  if (v.length < 2) return null
  let lo = Math.min(...v)
  let hi = Math.max(...v)
  if (hi - lo < span) {
    const grow = (span - (hi - lo)) / 2
    lo -= grow
    hi += grow
  }
  const x = (i: number) => 1 + (i * 34) / (v.length - 1)
  const y = (n: number) => 2 + 10 - ((n - lo) / (hi - lo)) * 10
  return {
    path: v.map((n, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(n).toFixed(1)}`).join(''),
    end: { x: x(v.length - 1), y: y(v[v.length - 1]) },
  }
}

const rows = computed(() => {
  const { me, bm, history } = props
  const kda = me.kda
  return [
    {
      id: 'csm',
      label: 'CSM',
      value: me.csm.toFixed(1),
      target: bm.csm.toFixed(1),
      state: state(me.csm, bm.csm),
      tr: trend(history.csm, 0.8),
    },
    {
      id: 'cs',
      label: 'CS',
      value: String(me.cs),
      target: String(me.vs.cs),
      state: state(me.cs, me.vs.cs, true),
      tr: null,
    },
    {
      id: 'gpm',
      label: 'GPM',
      value: String(Math.round(me.gpm)),
      target: String(Math.round(bm.gpm)),
      state: state(me.gpm, bm.gpm),
      tr: trend(history.gpm, 40),
    },
    {
      id: 'kp',
      label: 'KP%',
      value: String(Math.round(me.kp * 100)),
      target: String(Math.round(bm.kp * 100)),
      state: state(me.kp, bm.kp),
      tr: trend(history.kp, 0.1),
    },
    {
      id: 'kda',
      label: 'KDA',
      value: kda.toFixed(1),
      target: bm.kda.toFixed(1),
      state: state(kda, bm.kda),
      tr: trend(history.kda, 0.6),
    },
    {
      id: 'level',
      label: 'LVL',
      value: String(me.level),
      target: String(me.vs.level),
      state: state(me.level, me.vs.level, true),
      tr: null,
    },
  ]
})
</script>

<template>
  <div class="ov-panel perf">
    <div class="perf-head">
      <Glyph :size="12" />
      <span class="perf-word">INVADE</span>
      <span class="perf-target">vs {{ rank }}</span>
    </div>
    <div class="perf-rows">
      <div v-for="r in rows" :key="r.id" class="perf-row">
        <span class="perf-label">{{ r.label }}</span>
        <span class="perf-val" :class="r.state"
          >{{ r.value }}<small>/{{ r.target }}</small></span
        >
        <span class="perf-ind" :class="r.state" aria-hidden="true">
          <svg v-if="r.tr" viewBox="0 0 36 14" width="36" height="14">
            <path
              :d="r.tr.path"
              class="line"
              pathLength="1"
              :style="{ strokeDasharray: 1, strokeDashoffset: 1 - (drawn ?? 1) }"
            />
            <circle
              :cx="r.tr.end.x"
              :cy="r.tr.end.y"
              r="1.6"
              class="end"
              :style="{ opacity: (drawn ?? 1) >= 1 ? 1 : 0 }"
            />
          </svg>
          <svg
            v-else-if="r.state === 'ahead' || r.state === 'behind'"
            viewBox="0 0 10 10"
            width="10"
            height="10"
          >
            <path class="arrow" :d="r.state === 'ahead' ? 'M5 1.5 9 7.5H1z' : 'M5 8.5 1 2.5h8z'" />
          </svg>
          <i v-else-if="r.state === 'even'" class="even" />
        </span>
      </div>
    </div>
  </div>
</template>
