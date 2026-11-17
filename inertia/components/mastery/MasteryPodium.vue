<script setup lang="ts">
import { computed } from 'vue'
import { championName } from '../../lib/assets.js'
import { compact, timeAgo } from '../../lib/format.js'
import type { ChampionMastery } from '../../lib/types.js'
import MasteryCrest from './MasteryCrest.vue'

/**
 * The three champions with the most points as a podium: tall loading-screen art with the level and
 * the points, standing on steps of 2, 1, 3 (the first in the middle, on the tallest, lit violet).
 */
const props = defineProps<{ top: ChampionMastery[] }>()

const STEP = [92, 64, 44]
const places = computed(() => {
  const list = props.top.slice(0, 3).map((entry, index) => ({ entry, place: index + 1 }))
  return list.length === 3 ? [list[1], list[0], list[2]] : list
})

/** How far into the current level, when Riot said both the points earned and the points left. */
function progress(entry: ChampionMastery) {
  const since = entry.championPointsSinceLastLevel
  const left = entry.championPointsUntilNextLevel
  if (since === undefined || left === undefined || since + left <= 0) return null
  return Math.round((since / (since + left)) * 100)
}
const title = (entry: ChampionMastery) =>
  entry.championPointsUntilNextLevel
    ? `${entry.championPointsUntilNextLevel.toLocaleString('en-US')} points to level ${entry.championLevel + 1}`
    : undefined
</script>

<template>
  <ol class="pod" :class="`n${places.length}`" aria-label="Most mastery">
    <li
      v-for="{ entry, place } in places"
      :key="entry.championId"
      class="pod-c"
      :class="{ first: place === 1 }"
    >
      <div class="pod-a" :title="title(entry)">
        <img
          :src="`/cdn/loading/${entry.championId}.jpg`"
          :alt="`${championName(entry.championId)} art`"
          loading="eager"
        />
        <span class="lvl num"
          ><MasteryCrest :level="entry.championLevel" :size="18" :titled="false" />Level
          {{ entry.championLevel }}</span
        >
        <div class="nm">
          <b>{{ championName(entry.championId) }}</b>
          <span class="num">{{ compact(entry.championPoints) }} points</span>
          <span class="pod-when">{{ timeAgo(entry.lastPlayTime) }}</span>
        </div>
        <span v-if="progress(entry) !== null" class="pod-pr" aria-hidden="true"
          ><i :style="{ width: `${progress(entry)}%` }"
        /></span>
      </div>
      <div class="pod-s" :style="{ '--ph': `${STEP[place - 1]}px` }">
        <b class="num">{{ place }}</b>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.pod {
  display: grid;
  grid-template-columns: 1fr 1.12fr 1fr;
  gap: 18px;
  align-items: end;
  margin: 0;
  padding: 26px 40px 0;
  list-style: none;
}
.pod.n1 {
  grid-template-columns: minmax(0, 300px);
  justify-content: center;
}
.pod.n2 {
  grid-template-columns: 1fr 1.12fr;
}
.pod-c {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}
.pod-a {
  position: relative;
  width: 100%;
  aspect-ratio: 308 / 400;
  border-radius: 14px;
  overflow: hidden;
  background: var(--s3);
  box-shadow:
    0 0 0 1px var(--line-2),
    0 18px 40px -18px rgb(0 0 0 / 0.7);
}
.pod-c:not(.first) .pod-a {
  width: 92%;
}
.pod-a img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 18%;
}
.pod-a::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgb(11 10 17 / 0) 50%, rgb(11 10 17 / 0.92));
}
.lvl {
  position: absolute;
  left: 12px;
  top: 12px;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 9px 0 5px;
  border-radius: 7px;
  background: rgb(11 10 17 / 0.72);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.12);
  font-size: 12px;
  font-weight: 750;
  color: #e4e0ff;
}
.nm {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 18px;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 8px;
  color: #f3f1fb;
}
.nm b {
  flex: 1 0 100%;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.015em;
  text-shadow: 0 1px 6px rgb(0 0 0 / 0.5);
}
.nm span {
  font-size: 13px;
  font-weight: 600;
  color: #bebad3;
}
.pod-when {
  color: #938eae !important;
}
.pod-pr {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 9px;
  z-index: 1;
  height: 3px;
  border-radius: 2px;
  background: rgb(255 255 255 / 0.14);
  overflow: hidden;
}
.pod-pr i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--v400), var(--v300));
}
.pod-s {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: var(--ph);
  margin-top: 12px;
  border-radius: 10px 10px 0 0;
  background: linear-gradient(180deg, var(--s3), var(--s1));
  box-shadow: inset 0 1px 0 var(--line-3);
}
.pod-c:not(.first) .pod-s {
  width: 92%;
}
.pod-s b {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--t2);
}
.pod-c.first .pod-s {
  background: linear-gradient(180deg, rgb(var(--v-rgb) / 0.3), rgb(var(--v-rgb) / 0.06));
  box-shadow: inset 0 1px 0 rgb(var(--v-rgb) / 0.6);
}
.pod-c.first .pod-s b {
  color: var(--t1);
}
@media (max-width: 767px) {
  .pod {
    gap: 8px;
    padding: 18px 12px 0;
  }
  .nm {
    left: 8px;
    right: 8px;
    bottom: 12px;
  }
  .nm b {
    font-size: 14px;
  }
  .nm span {
    font-size: 11px;
  }
  .pod-when {
    display: none;
  }
  .pod-pr {
    left: 8px;
    right: 8px;
    bottom: 6px;
  }
  .lvl {
    left: 6px;
    top: 6px;
    height: 22px;
    padding: 0 6px 0 3px;
    font-size: 10.5px;
  }
  .pod-s b {
    font-size: 20px;
  }
}
</style>
