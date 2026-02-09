<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { ref, onMounted, computed } from 'vue'
import { Home, ArrowLeft } from 'lucide-vue-next'
import { Line as LineChart, Bar as BarChart } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

import SearchBar from '../components/SearchBar.vue'

const props = defineProps<{
  summoner: string
  matchId: string
}>()

// ── Types ──────────────────────────────────────────────────────────
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
  champLevel: number
  items: number[]
  spells: number[]
  perks: { primary: number; sub: number }
  visionScore: number
  damageTaken: number
  damageDealt: number
  physicalDamageDealt: number
  magicDamageDealt: number
  trueDamageDealt: number
  totalDamageDealtToChampions: number
  physicalDamageDealtToChampions: number
  magicDamageDealtToChampions: number
  trueDamageDealtToChampions: number
  damageDealtToObjectives: number
  damageDealtToTurrets: number
  totalMinionsKilled: number
  neutralMinionsKilled: number
  visionWardsBoughtInGame: number
  position: string
  goldEarned: number
  wardsPlaced: number
  wardsKilled: number
  allInPings: number
  assistPings: number
  commandPings: number
  dangerPings: number
  enemyMissingPings: number
  enemyVisionPings: number
  getBackPings: number
  needVisionPings: number
  onMyWayPings: number
  pushPings: number
  visionClearedPings: number
  baitPings: number
  holdPings: number
}

interface TimelineEntry {
  participantId: number
  puuid: string
  teamId: number
  frameMs: number
  level: number
  xp: number
  goldCurrent: number
  goldTotal: number
  goldPerSec: number
  cs: number
  jungleCs: number
  kills: number
  deaths: number
  assists: number
  posX: number
  posY: number
  timeCc: number
  spells: number[]
  perks: {
    primaryStyle: number
    secondaryStyle: number
    keystone: number
    runes: number[]
    statPerks: { offense: number; flex: number; defense: number }
  }
  skillOrder: number[]
}

interface Match {
  matchId: string
  gameStartMs: number
  duration: number
  queueId: number
  patch: string
  t1Win: number
  t2Win: number
  t1Towers: number
  t2Towers: number
  t1Inhibs: number
  t2Inhibs: number
  t1Dragons: number
  t2Dragons: number
  t1Barons: number
  t2Barons: number
  t1Heralds: number
  t2Heralds: number
  participants: Participant[]
  timeline?: TimelineEntry[]
}

// ── State ──────────────────────────────────────────────────────────
const match = ref<Match | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
const selectedPuuid = ref<string>('')
const activeSection = ref<'overview' | 'timeline' | 'advanced'>('overview')
const runeMap = ref<Record<number, string>>({})

// ── Constants ──────────────────────────────────────────────────────
const DDRAGON_BASE = 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img'
const CDRAGON_BASE =
  'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1'

const queueNames: Record<number, string> = {
  420: 'Ranked Solo/Duo',
  440: 'Ranked Flex',
  400: 'Normal Draft',
  430: 'Normal Blind',
  450: 'ARAM',
  900: 'URF',
}

const positionNames: Record<string, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MIDDLE: 'Mid',
  BOTTOM: 'Bot',
  UTILITY: 'Support',
}

const parsedSummoner = computed(() => {
  const decoded = decodeURIComponent(props.summoner)
  const lastDash = decoded.lastIndexOf('-')
  if (lastDash === -1) return { gameName: decoded, tagLine: 'EUW' }
  return {
    gameName: decoded.substring(0, lastDash),
    tagLine: decoded.substring(lastDash + 1),
  }
})

// ── Fetch ──────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const [runeRes, matchRes] = await Promise.all([
      fetch('https://ddragon.leagueoflegends.com/cdn/14.24.1/data/en_US/runesReforged.json'),
      fetch(`/api/matches/${encodeURIComponent(props.matchId)}`),
    ])

    if (runeRes.ok) {
      const runes = await runeRes.json()
      runes.forEach((style: any) => {
        runeMap.value[style.id] = style.icon
        style.slots.forEach((slot: any) => {
          slot.runes.forEach((rune: any) => {
            runeMap.value[rune.id] = rune.icon
          })
        })
      })
    }

    if (matchRes.ok) {
      match.value = await matchRes.json()
      // Default select the page-owner summoner, fallback to first participant
      const ownerParticipant = match.value?.participants.find((p) => {
        const slug = `${p.gameName}-${p.tagLine}`
        return slug === decodeURIComponent(props.summoner)
      })
      selectedPuuid.value = ownerParticipant?.puuid || match.value?.participants[0]?.puuid || ''
    } else {
      error.value = 'Match not found'
    }
  } catch (e) {
    error.value = 'Failed to load match data'
  } finally {
    isLoading.value = false
  }
})

// ── Computed ───────────────────────────────────────────────────────
const selectedPlayer = computed(() =>
  match.value?.participants.find((p) => p.puuid === selectedPuuid.value) || match.value?.participants[0]
)

const opponent = computed(() => {
  if (!selectedPlayer.value || !match.value) return undefined
  const sameRole = match.value.participants.find(
    (p) => p.teamId !== selectedPlayer.value!.teamId && p.position && p.position === selectedPlayer.value!.position
  )
  return sameRole || match.value.participants.find((p) => p.teamId !== selectedPlayer.value!.teamId)
})

const team100 = computed(() => match.value?.participants.filter((p) => p.teamId === 100) || [])
const team200 = computed(() => match.value?.participants.filter((p) => p.teamId === 200) || [])

const teamOrder = computed(() => {
  if (!match.value) return [100, 200]
  return match.value.t1Win ? [100, 200] : [200, 100]
})

const teamStats = computed(() => {
  if (!match.value) return { 100: { kills: 0, gold: 0, dmg: 0 }, 200: { kills: 0, gold: 0, dmg: 0 } }
  const stats: Record<number, { kills: number; gold: number; dmg: number }> = {
    100: { kills: 0, gold: 0, dmg: 0 },
    200: { kills: 0, gold: 0, dmg: 0 },
  }
  match.value.participants.forEach((p) => {
    stats[p.teamId].kills += p.kills || 0
    stats[p.teamId].gold += p.goldEarned || 0
    stats[p.teamId].dmg += p.totalDamageDealtToChampions || 0
  })
  return stats
})

// Timeline indexed by puuid
const timelineByPuuid = computed<Record<string, TimelineEntry[]>>(() => {
  const map: Record<string, TimelineEntry[]> = {}
  if (!match.value?.timeline) return map
  match.value.timeline.forEach((entry) => {
    const key = entry.puuid || String(entry.participantId)
    if (!map[key]) map[key] = []
    map[key].push(entry)
  })
  Object.values(map).forEach((frames) => frames.sort((a, b) => a.frameMs - b.frameMs))
  return map
})

// Performance scores for all participants
const performanceScores = computed(() => {
  if (!match.value) return {}
  const scores: Record<string, number> = {}
  match.value.participants.forEach((p) => {
    scores[p.puuid] = calcScore(p)
  })
  return scores
})

const mvpPuuid = computed(() => {
  if (!match.value) return null
  const winTeam = match.value.t1Win ? 100 : 200
  const winners = match.value.participants.filter((p) => p.teamId === winTeam)
  const sorted = winners.sort((a, b) => (performanceScores.value[b.puuid] || 0) - (performanceScores.value[a.puuid] || 0))
  return sorted[0]?.puuid ?? null
})

const acePuuid = computed(() => {
  if (!match.value) return null
  const loseTeam = match.value.t1Win ? 200 : 100
  const losers = match.value.participants.filter((p) => p.teamId === loseTeam)
  const sorted = losers.sort((a, b) => (performanceScores.value[b.puuid] || 0) - (performanceScores.value[a.puuid] || 0))
  return sorted[0]?.puuid ?? null
})

// ── Helpers ────────────────────────────────────────────────────────
function calcScore(p: Participant) {
  const minutes = Math.max((match.value?.duration || 1) / 60, 1)
  const kda = (p.kills + p.assists) / Math.max(1, p.deaths)
  const dmgPerMin = (p.damageDealt || 0) / minutes
  const goldPerMin = (p.goldEarned || 0) / minutes
  const visionPerMin = (p.visionScore || 0) / minutes
  const csPerMin = (p.cs || 0) / minutes
  return kda * 18 + dmgPerMin / 140 + goldPerMin / 70 + visionPerMin * 2 + csPerMin * 4
}

function getPerformanceRank(puuid: string) {
  if (!match.value) return 0
  const sorted = [...match.value.participants].sort(
    (a, b) => (performanceScores.value[b.puuid] || 0) - (performanceScores.value[a.puuid] || 0)
  )
  return sorted.findIndex((p) => p.puuid === puuid) + 1
}

function getPerformancePercent(puuid: string) {
  const maxScore = Math.max(...Object.values(performanceScores.value), 1)
  return Math.round(((performanceScores.value[puuid] || 0) / maxScore) * 100)
}

function isTeamWin(teamId: number) {
  if (!match.value) return false
  return teamId === 100 ? Boolean(match.value.t1Win) : Boolean(match.value.t2Win)
}

function getTeamObjectives(teamId: number) {
  if (!match.value) return { barons: 0, dragons: 0, heralds: 0, towers: 0, inhibs: 0 }
  return {
    barons: teamId === 100 ? match.value.t1Barons : match.value.t2Barons,
    dragons: teamId === 100 ? match.value.t1Dragons : match.value.t2Dragons,
    heralds: teamId === 100 ? match.value.t1Heralds : match.value.t2Heralds,
    towers: teamId === 100 ? match.value.t1Towers : match.value.t2Towers,
    inhibs: teamId === 100 ? match.value.t1Inhibs : match.value.t2Inhibs,
  }
}

function getTeam(teamId: number) {
  return teamId === 100 ? team100.value : team200.value
}

function getFrames(puuid: string | undefined) {
  if (!puuid) return []
  return timelineByPuuid.value[puuid] || []
}

function getSkillOrder(puuid: string | undefined) {
  const frames = getFrames(puuid)
  const withSkill = frames.find((f) => Array.isArray(f.skillOrder) && f.skillOrder.length)
  return withSkill?.skillOrder || []
}

function buildSkillMatrix(skillOrder: number[]) {
  const matrix: Record<string, (number | null)[]> = {
    Q: Array.from({ length: 18 }, () => null),
    W: Array.from({ length: 18 }, () => null),
    E: Array.from({ length: 18 }, () => null),
    R: Array.from({ length: 18 }, () => null),
  }
  skillOrder.forEach((slot, index) => {
    const level = index + 1
    const key = slot === 1 ? 'Q' : slot === 2 ? 'W' : slot === 3 ? 'E' : slot === 4 ? 'R' : null
    if (!key || level > 18) return
    matrix[key][level - 1] = level
  })
  return matrix
}

function getRuneData(p: Participant | undefined) {
  if (!p) return { keystone: 0, primaryStyle: 0, secondaryStyle: 0, runes: [] as number[], statPerks: { offense: 0, flex: 0, defense: 0 } }
  const frames = getFrames(p.puuid)
  const earliest = frames[0]
  if (earliest?.perks) {
    return {
      keystone: earliest.perks.keystone,
      primaryStyle: earliest.perks.primaryStyle,
      secondaryStyle: earliest.perks.secondaryStyle,
      runes: Array.isArray(earliest.perks.runes) ? earliest.perks.runes.filter((r) => r > 0) : [],
      statPerks: earliest.perks.statPerks || { offense: 0, flex: 0, defense: 0 },
    }
  }
  return {
    keystone: 0,
    primaryStyle: p.perks.primary || 0,
    secondaryStyle: p.perks.sub || 0,
    runes: [],
    statPerks: { offense: 0, flex: 0, defense: 0 },
  }
}

function formatNumber(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return `${Math.round(value)}`
}

function formatMs(ms: number) {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function timeAgo(ms: number) {
  if (!ms || Number.isNaN(ms)) return 'Unknown'
  const now = Date.now()
  const diff = now - Number(ms)
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  return 'Just now'
}

function formatOrdinal(value: number) {
  const mod10 = value % 10
  const mod100 = value % 100
  if (mod10 === 1 && mod100 !== 11) return `${value}st`
  if (mod10 === 2 && mod100 !== 12) return `${value}nd`
  if (mod10 === 3 && mod100 !== 13) return `${value}rd`
  return `${value}th`
}

function champIcon(id: number) {
  return `${CDRAGON_BASE}/champion-icons/${id}.png`
}
function spellIcon(id: number) {
  return `${CDRAGON_BASE}/summoner-spell-icons/${id}.png`
}
function itemIcon(id: number) {
  return `${DDRAGON_BASE}/item/${id}.png`
}
function runeIcon(id: number) {
  const path = runeMap.value[id]
  if (path) return `https://ddragon.leagueoflegends.com/cdn/img/${path}`
  return `${CDRAGON_BASE}/perks/${id}.png`
}
function runeStyleIcon(id: number) {
  const path = runeMap.value[id]
  if (path) return `https://ddragon.leagueoflegends.com/cdn/img/${path}`
  return `${CDRAGON_BASE}/perkstyles/${id}.png`
}

function getKillParticipation(p: Participant) {
  if (!match.value) return 0
  const teamKills = teamStats.value[p.teamId]?.kills || 1
  return ((p.kills + p.assists) / Math.max(teamKills, 1)) * 100
}

function getDamageShare(p: Participant) {
  if (!match.value) return 0
  const teamDmg = teamStats.value[p.teamId]?.dmg || 1
  return (p.totalDamageDealtToChampions / Math.max(teamDmg, 1)) * 100
}

function getGoldShare(p: Participant) {
  if (!match.value) return 0
  const teamGold = teamStats.value[p.teamId]?.gold || 1
  return (p.goldEarned / Math.max(teamGold, 1)) * 100
}

function minutes() {
  return Math.max((match.value?.duration || 1) / 60, 1)
}

// ── Chart Helpers ──────────────────────────────────────────────────
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#fff',
      titleColor: '#111',
      bodyColor: '#555',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      padding: 8,
      titleFont: { weight: 'bold' as const, size: 11 },
      bodyFont: { size: 11 },
      callbacks: {
        label: (ctx: any) => `${ctx.dataset.label}: ${formatNumber(ctx.parsed.y)}`,
      },
    },
  },
  scales: {
    x: {
      display: true,
      ticks: { maxTicksLimit: 8, font: { size: 10 }, color: '#9ca3af' },
      grid: { display: false },
    },
    y: {
      display: true,
      ticks: {
        maxTicksLimit: 5,
        font: { size: 10 },
        color: '#9ca3af',
        callback: (v: any) => formatNumber(v),
      },
      grid: { color: '#f3f4f6' },
    },
  },
}

const barChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y' as const,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#fff',
      titleColor: '#111',
      bodyColor: '#555',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      callbacks: {
        label: (ctx: any) => formatNumber(ctx.parsed.x),
      },
    },
  },
  scales: {
    x: {
      display: true,
      ticks: { font: { size: 10 }, color: '#9ca3af', callback: (v: any) => formatNumber(v) },
      grid: { color: '#f3f4f6' },
    },
    y: {
      display: true,
      ticks: { font: { size: 10 }, color: '#374151' },
      grid: { display: false },
    },
  },
}

function buildTimelineChart(seriesKey: 'gold' | 'cs' | 'xp', color1: string, color2: string) {
  if (!selectedPlayer.value) return { labels: [], datasets: [] }
  const playerFrames = getFrames(selectedPlayer.value.puuid)
  const oppFrames = getFrames(opponent.value?.puuid)

  const labels = playerFrames.map((f) => formatMs(f.frameMs))
  const getValue = (f: TimelineEntry) => {
    if (seriesKey === 'gold') return f.goldTotal || 0
    if (seriesKey === 'cs') return (f.cs || 0) + (f.jungleCs || 0)
    return f.xp || 0
  }

  return {
    labels,
    datasets: [
      {
        label: selectedPlayer.value.gameName,
        data: playerFrames.map(getValue),
        borderColor: color1,
        backgroundColor: color1 + '15',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.3,
        fill: true,
      },
      {
        label: opponent.value?.gameName || 'Opponent',
        data: oppFrames.map(getValue),
        borderColor: color2,
        backgroundColor: color2 + '10',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.3,
        fill: true,
      },
    ],
  }
}

function buildGoldDiffChart() {
  if (!selectedPlayer.value || !opponent.value) return { labels: [], datasets: [] }
  const playerFrames = getFrames(selectedPlayer.value.puuid)
  const oppFrames = getFrames(opponent.value.puuid)

  const labels = playerFrames.map((f) => formatMs(f.frameMs))
  const diffs = playerFrames.map((f, i) => {
    const oppGold = oppFrames[i]?.goldTotal || 0
    return (f.goldTotal || 0) - oppGold
  })

  return {
    labels,
    datasets: [
      {
        label: 'Gold Advantage',
        data: diffs,
        borderColor: '#3b82f6',
        backgroundColor: diffs.map((d) => (d >= 0 ? '#3b82f620' : '#ef444420')),
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.3,
        fill: true,
        segment: {
          borderColor: (ctx: any) => (ctx.p0.parsed.y >= 0 ? '#3b82f6' : '#ef4444'),
        },
      },
    ],
  }
}

function buildTeamDamageChart(teamId: number) {
  const team = getTeam(teamId)
  return {
    labels: team.map((p) => p.gameName),
    datasets: [
      {
        label: 'Damage to Champions',
        data: team.map((p) => p.totalDamageDealtToChampions),
        backgroundColor: teamId === 100 ? '#3b82f680' : '#ef444480',
        borderColor: teamId === 100 ? '#3b82f6' : '#ef4444',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }
}

function buildTeamGoldChart(teamId: number) {
  const team = getTeam(teamId)
  return {
    labels: team.map((p) => p.gameName),
    datasets: [
      {
        label: 'Gold Earned',
        data: team.map((p) => p.goldEarned),
        backgroundColor: '#f59e0b80',
        borderColor: '#f59e0b',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }
}

// Team gold over time
function buildTeamGoldTimelineChart() {
  if (!match.value?.timeline?.length) return { labels: [], datasets: [] }

  const team100Puuids = new Set(team100.value.map((p) => p.puuid))
  const team200Puuids = new Set(team200.value.map((p) => p.puuid))

  // Get unique frame timestamps
  const frameTimestamps = [...new Set(match.value.timeline.map((e) => e.frameMs))].sort((a, b) => a - b)

  const t100Gold: number[] = []
  const t200Gold: number[] = []

  frameTimestamps.forEach((ts) => {
    let gold100 = 0
    let gold200 = 0
    match.value!.timeline!.forEach((entry) => {
      if (entry.frameMs === ts) {
        if (team100Puuids.has(entry.puuid)) gold100 += entry.goldTotal || 0
        else if (team200Puuids.has(entry.puuid)) gold200 += entry.goldTotal || 0
      }
    })
    t100Gold.push(gold100)
    t200Gold.push(gold200)
  })

  return {
    labels: frameTimestamps.map((t) => formatMs(t)),
    datasets: [
      {
        label: 'Blue Team',
        data: t100Gold,
        borderColor: '#3b82f6',
        backgroundColor: '#3b82f615',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        fill: true,
      },
      {
        label: 'Red Team',
        data: t200Gold,
        borderColor: '#ef4444',
        backgroundColor: '#ef444415',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        fill: true,
      },
    ],
  }
}

function getTotalPings(p: Participant) {
  return (p.allInPings || 0) + (p.assistPings || 0) + (p.commandPings || 0) +
    (p.dangerPings || 0) + (p.enemyMissingPings || 0) + (p.enemyVisionPings || 0) +
    (p.getBackPings || 0) + (p.needVisionPings || 0) + (p.onMyWayPings || 0) +
    (p.pushPings || 0) + (p.visionClearedPings || 0) + (p.baitPings || 0) + (p.holdPings || 0)
}
</script>

<template>
  <Head :title="`Match ${matchId} - ${parsedSummoner.gameName}`" />

  <div class="min-h-screen bg-gray-100">
    <!-- Header -->
    <header class="bg-white shadow-sm">
      <div class="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
        <a href="/" class="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Home">
          <Home class="w-5 h-5 text-gray-700" />
        </a>
        <a
          :href="`/${encodeURIComponent(props.summoner)}`"
          class="p-2 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-1 text-sm text-gray-600"
        >
          <ArrowLeft class="w-4 h-4" />
          {{ parsedSummoner.gameName }}
        </a>
        <div class="flex-1 max-w-md">
          <SearchBar />
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 py-6">
      <!-- Loading -->
      <div v-if="isLoading" class="text-center py-16">
        <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-500">Loading match data...</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="text-center py-16">
        <p class="text-red-500 text-lg mb-4">{{ error }}</p>
        <a :href="`/${encodeURIComponent(props.summoner)}`" class="text-blue-600 hover:underline">← Back to profile</a>
      </div>

      <!-- Match Data -->
      <div v-else-if="match">
        <!-- ═══════════════ Match Header ═══════════════ -->
        <div class="bg-white rounded-lg shadow p-6 mb-6">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div class="flex items-center gap-3 mb-2">
                <span
                  class="text-2xl font-bold"
                  :class="selectedPlayer?.win ? 'text-blue-600' : 'text-red-600'"
                >
                  {{ selectedPlayer?.win ? 'Victory' : 'Defeat' }}
                </span>
                <span class="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                  {{ queueNames[match.queueId] || 'Custom' }}
                </span>
                <span class="text-xs text-gray-400">Patch {{ match.patch }}</span>
              </div>
              <div class="flex items-center gap-4 text-sm text-gray-500">
                <span>{{ formatDuration(match.duration) }}</span>
                <span>{{ timeAgo(match.gameStartMs) }}</span>
                <span class="font-mono text-xs text-gray-400">{{ match.matchId }}</span>
              </div>
            </div>

            <!-- Team Score Summary -->
            <div class="flex items-center gap-6 text-center">
              <div>
                <div class="text-2xl font-bold" :class="match.t1Win ? 'text-blue-600' : 'text-gray-400'">
                  {{ teamStats[100].kills }}
                </div>
                <div class="text-xs text-gray-500">Blue</div>
              </div>
              <div class="text-gray-300 text-lg font-bold">vs</div>
              <div>
                <div class="text-2xl font-bold" :class="match.t2Win ? 'text-red-600' : 'text-gray-400'">
                  {{ teamStats[200].kills }}
                </div>
                <div class="text-xs text-gray-500">Red</div>
              </div>
            </div>
          </div>

          <!-- Objectives Row -->
          <div class="mt-4 grid grid-cols-2 gap-4">
            <div v-for="teamId in [100, 200]" :key="teamId" class="flex items-center gap-4 text-xs text-gray-500">
              <span class="font-bold" :class="teamId === 100 ? 'text-blue-600' : 'text-red-600'">
                {{ teamId === 100 ? 'Blue' : 'Red' }}
              </span>
              <span title="Towers">T {{ getTeamObjectives(teamId).towers }}</span>
              <span title="Dragons">D {{ getTeamObjectives(teamId).dragons }}</span>
              <span title="Barons">B {{ getTeamObjectives(teamId).barons }}</span>
              <span title="Heralds">H {{ getTeamObjectives(teamId).heralds }}</span>
              <span title="Inhibitors">I {{ getTeamObjectives(teamId).inhibs }}</span>
              <span class="font-medium text-gray-700">{{ formatNumber(teamStats[teamId].gold) }}g</span>
            </div>
          </div>
        </div>

        <!-- ═══════════════ Section Tabs ═══════════════ -->
        <div class="flex gap-2 mb-6 overflow-x-auto pb-1">
          <button
            v-for="section in (['overview', 'timeline', 'advanced'] as const)"
            :key="section"
            @click="activeSection = section"
            class="px-5 py-2.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap"
            :class="activeSection === section ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'"
          >
            {{ section === 'overview' ? 'Overview' : section === 'timeline' ? 'Timeline & Charts' : 'Advanced Stats' }}
          </button>
        </div>

        <!-- ═══════════════ OVERVIEW SECTION ═══════════════ -->
        <div v-if="activeSection === 'overview'">
          <!-- Player Selector Strip -->
          <div class="bg-white rounded-lg shadow p-4 mb-6">
            <div class="flex items-center gap-4 flex-wrap">
              <span class="text-sm font-bold text-gray-500">Focus Player:</span>
              <div class="flex gap-2">
                <button
                  v-for="p in team100"
                  :key="p.puuid"
                  @click="selectedPuuid = p.puuid"
                  :class="[
                    'p-1 rounded-lg transition-all',
                    selectedPuuid === p.puuid ? 'bg-blue-100 ring-2 ring-blue-500 scale-110' : 'hover:bg-gray-100'
                  ]"
                >
                  <img :src="champIcon(p.championId)" class="w-8 h-8 rounded-md" :title="p.gameName" />
                </button>
              </div>
              <div class="text-gray-300 font-bold">vs</div>
              <div class="flex gap-2">
                <button
                  v-for="p in team200"
                  :key="p.puuid"
                  @click="selectedPuuid = p.puuid"
                  :class="[
                    'p-1 rounded-lg transition-all',
                    selectedPuuid === p.puuid ? 'bg-red-100 ring-2 ring-red-500 scale-110' : 'hover:bg-gray-100'
                  ]"
                >
                  <img :src="champIcon(p.championId)" class="w-8 h-8 rounded-md" :title="p.gameName" />
                </button>
              </div>
            </div>
          </div>

          <!-- Selected Player Summary -->
          <div v-if="selectedPlayer" class="bg-white rounded-lg shadow p-6 mb-6">
            <div class="flex items-center gap-5">
              <div class="relative flex-shrink-0">
                <img :src="champIcon(selectedPlayer.championId)" class="w-20 h-20 rounded-xl shadow" />
                <div
                  class="absolute -bottom-1 -right-1 w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold text-white border-2 border-white"
                  :class="selectedPlayer.win ? 'bg-blue-500' : 'bg-red-500'"
                >
                  {{ selectedPlayer.champLevel }}
                </div>
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-1">
                  <h2 class="text-xl font-bold text-gray-900">{{ selectedPlayer.gameName }}</h2>
                  <span class="text-gray-400">#{{ selectedPlayer.tagLine }}</span>
                  <span
                    v-if="selectedPlayer.puuid === mvpPuuid"
                    class="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full"
                  >
                    MVP
                  </span>
                  <span
                    v-if="selectedPlayer.puuid === acePuuid"
                    class="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-full"
                  >
                    ACE
                  </span>
                  <span class="text-xs text-gray-400">
                    {{ formatOrdinal(getPerformanceRank(selectedPlayer.puuid)) }} overall
                  </span>
                </div>
                <div class="flex items-center gap-6 text-sm">
                  <div>
                    <span class="text-2xl font-bold text-gray-900">{{ selectedPlayer.kills }}</span>
                    <span class="text-gray-400"> / </span>
                    <span class="text-2xl font-bold text-red-500">{{ selectedPlayer.deaths }}</span>
                    <span class="text-gray-400"> / </span>
                    <span class="text-2xl font-bold text-gray-900">{{ selectedPlayer.assists }}</span>
                    <span class="ml-2 text-gray-500">
                      {{ ((selectedPlayer.kills + selectedPlayer.assists) / Math.max(1, selectedPlayer.deaths)).toFixed(2) }} KDA
                    </span>
                  </div>
                </div>
                <div class="flex gap-1 mt-2">
                  <img
                    v-for="(itemId, idx) in selectedPlayer.items"
                    :key="idx"
                    v-show="itemId > 0"
                    :src="itemIcon(itemId)"
                    class="w-8 h-8 rounded bg-gray-200"
                  />
                </div>
              </div>

              <!-- Spells & Runes -->
              <div class="flex flex-col items-center gap-2 flex-shrink-0">
                <div class="flex gap-1">
                  <img v-for="s in selectedPlayer.spells" :key="s" :src="spellIcon(s)" class="w-8 h-8 rounded" />
                </div>
                <div class="flex gap-1">
                  <img
                    v-if="getRuneData(selectedPlayer).keystone"
                    :src="runeIcon(getRuneData(selectedPlayer).keystone)"
                    class="w-8 h-8"
                  />
                  <div class="flex flex-col gap-0.5">
                    <img
                      v-if="getRuneData(selectedPlayer).primaryStyle"
                      :src="runeStyleIcon(getRuneData(selectedPlayer).primaryStyle)"
                      class="w-4 h-4"
                    />
                    <img
                      v-if="getRuneData(selectedPlayer).secondaryStyle"
                      :src="runeStyleIcon(getRuneData(selectedPlayer).secondaryStyle)"
                      class="w-4 h-4"
                    />
                  </div>
                </div>
                <div class="text-xs text-gray-500">{{ positionNames[selectedPlayer.position] || selectedPlayer.position || 'N/A' }}</div>
              </div>
            </div>

            <!-- Quick Stats Grid -->
            <div class="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-5">
              <div class="text-center p-2 bg-gray-50 rounded-lg">
                <div class="text-lg font-bold text-gray-800">{{ selectedPlayer.cs }}</div>
                <div class="text-xs text-gray-500">CS ({{ (selectedPlayer.cs / minutes()).toFixed(1) }}/m)</div>
              </div>
              <div class="text-center p-2 bg-gray-50 rounded-lg">
                <div class="text-lg font-bold text-yellow-600">{{ formatNumber(selectedPlayer.goldEarned) }}</div>
                <div class="text-xs text-gray-500">Gold ({{ formatNumber(selectedPlayer.goldEarned / minutes()) }}/m)</div>
              </div>
              <div class="text-center p-2 bg-gray-50 rounded-lg">
                <div class="text-lg font-bold text-orange-600">{{ formatNumber(selectedPlayer.totalDamageDealtToChampions) }}</div>
                <div class="text-xs text-gray-500">Dmg ({{ formatNumber(selectedPlayer.totalDamageDealtToChampions / minutes()) }}/m)</div>
              </div>
              <div class="text-center p-2 bg-gray-50 rounded-lg">
                <div class="text-lg font-bold text-blue-600">{{ selectedPlayer.visionScore }}</div>
                <div class="text-xs text-gray-500">Vision ({{ (selectedPlayer.visionScore / minutes()).toFixed(1) }}/m)</div>
              </div>
              <div class="text-center p-2 bg-gray-50 rounded-lg">
                <div class="text-lg font-bold text-green-600">{{ getKillParticipation(selectedPlayer).toFixed(0) }}%</div>
                <div class="text-xs text-gray-500">Kill Part.</div>
              </div>
              <div class="text-center p-2 bg-gray-50 rounded-lg">
                <div class="text-lg font-bold text-purple-600">{{ getDamageShare(selectedPlayer).toFixed(0) }}%</div>
                <div class="text-xs text-gray-500">Dmg Share</div>
              </div>
            </div>
          </div>

          <!-- Team Tables -->
          <div class="grid gap-6 lg:grid-cols-2 mb-6">
            <div v-for="teamId in teamOrder" :key="teamId" class="space-y-3">
              <div class="flex items-center justify-between px-2">
                <span class="font-bold text-sm" :class="isTeamWin(teamId) ? 'text-blue-600' : 'text-red-600'">
                  {{ isTeamWin(teamId) ? 'Victory' : 'Defeat' }}
                  <span class="text-gray-400 font-normal ml-1">({{ teamId === 100 ? 'Blue' : 'Red' }})</span>
                </span>
                <div class="flex gap-3 text-xs text-gray-500">
                  <span>{{ teamStats[teamId].kills }} Kills</span>
                  <span>{{ formatNumber(teamStats[teamId].gold) }} Gold</span>
                </div>
              </div>

              <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div class="overflow-x-auto">
                  <table class="w-full text-xs">
                    <thead>
                      <tr class="border-b border-gray-100 text-gray-400">
                        <th class="text-left p-2 pl-3 w-36">Player</th>
                        <th class="text-center p-2">KDA</th>
                        <th class="text-center p-2">Dmg</th>
                        <th class="text-center p-2">CS</th>
                        <th class="text-center p-2">Gold</th>
                        <th class="text-center p-2">Vision</th>
                        <th class="text-center p-2">KP%</th>
                        <th class="text-left p-2">Items</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="p in getTeam(teamId)"
                        :key="p.puuid"
                        class="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                        :class="{ 'bg-blue-50/40': p.puuid === selectedPuuid }"
                        @click="selectedPuuid = p.puuid"
                      >
                        <td class="p-2 pl-3">
                          <div class="flex items-center gap-2">
                            <img :src="champIcon(p.championId)" class="w-7 h-7 rounded-md" />
                            <div class="overflow-hidden">
                              <div class="font-bold text-gray-900 truncate flex items-center gap-1">
                                {{ p.gameName }}
                                <span
                                  v-if="p.puuid === mvpPuuid"
                                  class="text-[9px] px-1 bg-yellow-100 text-yellow-700 rounded font-bold"
                                >MVP</span>
                                <span
                                  v-if="p.puuid === acePuuid"
                                  class="text-[9px] px-1 bg-purple-100 text-purple-700 rounded font-bold"
                                >ACE</span>
                              </div>
                              <div class="text-[10px] text-gray-400">{{ positionNames[p.position] || '' }}</div>
                            </div>
                          </div>
                        </td>
                        <td class="text-center p-2">
                          <div class="font-bold">{{ p.kills }}/{{ p.deaths }}/{{ p.assists }}</div>
                          <div class="text-gray-400">{{ ((p.kills + p.assists) / Math.max(1, p.deaths)).toFixed(1) }}</div>
                        </td>
                        <td class="text-center p-2 font-medium">{{ formatNumber(p.totalDamageDealtToChampions) }}</td>
                        <td class="text-center p-2">{{ p.cs }} <span class="text-gray-400">({{ (p.cs / minutes()).toFixed(1) }})</span></td>
                        <td class="text-center p-2 text-yellow-600 font-medium">{{ formatNumber(p.goldEarned) }}</td>
                        <td class="text-center p-2">{{ p.visionScore }}</td>
                        <td class="text-center p-2 font-medium">{{ getKillParticipation(p).toFixed(0) }}%</td>
                        <td class="p-2">
                          <div class="flex gap-0.5">
                            <template v-for="(itemId, idx) in p.items.slice(0, 6)" :key="idx">
                              <img v-if="itemId > 0" :src="itemIcon(itemId)" class="w-5 h-5 rounded bg-gray-100" />
                              <div v-else class="w-5 h-5 rounded bg-gray-100"></div>
                            </template>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <!-- Detailed Stat Cards -->
          <div v-if="selectedPlayer" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
            <!-- Combat -->
            <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <h4 class="font-bold text-sm mb-3 text-gray-700">Combat Stats</h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between"><span class="text-gray-500">Total Damage to Champions</span><span class="font-medium">{{ formatNumber(selectedPlayer.totalDamageDealtToChampions) }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Physical Damage</span><span class="font-medium text-orange-600">{{ formatNumber(selectedPlayer.physicalDamageDealtToChampions) }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Magic Damage</span><span class="font-medium text-blue-600">{{ formatNumber(selectedPlayer.magicDamageDealtToChampions) }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">True Damage</span><span class="font-medium text-gray-600">{{ formatNumber(selectedPlayer.trueDamageDealtToChampions) }}</span></div>
                <div class="flex justify-between border-t border-gray-50 pt-2"><span class="text-gray-500">Damage Taken</span><span class="font-medium">{{ formatNumber(selectedPlayer.damageTaken) }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Damage/min</span><span class="font-medium">{{ formatNumber(selectedPlayer.totalDamageDealtToChampions / minutes()) }}</span></div>
                <!-- Damage bar -->
                <div class="mt-2">
                  <div class="h-2 flex rounded-full overflow-hidden bg-gray-100">
                    <div class="bg-orange-500 h-full" :style="{ width: (selectedPlayer.physicalDamageDealtToChampions / Math.max(selectedPlayer.totalDamageDealtToChampions, 1) * 100) + '%' }"></div>
                    <div class="bg-blue-500 h-full" :style="{ width: (selectedPlayer.magicDamageDealtToChampions / Math.max(selectedPlayer.totalDamageDealtToChampions, 1) * 100) + '%' }"></div>
                    <div class="bg-gray-300 h-full" :style="{ width: (selectedPlayer.trueDamageDealtToChampions / Math.max(selectedPlayer.totalDamageDealtToChampions, 1) * 100) + '%' }"></div>
                  </div>
                  <div class="flex gap-3 text-[10px] mt-1 text-gray-400">
                    <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-orange-500"></span>Physical</span>
                    <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-blue-500"></span>Magic</span>
                    <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-gray-300"></span>True</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Vision & Objectives -->
            <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <h4 class="font-bold text-sm mb-3 text-gray-700">Vision & Objectives</h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between"><span class="text-gray-500">Vision Score</span><span class="font-medium">{{ selectedPlayer.visionScore }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Wards Placed</span><span class="font-medium">{{ selectedPlayer.wardsPlaced }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Wards Killed</span><span class="font-medium">{{ selectedPlayer.wardsKilled }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Control Wards Bought</span><span class="font-medium">{{ selectedPlayer.visionWardsBoughtInGame }}</span></div>
                <div class="flex justify-between border-t border-gray-50 pt-2"><span class="text-gray-500">Damage to Turrets</span><span class="font-medium">{{ formatNumber(selectedPlayer.damageDealtToTurrets) }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Damage to Objectives</span><span class="font-medium">{{ formatNumber(selectedPlayer.damageDealtToObjectives) }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Vision/min</span><span class="font-medium">{{ (selectedPlayer.visionScore / minutes()).toFixed(2) }}</span></div>
              </div>
            </div>

            <!-- Income & CS -->
            <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <h4 class="font-bold text-sm mb-3 text-gray-700">Income & Farming</h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between"><span class="text-gray-500">Gold Earned</span><span class="font-medium text-yellow-600">{{ formatNumber(selectedPlayer.goldEarned) }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Gold/min</span><span class="font-medium">{{ formatNumber(selectedPlayer.goldEarned / minutes()) }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Gold Share</span><span class="font-medium">{{ getGoldShare(selectedPlayer).toFixed(1) }}%</span></div>
                <div class="flex justify-between border-t border-gray-50 pt-2"><span class="text-gray-500">Total CS</span><span class="font-medium">{{ selectedPlayer.cs }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">CS/min</span><span class="font-medium">{{ (selectedPlayer.cs / minutes()).toFixed(1) }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Minions Killed</span><span class="font-medium">{{ selectedPlayer.totalMinionsKilled }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Jungle Monsters</span><span class="font-medium">{{ selectedPlayer.neutralMinionsKilled }}</span></div>
              </div>
            </div>

            <!-- Pings -->
            <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <h4 class="font-bold text-sm mb-3 text-gray-700">Communication (Pings)</h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between"><span class="text-gray-500">Total Pings</span><span class="font-bold">{{ getTotalPings(selectedPlayer) }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Enemy Missing</span><span class="font-medium">{{ selectedPlayer.enemyMissingPings }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">On My Way</span><span class="font-medium">{{ selectedPlayer.onMyWayPings }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Danger</span><span class="font-medium">{{ selectedPlayer.dangerPings }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Assist Me</span><span class="font-medium">{{ selectedPlayer.assistPings }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">All In</span><span class="font-medium">{{ selectedPlayer.allInPings }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Push</span><span class="font-medium">{{ selectedPlayer.pushPings }}</span></div>
              </div>
            </div>

            <!-- Performance Score -->
            <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <h4 class="font-bold text-sm mb-3 text-gray-700">Performance Rating</h4>
              <div class="flex flex-col items-center gap-3">
                <div class="text-5xl font-bold" :class="getPerformancePercent(selectedPlayer.puuid) >= 70 ? 'text-green-600' : getPerformancePercent(selectedPlayer.puuid) >= 40 ? 'text-yellow-600' : 'text-red-500'">
                  {{ getPerformancePercent(selectedPlayer.puuid) }}
                </div>
                <div class="text-sm text-gray-500">Out of 100 (relative to all players)</div>
                <div class="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all"
                    :class="getPerformancePercent(selectedPlayer.puuid) >= 70 ? 'bg-green-500' : getPerformancePercent(selectedPlayer.puuid) >= 40 ? 'bg-yellow-500' : 'bg-red-500'"
                    :style="{ width: getPerformancePercent(selectedPlayer.puuid) + '%' }"
                  ></div>
                </div>
                <div class="text-xs text-gray-400">
                  Rank: {{ formatOrdinal(getPerformanceRank(selectedPlayer.puuid)) }} of 10 players
                </div>
              </div>
            </div>

            <!-- Skill Order -->
            <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <h4 class="font-bold text-sm mb-3 text-gray-700">Skill Order</h4>
              <div class="overflow-x-auto pb-2">
                <div class="grid gap-1 min-w-[300px]">
                  <div
                    v-for="(row, key) in buildSkillMatrix(getSkillOrder(selectedPlayer?.puuid))"
                    :key="key"
                    class="grid grid-cols-[20px_repeat(18,1fr)] gap-1 items-center"
                  >
                    <div class="text-xs font-bold text-gray-500">{{ key }}</div>
                    <div
                      v-for="(level, idx) in row"
                      :key="idx"
                      class="h-5 rounded text-[10px] flex items-center justify-center"
                      :class="level ? (key === 'R' ? 'bg-yellow-100 text-yellow-800 font-bold' : 'bg-blue-50 text-gray-900 font-bold') : 'bg-gray-100 text-gray-300'"
                    >
                      <span v-if="level">{{ level }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Runes Section -->
          <div class="bg-white rounded-lg shadow p-6 mb-6">
            <h3 class="font-bold text-sm mb-4 text-gray-700">Runes Overview</h3>
            <div class="grid gap-6 lg:grid-cols-2">
              <div v-for="teamId in teamOrder" :key="teamId">
                <div class="font-bold text-xs text-gray-400 mb-3 uppercase tracking-wider">{{ teamId === 100 ? 'Blue Team' : 'Red Team' }}</div>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div
                    v-for="p in getTeam(teamId)"
                    :key="p.puuid"
                    class="bg-gray-50 p-3 rounded-xl flex flex-col items-center gap-2 cursor-pointer hover:bg-gray-100 transition-colors"
                    :class="{ 'ring-2 ring-blue-400': p.puuid === selectedPuuid }"
                    @click="selectedPuuid = p.puuid"
                  >
                    <img :src="champIcon(p.championId)" class="w-10 h-10 rounded-lg" />
                    <div class="text-xs font-bold text-gray-700 truncate max-w-full">{{ p.gameName }}</div>
                    <div class="flex gap-1 items-center">
                      <img v-if="getRuneData(p).keystone" :src="runeIcon(getRuneData(p).keystone)" class="w-7 h-7" />
                      <div class="flex flex-col gap-0.5">
                        <img v-if="getRuneData(p).primaryStyle" :src="runeStyleIcon(getRuneData(p).primaryStyle)" class="w-4 h-4" />
                        <img v-if="getRuneData(p).secondaryStyle" :src="runeStyleIcon(getRuneData(p).secondaryStyle)" class="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══════════════ TIMELINE SECTION ═══════════════ -->
        <div v-else-if="activeSection === 'timeline'">
          <div v-if="!match.timeline?.length" class="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            No timeline data available for this match.
          </div>
          <div v-else>
            <!-- Player Selector -->
            <div class="bg-white rounded-lg shadow p-4 mb-6">
              <div class="flex items-center gap-4 flex-wrap">
                <span class="text-sm font-bold text-gray-500">Compare:</span>
                <div class="flex gap-2">
                  <button
                    v-for="p in [...team100, ...team200]"
                    :key="p.puuid"
                    @click="selectedPuuid = p.puuid"
                    :class="[
                      'p-1 rounded-lg transition-all',
                      selectedPuuid === p.puuid
                        ? (p.teamId === 100 ? 'bg-blue-100 ring-2 ring-blue-500' : 'bg-red-100 ring-2 ring-red-500')
                        : 'hover:bg-gray-100'
                    ]"
                  >
                    <img :src="champIcon(p.championId)" class="w-8 h-8 rounded-md" :title="p.gameName" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Timeline Charts Grid -->
            <div class="grid gap-6 lg:grid-cols-2 mb-6">
              <!-- Gold Over Time -->
              <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h4 class="font-bold text-sm mb-1">Gold Over Time</h4>
                <p class="text-xs text-gray-500 mb-3">{{ selectedPlayer?.gameName }} vs {{ opponent?.gameName || 'opponent' }}</p>
                <div class="h-52">
                  <LineChart :data="buildTimelineChart('gold', '#3b82f6', '#ef4444')" :options="chartOptions" />
                </div>
              </div>

              <!-- XP Over Time -->
              <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h4 class="font-bold text-sm mb-1">XP Over Time</h4>
                <p class="text-xs text-gray-500 mb-3">Experience comparison</p>
                <div class="h-52">
                  <LineChart :data="buildTimelineChart('xp', '#8b5cf6', '#9ca3af')" :options="chartOptions" />
                </div>
              </div>

              <!-- CS Over Time -->
              <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h4 class="font-bold text-sm mb-1">CS Over Time</h4>
                <p class="text-xs text-gray-500 mb-3">Farming comparison</p>
                <div class="h-52">
                  <LineChart :data="buildTimelineChart('cs', '#10b981', '#f59e0b')" :options="chartOptions" />
                </div>
              </div>

              <!-- Gold Difference -->
              <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h4 class="font-bold text-sm mb-1">Gold Advantage</h4>
                <p class="text-xs text-gray-500 mb-3">{{ selectedPlayer?.gameName }}'s gold lead/deficit</p>
                <div class="h-52">
                  <LineChart :data="buildGoldDiffChart()" :options="chartOptions" />
                </div>
              </div>

              <!-- Team Gold Over Time -->
              <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 lg:col-span-2">
                <h4 class="font-bold text-sm mb-1">Team Gold Over Time</h4>
                <p class="text-xs text-gray-500 mb-3">Blue vs Red team total gold</p>
                <div class="h-56">
                  <LineChart :data="buildTeamGoldTimelineChart()" :options="chartOptions" />
                </div>
                <div class="flex justify-center gap-6 mt-2 text-xs">
                  <span class="flex items-center gap-1"><span class="w-3 h-1.5 bg-blue-500 rounded"></span> Blue Team</span>
                  <span class="flex items-center gap-1"><span class="w-3 h-1.5 bg-red-500 rounded"></span> Red Team</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══════════════ ADVANCED SECTION ═══════════════ -->
        <div v-else-if="activeSection === 'advanced'">
          <!-- Team Damage Distribution -->
          <div class="grid gap-6 lg:grid-cols-2 mb-6">
            <div v-for="teamId in teamOrder" :key="teamId" class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h4 class="font-bold text-sm mb-1">
                {{ isTeamWin(teamId) ? 'Winners' : 'Losers' }} — Damage to Champions
              </h4>
              <p class="text-xs text-gray-500 mb-3">{{ teamId === 100 ? 'Blue' : 'Red' }} team breakdown</p>
              <div class="h-40">
                <BarChart :data="buildTeamDamageChart(teamId)" :options="barChartOptions" />
              </div>
            </div>
          </div>

          <!-- Team Gold Distribution -->
          <div class="grid gap-6 lg:grid-cols-2 mb-6">
            <div v-for="teamId in teamOrder" :key="teamId" class="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h4 class="font-bold text-sm mb-1">
                {{ isTeamWin(teamId) ? 'Winners' : 'Losers' }} — Gold Earned
              </h4>
              <p class="text-xs text-gray-500 mb-3">{{ teamId === 100 ? 'Blue' : 'Red' }} team gold</p>
              <div class="h-40">
                <BarChart :data="buildTeamGoldChart(teamId)" :options="barChartOptions" />
              </div>
            </div>
          </div>

          <!-- All Players Comparison Table -->
          <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
            <h4 class="font-bold text-sm mb-4 text-gray-700">All Players Comparison</h4>
            <div class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead>
                  <tr class="border-b border-gray-200 text-gray-400">
                    <th class="text-left p-2 pl-3">#</th>
                    <th class="text-left p-2">Player</th>
                    <th class="text-center p-2">Score</th>
                    <th class="text-center p-2">KDA</th>
                    <th class="text-center p-2">Damage</th>
                    <th class="text-center p-2">Dmg/min</th>
                    <th class="text-center p-2">Gold</th>
                    <th class="text-center p-2">Gold/min</th>
                    <th class="text-center p-2">CS</th>
                    <th class="text-center p-2">CS/min</th>
                    <th class="text-center p-2">Vision</th>
                    <th class="text-center p-2">KP%</th>
                    <th class="text-center p-2">Dmg%</th>
                    <th class="text-center p-2">Gold%</th>
                    <th class="text-center p-2">Pings</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(p, idx) in [...match.participants].sort((a, b) => (performanceScores[b.puuid] || 0) - (performanceScores[a.puuid] || 0))"
                    :key="p.puuid"
                    class="border-b border-gray-50 last:border-0 hover:bg-gray-50"
                    :class="{
                      'bg-blue-50/30': p.puuid === selectedPuuid,
                      'border-l-2 border-l-blue-500': p.teamId === 100,
                      'border-l-2 border-l-red-500': p.teamId === 200,
                    }"
                  >
                    <td class="p-2 pl-3 font-bold text-gray-400">{{ idx + 1 }}</td>
                    <td class="p-2">
                      <div class="flex items-center gap-2">
                        <img :src="champIcon(p.championId)" class="w-6 h-6 rounded" />
                        <span class="font-bold text-gray-900 truncate max-w-[80px]">{{ p.gameName }}</span>
                        <span v-if="p.puuid === mvpPuuid" class="text-[8px] px-1 bg-yellow-100 text-yellow-700 rounded font-bold">MVP</span>
                        <span v-if="p.puuid === acePuuid" class="text-[8px] px-1 bg-purple-100 text-purple-700 rounded font-bold">ACE</span>
                      </div>
                    </td>
                    <td class="text-center p-2">
                      <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden inline-block max-w-[40px]">
                        <div
                          class="h-full rounded-full"
                          :class="getPerformancePercent(p.puuid) >= 70 ? 'bg-green-500' : getPerformancePercent(p.puuid) >= 40 ? 'bg-yellow-500' : 'bg-red-500'"
                          :style="{ width: getPerformancePercent(p.puuid) + '%' }"
                        ></div>
                      </div>
                      <div class="text-[10px] text-gray-500">{{ getPerformancePercent(p.puuid) }}</div>
                    </td>
                    <td class="text-center p-2 font-bold">{{ p.kills }}/{{ p.deaths }}/{{ p.assists }}</td>
                    <td class="text-center p-2 font-medium">{{ formatNumber(p.totalDamageDealtToChampions) }}</td>
                    <td class="text-center p-2">{{ formatNumber(p.totalDamageDealtToChampions / minutes()) }}</td>
                    <td class="text-center p-2 text-yellow-600 font-medium">{{ formatNumber(p.goldEarned) }}</td>
                    <td class="text-center p-2">{{ formatNumber(p.goldEarned / minutes()) }}</td>
                    <td class="text-center p-2">{{ p.cs }}</td>
                    <td class="text-center p-2">{{ (p.cs / minutes()).toFixed(1) }}</td>
                    <td class="text-center p-2">{{ p.visionScore }}</td>
                    <td class="text-center p-2">{{ getKillParticipation(p).toFixed(0) }}%</td>
                    <td class="text-center p-2">{{ getDamageShare(p).toFixed(0) }}%</td>
                    <td class="text-center p-2">{{ getGoldShare(p).toFixed(0) }}%</td>
                    <td class="text-center p-2">{{ getTotalPings(p) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Per-Player Advanced Breakdown -->
          <div v-if="selectedPlayer" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
            <!-- Damage Dealt Breakdown -->
            <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <h4 class="font-bold text-sm mb-3 text-gray-700">Damage Dealt (Total)</h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between"><span class="text-gray-500">Physical</span><span class="font-medium text-orange-600">{{ formatNumber(selectedPlayer.physicalDamageDealt) }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Magic</span><span class="font-medium text-blue-600">{{ formatNumber(selectedPlayer.magicDamageDealt) }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">True</span><span class="font-medium text-gray-600">{{ formatNumber(selectedPlayer.trueDamageDealt) }}</span></div>
                <div class="flex justify-between border-t border-gray-50 pt-2"><span class="text-gray-500">To Turrets</span><span class="font-medium">{{ formatNumber(selectedPlayer.damageDealtToTurrets) }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">To Objectives</span><span class="font-medium">{{ formatNumber(selectedPlayer.damageDealtToObjectives) }}</span></div>
              </div>
            </div>

            <!-- All Pings Breakdown -->
            <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <h4 class="font-bold text-sm mb-3 text-gray-700">All Pings</h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between"><span class="text-gray-500">Enemy Missing</span><span class="font-medium">{{ selectedPlayer.enemyMissingPings }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">On My Way</span><span class="font-medium">{{ selectedPlayer.onMyWayPings }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Danger</span><span class="font-medium">{{ selectedPlayer.dangerPings }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Assist Me</span><span class="font-medium">{{ selectedPlayer.assistPings }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">All In</span><span class="font-medium">{{ selectedPlayer.allInPings }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Push</span><span class="font-medium">{{ selectedPlayer.pushPings }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Command</span><span class="font-medium">{{ selectedPlayer.commandPings }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Get Back</span><span class="font-medium">{{ selectedPlayer.getBackPings }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Need Vision</span><span class="font-medium">{{ selectedPlayer.needVisionPings }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Enemy Vision</span><span class="font-medium">{{ selectedPlayer.enemyVisionPings }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Vision Cleared</span><span class="font-medium">{{ selectedPlayer.visionClearedPings }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Bait</span><span class="font-medium">{{ selectedPlayer.baitPings }}</span></div>
                <div class="flex justify-between"><span class="text-gray-500">Hold</span><span class="font-medium">{{ selectedPlayer.holdPings }}</span></div>
              </div>
            </div>

            <!-- Lane Comparison -->
            <div v-if="opponent" class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <h4 class="font-bold text-sm mb-3 text-gray-700">Lane Matchup</h4>
              <div class="flex items-center justify-between mb-3 gap-2">
                <div class="flex items-center gap-2">
                  <img :src="champIcon(selectedPlayer.championId)" class="w-8 h-8 rounded-md" />
                  <span class="text-xs font-bold">{{ selectedPlayer.gameName }}</span>
                </div>
                <span class="text-gray-300 font-bold text-xs">vs</span>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold">{{ opponent.gameName }}</span>
                  <img :src="champIcon(opponent.championId)" class="w-8 h-8 rounded-md" />
                </div>
              </div>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between items-center">
                  <span class="font-medium text-gray-900">{{ selectedPlayer.kills }}/{{ selectedPlayer.deaths }}/{{ selectedPlayer.assists }}</span>
                  <span class="text-gray-400 text-xs">KDA</span>
                  <span class="font-medium text-gray-900">{{ opponent.kills }}/{{ opponent.deaths }}/{{ opponent.assists }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="font-medium">{{ formatNumber(selectedPlayer.totalDamageDealtToChampions) }}</span>
                  <span class="text-gray-400 text-xs">Damage</span>
                  <span class="font-medium">{{ formatNumber(opponent.totalDamageDealtToChampions) }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="font-medium text-yellow-600">{{ formatNumber(selectedPlayer.goldEarned) }}</span>
                  <span class="text-gray-400 text-xs">Gold</span>
                  <span class="font-medium text-yellow-600">{{ formatNumber(opponent.goldEarned) }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="font-medium">{{ selectedPlayer.cs }}</span>
                  <span class="text-gray-400 text-xs">CS</span>
                  <span class="font-medium">{{ opponent.cs }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="font-medium">{{ selectedPlayer.visionScore }}</span>
                  <span class="text-gray-400 text-xs">Vision</span>
                  <span class="font-medium">{{ opponent.visionScore }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </main>
  </div>
</template>
