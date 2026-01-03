<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  puuid: string
}>()

interface Friend {
  puuid: string
  gameName: string
  tagLine: string
  profileIconId: number
  level: number
  games: number
  wins: number
}

const friends = ref<Friend[]>([])
const isLoading = ref(true)

const DDRAGON_BASE = 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img'

onMounted(async () => {
  try {
    const res = await fetch(`/api/summoners/puuid/${props.puuid}/friends`)
    if (res.ok) {
      friends.value = await res.json()
    }
  } catch (e) {
    console.error('Failed to load friends:', e)
  } finally {
    isLoading.value = false
  }
})

function getWinrate(friend: Friend) {
  if (friend.games === 0) return 0
  return Math.round((friend.wins / friend.games) * 100)
}
</script>

<template>
  <div class="bg-white rounded-lg shadow p-4">
    <h2 class="text-lg font-semibold mb-4">Frequent Teammates</h2>
    
    <div v-if="isLoading" class="text-center py-8 text-gray-500">
      Loading teammates...
    </div>
    
    <div v-else-if="friends.length === 0" class="text-center py-8 text-gray-500">
      No frequent teammates found
    </div>
    
    <ul v-else class="space-y-3">
      <li
        v-for="friend in friends"
        :key="friend.puuid"
        class="flex items-center gap-3 p-2 rounded hover:bg-gray-50 transition-colors"
      >
        <img
          :src="`${DDRAGON_BASE}/profileicon/${friend.profileIconId || 1}.png`"
          :alt="friend.gameName"
          class="w-10 h-10 rounded-full"
        />
        <div class="flex-1 min-w-0">
          <div class="font-medium truncate">
            {{ friend.gameName }}
            <span class="text-gray-500">#{{ friend.tagLine }}</span>
          </div>
          <div class="text-sm text-gray-500">
            Level {{ friend.level }}
          </div>
        </div>
        <div class="text-right text-sm">
          <div class="font-medium">{{ friend.games }} games</div>
          <div :class="getWinrate(friend) >= 50 ? 'text-green-600' : 'text-red-600'">
            {{ getWinrate(friend) }}% WR
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
