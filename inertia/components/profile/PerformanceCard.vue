<script setup lang="ts">
import { computed } from 'vue'
import CardHead from '../ui/CardHead.vue'
import ScoreDial from '../ui/ScoreDial.vue'
import EmptyState from '../ui/EmptyState.vue'
import { isRemake, scoreLobby, SCORE_CATEGORIES } from '../../lib/match.js'
import type { Match } from '../../lib/types.js'

/**
 * Performance (`.pf-perf`): the average Invade score of the last games on the dial, its line over
 * them, and the average of each part of the score. About 41 is an average Emerald game.
 */
const props = defineProps<{ matches: Match[]; puuid: string }>()
const NAMES: Record<string, string> = {
  fighting: 'Fighting',
  damage: 'Damage',
  farming: 'Farming',
  vision: 'Vision',
  objectives: 'Objectives',
}
const rated = computed(() =>
  props.matches
    .filter((m) => !isRemake(m))
    .slice(0, 20)
    .map((m) => scoreLobby(m)[props.puuid])
    .filter(Boolean)
)
const average = computed(() =>
  rated.value.length
    ? Math.round(rated.value.reduce((s, r) => s + r.score, 0) / rated.value.length)
    : null
)
const parts = computed(() =>
  SCORE_CATEGORIES.map((c) => {
    const values = rated.value.map((r) => r.categories[c]).filter((v) => Number.isFinite(v))
    return {
      key: c,
      name: NAMES[c] ?? c,
      v: values.length ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : null,
    }
  }).filter((p) => p.v !== null)
)
const spark = computed(() => {
  const values = [...rated.value].reverse().map((r) => r.score)
  if (values.length < 2) return null
  const W = 200
  const H = 44
  const lo = Math.min(...values) - 5
  const hi = Math.max(...values) + 5
  const pts = values.map(
    (v, i) =>
      `${((i / (values.length - 1)) * W).toFixed(1)} ${(H - ((v - lo) / (hi - lo)) * H).toFixed(1)}`
  )
  const d = `M${pts.join(' L')}`
  return { W, H, d, area: `${d} L${W} ${H} L0 ${H}Z` }
})
</script>

<template>
  <article class="card">
    <CardHead title="Performance" icon="sliders" meta="Invade score" />
    <template v-if="average !== null">
      <div class="pf-perf">
        <ScoreDial :value="average" size="lg" />
        <div class="col grow" style="gap: 6px; min-width: 0">
          <span class="lab">Average score</span>
          <div v-if="spark" class="chart spark" style="height: 44px">
            <svg
              class="fade"
              :viewBox="`0 0 ${spark.W} ${spark.H}`"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path class="area" :d="spark.area" />
            </svg>
            <svg
              :viewBox="`0 0 ${spark.W} ${spark.H}`"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path class="ln" :d="spark.d" />
            </svg>
          </div>
          <div class="row meta" style="justify-content: space-between">
            <span>Last {{ rated.length }} games</span><span>Emerald average, 41</span>
          </div>
        </div>
      </div>
      <div class="col" style="gap: 12px; padding: 4px 20px 20px">
        <div v-for="p in parts" :key="p.key" class="pf-sub">
          <span>{{ p.name }}</span>
          <div class="bar"><i :style="{ width: `${p.v}%` }"></i></div>
          <span class="fg-xs">{{ p.v }}</span>
        </div>
      </div>
    </template>
    <EmptyState v-else compact icon="sliders" title="No scored game yet" />
  </article>
</template>
