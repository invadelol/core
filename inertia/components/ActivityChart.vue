<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

const props = defineProps<{
  puuid: string
}>()

interface Activity {
  day: string
  games: number
  wins: number
}

const activity = ref<Activity[]>([])
const isLoading = ref(true)

onMounted(async () => {
  try {
    const res = await fetch(`/summoners/puuid/${props.puuid}/activity`)
    if (res.ok) {
      activity.value = await res.json()
    }
  } catch (e) {
    console.error('Failed to load activity:', e)
  } finally {
    isLoading.value = false
  }
})

// Build a calendar grid similar to GitHub contributions
const calendarData = computed(() => {
  const today = new Date()
  const weeks: Array<Array<{ date: string; games: number; wins: number; level: number }>> = []
  
  // Create a map for quick lookup
  const activityMap = new Map<string, Activity>()
  activity.value.forEach(a => activityMap.set(a.day, a))
  
  // Calculate max games for intensity
  const maxGames = Math.max(...activity.value.map(a => a.games), 1)
  
  // Generate last 12 weeks (84 days)
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 83)
  
  // Adjust to start on Sunday
  const dayOfWeek = startDate.getDay()
  startDate.setDate(startDate.getDate() - dayOfWeek)
  
  let currentWeek: Array<{ date: string; games: number; wins: number; level: number }> = []
  
  for (let i = 0; i < 91; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    
    if (d > today) break
    
    const dateStr = d.toISOString().split('T')[0]
    const data = activityMap.get(dateStr)
    const games = data?.games || 0
    const wins = data?.wins || 0
    
    // Calculate intensity level (0-4)
    let level = 0
    if (games > 0) {
      level = Math.min(4, Math.ceil((games / maxGames) * 4))
    }
    
    currentWeek.push({ date: dateStr, games, wins, level })
    
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }
  
  if (currentWeek.length > 0) {
    weeks.push(currentWeek)
  }
  
  return weeks
})

const totalGames = computed(() => activity.value.reduce((sum, a) => sum + Number(a.games), 0))
const totalWins = computed(() => activity.value.reduce((sum, a) => sum + Number(a.wins), 0))

function getLevelColor(level: number) {
  const colors = [
    'bg-gray-100', // 0 games
    'bg-green-200', // low
    'bg-green-400', // medium-low
    'bg-green-500', // medium-high
    'bg-green-700', // high
  ]
  return colors[level] || colors[0]
}

function getWinrate(games: number, wins: number) {
  if (games === 0) return 0
  return Math.round((wins / games) * 100)
}
</script>

<template>
  <div class="bg-white rounded-lg shadow p-4">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold">Activity</h2>
      <div v-if="!isLoading && totalGames > 0" class="text-sm text-gray-500">
        {{ totalGames }} games • {{ getWinrate(totalGames, totalWins) }}% WR
      </div>
    </div>
    
    <div v-if="isLoading" class="text-center py-8 text-gray-500">
      Loading activity...
    </div>
    
    <div v-else-if="activity.length === 0" class="text-center py-8 text-gray-500">
      No recent activity
    </div>
    
    <div v-else>
      <!-- GitHub-style heatmap -->
      <div class="flex gap-1 overflow-x-auto pb-2">
        <div
          v-for="(week, weekIdx) in calendarData"
          :key="weekIdx"
          class="flex flex-col gap-1"
        >
          <div
            v-for="(day, dayIdx) in week"
            :key="dayIdx"
            :class="[
              'w-3 h-3 rounded-sm cursor-pointer transition-all hover:ring-2 hover:ring-gray-400',
              getLevelColor(day.level)
            ]"
            :title="`${day.date}: ${day.games} games (${getWinrate(day.games, day.wins)}% WR)`"
          ></div>
        </div>
      </div>
      
      <!-- Legend -->
      <div class="flex items-center justify-end gap-2 mt-3 text-xs text-gray-500">
        <span>Less</span>
        <div class="flex gap-1">
          <div class="w-3 h-3 rounded-sm bg-gray-100"></div>
          <div class="w-3 h-3 rounded-sm bg-green-200"></div>
          <div class="w-3 h-3 rounded-sm bg-green-400"></div>
          <div class="w-3 h-3 rounded-sm bg-green-500"></div>
          <div class="w-3 h-3 rounded-sm bg-green-700"></div>
        </div>
        <span>More</span>
      </div>
    </div>
  </div>
</template>
