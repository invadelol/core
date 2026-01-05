<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  puuid: string
}>()

interface Stats {
  global: {
    csMin: number
    visionMin: number
    goldPerMinute: number
    damagePerMinute: number
    kda: number
    killParticipation: number
    damageShare: number
    goldShare: number
    winrate: number
    total: number
  }
  champions: Array<{
    championId: number
    games: number
    winrate: number
    kda: number
  }>
}

const stats = ref<Stats | null>(null)
const isLoading = ref(true)

onMounted(async () => {
  try {
    const res = await fetch(`/api/summoners/puuid/${props.puuid}/stats?count=100`)
    if (res.ok) {
      stats.value = await res.json()
    }
  } catch (e) {
    console.error('Failed to load stats:', e)
  } finally {
    isLoading.value = false
  }
})

function formatNumber(n: number, decimals = 1) {
  return n.toFixed(decimals)
}

function formatPercent(n: number) {
  return (n * 100).toFixed(0) + '%'
}

const statItems = [
  { key: 'kda', label: 'KDA', format: (v: number) => formatNumber(v, 2) },
  { key: 'winrate', label: 'Win Rate', format: (v: number) => formatPercent(v) },
  { key: 'csMin', label: 'CS/min', format: (v: number) => formatNumber(v) },
  { key: 'visionMin', label: 'Vision/min', format: (v: number) => formatNumber(v, 2) },
  { key: 'goldPerMinute', label: 'Gold/min', format: (v: number) => formatNumber(v, 0) },
  { key: 'damagePerMinute', label: 'Damage/min', format: (v: number) => formatNumber(v, 0) },
  {
    key: 'killParticipation',
    label: 'Kill Participation',
    format: (v: number) => formatPercent(v),
  },
  { key: 'damageShare', label: 'Damage Share', format: (v: number) => formatPercent(v) },
  { key: 'goldShare', label: 'Gold Share', format: (v: number) => formatPercent(v) },
]
</script>

<template>
  <div class="bg-white rounded-lg shadow p-4">
    <h2 class="text-lg font-semibold mb-4">Statistics</h2>

    <div v-if="isLoading" class="text-center py-8 text-gray-500">Loading statistics...</div>

    <div v-else-if="!stats || stats.global.total === 0" class="text-center py-8 text-gray-500">
      No statistics available
    </div>

    <div v-else class="space-y-4">
      <div class="text-sm text-gray-500">Based on {{ stats.global.total }} games</div>

      <div class="grid grid-cols-3 gap-4">
        <div
          v-for="item in statItems"
          :key="item.key"
          class="text-center p-3 bg-gray-50 rounded-lg"
        >
          <div class="text-2xl font-bold text-gray-800">
            {{ item.format((stats.global as any)[item.key]) }}
          </div>
          <div class="text-sm text-gray-500">{{ item.label }}</div>
        </div>
      </div>

      <!-- Top Champions -->
      <div v-if="stats.champions.length > 0" class="mt-6">
        <h3 class="text-sm font-semibold text-gray-600 mb-2">Top Champions</h3>
        <div class="flex gap-4">
          <div
            v-for="champ in stats.champions.slice(0, 3)"
            :key="champ.championId"
            class="flex items-center gap-2"
          >
            <img
              :src="`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${champ.championId}.png`"
              class="w-8 h-8 rounded"
              :alt="`Champion ${champ.championId}`"
            />
            <div class="text-sm">
              <div :class="champ.winrate >= 0.5 ? 'text-green-600' : 'text-red-600'">
                {{ formatPercent(champ.winrate) }}
              </div>
              <div class="text-gray-500">{{ champ.games }}g</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
