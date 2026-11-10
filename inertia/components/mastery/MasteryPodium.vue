<script setup lang="ts">
import { computed } from 'vue'
import { championName, championSplash } from '../../lib/assets.js'
import { compact, timeAgo } from '../../lib/format.js'
import type { ChampionMastery } from '../../lib/types.js'

/**
 * The three champions with the most points, as a podium of splash cards: second on the left, first
 * in the middle and taller with a violet edge, third on the right. Each says its level, points and
 * how far the next level is.
 */
const props = defineProps<{ top: ChampionMastery[] }>()

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
  <ol class="pod" aria-label="Most mastery">
    <li
      v-for="{ entry, place } in places"
      :key="entry.championId"
      class="pc"
      :class="{ first: place === 1 }"
      :data-place="place"
    >
      <img
        class="bg"
        :src="championSplash(entry.championId)"
        :alt="`${championName(entry.championId)} splash art`"
        decoding="async"
      />
      <span class="pl num">#{{ place }}</span>
      <span class="rd-tag v lvl">Level {{ entry.championLevel }}</span>
      <b class="n">{{ championName(entry.championId) }}</b>
      <span class="pts"
        ><span class="rd-fig num">{{ compact(entry.championPoints) }}</span
        ><span>points</span></span
      >
      <template v-if="entry.championPointsUntilNextLevel">
        <span v-if="progress(entry)" class="rd-bar"
          ><i :style="{ width: progress(entry) ?? undefined }"
        /></span>
        <small class="num"
          >{{ entry.championPointsUntilNextLevel.toLocaleString('en-US') }} to level
          {{ entry.championLevel + 1 }}, last played {{ timeAgo(entry.lastPlayTime) }}</small
        >
      </template>
      <small v-else class="num">Last played {{ timeAgo(entry.lastPlayTime) }}</small>
    </li>
  </ol>
</template>

<style scoped>
.pod {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr) minmax(0, 1fr);
  gap: 12px;
  align-items: end;
  margin: 0;
  padding: 0;
  list-style: none;
}
.pc {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  height: 260px;
  padding: 16px 18px;
  overflow: hidden;
  border-radius: 10px;
  background: var(--ink-0);
  box-shadow: inset 0 0 0 1px var(--rd-line);
  grid-row: 1;
}
.pc[data-place='1'] {
  grid-column: 2;
}
.pc[data-place='2'] {
  grid-column: 1;
}
.pc[data-place='3'] {
  grid-column: 3;
}
.pc.first {
  height: 320px;
  box-shadow: inset 0 0 0 1px rgb(123 109 255 / 0.45);
}
.pc img.bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 22%;
}
.pc::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgb(9 9 16 / 0) 30%, rgb(9 9 16 / 0.96) 86%);
}
.pc > *:not(.bg) {
  position: relative;
  z-index: 1;
}
.pc .pl {
  position: absolute;
  top: 14px;
  left: 16px;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 6px rgb(0 0 0 / 0.8);
}
.pc .lvl {
  position: absolute;
  top: 12px;
  right: 14px;
}
.pc .n {
  font-size: 22px;
  font-weight: 650;
  color: #fff;
}
.pts {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.pts .rd-fig {
  font-size: 30px;
  color: #fff;
}
.pts span:last-child {
  font-size: 12px;
  color: rgb(255 255 255 / 0.72);
}
.pc .rd-bar {
  margin-top: 10px;
  background: rgb(255 255 255 / 0.14);
}
.pc small {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: rgb(255 255 255 / 0.72);
}
@media (max-width: 1000px) {
  .pod {
    grid-template-columns: minmax(0, 1fr);
  }
  .pc,
  .pc.first,
  .pc[data-place] {
    grid-column: 1;
    grid-row: auto;
    height: 220px;
  }
}
</style>
