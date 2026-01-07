<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3'
import { ref, computed, onMounted } from 'vue'
import { Home, ChevronLeft, Trophy, Skull, Shield, Swords, Target, Eye, Coins, Zap, Clock, ArrowUp, ArrowDown } from 'lucide-vue-next'
import SearchBar from '../components/SearchBar.vue'

const props = defineProps<{
  matchId: string
  puuid?: string
}>()

// Tab state
const activeTab = ref<'general' | 'details' | 'runes'>('general')

// Selected player for Details tab
const selectedPlayerPuuid = ref<string>('')

// Mock data structures - in production these would come from API
interface Player {
  puuid: string
  gameName: string
  tagLine: string
  championId: number
  championName: string
  teamId: number
  win: boolean
  kills: number
  deaths: number
  assists: number
  cs: number
  csPerMin: number
  level: number
  items: number[]
  trinket: number
  summonerSpells: number[]
  primaryRune: number
  primaryRuneTree: number
  secondaryRuneTree: number
  primaryRunes: number[]
  secondaryRunes: number[]
  statShards: number[]
  goldEarned: number
  goldPerMin: number
  damageDealt: number
  damagePerMin: number
  visionScore: number
  visionPerMin: number
  wardsPlaced: number
  wardsKilled: number
  controlWardsBought: number
  killParticipation: number
  rank: string
  lp: number
  matchRanking: number // 1-10, 1 = MVP
  overallScore: number
  // Lane phase stats (at 15 min)
  csDiff15: number
  goldDiff15: number
  xpDiff15: number
  firstLevel2: boolean
  // Skill order
  skillOrder: number[][] // [Q levels, W levels, E levels, R levels]
  // Build order
  buildOrder: { time: number; itemId: number }[]
  // Spell/Ping stats
  spellsCast: { Q: number; W: number; E: number; R: number; D: number; F: number }
  pings: { onMyWay: number; missing: number; danger: number; assist: number; vision: number; retreat: number }
}

interface TeamObjectives {
  baron: number
  dragon: number
  herald: number
  grubs: number
  tower: number
  inhibitor: number
}

interface Match {
  matchId: string
  gameStartMs: number
  duration: number
  queueId: number
  patch: string
  team1: {
    teamId: number
    win: boolean
    objectives: TeamObjectives
    players: Player[]
  }
  team2: {
    teamId: number
    win: boolean
    objectives: TeamObjectives
    players: Player[]
  }
}

const match = ref<Match | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

const DDRAGON_BASE = 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img'
const CDRAGON_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1'

const queueNames: Record<number, string> = {
  420: 'Ranked Solo/Duo',
  440: 'Ranked Flex',
  400: 'Normal Draft',
  430: 'Normal Blind',
  450: 'ARAM',
  900: 'URF',
}

// Summoner spell mappings
const summonerSpellNames: Record<number, string> = {
  1: 'SummonerBoost', // Cleanse
  3: 'SummonerExhaust',
  4: 'SummonerFlash',
  6: 'SummonerHaste', // Ghost
  7: 'SummonerHeal',
  11: 'SummonerSmite',
  12: 'SummonerTeleport',
  14: 'SummonerDot', // Ignite
  21: 'SummonerBarrier',
  32: 'SummonerSnowball', // Mark (ARAM)
}

// Rune tree data
const runeTreeNames: Record<number, { name: string; color: string }> = {
  8000: { name: 'Precision', color: '#C8AA6E' },
  8100: { name: 'Domination', color: '#D44545' },
  8200: { name: 'Sorcery', color: '#9FAAFC' },
  8300: { name: 'Inspiration', color: '#49AAB9' },
  8400: { name: 'Resolve', color: '#A4D17D' },
}

onMounted(async () => {
  try {
    // In production, fetch from API: /api/matches/${props.matchId}
    // For now, using mock data
    await loadMockData()
  } catch (e) {
    error.value = 'Failed to load match details'
  } finally {
    isLoading.value = false
  }
})

async function loadMockData() {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 300))
  
  const mockPlayers: Player[] = []
  const championIds = [266, 64, 103, 22, 412, 86, 121, 99, 21, 89] // Random champion IDs
  const names = ['ProPlayer1', 'JungleKing', 'MidLaner99', 'ADCarry', 'Support42', 'TopDiff', 'Ganker', 'MageMain', 'Marksman', 'TankSupp']
  
  for (let i = 0; i < 10; i++) {
    const teamId = i < 5 ? 100 : 200
    const win = i < 5
    mockPlayers.push({
      puuid: `puuid-${i}`,
      gameName: names[i],
      tagLine: 'EUW',
      championId: championIds[i],
      championName: `Champion${championIds[i]}`,
      teamId,
      win,
      kills: Math.floor(Math.random() * 15),
      deaths: Math.floor(Math.random() * 10),
      assists: Math.floor(Math.random() * 20),
      cs: Math.floor(Math.random() * 200) + 100,
      csPerMin: parseFloat((Math.random() * 4 + 5).toFixed(1)),
      level: 18,
      items: [3078, 3111, 3053, 3071, 3026, 3065],
      trinket: 3340,
      summonerSpells: [4, 14], // Flash + Ignite
      primaryRune: 8005,
      primaryRuneTree: 8000,
      secondaryRuneTree: 8100,
      primaryRunes: [8005, 9111, 9104, 8299],
      secondaryRunes: [8139, 8135],
      statShards: [5008, 5008, 5002],
      goldEarned: Math.floor(Math.random() * 8000) + 10000,
      goldPerMin: parseFloat((Math.random() * 200 + 300).toFixed(0)),
      damageDealt: Math.floor(Math.random() * 30000) + 15000,
      damagePerMin: parseFloat((Math.random() * 500 + 500).toFixed(0)),
      visionScore: Math.floor(Math.random() * 40) + 20,
      visionPerMin: parseFloat((Math.random() * 1 + 0.5).toFixed(2)),
      wardsPlaced: Math.floor(Math.random() * 15) + 5,
      wardsKilled: Math.floor(Math.random() * 10),
      controlWardsBought: Math.floor(Math.random() * 5) + 1,
      killParticipation: Math.floor(Math.random() * 40) + 40,
      rank: ['DIAMOND', 'MASTER', 'GRANDMASTER', 'PLATINUM', 'EMERALD'][Math.floor(Math.random() * 5)],
      lp: Math.floor(Math.random() * 100) + 1,
      matchRanking: i + 1,
      overallScore: Math.floor(Math.random() * 30) + 60,
      csDiff15: Math.floor(Math.random() * 40) - 20,
      goldDiff15: Math.floor(Math.random() * 1000) - 500,
      xpDiff15: Math.floor(Math.random() * 800) - 400,
      firstLevel2: Math.random() > 0.5,
      skillOrder: generateSkillOrder(),
      buildOrder: generateBuildOrder(),
      spellsCast: {
        Q: Math.floor(Math.random() * 150) + 50,
        W: Math.floor(Math.random() * 100) + 30,
        E: Math.floor(Math.random() * 120) + 40,
        R: Math.floor(Math.random() * 20) + 5,
        D: Math.floor(Math.random() * 5) + 1,
        F: Math.floor(Math.random() * 5) + 1,
      },
      pings: {
        onMyWay: Math.floor(Math.random() * 30),
        missing: Math.floor(Math.random() * 20),
        danger: Math.floor(Math.random() * 15),
        assist: Math.floor(Math.random() * 25),
        vision: Math.floor(Math.random() * 10),
        retreat: Math.floor(Math.random() * 10),
      },
    })
  }

  match.value = {
    matchId: props.matchId,
    gameStartMs: Date.now() - 3600000,
    duration: 1847, // ~30 min
    queueId: 420,
    patch: '14.24.1',
    team1: {
      teamId: 100,
      win: true,
      objectives: {
        baron: 2,
        dragon: 4,
        herald: 1,
        grubs: 5,
        tower: 9,
        inhibitor: 2,
      },
      players: mockPlayers.filter(p => p.teamId === 100),
    },
    team2: {
      teamId: 200,
      win: false,
      objectives: {
        baron: 0,
        dragon: 1,
        herald: 1,
        grubs: 1,
        tower: 3,
        inhibitor: 0,
      },
      players: mockPlayers.filter(p => p.teamId === 200),
    },
  }

  // Set selected player to the current user or first player
  selectedPlayerPuuid.value = props.puuid || mockPlayers[0].puuid
}

function generateSkillOrder(): number[][] {
  // Generate a typical skill order matrix (4 skills, 18 levels)
  const order: number[][] = [[], [], [], []]
  let skillPoints = [0, 0, 0, 0]
  
  for (let level = 1; level <= 18; level++) {
    let skill: number
    if (level === 6 || level === 11 || level === 16) {
      skill = 3 // R
    } else if (level <= 3) {
      skill = level - 1 // Q, W, E
    } else {
      // Max Q first, then W, then E
      if (skillPoints[0] < 5) skill = 0
      else if (skillPoints[1] < 5) skill = 1
      else skill = 2
    }
    skillPoints[skill]++
    order[skill].push(level)
  }
  
  return order
}

function generateBuildOrder(): { time: number; itemId: number }[] {
  const items = [
    { time: 0, itemId: 1055 }, // Starter
    { time: 240, itemId: 1001 }, // Boots
    { time: 420, itemId: 3044 }, // Phage
    { time: 600, itemId: 3133 }, // Caulfield
    { time: 840, itemId: 3078 }, // Trinity
    { time: 1020, itemId: 3111 }, // Mercs
    { time: 1260, itemId: 3053 }, // Sterak's
  ]
  return items
}

// Computed properties
const selectedPlayer = computed(() => {
  if (!match.value) return null
  const all = [...match.value.team1.players, ...match.value.team2.players]
  return all.find(p => p.puuid === selectedPlayerPuuid.value) || null
})

const allPlayers = computed(() => {
  if (!match.value) return []
  return [...match.value.team1.players, ...match.value.team2.players]
})

// Helper functions
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  return `${m}m`
}

function formatNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toString()
}

function getMatchRankBadge(rank: number, win: boolean): { label: string; class: string } {
  if (rank === 1 && win) return { label: 'MVP', class: 'bg-yellow-500 text-white' }
  if (rank === 1 && !win) return { label: 'ACE', class: 'bg-purple-500 text-white' }
  if (rank <= 3) return { label: `${rank}${rank === 2 ? 'nd' : 'rd'}`, class: 'bg-blue-500 text-white' }
  return { label: `${rank}th`, class: 'bg-gray-400 text-white' }
}

function getChampionIcon(championId: number): string {
  return `${CDRAGON_BASE}/champion-icons/${championId}.png`
}

function getItemIcon(itemId: number): string {
  return `${DDRAGON_BASE}/item/${itemId}.png`
}

function getSummonerSpellIcon(spellId: number): string {
  const spellName = summonerSpellNames[spellId] || 'SummonerFlash'
  return `${DDRAGON_BASE}/spell/${spellName}.png`
}

function getRuneIcon(runeId: number): string {
  // Using Community Dragon for rune icons
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/${getRunePath(runeId)}.png`
}

function getRunePath(runeId: number): string {
  // Simplified - in production would have full mapping
  const runePaths: Record<number, string> = {
    8005: 'precision/presstheattack/presstheattack',
    8008: 'precision/lethaltempo/lethaltempotemp',
    8021: 'precision/fleetfootwork/fleetfootwork',
    8010: 'precision/conqueror/conqueror',
    8112: 'domination/electrocute/electrocute',
    8124: 'domination/predator/predator',
    8128: 'domination/darkharvest/darkharvest',
    8214: 'sorcery/summonaery/summonaery',
    8229: 'sorcery/arcanecomet/arcanecomet',
    8230: 'sorcery/phaserush/phaserush',
    8351: 'inspiration/glacialaugment/glacialaugment',
    8360: 'inspiration/unsealedspellbook/unsealedspellbook',
    8369: 'inspiration/firststrike/firststrike',
    8437: 'resolve/graspoftheundying/graspoftheundying',
    8439: 'resolve/veteranaftershock/veteranaftershock',
    8465: 'resolve/guardian/guardian',
  }
  return runePaths[runeId] || 'precision/presstheattack/presstheattack'
}

function getRuneTreeIcon(treeId: number): string {
  const treePaths: Record<number, string> = {
    8000: '7201_precision',
    8100: '7200_domination',
    8200: '7202_sorcery',
    8300: '7203_whimsy',
    8400: '7204_resolve',
  }
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/${treePaths[treeId] || '7201_precision'}.png`
}

function selectPlayer(puuid: string) {
  selectedPlayerPuuid.value = puuid
  if (activeTab.value !== 'details') {
    activeTab.value = 'details'
  }
}

function goBack() {
  window.history.back()
}
</script>

<template>
  <Head :title="`Match ${matchId}`" />

  <div class="min-h-screen bg-gray-900 text-white">
    <!-- Navigation Bar -->
    <header class="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
        <button 
          @click="goBack"
          class="p-2 rounded-lg hover:bg-gray-700 transition-colors"
          title="Go Back"
        >
          <ChevronLeft class="w-5 h-5" />
        </button>
        <a href="/" class="p-2 rounded-lg hover:bg-gray-700 transition-colors" title="Home">
          <Home class="w-5 h-5" />
        </a>
        <div class="flex-1 max-w-md">
          <SearchBar />
        </div>
        
        <!-- Match Meta Info -->
        <div v-if="match" class="hidden md:flex items-center gap-4 text-sm text-gray-400">
          <span>{{ queueNames[match.queueId] || 'Custom' }}</span>
          <span>{{ formatDuration(match.duration) }}</span>
          <span>Patch {{ match.patch }}</span>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 py-6">
      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center justify-center py-20">
        <div class="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-20">
        <p class="text-red-400 text-lg mb-4">{{ error }}</p>
        <a href="/" class="text-blue-400 hover:underline">← Back to home</a>
      </div>

      <!-- Match Content -->
      <div v-else-if="match">
        <!-- Tab Navigation -->
        <div class="flex gap-1 mb-6 bg-gray-800 rounded-lg p-1 w-fit">
          <button
            v-for="tab in [
              { id: 'general', label: 'General' },
              { id: 'details', label: 'Details' },
              { id: 'runes', label: 'Runes' }
            ]"
            :key="tab.id"
            :class="[
              'px-6 py-2.5 rounded-md text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            ]"
            @click="activeTab = tab.id as 'general' | 'details' | 'runes'"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- ==================== GENERAL TAB ==================== -->
        <div v-if="activeTab === 'general'" class="space-y-6">
          <!-- Team 1 (Winners) -->
          <div class="bg-gray-800 rounded-xl overflow-hidden">
            <!-- Team Header -->
            <div class="flex items-center justify-between px-6 py-4 bg-blue-900/30 border-b border-gray-700">
              <div class="flex items-center gap-3">
                <Trophy class="w-6 h-6 text-yellow-500" />
                <span class="text-xl font-bold text-blue-400">Victory</span>
                <span class="text-gray-400 text-sm">Blue Side</span>
              </div>
              
              <!-- Objectives -->
              <div class="flex items-center gap-6 text-sm">
                <div class="flex items-center gap-2" title="Baron Nashor">
                  <div class="w-6 h-6 bg-purple-600 rounded flex items-center justify-center text-xs">B</div>
                  <span>{{ match.team1.objectives.baron }}</span>
                </div>
                <div class="flex items-center gap-2" title="Dragons">
                  <div class="w-6 h-6 bg-orange-500 rounded flex items-center justify-center text-xs">D</div>
                  <span>{{ match.team1.objectives.dragon }}</span>
                </div>
                <div class="flex items-center gap-2" title="Void Grubs">
                  <div class="w-6 h-6 bg-pink-600 rounded flex items-center justify-center text-xs">G</div>
                  <span>{{ match.team1.objectives.grubs }}</span>
                </div>
                <div class="flex items-center gap-2" title="Rift Herald">
                  <div class="w-6 h-6 bg-teal-500 rounded flex items-center justify-center text-xs">H</div>
                  <span>{{ match.team1.objectives.herald }}</span>
                </div>
                <div class="flex items-center gap-2" title="Towers">
                  <div class="w-6 h-6 bg-gray-500 rounded flex items-center justify-center text-xs">T</div>
                  <span>{{ match.team1.objectives.tower }}</span>
                </div>
                <div class="flex items-center gap-2" title="Inhibitors">
                  <div class="w-6 h-6 bg-indigo-500 rounded flex items-center justify-center text-xs">I</div>
                  <span>{{ match.team1.objectives.inhibitor }}</span>
                </div>
              </div>
            </div>

            <!-- Player Rows -->
            <div class="divide-y divide-gray-700">
              <div
                v-for="player in match.team1.players"
                :key="player.puuid"
                class="flex items-center gap-4 px-4 py-3 hover:bg-gray-700/50 transition-colors cursor-pointer"
                @click="selectPlayer(player.puuid)"
              >
                <!-- Rank Badge & Level -->
                <div class="w-16 flex flex-col items-center gap-1">
                  <span 
                    :class="['px-2 py-0.5 rounded text-xs font-bold', getMatchRankBadge(player.matchRanking, player.win).class]"
                  >
                    {{ getMatchRankBadge(player.matchRanking, player.win).label }}
                  </span>
                  <span class="text-xs text-gray-500">Lv.{{ player.level }}</span>
                </div>

                <!-- Champion & Player Info -->
                <div class="flex items-center gap-3 w-48">
                  <img
                    :src="getChampionIcon(player.championId)"
                    :alt="player.championName"
                    class="w-12 h-12 rounded-lg border-2 border-blue-500"
                  />
                  <div>
                    <div class="font-semibold truncate max-w-[120px]">{{ player.gameName }}</div>
                    <div class="text-xs text-gray-400">{{ player.rank }} {{ player.lp }} LP</div>
                  </div>
                </div>

                <!-- Loadout (Summoners + Runes) -->
                <div class="grid grid-cols-2 gap-1 w-20">
                  <img :src="getSummonerSpellIcon(player.summonerSpells[0])" class="w-6 h-6 rounded" />
                  <img :src="getRuneTreeIcon(player.primaryRuneTree)" class="w-6 h-6 rounded" />
                  <img :src="getSummonerSpellIcon(player.summonerSpells[1])" class="w-6 h-6 rounded" />
                  <img :src="getRuneTreeIcon(player.secondaryRuneTree)" class="w-6 h-6 rounded" />
                </div>

                <!-- Items -->
                <div class="flex items-center gap-1">
                  <div class="flex gap-0.5">
                    <template v-for="(itemId, idx) in player.items" :key="idx">
                      <img
                        v-if="itemId > 0"
                        :src="getItemIcon(itemId)"
                        class="w-8 h-8 rounded"
                      />
                      <div v-else class="w-8 h-8 bg-gray-600 rounded"></div>
                    </template>
                  </div>
                  <div class="w-8 h-8 ml-1">
                    <img
                      v-if="player.trinket > 0"
                      :src="getItemIcon(player.trinket)"
                      class="w-8 h-8 rounded border border-yellow-600"
                    />
                    <div v-else class="w-8 h-8 bg-gray-600 rounded border border-yellow-600"></div>
                  </div>
                </div>

                <!-- KDA -->
                <div class="w-28 text-center">
                  <div class="font-bold">
                    <span class="text-green-400">{{ player.kills }}</span>
                    <span class="text-gray-500"> / </span>
                    <span class="text-red-400">{{ player.deaths }}</span>
                    <span class="text-gray-500"> / </span>
                    <span class="text-blue-400">{{ player.assists }}</span>
                  </div>
                  <div class="text-xs text-gray-400">
                    {{ player.deaths === 0 ? 'Perfect' : ((player.kills + player.assists) / player.deaths).toFixed(2) }} KDA
                  </div>
                </div>

                <!-- Combat Metrics -->
                <div class="flex items-center gap-4 text-sm">
                  <div class="text-center w-16">
                    <div class="font-semibold text-amber-400">{{ player.killParticipation }}%</div>
                    <div class="text-xs text-gray-500">KP</div>
                  </div>
                  <div class="text-center w-16">
                    <div class="font-semibold">{{ player.csPerMin }}</div>
                    <div class="text-xs text-gray-500">CS/min</div>
                  </div>
                  <div class="text-center w-16">
                    <div class="font-semibold text-yellow-400">{{ formatNumber(player.goldEarned) }}</div>
                    <div class="text-xs text-gray-500">Gold</div>
                  </div>
                </div>

                <!-- Overall Score -->
                <div class="w-14 text-center">
                  <div 
                    :class="[
                      'text-2xl font-bold',
                      player.overallScore >= 80 ? 'text-green-400' :
                      player.overallScore >= 60 ? 'text-blue-400' :
                      player.overallScore >= 40 ? 'text-yellow-400' : 'text-red-400'
                    ]"
                  >
                    {{ player.overallScore }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Team 2 (Losers) -->
          <div class="bg-gray-800 rounded-xl overflow-hidden">
            <!-- Team Header -->
            <div class="flex items-center justify-between px-6 py-4 bg-red-900/30 border-b border-gray-700">
              <div class="flex items-center gap-3">
                <Skull class="w-6 h-6 text-red-500" />
                <span class="text-xl font-bold text-red-400">Defeat</span>
                <span class="text-gray-400 text-sm">Red Side</span>
              </div>
              
              <!-- Objectives -->
              <div class="flex items-center gap-6 text-sm">
                <div class="flex items-center gap-2" title="Baron Nashor">
                  <div class="w-6 h-6 bg-purple-600 rounded flex items-center justify-center text-xs">B</div>
                  <span>{{ match.team2.objectives.baron }}</span>
                </div>
                <div class="flex items-center gap-2" title="Dragons">
                  <div class="w-6 h-6 bg-orange-500 rounded flex items-center justify-center text-xs">D</div>
                  <span>{{ match.team2.objectives.dragon }}</span>
                </div>
                <div class="flex items-center gap-2" title="Void Grubs">
                  <div class="w-6 h-6 bg-pink-600 rounded flex items-center justify-center text-xs">G</div>
                  <span>{{ match.team2.objectives.grubs }}</span>
                </div>
                <div class="flex items-center gap-2" title="Rift Herald">
                  <div class="w-6 h-6 bg-teal-500 rounded flex items-center justify-center text-xs">H</div>
                  <span>{{ match.team2.objectives.herald }}</span>
                </div>
                <div class="flex items-center gap-2" title="Towers">
                  <div class="w-6 h-6 bg-gray-500 rounded flex items-center justify-center text-xs">T</div>
                  <span>{{ match.team2.objectives.tower }}</span>
                </div>
                <div class="flex items-center gap-2" title="Inhibitors">
                  <div class="w-6 h-6 bg-indigo-500 rounded flex items-center justify-center text-xs">I</div>
                  <span>{{ match.team2.objectives.inhibitor }}</span>
                </div>
              </div>
            </div>

            <!-- Player Rows -->
            <div class="divide-y divide-gray-700">
              <div
                v-for="player in match.team2.players"
                :key="player.puuid"
                class="flex items-center gap-4 px-4 py-3 hover:bg-gray-700/50 transition-colors cursor-pointer"
                @click="selectPlayer(player.puuid)"
              >
                <!-- Rank Badge & Level -->
                <div class="w-16 flex flex-col items-center gap-1">
                  <span 
                    :class="['px-2 py-0.5 rounded text-xs font-bold', getMatchRankBadge(player.matchRanking - 5, player.win).class]"
                  >
                    {{ getMatchRankBadge(player.matchRanking - 5, player.win).label }}
                  </span>
                  <span class="text-xs text-gray-500">Lv.{{ player.level }}</span>
                </div>

                <!-- Champion & Player Info -->
                <div class="flex items-center gap-3 w-48">
                  <img
                    :src="getChampionIcon(player.championId)"
                    :alt="player.championName"
                    class="w-12 h-12 rounded-lg border-2 border-red-500"
                  />
                  <div>
                    <div class="font-semibold truncate max-w-[120px]">{{ player.gameName }}</div>
                    <div class="text-xs text-gray-400">{{ player.rank }} {{ player.lp }} LP</div>
                  </div>
                </div>

                <!-- Loadout (Summoners + Runes) -->
                <div class="grid grid-cols-2 gap-1 w-20">
                  <img :src="getSummonerSpellIcon(player.summonerSpells[0])" class="w-6 h-6 rounded" />
                  <img :src="getRuneTreeIcon(player.primaryRuneTree)" class="w-6 h-6 rounded" />
                  <img :src="getSummonerSpellIcon(player.summonerSpells[1])" class="w-6 h-6 rounded" />
                  <img :src="getRuneTreeIcon(player.secondaryRuneTree)" class="w-6 h-6 rounded" />
                </div>

                <!-- Items -->
                <div class="flex items-center gap-1">
                  <div class="flex gap-0.5">
                    <template v-for="(itemId, idx) in player.items" :key="idx">
                      <img
                        v-if="itemId > 0"
                        :src="getItemIcon(itemId)"
                        class="w-8 h-8 rounded"
                      />
                      <div v-else class="w-8 h-8 bg-gray-600 rounded"></div>
                    </template>
                  </div>
                  <div class="w-8 h-8 ml-1">
                    <img
                      v-if="player.trinket > 0"
                      :src="getItemIcon(player.trinket)"
                      class="w-8 h-8 rounded border border-yellow-600"
                    />
                    <div v-else class="w-8 h-8 bg-gray-600 rounded border border-yellow-600"></div>
                  </div>
                </div>

                <!-- KDA -->
                <div class="w-28 text-center">
                  <div class="font-bold">
                    <span class="text-green-400">{{ player.kills }}</span>
                    <span class="text-gray-500"> / </span>
                    <span class="text-red-400">{{ player.deaths }}</span>
                    <span class="text-gray-500"> / </span>
                    <span class="text-blue-400">{{ player.assists }}</span>
                  </div>
                  <div class="text-xs text-gray-400">
                    {{ player.deaths === 0 ? 'Perfect' : ((player.kills + player.assists) / player.deaths).toFixed(2) }} KDA
                  </div>
                </div>

                <!-- Combat Metrics -->
                <div class="flex items-center gap-4 text-sm">
                  <div class="text-center w-16">
                    <div class="font-semibold text-amber-400">{{ player.killParticipation }}%</div>
                    <div class="text-xs text-gray-500">KP</div>
                  </div>
                  <div class="text-center w-16">
                    <div class="font-semibold">{{ player.csPerMin }}</div>
                    <div class="text-xs text-gray-500">CS/min</div>
                  </div>
                  <div class="text-center w-16">
                    <div class="font-semibold text-yellow-400">{{ formatNumber(player.goldEarned) }}</div>
                    <div class="text-xs text-gray-500">Gold</div>
                  </div>
                </div>

                <!-- Overall Score -->
                <div class="w-14 text-center">
                  <div 
                    :class="[
                      'text-2xl font-bold',
                      player.overallScore >= 80 ? 'text-green-400' :
                      player.overallScore >= 60 ? 'text-blue-400' :
                      player.overallScore >= 40 ? 'text-yellow-400' : 'text-red-400'
                    ]"
                  >
                    {{ player.overallScore }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ==================== DETAILS TAB ==================== -->
        <div v-if="activeTab === 'details'" class="space-y-6">
          <!-- Top Bar: Player Selection -->
          <div class="bg-gray-800 rounded-xl p-4">
            <div class="flex items-center justify-center gap-2">
              <!-- Team 1 Champions -->
              <div class="flex gap-2">
                <button
                  v-for="player in match.team1.players"
                  :key="player.puuid"
                  :class="[
                    'relative rounded-lg overflow-hidden transition-all border-2',
                    selectedPlayerPuuid === player.puuid
                      ? 'border-blue-500 ring-2 ring-blue-500/50 scale-110'
                      : 'border-transparent hover:border-blue-400 opacity-70 hover:opacity-100'
                  ]"
                  @click="selectedPlayerPuuid = player.puuid"
                >
                  <img
                    :src="getChampionIcon(player.championId)"
                    :alt="player.championName"
                    class="w-12 h-12"
                  />
                </button>
              </div>
              
              <!-- VS Separator -->
              <div class="px-4 text-gray-500 font-bold text-lg">VS</div>
              
              <!-- Team 2 Champions -->
              <div class="flex gap-2">
                <button
                  v-for="player in match.team2.players"
                  :key="player.puuid"
                  :class="[
                    'relative rounded-lg overflow-hidden transition-all border-2',
                    selectedPlayerPuuid === player.puuid
                      ? 'border-red-500 ring-2 ring-red-500/50 scale-110'
                      : 'border-transparent hover:border-red-400 opacity-70 hover:opacity-100'
                  ]"
                  @click="selectedPlayerPuuid = player.puuid"
                >
                  <img
                    :src="getChampionIcon(player.championId)"
                    :alt="player.championName"
                    class="w-12 h-12"
                  />
                </button>
              </div>
            </div>
            
            <!-- Selected Player Name -->
            <div v-if="selectedPlayer" class="text-center mt-3">
              <span class="text-lg font-semibold">{{ selectedPlayer.gameName }}</span>
              <span class="text-gray-400">#{{ selectedPlayer.tagLine }}</span>
            </div>
          </div>

          <!-- Stat Cards Row -->
          <div v-if="selectedPlayer" class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- Laning Phase (at 15 min) -->
            <div class="bg-gray-800 rounded-xl p-5">
              <h3 class="text-sm font-semibold text-gray-400 mb-4 flex items-center gap-2">
                <Clock class="w-4 h-4" />
                Laning Phase (@15 min)
              </h3>
              <div class="space-y-3">
                <div class="flex justify-between items-center">
                  <span class="text-gray-400">CS Diff</span>
                  <span :class="selectedPlayer.csDiff15 >= 0 ? 'text-green-400' : 'text-red-400'" class="font-semibold flex items-center gap-1">
                    <ArrowUp v-if="selectedPlayer.csDiff15 >= 0" class="w-4 h-4" />
                    <ArrowDown v-else class="w-4 h-4" />
                    {{ selectedPlayer.csDiff15 >= 0 ? '+' : '' }}{{ selectedPlayer.csDiff15 }}
                  </span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-gray-400">Gold Diff</span>
                  <span :class="selectedPlayer.goldDiff15 >= 0 ? 'text-green-400' : 'text-red-400'" class="font-semibold flex items-center gap-1">
                    <ArrowUp v-if="selectedPlayer.goldDiff15 >= 0" class="w-4 h-4" />
                    <ArrowDown v-else class="w-4 h-4" />
                    {{ selectedPlayer.goldDiff15 >= 0 ? '+' : '' }}{{ selectedPlayer.goldDiff15 }}
                  </span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-gray-400">XP Diff</span>
                  <span :class="selectedPlayer.xpDiff15 >= 0 ? 'text-green-400' : 'text-red-400'" class="font-semibold flex items-center gap-1">
                    <ArrowUp v-if="selectedPlayer.xpDiff15 >= 0" class="w-4 h-4" />
                    <ArrowDown v-else class="w-4 h-4" />
                    {{ selectedPlayer.xpDiff15 >= 0 ? '+' : '' }}{{ selectedPlayer.xpDiff15 }}
                  </span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-gray-400">First Level 2</span>
                  <span :class="selectedPlayer.firstLevel2 ? 'text-green-400' : 'text-gray-500'" class="font-semibold">
                    {{ selectedPlayer.firstLevel2 ? 'Yes' : 'No' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Vision (Wards) -->
            <div class="bg-gray-800 rounded-xl p-5">
              <h3 class="text-sm font-semibold text-gray-400 mb-4 flex items-center gap-2">
                <Eye class="w-4 h-4" />
                Vision
              </h3>
              <div class="space-y-3">
                <div class="flex justify-between items-center">
                  <span class="text-gray-400">Wards Placed</span>
                  <span class="font-semibold text-blue-400">{{ selectedPlayer.wardsPlaced }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-gray-400">Wards Killed</span>
                  <span class="font-semibold text-red-400">{{ selectedPlayer.wardsKilled }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-gray-400">Control Wards</span>
                  <span class="font-semibold text-pink-400">{{ selectedPlayer.controlWardsBought }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-gray-400">Vision Score</span>
                  <span class="font-semibold text-yellow-400">{{ selectedPlayer.visionScore }}</span>
                </div>
              </div>
            </div>

            <!-- Global Stats (Per Minute) -->
            <div class="bg-gray-800 rounded-xl p-5">
              <h3 class="text-sm font-semibold text-gray-400 mb-4 flex items-center gap-2">
                <Zap class="w-4 h-4" />
                Per Minute Stats
              </h3>
              <div class="space-y-3">
                <div class="flex justify-between items-center">
                  <span class="text-gray-400">CS/min</span>
                  <span class="font-semibold">{{ selectedPlayer.csPerMin }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-gray-400">Vision/min</span>
                  <span class="font-semibold">{{ selectedPlayer.visionPerMin }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-gray-400">Damage/min</span>
                  <span class="font-semibold text-orange-400">{{ selectedPlayer.damagePerMin }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-gray-400">Gold/min</span>
                  <span class="font-semibold text-yellow-400">{{ selectedPlayer.goldPerMin }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Build Order -->
          <div v-if="selectedPlayer" class="bg-gray-800 rounded-xl p-5">
            <h3 class="text-sm font-semibold text-gray-400 mb-4">Build Order</h3>
            <div class="flex flex-wrap gap-4">
              <div 
                v-for="(item, idx) in selectedPlayer.buildOrder" 
                :key="idx"
                class="flex flex-col items-center gap-1"
              >
                <img
                  :src="getItemIcon(item.itemId)"
                  class="w-10 h-10 rounded border border-gray-600"
                />
                <span class="text-xs text-gray-500">{{ formatTime(item.time) }}</span>
              </div>
            </div>
          </div>

          <!-- Skill Order -->
          <div v-if="selectedPlayer" class="bg-gray-800 rounded-xl p-5">
            <h3 class="text-sm font-semibold text-gray-400 mb-4">Skill Order</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr>
                    <th class="w-12 text-left text-gray-500 pb-2">Skill</th>
                    <th 
                      v-for="level in 18" 
                      :key="level" 
                      class="w-8 text-center text-gray-500 pb-2"
                    >
                      {{ level }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(skillLevels, skillIdx) in selectedPlayer.skillOrder" :key="skillIdx">
                    <td class="py-1 font-semibold" :class="[
                      skillIdx === 0 ? 'text-blue-400' :
                      skillIdx === 1 ? 'text-green-400' :
                      skillIdx === 2 ? 'text-yellow-400' : 'text-purple-400'
                    ]">
                      {{ ['Q', 'W', 'E', 'R'][skillIdx] }}
                    </td>
                    <td 
                      v-for="level in 18" 
                      :key="level"
                      class="text-center py-1"
                    >
                      <div 
                        v-if="skillLevels.includes(level)"
                        :class="[
                          'w-6 h-6 rounded flex items-center justify-center text-xs font-bold mx-auto',
                          skillIdx === 0 ? 'bg-blue-600' :
                          skillIdx === 1 ? 'bg-green-600' :
                          skillIdx === 2 ? 'bg-yellow-600' : 'bg-purple-600'
                        ]"
                      >
                        {{ skillLevels.filter(l => l <= level).length }}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Action Footer: Spells & Pings -->
          <div v-if="selectedPlayer" class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Spells Casted -->
            <div class="bg-gray-800 rounded-xl p-5">
              <h3 class="text-sm font-semibold text-gray-400 mb-4">Spells Casted</h3>
              <div class="grid grid-cols-6 gap-3">
                <div 
                  v-for="(count, spell) in selectedPlayer.spellsCast" 
                  :key="spell"
                  class="text-center"
                >
                  <div :class="[
                    'w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-1 font-bold',
                    spell === 'Q' ? 'bg-blue-600' :
                    spell === 'W' ? 'bg-green-600' :
                    spell === 'E' ? 'bg-yellow-600' :
                    spell === 'R' ? 'bg-purple-600' :
                    spell === 'D' ? 'bg-teal-600' : 'bg-orange-600'
                  ]">
                    {{ spell }}
                  </div>
                  <span class="text-sm font-semibold">{{ count }}</span>
                </div>
              </div>
            </div>

            <!-- Pings -->
            <div class="bg-gray-800 rounded-xl p-5">
              <h3 class="text-sm font-semibold text-gray-400 mb-4">Pings</h3>
              <div class="grid grid-cols-3 gap-3 text-sm">
                <div class="flex justify-between items-center bg-gray-700/50 px-3 py-2 rounded">
                  <span class="text-gray-400">On My Way</span>
                  <span class="font-semibold">{{ selectedPlayer.pings.onMyWay }}</span>
                </div>
                <div class="flex justify-between items-center bg-gray-700/50 px-3 py-2 rounded">
                  <span class="text-gray-400">Missing</span>
                  <span class="font-semibold">{{ selectedPlayer.pings.missing }}</span>
                </div>
                <div class="flex justify-between items-center bg-gray-700/50 px-3 py-2 rounded">
                  <span class="text-gray-400">Danger</span>
                  <span class="font-semibold">{{ selectedPlayer.pings.danger }}</span>
                </div>
                <div class="flex justify-between items-center bg-gray-700/50 px-3 py-2 rounded">
                  <span class="text-gray-400">Assist</span>
                  <span class="font-semibold">{{ selectedPlayer.pings.assist }}</span>
                </div>
                <div class="flex justify-between items-center bg-gray-700/50 px-3 py-2 rounded">
                  <span class="text-gray-400">Vision</span>
                  <span class="font-semibold">{{ selectedPlayer.pings.vision }}</span>
                </div>
                <div class="flex justify-between items-center bg-gray-700/50 px-3 py-2 rounded">
                  <span class="text-gray-400">Retreat</span>
                  <span class="font-semibold">{{ selectedPlayer.pings.retreat }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ==================== RUNES TAB ==================== -->
        <div v-if="activeTab === 'runes'" class="space-y-6">
          <!-- Team 1 Runes -->
          <div class="bg-gray-800 rounded-xl overflow-hidden">
            <div class="px-6 py-3 bg-blue-900/30 border-b border-gray-700">
              <span class="font-semibold text-blue-400">Blue Side</span>
            </div>
            <div class="grid grid-cols-5 divide-x divide-gray-700">
              <div 
                v-for="player in match.team1.players" 
                :key="player.puuid"
                class="p-4 flex flex-col items-center"
              >
                <!-- Champion Avatar -->
                <img
                  :src="getChampionIcon(player.championId)"
                  :alt="player.championName"
                  class="w-14 h-14 rounded-lg border-2 border-blue-500 mb-3"
                />
                <span class="text-sm font-semibold mb-3 truncate max-w-full">{{ player.gameName }}</span>
                
                <!-- Keystone -->
                <div class="mb-2">
                  <img
                    :src="getRuneTreeIcon(player.primaryRuneTree)"
                    class="w-12 h-12"
                    title="Keystone"
                  />
                </div>
                
                <!-- Primary Tree (3 runes) -->
                <div class="flex gap-1 mb-2">
                  <div 
                    v-for="i in 3" 
                    :key="i"
                    class="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center"
                  >
                    <img
                      :src="getRuneTreeIcon(player.primaryRuneTree)"
                      class="w-5 h-5 opacity-80"
                    />
                  </div>
                </div>
                
                <!-- Secondary Tree (2 runes) -->
                <div class="flex gap-1 mb-2">
                  <div 
                    v-for="i in 2" 
                    :key="i"
                    class="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center"
                  >
                    <img
                      :src="getRuneTreeIcon(player.secondaryRuneTree)"
                      class="w-5 h-5 opacity-80"
                    />
                  </div>
                </div>
                
                <!-- Stat Shards (3 tiny icons) -->
                <div class="flex gap-1">
                  <div 
                    v-for="i in 3" 
                    :key="i"
                    class="w-5 h-5 rounded bg-gray-600"
                    :class="[
                      i === 1 ? 'bg-red-900/50' : i === 2 ? 'bg-yellow-900/50' : 'bg-green-900/50'
                    ]"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Team 2 Runes -->
          <div class="bg-gray-800 rounded-xl overflow-hidden">
            <div class="px-6 py-3 bg-red-900/30 border-b border-gray-700">
              <span class="font-semibold text-red-400">Red Side</span>
            </div>
            <div class="grid grid-cols-5 divide-x divide-gray-700">
              <div 
                v-for="player in match.team2.players" 
                :key="player.puuid"
                class="p-4 flex flex-col items-center"
              >
                <!-- Champion Avatar -->
                <img
                  :src="getChampionIcon(player.championId)"
                  :alt="player.championName"
                  class="w-14 h-14 rounded-lg border-2 border-red-500 mb-3"
                />
                <span class="text-sm font-semibold mb-3 truncate max-w-full">{{ player.gameName }}</span>
                
                <!-- Keystone -->
                <div class="mb-2">
                  <img
                    :src="getRuneTreeIcon(player.primaryRuneTree)"
                    class="w-12 h-12"
                    title="Keystone"
                  />
                </div>
                
                <!-- Primary Tree (3 runes) -->
                <div class="flex gap-1 mb-2">
                  <div 
                    v-for="i in 3" 
                    :key="i"
                    class="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center"
                  >
                    <img
                      :src="getRuneTreeIcon(player.primaryRuneTree)"
                      class="w-5 h-5 opacity-80"
                    />
                  </div>
                </div>
                
                <!-- Secondary Tree (2 runes) -->
                <div class="flex gap-1 mb-2">
                  <div 
                    v-for="i in 2" 
                    :key="i"
                    class="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center"
                  >
                    <img
                      :src="getRuneTreeIcon(player.secondaryRuneTree)"
                      class="w-5 h-5 opacity-80"
                    />
                  </div>
                </div>
                
                <!-- Stat Shards (3 tiny icons) -->
                <div class="flex gap-1">
                  <div 
                    v-for="i in 3" 
                    :key="i"
                    class="w-5 h-5 rounded bg-gray-600"
                    :class="[
                      i === 1 ? 'bg-red-900/50' : i === 2 ? 'bg-yellow-900/50' : 'bg-green-900/50'
                    ]"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
