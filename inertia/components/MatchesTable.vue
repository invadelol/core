<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  puuid: string
}>()

interface Participant {
  puuid: string
  gameName: string
  tagLine: string
  championId: number
  teamId: number
  win: boolean
  kills: number
  deaths: number
  assists: number
  cs: number
  level: number
  items: number[]
  position: string
  visionScore: number
  damageTaken: number
  damageDealt: number
}

interface Match {
  matchId: string
  gameStartMs: number
  duration: number
  queueId: number
  patch: string
  participants: Participant[]
}

const matches = ref<Match[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const expandedMatch = ref<string | null>(null)
const activeTab = ref<Record<string, string>>({})

const DDRAGON_BASE = 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img'

const queueNames: Record<number, string> = {
  420: 'Ranked Solo',
  440: 'Ranked Flex',
  400: 'Normal Draft',
  430: 'Normal Blind',
  450: 'ARAM',
  900: 'URF',
}

onMounted(async () => {
  try {
    const res = await fetch(`/summoners/puuid/${props.puuid}/matches?count=15`)
    if (res.ok) {
      matches.value = await res.json()
      // Initialize default tabs
      matches.value.forEach(m => {
        activeTab.value[m.matchId] = 'overview'
      })
    } else {
      error.value = 'Failed to load matches'
    }
  } catch (e) {
    error.value = 'Failed to load matches'
  } finally {
    isLoading.value = false
  }
})

function toggleExpand(matchId: string) {
  expandedMatch.value = expandedMatch.value === matchId ? null : matchId
}

function getPlayerData(match: Match) {
  return match.participants.find(p => p.puuid === props.puuid)
}

function getTeam(match: Match, teamId: number) {
  return match.participants.filter(p => p.teamId === teamId)
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatDate(ms: number) {
  if (!ms || isNaN(ms)) return 'Unknown'
  const date = new Date(Number(ms))
  if (isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleDateString()
}

function timeAgo(ms: number) {
  if (!ms || isNaN(ms)) return 'Unknown'
  const now = Date.now()
  const diff = now - Number(ms)
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  return 'Just now'
}

function getKDA(kills: number, deaths: number, assists: number) {
  if (deaths === 0) return 'Perfect'
  return ((kills + assists) / deaths).toFixed(2)
}
</script>

<template>
  <div class="bg-white rounded-lg shadow p-4">
    <h2 class="text-lg font-semibold mb-4">Match History</h2>
    
    <div v-if="isLoading" class="text-center py-8 text-gray-500">
      Loading matches...
    </div>
    
    <div v-else-if="error" class="text-center py-8 text-red-500">
      {{ error }}
    </div>
    
    <div v-else-if="matches.length === 0" class="text-center py-8 text-gray-500">
      No matches found
    </div>
    
    <div v-else class="space-y-2">
      <div
        v-for="match in matches"
        :key="match.matchId"
        class="border rounded-lg overflow-hidden"
      >
        <!-- Match Row (Clickable) -->
        <div
          :class="[
            'flex items-center gap-4 p-3 cursor-pointer transition-colors',
            getPlayerData(match)?.win ? 'bg-blue-50 hover:bg-blue-100' : 'bg-red-50 hover:bg-red-100'
          ]"
          @click="toggleExpand(match.matchId)"
        >
          <!-- Win/Loss -->
          <div class="w-12 text-center">
            <span
              :class="getPlayerData(match)?.win ? 'text-blue-600' : 'text-red-600'"
              class="font-bold text-sm"
            >
              {{ getPlayerData(match)?.win ? 'WIN' : 'LOSS' }}
            </span>
          </div>
          
          <!-- Champion -->
          <img
            :src="`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${getPlayerData(match)?.championId}.png`"
            class="w-12 h-12 rounded"
            :alt="`Champion ${getPlayerData(match)?.championId}`"
          />
          
          <!-- KDA -->
          <div class="flex-1">
            <div class="font-semibold">
              {{ getPlayerData(match)?.kills }}/{{ getPlayerData(match)?.deaths }}/{{ getPlayerData(match)?.assists }}
              <span class="text-gray-500 text-sm ml-1">
                ({{ getKDA(getPlayerData(match)?.kills || 0, getPlayerData(match)?.deaths || 0, getPlayerData(match)?.assists || 0) }} KDA)
              </span>
            </div>
            <div class="text-sm text-gray-500">
              {{ getPlayerData(match)?.cs }} CS
            </div>
          </div>
          
          <!-- Items -->
          <div class="hidden md:flex gap-0.5">
            <template v-for="(itemId, idx) in getPlayerData(match)?.items || []" :key="idx">
              <img
                v-if="itemId > 0"
                :src="`${DDRAGON_BASE}/item/${itemId}.png`"
                class="w-6 h-6 rounded"
              />
              <div v-else class="w-6 h-6 bg-gray-300 rounded"></div>
            </template>
          </div>
          
          <!-- Meta -->
          <div class="text-right text-sm text-gray-500 w-24">
            <div>{{ queueNames[match.queueId] || 'Custom' }}</div>
            <div>{{ formatDuration(match.duration) }} • {{ timeAgo(match.gameStartMs) }}</div>
          </div>
          
          <!-- Expand indicator -->
          <div class="text-gray-400">
            <svg :class="['w-5 h-5 transition-transform', expandedMatch === match.matchId && 'rotate-180']" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        
        <!-- Expanded Details -->
        <div v-if="expandedMatch === match.matchId" class="border-t bg-gray-50 p-4">
          <!-- Tabs -->
          <div class="flex gap-2 mb-4 border-b">
            <button
              v-for="tab in ['overview', 'team1', 'team2']"
              :key="tab"
              :class="[
                'px-4 py-2 text-sm font-medium transition-colors -mb-px',
                activeTab[match.matchId] === tab
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              ]"
              @click="activeTab[match.matchId] = tab"
            >
              {{ tab === 'overview' ? 'Overview' : tab === 'team1' ? 'Blue Team' : 'Red Team' }}
            </button>
          </div>
          
          <!-- Overview Tab -->
          <div v-if="activeTab[match.matchId] === 'overview'" class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div class="bg-white p-3 rounded shadow-sm">
              <div class="text-gray-500">Duration</div>
              <div class="font-semibold">{{ formatDuration(match.duration) }}</div>
            </div>
            <div class="bg-white p-3 rounded shadow-sm">
              <div class="text-gray-500">Vision Score</div>
              <div class="font-semibold">{{ getPlayerData(match)?.visionScore }}</div>
            </div>
            <div class="bg-white p-3 rounded shadow-sm">
              <div class="text-gray-500">Damage Dealt</div>
              <div class="font-semibold">{{ (getPlayerData(match)?.damageDealt || 0).toLocaleString() }}</div>
            </div>
            <div class="bg-white p-3 rounded shadow-sm">
              <div class="text-gray-500">Damage Taken</div>
              <div class="font-semibold">{{ (getPlayerData(match)?.damageTaken || 0).toLocaleString() }}</div>
            </div>
          </div>
          
          <!-- Team Tabs -->
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-gray-600 border-b">
                  <th class="py-2 px-2">Player</th>
                  <th class="py-2 px-2">K/D/A</th>
                  <th class="py-2 px-2">CS</th>
                  <th class="py-2 px-2">Damage</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="p in getTeam(match, activeTab[match.matchId] === 'team1' ? 100 : 200)"
                  :key="p.puuid"
                  :class="p.puuid === props.puuid ? 'bg-yellow-50' : ''"
                  class="border-b"
                >
                  <td class="py-2 px-2 flex items-center gap-2">
                    <img
                      :src="`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${p.championId}.png`"
                      class="w-6 h-6 rounded"
                    />
                    <span class="truncate max-w-[100px]">{{ p.gameName }}</span>
                  </td>
                  <td class="py-2 px-2">{{ p.kills }}/{{ p.deaths }}/{{ p.assists }}</td>
                  <td class="py-2 px-2">{{ p.cs }}</td>
                  <td class="py-2 px-2">{{ (p.damageDealt || 0).toLocaleString() }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
