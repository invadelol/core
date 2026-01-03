<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  puuid: string
}>()

interface Rank {
  queueType: string
  tier: string
  rank: string
  leaguePoints: number
  wins: number
  losses: number
}

interface RanksData {
  current: Rank[]
  history: Rank[]
}

const ranks = ref<RanksData | null>(null)
const isLoading = ref(true)

// Rank tier to display name
const tierNames: Record<string, string> = {
  IRON: 'Iron',
  BRONZE: 'Bronze',
  SILVER: 'Silver',
  GOLD: 'Gold',
  PLATINUM: 'Platinum',
  EMERALD: 'Emerald',
  DIAMOND: 'Diamond',
  MASTER: 'Master',
  GRANDMASTER: 'Grandmaster',
  CHALLENGER: 'Challenger',
}

// Queue type to display name
const queueNames: Record<string, string> = {
  RANKED_SOLO_5x5: 'Solo/Duo',
  RANKED_FLEX_SR: 'Flex',
}

onMounted(async () => {
  try {
    const res = await fetch(`/summoners/puuid/${props.puuid}/ranks`)
    if (res.ok) {
      ranks.value = await res.json()
    }
  } catch (e) {
    console.error('Failed to load ranks:', e)
  } finally {
    isLoading.value = false
  }
})

function getRankIcon(tier: string) {
  // Use Community Dragon for rank emblems
  const tierLower = tier.toLowerCase()
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/${tierLower}.svg`
}

function getWinrate(wins: number, losses: number) {
  const total = wins + losses
  if (total === 0) return 0
  return Math.round((wins / total) * 100)
}
</script>

<template>
  <div class="bg-white rounded-lg shadow p-4">
    <h2 class="text-lg font-semibold mb-4">Ranked</h2>
    
    <div v-if="isLoading" class="text-center py-4 text-gray-500">
      Loading...
    </div>
    
    <div v-else-if="!ranks || ranks.current.length === 0" class="text-center py-4 text-gray-500">
      Unranked
    </div>
    
    <div v-else class="space-y-3">
      <div
        v-for="rank in ranks.current"
        :key="rank.queueType"
        class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
      >
        <img
          :src="getRankIcon(rank.tier)"
          :alt="rank.tier"
          class="w-12 h-12"
        />
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-gray-800">
            {{ tierNames[rank.tier] || rank.tier }} {{ rank.rank }}
          </div>
          <div class="text-sm text-gray-500">
            {{ queueNames[rank.queueType] || rank.queueType }}
          </div>
        </div>
        <div class="text-right">
          <div class="font-bold text-gray-800">{{ rank.leaguePoints }} LP</div>
          <div class="text-sm text-gray-500">
            {{ rank.wins }}W {{ rank.losses }}L
            <span :class="getWinrate(rank.wins, rank.losses) >= 50 ? 'text-green-600' : 'text-red-500'">
              ({{ getWinrate(rank.wins, rank.losses) }}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
