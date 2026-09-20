<script setup lang="ts">
import { computed } from 'vue'
import { TrendingUp, Crosshair, Swords, Flame } from 'lucide-vue-next'
import type { GlobalStats, Match } from '../lib/types.js'
const props = defineProps<{ stats: GlobalStats | null; matches: Match[]; puuid: string }>()
const cells = computed(() => [
  {
    name: 'Win rate',
    value: props.stats ? `${Math.round(props.stats.winrate * 100)}%` : '—',
    detail: 'Across recent games',
    icon: TrendingUp,
  },
  {
    name: 'KDA ratio',
    value: props.stats?.kda.toFixed(2) ?? '—',
    detail: 'Kills + assists / deaths',
    icon: Swords,
  },
  {
    name: 'CS per minute',
    value: props.stats?.csMin.toFixed(1) ?? '—',
    detail: 'Farming efficiency',
    icon: Crosshair,
  },
  {
    name: 'Damage / min',
    value: props.stats ? Math.round(props.stats.damagePerMinute).toLocaleString() : '—',
    detail: 'Damage to champions',
    icon: Flame,
  },
])
const form = computed(() =>
  props.matches
    .slice(0, 12)
    .map((m) => m.participants.find((p) => p.puuid === props.puuid))
    .filter(Boolean)
    .reverse()
)
</script>
<template>
  <section class="card stat-band">
    <div class="stat-band-heading">
      <div>
        <span class="eyebrow">THE BIG PICTURE</span>
        <h2>Performance at a glance</h2>
      </div>
      <span class="subtle">{{ stats?.total ?? 0 }} recent games</span>
    </div>
    <div class="stat-band-grid">
      <div v-for="cell in cells" :key="cell.name" class="hero-stat">
        <div class="hero-stat-label"><component :is="cell.icon" :size="14" />{{ cell.name }}</div>
        <strong class="num">{{ cell.value }}</strong
        ><span>{{ cell.detail }}</span>
      </div>
    </div>
    <div v-if="form.length" class="recent-form">
      <span>Recent form</span>
      <div>
        <span
          v-for="(p, i) in form"
          :key="i"
          :class="p?.win ? 'form-win' : 'form-loss'"
          :title="p?.win ? 'Victory' : 'Defeat'"
          >{{ p?.win ? 'W' : 'L' }}</span
        >
      </div>
      <span class="ml-auto"
        >{{ form.filter((p) => p?.win).length }}W · {{ form.filter((p) => !p?.win).length }}L</span
      >
    </div>
  </section>
</template>
