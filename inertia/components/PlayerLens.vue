<script setup lang="ts">
import { computed, ref } from 'vue'
import { Award, Sparkles } from 'lucide-vue-next'
import { championName, championSplash, champIcon } from '../lib/assets.js'
import { compact, timeAgo } from '../lib/format.js'
import PerformanceBand from './PerformanceBand.vue'
import type { ChampionMastery, GlobalStats, Match } from '../lib/types.js'
const props = defineProps<{
  mastery: ChampionMastery[]
  loading: boolean
  error: boolean
  stats: GlobalStats | null
  matches: Match[]
  puuid: string
}>()
defineEmits<{ retry: [] }>()
const query = ref('')
const expanded = ref(false)
const total = computed(() => props.mastery.reduce((n, c) => n + c.championPoints, 0))
const score = computed(() => props.mastery.reduce((n, c) => n + c.championLevel, 0))
const visible = computed(() =>
  props.mastery
    .filter((c) => championName(c.championId).toLowerCase().includes(query.value.toLowerCase()))
    .slice(0, expanded.value ? undefined : 12)
)
</script>
<template>
  <section class="space-y-5">
    <div class="section-intro">
      <div>
        <span class="eyebrow">A CLOSER LOOK AT YOUR GAME</span>
        <h2>Player Lens <Sparkles :size="21" /></h2>
        <p>The champions you know best. The numbers that tell your story.</p>
      </div>
    </div>
    <div v-if="loading" class="skel h-80" role="status" aria-label="Loading mastery" />
    <div v-else-if="error" class="card empty-panel">
      <Award :size="30" />
      <h3>Mastery is temporarily unavailable</h3>
      <p>
        Riot couldn’t return this player’s mastery. Your performance data is still available below.
      </p>
      <button class="btn" @click="$emit('retry')">Try again</button>
    </div>
    <template v-else-if="mastery.length"
      ><div class="lens-layout">
        <div class="mastery-mosaic">
          <div
            v-for="(c, i) in mastery.slice(0, 5)"
            :key="c.championId"
            :class="`mosaic-tile mosaic-${i}`"
          >
            <img :src="championSplash(c.championId)" :alt="championName(c.championId)" />
            <div>
              <strong>{{ championName(c.championId) }}</strong
              ><span>{{ compact(c.championPoints) }} pts</span>
            </div>
          </div>
        </div>
        <div class="card mastery-summary">
          <Award :size="28" /><span class="eyebrow">TIME WELL SPENT</span>
          <h3>A champion pool<br />of your own.</h3>
          <div class="mastery-totals">
            <div>
              <strong>{{ score }}</strong
              ><span>Total mastery level</span>
            </div>
            <div>
              <strong>{{ compact(total) }}</strong
              ><span>Champion points</span>
            </div>
            <div>
              <strong>{{ mastery.length }}</strong
              ><span>Champions mastered</span>
            </div>
          </div>
        </div>
      </div>
      <div class="section-intro">
        <div>
          <h3>Mastery collection</h3>
          <p>Lifetime champion mastery, straight from Riot.</p>
        </div>
        <input
          v-model="query"
          class="field"
          aria-label="Search mastery"
          placeholder="Find a champion…"
        />
      </div>
      <div class="mastery-grid">
        <article v-for="c in visible" :key="c.championId" class="card mastery-card">
          <img :src="champIcon(c.championId)" :alt="championName(c.championId)" />
          <div>
            <h4>{{ championName(c.championId) }}</h4>
            <span>{{ c.championPoints.toLocaleString() }} points</span
            ><small>Last played {{ timeAgo(c.lastPlayTime) }}</small>
          </div>
          <span class="mastery-level"><Award :size="15" />{{ c.championLevel }}</span>
        </article>
      </div>
      <p v-if="!visible.length" class="empty-panel">No champions match your search.</p>
      <button v-if="!expanded && mastery.length > 12" class="btn" @click="expanded = true">
        Show all {{ mastery.length }} champions
      </button></template
    >
    <div v-else class="card empty-panel">No champion mastery recorded yet.</div>
    <PerformanceBand :stats="stats" :matches="matches" :puuid="puuid" />
  </section>
</template>
