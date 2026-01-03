<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3'
import { ref, onMounted, computed } from 'vue'
import { Home, RefreshCw, Eye } from 'lucide-vue-next'

import SearchBar from '../components/SearchBar.vue'
import MatchesTable from '../components/MatchesTable.vue'
import ActivityChart from '../components/ActivityChart.vue'
import FriendsList from '../components/FriendsList.vue'
import ChampionsStats from '../components/ChampionsStats.vue'
import StatisticsPanel from '../components/StatisticsPanel.vue'
import RankDisplay from '../components/RankDisplay.vue'

const props = defineProps<{
  summoner: string
}>()

interface SummonerData {
  puuid: string
  gameName: string
  tagLine: string
  profileIconId: number | null
  summonerLevel: number | null
  platform: string
}

const summonerData = ref<SummonerData | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
const isSyncing = ref(false)
const syncMessage = ref<string | null>(null)
const viewCount = ref<number | null>(null)

const DDRAGON_BASE = 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img'

const parsedSummoner = computed(() => {
  const decoded = decodeURIComponent(props.summoner)
  const lastDash = decoded.lastIndexOf('-')
  if (lastDash === -1) return { gameName: decoded, tagLine: 'EUW' }
  return {
    gameName: decoded.substring(0, lastDash),
    tagLine: decoded.substring(lastDash + 1)
  }
})

onMounted(async () => {
  try {
    const platform = 'EUW1'
    const res = await fetch(`/summoners/${platform}/${encodeURIComponent(props.summoner)}`)
    
    if (res.ok) {
      const data = await res.json()
      summonerData.value = data.summoner
    } else if (res.status === 404) {
      // Try to sync the summoner first before giving up
      const syncRes = await fetch('/summoners/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summoner: props.summoner,
          platform: platform
        })
      })
      
      if (syncRes.ok) {
        // Sync succeeded, retry fetching the summoner
        const retryRes = await fetch(`/summoners/${platform}/${encodeURIComponent(props.summoner)}`)
        if (retryRes.ok) {
          const data = await retryRes.json()
          summonerData.value = data.summoner
        } else {
          error.value = 'Summoner not found'
        }
      } else {
        error.value = 'Summoner not found'
      }
    } else {
      error.value = 'Failed to load summoner'
    }
  } catch (e) {
    error.value = 'Failed to load summoner'
  } finally {
    isLoading.value = false
  }
  
  // Track view after 3 seconds
  if (summonerData.value) {
    setTimeout(async () => {
      if (!summonerData.value) return
      try {
        const viewRes = await fetch(`/summoners/puuid/${summonerData.value.puuid}/increment`, {
          method: 'PUT'
        })
        if (viewRes.ok) {
          const data = await viewRes.json()
          viewCount.value = Number(data.viewCount)
        }
      } catch (e) {
        // Silent fail for view tracking
      }
    }, 3000)
  }
})

async function syncSummoner() {
  if (!summonerData.value || isSyncing.value) return
  
  isSyncing.value = true
  syncMessage.value = null
  
  try {
    const res = await fetch('/summoners/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summoner: `${summonerData.value.gameName}-${summonerData.value.tagLine}`,
        platform: summonerData.value.platform
      })
    })
    
    if (res.ok) {
      const data = await res.json()
      syncMessage.value = `Found ${data.matches?.length || 0} new matches!`
      // Reload page to refresh all components
      setTimeout(() => window.location.reload(), 1500)
    } else if (res.status === 404) {
      syncMessage.value = 'No new matches found'
    } else {
      syncMessage.value = 'Sync failed'
    }
  } catch (e) {
    syncMessage.value = 'Sync failed'
  } finally {
    isSyncing.value = false
  }
}
</script>

<template>
  <Head :title="parsedSummoner.gameName" />

  <div class="min-h-screen bg-gray-100">
    <!-- Header with search -->
    <header class="bg-white shadow-sm">
      <div class="max-w-7xl mx-auto px-4 py-4 flex items-center gap-6">
        <a href="/" class="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Home">
          <Home class="w-6 h-6 text-gray-700" />
        </a>
        <div class="flex-1 max-w-md">
          <SearchBar />
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 py-8">
      <!-- Loading state -->
      <div v-if="isLoading" class="text-center py-16">
        <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-500">Loading summoner...</p>
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="text-center py-16">
        <p class="text-red-500 text-lg mb-4">{{ error }}</p>
        <a href="/" class="text-blue-600 hover:underline">← Back to search</a>
      </div>

      <!-- Summoner data -->
      <div v-else-if="summonerData">
        <!-- Summoner header -->
        <div class="bg-white rounded-lg shadow p-6 mb-6 flex items-center gap-6">
          <img
            :src="`${DDRAGON_BASE}/profileicon/${summonerData.profileIconId || 1}.png`"
            :alt="summonerData.gameName"
            class="w-24 h-24 rounded-full border-4 border-blue-500"
          />
          <div class="flex-1">
            <h1 class="text-3xl font-bold text-gray-800">
              {{ summonerData.gameName }}
              <span class="text-gray-500 text-xl">#{{ summonerData.tagLine }}</span>
            </h1>
            <p class="text-gray-500 mt-1">
              Level {{ summonerData.summonerLevel || 'Unknown' }} • {{ summonerData.platform }}
              <span v-if="viewCount !== null" class="ml-2 inline-flex items-center gap-1">
                <Eye class="w-4 h-4" />
                {{ viewCount.toLocaleString() }}
              </span>
            </p>
            <p v-if="syncMessage" class="text-sm mt-1" :class="syncMessage.includes('new matches') ? 'text-green-600' : 'text-gray-500'">
              {{ syncMessage }}
            </p>
          </div>
          
          <button
            @click="syncSummoner"
            :disabled="isSyncing"
            class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw :class="['w-4 h-4', isSyncing && 'animate-spin']" />
            <span>{{ isSyncing ? 'Syncing...' : 'Update' }}</span>
          </button>
        </div>

        <!-- Stats grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div class="lg:col-span-2">
            <StatisticsPanel :puuid="summonerData.puuid" />
          </div>
          <div>
            <ActivityChart :puuid="summonerData.puuid" />
          </div>
        </div>

        <!-- Main content grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Match history (2 cols) -->
          <div class="lg:col-span-2">
            <MatchesTable :puuid="summonerData.puuid" />
          </div>

          <!-- Sidebar -->
          <div class="space-y-6">
            <RankDisplay :puuid="summonerData.puuid" />
            <FriendsList :puuid="summonerData.puuid" />
            <ChampionsStats :puuid="summonerData.puuid" />
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
