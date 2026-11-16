<script setup lang="ts">
import { computed } from 'vue'
import { championName, championSplash } from '../../lib/assets.js'
import { compact, timeAgo } from '../../lib/format.js'
import type { ChampionMastery } from '../../lib/types.js'
import Frame from '../ui/Frame.vue'
import MasteryCrest from './MasteryCrest.vue'

/**
 * The three champions with the most points, as art cards in a row, most points first. Each says its
 * level, points and how far the next level is.
 */
const props = defineProps<{ top: ChampionMastery[] }>()

const PLACE = ['1st', '2nd', '3rd']
const places = computed(() =>
  props.top.slice(0, 3).map((entry, index) => ({ entry, place: index + 1 }))
)

/** How far into the current level, when Riot said both the points earned and the points left. */
function progress(entry: ChampionMastery) {
  const since = entry.championPointsSinceLastLevel
  const left = entry.championPointsUntilNextLevel
  if (since === undefined || left === undefined || since + left <= 0) return null
  return `${Math.round((since / (since + left)) * 100)}%`
}
</script>

<template>
  <ol class="grid3 ms-top" aria-label="Most mastery">
    <li
      v-for="{ entry, place } in places"
      :key="entry.championId"
      class="ms-pc"
      :class="{ first: place === 1 }"
    >
      <Frame
        :src="championSplash(entry.championId)"
        :alt="`${championName(entry.championId)} splash art`"
        width="100%"
        :height="180"
        position="50% 22%"
        eager
      />
      <div class="row ms-pc-h">
        <span class="col" style="gap: 2px; min-width: 0">
          <span class="lab">{{ PLACE[place - 1] }}</span>
          <b class="h3 ell">{{ championName(entry.championId) }}</b>
        </span>
        <span class="ms-pc-lv">
          <MasteryCrest :level="entry.championLevel" :size="40" />
          <span class="meta num">Level {{ entry.championLevel }}</span>
        </span>
      </div>
      <div class="row ms-pc-pts">
        <span class="fg-m">{{ compact(entry.championPoints) }}</span>
        <span class="meta">points</span>
      </div>
      <template v-if="entry.championPointsUntilNextLevel">
        <span v-if="progress(entry)" class="bar"
          ><i :style="{ width: progress(entry) ?? undefined }"
        /></span>
        <small class="meta num"
          >{{ entry.championPointsUntilNextLevel.toLocaleString('en-US') }} to level
          {{ entry.championLevel + 1 }}, last played {{ timeAgo(entry.lastPlayTime) }}</small
        >
      </template>
      <small v-else class="meta num">Last played {{ timeAgo(entry.lastPlayTime) }}</small>
    </li>
  </ol>
</template>

<style scoped>
.ms-top {
  margin: 0;
  padding: 0;
  list-style: none;
}
.ms-pc {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 8px 8px 18px;
  border-radius: var(--r3);
  background: var(--s1);
  box-shadow: inset 0 0 0 1px var(--line);
}
.ms-pc.first {
  background: var(--v950);
  box-shadow: inset 0 0 0 1px rgb(var(--v-rgb) / 0.4);
}
.ms-pc > :not(.fr) {
  margin: 0 8px;
}
.ms-pc-h {
  justify-content: space-between;
  gap: 12px;
  margin-top: 4px !important;
}
.ms-pc-lv {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex: none;
}
.ms-pc-pts {
  align-items: baseline;
  gap: 8px;
}
@media (max-width: 860px) {
  .ms-top {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .ms-pc > .fr {
    height: 132px !important;
  }
}
</style>
