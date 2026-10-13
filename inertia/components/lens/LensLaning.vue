<script setup lang="ts">
import { computed, ref } from 'vue'
import LensStory from './LensStory.vue'
import LensRace from './LensRace.vue'
import { champIcon, championName } from '../../lib/assets.js'
import type { LensDomain, LensDuel, LensGame } from '../../lib/lens.js'

/** Laning as a duel: your champion against the ones you met, and the first fifteen minutes. */
const props = defineProps<{
  domain: LensDomain
  duel: LensDuel | null
  games: LensGame[]
  champion: number | null
  timelineGames: number
  labels: string[]
}>()

const metric = ref<'cs' | 'gold'>('cs')

/** The champions met most in lane, most first. */
const opponents = computed(() => {
  const counts = new Map<number, number>()
  for (const g of props.games)
    if (g.timeline && g.opponentChampionId)
      counts.set(g.opponentChampionId, (counts.get(g.opponentChampionId) ?? 0) + 1)
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id)
})

const gap = (key: string) => {
  const f = props.domain.figures.find((x) => x.key === key)
  const opp = f?.refs.find((r) => r.label === 'Opponents')
  return f?.value !== null && f?.value !== undefined && opp ? f.value - opp.value : null
}
const big = computed(() => {
  const cs = gap('cs10')
  const gold = gap('gold15')
  const sign = (v: number) => (v >= 0 ? '+' : '−')
  return {
    cs: cs === null ? null : `${sign(cs)}${Math.abs(Math.round(cs))}`,
    gold:
      gold === null ? null : `${sign(gold)}${Math.abs(Math.round(gold)).toLocaleString('en-US')}`,
  }
})
</script>

<template>
  <LensStory
    :domain="domain"
    wide
    :meta="timelineGames < games.length ? `${timelineGames} of ${games.length} games` : ''"
    :labels="labels"
    :shown="['cs10', 'gold15']"
  >
    <template #figure>
      <div class="lv-faceoff">
        <img
          v-if="champion"
          class="lv-face you"
          :src="champIcon(champion)"
          :alt="championName(champion)"
          :title="championName(champion)"
        />
        <span class="lv-vs">vs</span>
        <span class="lv-faces">
          <img
            v-for="id in opponents"
            :key="id"
            class="lv-face"
            :src="champIcon(id)"
            :alt="championName(id)"
            :title="championName(id)"
            loading="lazy"
          />
        </span>
      </div>
      <div class="lv-big">
        <div v-if="big.cs">
          <span class="iv-fig">{{ big.cs }}</span>
          <span class="lv-big-unit">CS at 10</span>
        </div>
        <div v-if="big.gold">
          <span class="iv-fig">{{ big.gold }}</span>
          <span class="lv-big-unit">gold at 15</span>
        </div>
      </div>
    </template>

    <template #visual>
      <div v-if="duel" class="lv-duel">
        <div class="lv-duel-head">
          <span>First fifteen minutes, {{ duel.games }} games</span>
          <div class="iv-seg lv-duel-seg" role="group" aria-label="Race">
            <button type="button" :class="{ on: metric === 'cs' }" @click="metric = 'cs'">
              CS
            </button>
            <button type="button" :class="{ on: metric === 'gold' }" @click="metric = 'gold'">
              Gold
            </button>
          </div>
        </div>
        <LensRace
          :key="metric"
          :you="duel[metric].you"
          :opponent="duel[metric].opponent"
          :at="metric === 'cs' ? 10 : 15"
          :unit="metric === 'cs' ? 'CS' : 'gold'"
        />
      </div>
    </template>
  </LensStory>
</template>

<style scoped>
.lv-faceoff {
  display: flex;
  align-items: center;
  gap: 12px;
}

.lv-face {
  width: 40px;
  height: 40px;
  border-radius: var(--r-sm);
  box-shadow: var(--portrait-sm);
  object-fit: cover;
}

.lv-face.you {
  width: 56px;
  height: 56px;
  box-shadow: var(--portrait);
  outline: 1.5px solid rgb(var(--brand-rgb) / 0.6);
  outline-offset: 2px;
}

.lv-vs {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}

.lv-faces {
  display: flex;
}

.lv-faces .lv-face + .lv-face {
  margin-left: -10px;
}

.lv-big {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 28px;
  margin-top: 20px;
}

.lv-big > div {
  display: grid;
  gap: 4px;
}

.lv-big .iv-fig {
  font-size: 40px;
  line-height: 1;
}

.lv-big-unit {
  font-size: 12px;
  color: var(--text-3);
}

.lv-duel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  font-size: 12px;
  color: var(--text-3);
}

.lv-duel-seg button {
  min-width: 52px;
}
</style>
