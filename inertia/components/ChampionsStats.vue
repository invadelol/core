<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  puuid: string
}>()

interface ChampionStats {
  championId: number
  games: number
  wins: number
  winrate: number
  kda: number
  avgKills: number
  avgDeaths: number
  avgAssists: number
  csMin: number
  goldMin: number
  damageMin: number
}

const champions = ref<ChampionStats[]>([])
const isLoading = ref(true)

onMounted(async () => {
  try {
    const res = await fetch(`/summoners/puuid/${props.puuid}/champions?count=100`)
    if (res.ok) {
      champions.value = await res.json()
    }
  } catch (e) {
    console.error('Failed to load champion stats:', e)
  } finally {
    isLoading.value = false
  }
})

function formatPercent(n: number) {
  return Math.round(n * 100) + '%'
}
</script>

<template>
  <div class="bg-white rounded-lg shadow p-4">
    <h2 class="text-lg font-semibold mb-4">Champions</h2>
    
    <div v-if="isLoading" class="text-center py-8 text-gray-500">
      Loading...
    </div>
    
    <div v-else-if="champions.length === 0" class="text-center py-8 text-gray-500">
      No data
    </div>
    
    <div v-else class="space-y-2">
      <div
        v-for="champ in champions.slice(0, 8)"
        :key="champ.championId"
        class="flex items-center gap-3 p-2 rounded hover:bg-gray-50 transition-colors"
      >
        <img
          :src="`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${champ.championId}.png`"
          class="w-10 h-10 rounded"
          :alt="`Champion ${champ.championId}`"
        />
        
        <div class="flex-1 min-w-0">
          <div class="text-sm text-gray-500">{{ champ.games }} games</div>
        </div>
        
        <!-- Winrate -->
        <div class="text-center w-16">
          <div
            :class="[
              'font-bold text-sm',
              champ.winrate >= 0.6 ? 'text-green-600' : champ.winrate >= 0.5 ? 'text-blue-600' : 'text-red-500'
            ]"
          >
            {{ formatPercent(champ.winrate) }}
          </div>
          <div class="text-xs text-gray-400">WR</div>
        </div>
        
        <!-- KDA -->
        <div class="text-center w-16">
          <div
            :class="[
              'font-bold text-sm',
              champ.kda >= 4 ? 'text-green-600' : champ.kda >= 3 ? 'text-blue-600' : champ.kda >= 2 ? 'text-gray-700' : 'text-red-500'
            ]"
          >
            {{ champ.kda.toFixed(2) }}
          </div>
          <div class="text-xs text-gray-400">KDA</div>
        </div>
      </div>
    </div>
  </div>
</template>
