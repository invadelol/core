<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Card from './ui/Card.vue'
import EmptyState from './ui/EmptyState.vue'
import Segmented from './ui/Segmented.vue'
import Meter from './ui/Meter.vue'
import { champIcon, championName, loadChampions } from '../lib/ddragon.js'
import { compact } from '../lib/format.js'
import type { ChampionStats } from '../lib/types.js'

const props = defineProps<{ champions: ChampionStats[] }>()

onMounted(loadChampions)

type SortKey = 'games' | 'winrate' | 'kda'

const sort = ref<SortKey>('games')
const expanded = ref(false)

const sortOptions = [
  { value: 'games' as const, label: 'Played' },
  { value: 'winrate' as const, label: 'Win rate' },
  { value: 'kda' as const, label: 'KDA' },
]

const maxGames = computed(() => Math.max(...props.champions.map((c) => c.games), 1))

const sorted = computed(() => {
  const list = [...props.champions]
  // A 100% win rate off one game shouldn't outrank a real sample.
  if (sort.value === 'winrate') {
    list.sort((a, b) => b.winrate - a.winrate || b.games - a.games)
  } else if (sort.value === 'kda') {
    list.sort((a, b) => b.kda - a.kda || b.games - a.games)
  } else {
    list.sort((a, b) => b.games - a.games)
  }
  return list
})

const visible = computed(() => (expanded.value ? sorted.value : sorted.value.slice(0, 7)))

function tone(winrate: number) {
  if (winrate >= 0.55) return 'text-pos'
  if (winrate < 0.45) return 'text-neg'
  return 'text-ink'
}
</script>

<template>
  <Card title="Champions" :note="champions.length ? `${champions.length} played` : undefined" flush>
    <template #actions>
      <Segmented v-model="sort" :options="sortOptions" />
    </template>

    <EmptyState v-if="!champions.length" message="No champion data yet" />

    <div v-else>
      <ul class="divide-y divide-line">
        <li
          v-for="champ in visible"
          :key="champ.championId"
          class="flex items-center gap-3 px-4 py-2.5"
        >
          <img
            :src="champIcon(champ.championId)"
            :alt="championName(champ.championId)"
            class="thumb h-8 w-8 shrink-0 rounded-md"
          />

          <div class="min-w-0 flex-1">
            <div class="truncate text-[0.8125rem] font-medium text-ink">
              {{ championName(champ.championId) }}
            </div>
            <div class="mt-1 flex items-center gap-2">
              <Meter class="w-16" :value="(champ.games / maxGames) * 100" tone="muted" />
              <span class="num text-[0.6875rem] text-ink-3">{{ champ.games }}g</span>
            </div>
          </div>

          <div class="w-14 text-right">
            <div class="num text-[0.8125rem] font-semibold" :class="tone(champ.winrate)">
              {{ Math.round(champ.winrate * 100) }}%
            </div>
            <div class="num text-[0.625rem] text-ink-3">
              {{ champ.wins }}W {{ champ.games - champ.wins }}L
            </div>
          </div>

          <div class="w-[4.5rem] text-right">
            <div class="num text-[0.8125rem] font-semibold text-ink">
              {{ champ.kda.toFixed(2) }}
            </div>
            <div class="num text-[0.625rem] text-ink-3">
              {{ champ.avgKills.toFixed(1) }}/{{ champ.avgDeaths.toFixed(1) }}/{{
                champ.avgAssists.toFixed(1)
              }}
            </div>
          </div>

          <div class="hidden w-16 text-right sm:block">
            <div class="num text-[0.8125rem] text-ink-2">{{ champ.csMin.toFixed(1) }}</div>
            <div class="num text-[0.625rem] text-ink-3">cs/m</div>
          </div>

          <div class="hidden w-16 text-right sm:block">
            <div class="num text-[0.8125rem] text-ink-2">{{ compact(champ.damageMin) }}</div>
            <div class="num text-[0.625rem] text-ink-3">dmg/m</div>
          </div>
        </li>
      </ul>

      <button
        v-if="sorted.length > 7"
        class="w-full border-t border-line py-2.5 text-[0.75rem] text-ink-2 transition-colors hover:bg-[#fafafb] hover:text-ink"
        @click="expanded = !expanded"
      >
        {{ expanded ? 'Show less' : `Show all ${sorted.length} champions` }}
      </button>
    </div>
  </Card>
</template>
