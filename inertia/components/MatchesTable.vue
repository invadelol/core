<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

const props = defineProps<{
  puuid: string
}>()

type TabKey = 'general' | 'details' | 'runes' | 'insight'

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
  timeline: TimelineEntry[]
}

interface MatchStats {
  teamKills: Record<number, number>
  teamGold: Record<number, number>
  rankByPuuid: Record<string, number>
  scoreByPuuid: Record<string, number>
  overallScoreByPuuid: Record<string, number>
  mvpPuuid: string | null
  acePuuid: string | null
}

const matches = ref<Match[]>([])
const isLoading = ref(true)
const loadingMatchDetails = ref<Record<string, boolean>>({})
const error = ref<string | null>(null)
const expandedMatch = ref<string | null>(null)
const activeTab = ref<Record<string, TabKey>>({})
const selectedPlayer = ref<Record<string, string>>({})
const runeMap = ref<Record<number, string>>({})

const DDRAGON_BASE = 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img'
const CDRAGON_BASE =
  'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1'

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
    // Fetch Runes
    const runeRes = await fetch('https://ddragon.leagueoflegends.com/cdn/14.24.1/data/en_US/runesReforged.json')
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

    const res = await fetch(`/api/summoners/puuid/${props.puuid}/matches?count=15`)
    if (res.ok) {
      matches.value = await res.json()
      matches.value.forEach((m) => {
        activeTab.value[m.matchId] = 'general'
        selectedPlayer.value[m.matchId] = props.puuid
      })
    } else {
      error.value = 'Failed to load matches'
    }
  } catch (err) {
    error.value = 'Failed to load matches'
  } finally {
    isLoading.value = false
  }
})

const timelineIndex = computed<Record<string, Record<string, TimelineEntry[]>>>(() => {
  const byMatch: Record<string, Record<string, TimelineEntry[]>> = {}
  matches.value.forEach((match) => {
    const byPuuid: Record<string, TimelineEntry[]> = {}
    match.timeline.forEach((entry) => {
      const key = entry.puuid || String(entry.participantId)
      if (!byPuuid[key]) byPuuid[key] = []
      byPuuid[key].push(entry)
    })
    Object.values(byPuuid).forEach((frames) => frames.sort((a, b) => a.frameMs - b.frameMs))
    byMatch[match.matchId] = byPuuid
  })
  return byMatch
})

const chartHover = ref<Record<string, number | null>>({})

interface SeriesData {
  values: number[]
  times: number[]
}

interface SeriesBundle {
  gold: SeriesData
  cs: SeriesData
  xp: SeriesData
}

const seriesIndex = computed<Record<string, SeriesBundle>>(() => {
  const map: Record<string, SeriesBundle> = {}
  matches.value.forEach((match) => {
    match.participants.forEach((p) => {
      const frames = getTimelineFrames(match, p)
      const times = frames.map((f) => f.frameMs || 0)
      map[`${match.matchId}:${p.puuid}`] = {
        gold: { values: frames.map((f) => f.goldTotal || 0), times },
        cs: {
          values: frames.map((f) => (f.cs || 0) + (f.jungleCs || 0)),
          times,
        },
        xp: { values: frames.map((f) => f.xp || 0), times },
      }
    })
  })
  return map
})

const matchStats = computed<Record<string, MatchStats>>(() => {
  const out: Record<string, MatchStats> = {}
  matches.value.forEach((match) => {
    const teamKills: Record<number, number> = { 100: 0, 200: 0 }
    const teamGold: Record<number, number> = { 100: 0, 200: 0 }
    const scoreByPuuid: Record<string, number> = {}

    match.participants.forEach((p) => {
      teamKills[p.teamId] = (teamKills[p.teamId] || 0) + (p.kills || 0)
      teamGold[p.teamId] = (teamGold[p.teamId] || 0) + (p.goldEarned || 0)
      scoreByPuuid[p.puuid] = calcScore(p, match)
    })

    const sorted = [...match.participants].sort(
      (a, b) => (scoreByPuuid[b.puuid] || 0) - (scoreByPuuid[a.puuid] || 0)
    )
    const rankByPuuid: Record<string, number> = {}
    const overallScoreByPuuid: Record<string, number> = {}
    const maxScore = Math.max(...sorted.map((p) => scoreByPuuid[p.puuid] || 0), 1)

    sorted.forEach((p, idx) => {
      rankByPuuid[p.puuid] = idx + 1
      overallScoreByPuuid[p.puuid] = Math.round(((scoreByPuuid[p.puuid] || 0) / maxScore) * 100)
    })

    const winningTeam = isTeamWin(match, 100) ? 100 : 200
    const mvp = sorted.find((p) => p.teamId === winningTeam) || null
    const ace = sorted.find((p) => p.teamId !== winningTeam) || null

    out[match.matchId] = {
      teamKills,
      teamGold,
      rankByPuuid,
      scoreByPuuid,
      overallScoreByPuuid,
      mvpPuuid: mvp?.puuid ?? null,
      acePuuid: ace?.puuid ?? null,
    }
  })
  return out
})

async function toggleExpand(matchId: string) {
  if (expandedMatch.value === matchId) {
    expandedMatch.value = null
    return
  }

  const match = matches.value.find((m) => m.matchId === matchId)
  if (match && match.participants.length <= 1) {
    loadingMatchDetails.value[matchId] = true
    try {
      const res = await fetch(`/api/matches/${matchId}`)
      if (res.ok) {
        const details = await res.json()
        Object.assign(match, details)
      }
    } catch (e) {
      console.error('Failed to load match details', e)
    } finally {
      loadingMatchDetails.value[matchId] = false
    }
  }

  expandedMatch.value = matchId
}

function setTab(matchId: string, tab: TabKey) {
  activeTab.value[matchId] = tab
}

function selectPlayer(matchId: string, puuid: string) {
  selectedPlayer.value[matchId] = puuid
}

function getPlayerData(match: Match) {
  return match.participants.find((p) => p.puuid === props.puuid)
}

function getSelectedPlayer(match: Match) {
  const chosen = selectedPlayer.value[match.matchId] || props.puuid
  return match.participants.find((p) => p.puuid === chosen) || match.participants[0]
}

function getTeam(match: Match, teamId: number) {
  return match.participants.filter((p) => p.teamId === teamId)
}

function getTeamOrder(match: Match) {
  return isTeamWin(match, 100) ? [100, 200] : [200, 100]
}

function isTeamWin(match: Match, teamId: number) {
  return teamId === 100 ? Boolean(match.t1Win) : Boolean(match.t2Win)
}

function getTeamObjectives(match: Match, teamId: number) {
  return {
    barons: teamId === 100 ? match.t1Barons : match.t2Barons,
    dragons: teamId === 100 ? match.t1Dragons : match.t2Dragons,
    heralds: teamId === 100 ? match.t1Heralds : match.t2Heralds,
    towers: teamId === 100 ? match.t1Towers : match.t2Towers,
    inhibs: teamId === 100 ? match.t1Inhibs : match.t2Inhibs,
  }
}

/**
 * Returns timeline frames for a player.
 */
function getTimelineFrames(match: Match, participant?: Participant) {
  if (!participant) return []
  return timelineIndex.value[match.matchId]?.[participant.puuid] || []
}

/**
 * Finds the frame closest to a target time.
 */
function getFrameAt(match: Match, participant: Participant | undefined, targetMs: number) {
  const frames = getTimelineFrames(match, participant)
  if (!frames.length) return null
  const found = frames.find((f) => f.frameMs >= targetMs)
  return found || frames[frames.length - 1]
}

function getCsAt(match: Match, participant: Participant | undefined, targetMs: number) {
  const frame = getFrameAt(match, participant, targetMs)
  if (!frame) return null
  return (frame.cs || 0) + (frame.jungleCs || 0)
}

function getGoldAt(match: Match, participant: Participant | undefined, targetMs: number) {
  const frame = getFrameAt(match, participant, targetMs)
  if (!frame) return null
  return frame.goldTotal || 0
}

function getXpAt(match: Match, participant: Participant | undefined, targetMs: number) {
  const frame = getFrameAt(match, participant, targetMs)
  if (!frame) return null
  return frame.xp || 0
}

/**
 * Returns the first available skill order array.
 */
function getSkillOrder(match: Match, participant: Participant | undefined) {
  const frames = getTimelineFrames(match, participant)
  const withSkill = frames.find((f) => Array.isArray(f.skillOrder) && f.skillOrder.length)
  return withSkill?.skillOrder || []
}

/**
 * Builds a 4x18 skill matrix.
 */
function buildSkillMatrix(skillOrder: number[]) {
  const matrix = {
    Q: Array.from({ length: 18 }, () => null as number | null),
    W: Array.from({ length: 18 }, () => null as number | null),
    E: Array.from({ length: 18 }, () => null as number | null),
    R: Array.from({ length: 18 }, () => null as number | null),
  }
  skillOrder.forEach((slot, index) => {
    const level = index + 1
    const key = slot === 1 ? 'Q' : slot === 2 ? 'W' : slot === 3 ? 'E' : slot === 4 ? 'R' : null
    if (!key || level > 18) return
    matrix[key][level - 1] = level
  })
  return matrix
}

/**
 * Uses timeline rune data when available, with match snapshot fallback.
 */
function getRuneData(match: Match, participant: Participant | undefined) {
  const frames = getTimelineFrames(match, participant)
  const earliest = frames[0]
  if (earliest?.perks) {
    return {
      keystone: earliest.perks.keystone,
      primaryStyle: earliest.perks.primaryStyle,
      secondaryStyle: earliest.perks.secondaryStyle,
      runes: Array.isArray(earliest.perks.runes)
        ? earliest.perks.runes.filter((r) => r > 0)
        : [],
      statPerks: earliest.perks.statPerks || { offense: 0, flex: 0, defense: 0 },
    }
  }
  return {
    keystone: 0,
    primaryStyle: participant?.perks.primary || 0,
    secondaryStyle: participant?.perks.sub || 0,
    runes: [],
    statPerks: { offense: 0, flex: 0, defense: 0 },
  }
}

function getOpponent(match: Match, participant: Participant | undefined) {
  if (!participant) return undefined
  const sameRole = match.participants.find(
    (p) => p.teamId !== participant.teamId && p.position && p.position === participant.position
  )
  return sameRole || match.participants.find((p) => p.teamId !== participant.teamId)
}

function formatOrdinal(value?: number) {
  if (!value) return ''
  const mod10 = value % 10
  const mod100 = value % 100
  if (mod10 === 1 && mod100 !== 11) return `${value}st`
  if (mod10 === 2 && mod100 !== 12) return `${value}nd`
  if (mod10 === 3 && mod100 !== 13) return `${value}rd`
  return `${value}th`
}

function calcScore(participant: Participant, match: Match) {
  const minutes = getMinutes(match, participant)
  const kda = (participant.kills + participant.assists) / Math.max(1, participant.deaths)
  const dmgPerMin = (participant.damageDealt || 0) / minutes
  const goldPerMin = (participant.goldEarned || 0) / minutes
  const visionPerMin = (participant.visionScore || 0) / minutes
  const csPerMin = (participant.cs || 0) / minutes
  return kda * 18 + dmgPerMin / 140 + goldPerMin / 70 + visionPerMin * 2 + csPerMin * 4
}

function getMinutes(match: Match, participant?: Participant) {
  const seconds = match.duration || 0
  return Math.max(seconds / 60, 1)
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

function formatNumber(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return `${Math.round(value)}`
}

function formatDiff(value: number | null) {
  if (value === null) return 'N/A'
  if (value > 0) return `+${formatNumber(value)}`
  if (value < 0) return `${formatNumber(value)}`
  return '0'
}

function toLinePath(values: number[], width = 140, height = 46) {
  if (!values.length) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(max - min, 1)
  const pad = 6
  const step = (width - pad * 2) / Math.max(values.length - 1, 1)
  return values
    .map((value, index) => {
      const x = pad + step * index
      const y = height - pad - ((value - min) / range) * (height - pad * 2)
      return `${index === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join(' ')
}

function champIcon(id: number) {
  return `${CDRAGON_BASE}/champion-icons/${id}.png`
}

function spellIcon(id: number) {
  return `${CDRAGON_BASE}/summoner-spell-icons/${id}.png`
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

function itemIcon(id: number) {
  return `${DDRAGON_BASE}/item/${id}.png`
}

function formatMs(ms: number) {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function getSeries(match: Match, participant: Participant | undefined): SeriesBundle {
  if (!participant) {
    return {
      gold: { values: [], times: [] },
      cs: { values: [], times: [] },
      xp: { values: [], times: [] },
    }
  }
  return (
    seriesIndex.value[`${match.matchId}:${participant.puuid}`] || {
      gold: { values: [], times: [] },
      cs: { values: [], times: [] },
      xp: { values: [], times: [] },
    }
  )
}

function getSeriesStats(values: number[]) {
  if (!values.length) {
    return { min: 0, max: 0, avg: 0, last: 0 }
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length
  return { min, max, avg, last: values[values.length - 1] }
}

function getHoverIndex(event: MouseEvent, length: number) {
  if (!length) return null
  const target = event.currentTarget as SVGElement | null
  if (!target) return null
  const rect = target.getBoundingClientRect()
  const ratio = rect.width ? (event.clientX - rect.left) / rect.width : 0
  const index = Math.round(ratio * (length - 1))
  return Math.min(length - 1, Math.max(0, index))
}

function hoverKey(matchId: string, puuid: string, seriesKey: string) {
  return `${matchId}:${puuid}:${seriesKey}`
}

function setHover(event: MouseEvent, key: string, length: number) {
  chartHover.value[key] = getHoverIndex(event, length)
}

function clearHover(key: string) {
  chartHover.value[key] = null
}

function getHoverValue(series: SeriesData, index: number | null) {
  if (index === null || index === undefined) return null
  return {
    value: series.values[index] ?? 0,
    time: series.times[index] ?? 0,
  }
}
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm overflow-hidden">
    <!-- Header -->
    <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
      <div>
        <h2 class="text-lg font-bold text-gray-900">Match History</h2>
        <p class="text-sm text-gray-500">Recent performance and details</p>
      </div>
      <div class="flex gap-2">
        <span class="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
          {{ matches.length }} games
        </span>
      </div>
    </div>

    <!-- Loading / Error States -->
    <div v-if="isLoading" class="p-8 text-center text-gray-500">Loading matches...</div>
    <div v-else-if="error" class="p-8 text-center text-red-500">{{ error }}</div>
    <div v-else-if="matches.length === 0" class="p-8 text-center text-gray-500">No matches found</div>

    <!-- Match List -->
    <div v-else class="divide-y divide-gray-100">
      <div v-for="match in matches" :key="match.matchId" class="group">
        <!-- Match Summary Row -->
        <button
          class="w-full flex items-stretch text-left hover:bg-gray-50 transition-colors relative"
          @click="toggleExpand(match.matchId)"
        >
          <!-- Win/Loss Indicator Strip -->
          <div
            :class="[
              'w-1.5 flex-shrink-0',
              getPlayerData(match)?.win ? 'bg-blue-500' : 'bg-red-500',
            ]"
          ></div>

          <div class="flex-1 p-4 flex items-center gap-4 overflow-hidden">
            <!-- Champion & Spells -->
            <div class="flex-shrink-0 relative">
              <img
                :src="champIcon(getPlayerData(match)?.championId || 0)"
                class="w-12 h-12 rounded-lg object-cover shadow-sm"
              />
              <div
                class="absolute -bottom-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold text-white border-2 border-white"
                :class="getPlayerData(match)?.win ? 'bg-blue-500' : 'bg-red-500'"
              >
                {{ getPlayerData(match)?.champLevel }}
              </div>
            </div>

            <!-- Game Info -->
            <div class="w-24 flex-shrink-0">
              <div
                class="font-bold text-sm"
                :class="getPlayerData(match)?.win ? 'text-blue-600' : 'text-red-600'"
              >
                {{ getPlayerData(match)?.win ? 'Victory' : 'Defeat' }}
              </div>
              <div class="text-xs text-gray-500">{{ queueNames[match.queueId] || 'Custom' }}</div>
              <div class="text-xs text-gray-400 mt-0.5">{{ timeAgo(match.gameStartMs) }}</div>
            </div>

            <!-- KDA & Stats -->
            <div class="w-28 flex-shrink-0">
              <div class="font-bold text-gray-900 text-sm">
                {{ getPlayerData(match)?.kills }} /
                <span class="text-red-500">{{ getPlayerData(match)?.deaths }}</span> /
                {{ getPlayerData(match)?.assists }}
              </div>
              <div class="text-xs text-gray-500 mt-0.5">
                {{
                  (
                    (getPlayerData(match)?.kills! + getPlayerData(match)?.assists!) /
                    Math.max(1, getPlayerData(match)?.deaths!)
                  ).toFixed(2)
                }}
                KDA
              </div>
            </div>

            <!-- Items -->
            <div class="flex-1 flex items-center gap-1 flex-wrap">
              <template v-for="(itemId, idx) in getPlayerData(match)?.items || []" :key="idx">
                <img
                  v-if="itemId > 0"
                  :src="itemIcon(itemId)"
                  class="w-8 h-8 rounded bg-gray-200"
                />
                <div v-else class="w-8 h-8 rounded bg-gray-100"></div>
              </template>
            </div>

            <!-- CS & Gold -->
            <div class="w-24 flex-shrink-0 text-right hidden sm:block">
              <div class="text-xs text-gray-500">
                <span class="font-medium text-gray-900">{{ getPlayerData(match)?.cs }}</span> CS
              </div>
              <div class="text-xs text-gray-500 mt-0.5">
                {{ formatNumber(getPlayerData(match)?.goldEarned || 0) }} Gold
              </div>
            </div>

            <!-- Expand Icon -->
            <div class="w-8 flex items-center justify-center text-gray-400">
              <svg
                v-if="!loadingMatchDetails[match.matchId]"
                class="w-5 h-5 transform transition-transform duration-200"
                :class="{ 'rotate-180': expandedMatch === match.matchId }"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
              <div
                v-else
                class="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"
              ></div>
            </div>
          </div>
        </button>

        <!-- Expanded Details -->
        <div
          v-if="expandedMatch === match.matchId && !loadingMatchDetails[match.matchId]"
          class="bg-gray-50 border-t border-gray-100 p-4"
        >
          <!-- Tabs -->
          <div class="flex gap-2 mb-4 overflow-x-auto pb-2">
            <button
              v-for="tab in ['general', 'details', 'runes', 'insight']"
              :key="tab"
              @click="setTab(match.matchId, tab as TabKey)"
              class="px-4 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap"
              :class="
                activeTab[match.matchId] === tab
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              "
            >
              {{ tab.charAt(0).toUpperCase() + tab.slice(1) }}
            </button>
          </div>

          <!-- General Tab -->
          <div v-if="activeTab[match.matchId] === 'general'" class="grid gap-6 lg:grid-cols-2">
            <div v-for="teamId in getTeamOrder(match)" :key="teamId" class="space-y-3">
              <div class="flex items-center justify-between px-2">
                <span
                  class="font-bold text-sm"
                  :class="isTeamWin(match, teamId) ? 'text-blue-600' : 'text-red-600'"
                >
                  {{ isTeamWin(match, teamId) ? 'Victory' : 'Defeat' }}
                  <span class="text-gray-400 font-normal ml-1"
                    >({{ teamId === 100 ? 'Blue' : 'Red' }})</span
                  >
                </span>
                <div class="flex gap-2 text-xs text-gray-500">
                  <span title="Barons">B {{ getTeamObjectives(match, teamId).barons }}</span>
                  <span title="Dragons">D {{ getTeamObjectives(match, teamId).dragons }}</span>
                  <span title="Towers">T {{ getTeamObjectives(match, teamId).towers }}</span>
                </div>
              </div>

              <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div
                  v-for="p in getTeam(match, teamId)"
                  :key="p.puuid"
                  class="p-2 flex items-center gap-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                  :class="{ 'bg-blue-50/30': p.puuid === props.puuid }"
                >
                  <img :src="champIcon(p.championId)" class="w-8 h-8 rounded-md" />
                  <div class="w-24 overflow-hidden">
                    <div class="text-xs font-bold text-gray-900 truncate">{{ p.gameName }}</div>
                    <div class="text-[10px] text-gray-500 truncate">#{{ p.tagLine }}</div>
                  </div>
                  <div class="flex-1 flex gap-1">
                    <template v-for="(itemId, idx) in p.items.slice(0, 6)" :key="idx">
                      <img
                        v-if="itemId > 0"
                        :src="itemIcon(itemId)"
                        class="w-6 h-6 rounded bg-gray-100"
                      />
                      <div v-else class="w-6 h-6 rounded bg-gray-100"></div>
                    </template>
                  </div>
                  <div class="text-right w-16">
                    <div class="text-xs font-bold text-gray-900">
                      {{ p.kills }}/{{ p.deaths }}/{{ p.assists }}
                    </div>
                    <div class="text-[10px] text-gray-500">
                      {{ formatNumber(p.damageDealt) }} DMG
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Details Tab -->
          <div v-else-if="activeTab[match.matchId] === 'details'" class="tab-panel">
            <div class="player-strip flex gap-4 mb-4">
              <div class="team-strip flex gap-2">
                <button
                  v-for="p in getTeam(match, 100)"
                  :key="p.puuid"
                  :class="['p-1 rounded-lg transition-colors', selectedPlayer[match.matchId] === p.puuid ? 'bg-blue-100 ring-2 ring-blue-500' : 'hover:bg-gray-100']"
                  @click="selectPlayer(match.matchId, p.puuid)"
                >
                  <img :src="champIcon(p.championId)" class="w-8 h-8 rounded-md" />
                </button>
              </div>
              <div class="vs font-bold text-gray-400 self-center">VS</div>
              <div class="team-strip flex gap-2">
                <button
                  v-for="p in getTeam(match, 200)"
                  :key="p.puuid"
                  :class="['p-1 rounded-lg transition-colors', selectedPlayer[match.matchId] === p.puuid ? 'bg-red-100 ring-2 ring-red-500' : 'hover:bg-gray-100']"
                  @click="selectPlayer(match.matchId, p.puuid)"
                >
                  <img :src="champIcon(p.championId)" class="w-8 h-8 rounded-md" />
                </button>
              </div>
            </div>

            <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <!-- Combat Stats -->
              <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <h4 class="font-bold text-sm mb-3">Combat</h4>
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-500">Total Damage</span>
                    <span class="font-medium">{{ formatNumber(getSelectedPlayer(match).totalDamageDealtToChampions) }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">Physical</span>
                    <span class="font-medium">{{ formatNumber(getSelectedPlayer(match).physicalDamageDealtToChampions) }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">Magic</span>
                    <span class="font-medium">{{ formatNumber(getSelectedPlayer(match).magicDamageDealtToChampions) }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">True</span>
                    <span class="font-medium">{{ formatNumber(getSelectedPlayer(match).trueDamageDealtToChampions) }}</span>
                  </div>
                  <div class="flex justify-between border-t border-gray-50 pt-2 mt-2">
                    <span class="text-gray-500">Damage Taken</span>
                    <span class="font-medium">{{ formatNumber(getSelectedPlayer(match).damageTaken) }}</span>
                  </div>
                </div>
              </div>

              <!-- Vision & Objectives -->
              <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <h4 class="font-bold text-sm mb-3">Vision & Objectives</h4>
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-500">Vision Score</span>
                    <span class="font-medium">{{ getSelectedPlayer(match).visionScore }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">Wards Placed</span>
                    <span class="font-medium">{{ getSelectedPlayer(match).wardsPlaced }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">Wards Killed</span>
                    <span class="font-medium">{{ getSelectedPlayer(match).wardsKilled }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">Control Wards</span>
                    <span class="font-medium">{{ getSelectedPlayer(match).visionWardsBoughtInGame }}</span>
                  </div>
                  <div class="flex justify-between border-t border-gray-50 pt-2 mt-2">
                    <span class="text-gray-500">Dmg to Turrets</span>
                    <span class="font-medium">{{ formatNumber(getSelectedPlayer(match).damageDealtToTurrets) }}</span>
                  </div>
                </div>
              </div>

              <!-- Pings -->
              <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <h4 class="font-bold text-sm mb-3">Pings</h4>
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-500">Enemy Missing</span>
                    <span class="font-medium">{{ getSelectedPlayer(match).enemyMissingPings }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">On My Way</span>
                    <span class="font-medium">{{ getSelectedPlayer(match).onMyWayPings }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">Danger</span>
                    <span class="font-medium">{{ getSelectedPlayer(match).dangerPings }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">Assist Me</span>
                    <span class="font-medium">{{ getSelectedPlayer(match).assistPings }}</span>
                  </div>
                  <div class="flex justify-between border-t border-gray-50 pt-2 mt-2">
                    <span class="text-gray-500">All In</span>
                    <span class="font-medium">{{ getSelectedPlayer(match).allInPings }}</span>
                  </div>
                </div>
              </div>

              <!-- Income & Creeps -->
              <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <h4 class="font-bold text-sm mb-3">Income & Creeps</h4>
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-500">Gold Earned</span>
                    <span class="font-medium text-yellow-600">{{ formatNumber(getSelectedPlayer(match).goldEarned) }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">Minions Killed</span>
                    <span class="font-medium">{{ getSelectedPlayer(match).totalMinionsKilled }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">Jungle Monsters</span>
                    <span class="font-medium">{{ getSelectedPlayer(match).neutralMinionsKilled }}</span>
                  </div>
                  <div class="flex justify-between border-t border-gray-50 pt-2 mt-2">
                    <span class="text-gray-500">CS / Min</span>
                    <span class="font-medium">{{ (getSelectedPlayer(match).cs / getMinutes(match)).toFixed(1) }}</span>
                  </div>
                </div>
              </div>

              <!-- Skill Order (Existing) -->
              <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm md:col-span-2 lg:col-span-3">
                <h4 class="font-bold text-sm mb-3">Skill Order</h4>
                <div class="overflow-x-auto pb-2">
                  <div class="grid gap-1 min-w-[300px]">
                    <div
                      v-for="(row, key) in buildSkillMatrix(getSkillOrder(match, getSelectedPlayer(match)))"
                      :key="key"
                      class="grid grid-cols-[20px_repeat(18,1fr)] gap-1 items-center"
                    >
                      <div class="text-xs font-bold text-gray-500">{{ key }}</div>
                      <div v-for="(level, idx) in row" :key="idx" class="h-4 bg-gray-100 rounded text-[10px] flex items-center justify-center text-gray-400">
                        <span v-if="level" class="text-gray-900 font-bold">{{ level }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Runes Tab -->
          <div v-else-if="activeTab[match.matchId] === 'runes'" class="tab-panel">
            <div class="grid gap-6 lg:grid-cols-2">
              <div v-for="teamId in getTeamOrder(match)" :key="teamId">
                <div class="font-bold text-gray-500 mb-3">{{ teamId === 100 ? 'Blue Team' : 'Red Team' }}</div>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div v-for="p in getTeam(match, teamId)" :key="p.puuid" class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center gap-2">
                    <img :src="champIcon(p.championId)" class="w-10 h-10 rounded-lg" />
                    <div class="flex gap-1">
                      <img
                        v-if="getRuneData(match, p).keystone"
                        :src="runeIcon(getRuneData(match, p).keystone)"
                        class="w-8 h-8"
                      />
                      <div v-else class="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs text-gray-400">?</div>
                      <div class="flex flex-col gap-0.5">
                         <img
                          v-if="getRuneData(match, p).primaryStyle"
                          :src="runeStyleIcon(getRuneData(match, p).primaryStyle)"
                          class="w-4 h-4"
                        />
                        <img
                          v-if="getRuneData(match, p).secondaryStyle"
                          :src="runeStyleIcon(getRuneData(match, p).secondaryStyle)"
                          class="w-4 h-4"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Insight Tab -->
          <div v-else-if="activeTab[match.matchId] === 'insight'" class="tab-panel">
            <div class="grid gap-4 md:grid-cols-2">
              <!-- Gold Advantage Chart -->
              <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div class="mb-4">
                  <h4 class="font-bold text-sm">Gold Advantage</h4>
                  <p class="text-xs text-gray-500">Team gold difference over time</p>
                </div>
                <div
                  class="relative h-32 w-full"
                  @mousemove="(e) => setHover(e, hoverKey(match.matchId, 'gold', 'gold'), getSeries(match, getSelectedPlayer(match)).gold.values.length)"
                  @mouseleave="clearHover(hoverKey(match.matchId, 'gold', 'gold'))"
                >
                  <svg class="w-full h-full" viewBox="0 0 140 46" preserveAspectRatio="none">
                    <path
                      :d="toLinePath(getSeries(match, getSelectedPlayer(match)).gold.values)"
                      class="stroke-blue-500 fill-none stroke-2"
                    />
                    <path
                      :d="toLinePath(getSeries(match, getOpponent(match, getSelectedPlayer(match))).gold.values)"
                      class="stroke-red-500 fill-none stroke-2 opacity-50"
                    />
                  </svg>
                  <div
                    v-if="chartHover[hoverKey(match.matchId, 'gold', 'gold')] !== null"
                    class="absolute top-2 right-2 bg-white border border-gray-200 rounded-lg p-2 shadow-lg text-xs z-10"
                  >
                    <div class="font-bold mb-1">
                      {{
                        formatMs(
                          getHoverValue(
                            getSeries(match, getSelectedPlayer(match)).gold,
                            chartHover[hoverKey(match.matchId, 'gold', 'gold')]
                          )?.time || 0
                        )
                      }}
                    </div>
                    <div class="flex justify-between gap-4 text-gray-500">
                      <span>You</span>
                      <strong class="text-gray-900">{{
                        formatNumber(
                          getHoverValue(
                            getSeries(match, getSelectedPlayer(match)).gold,
                            chartHover[hoverKey(match.matchId, 'gold', 'gold')]
                          )?.value || 0
                        )
                      }}</strong>
                    </div>
                    <div class="flex justify-between gap-4 text-gray-500">
                      <span>Opp</span>
                      <strong class="text-gray-900">{{
                        formatNumber(
                          getHoverValue(
                            getSeries(match, getOpponent(match, getSelectedPlayer(match))).gold,
                            chartHover[hoverKey(match.matchId, 'gold', 'gold')]
                          )?.value || 0
                        )
                      }}</strong>
                    </div>
                  </div>
                </div>
                <div class="flex justify-between text-xs mt-2">
                  <span class="text-blue-500 font-bold">You</span>
                  <span class="text-red-500 font-bold">Opponent</span>
                </div>
              </div>

              <!-- XP Advantage Chart -->
              <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div class="mb-4">
                  <h4 class="font-bold text-sm">XP Advantage</h4>
                  <p class="text-xs text-gray-500">Experience difference over time</p>
                </div>
                <div
                  class="relative h-32 w-full"
                  @mousemove="(e) => setHover(e, hoverKey(match.matchId, 'xp', 'xp'), getSeries(match, getSelectedPlayer(match)).xp.values.length)"
                  @mouseleave="clearHover(hoverKey(match.matchId, 'xp', 'xp'))"
                >
                  <svg class="w-full h-full" viewBox="0 0 140 46" preserveAspectRatio="none">
                    <path
                      :d="toLinePath(getSeries(match, getSelectedPlayer(match)).xp.values)"
                      class="stroke-purple-500 fill-none stroke-2"
                    />
                    <path
                      :d="toLinePath(getSeries(match, getOpponent(match, getSelectedPlayer(match))).xp.values)"
                      class="stroke-gray-400 fill-none stroke-2 opacity-50"
                    />
                  </svg>
                  <div
                    v-if="chartHover[hoverKey(match.matchId, 'xp', 'xp')] !== null"
                    class="absolute top-2 right-2 bg-white border border-gray-200 rounded-lg p-2 shadow-lg text-xs z-10"
                  >
                    <div class="font-bold mb-1">
                      {{
                        formatMs(
                          getHoverValue(
                            getSeries(match, getSelectedPlayer(match)).xp,
                            chartHover[hoverKey(match.matchId, 'xp', 'xp')]
                          )?.time || 0
                        )
                      }}
                    </div>
                    <div class="flex justify-between gap-4 text-gray-500">
                      <span>You</span>
                      <strong class="text-gray-900">{{
                        formatNumber(
                          getHoverValue(
                            getSeries(match, getSelectedPlayer(match)).xp,
                            chartHover[hoverKey(match.matchId, 'xp', 'xp')]
                          )?.value || 0
                        )
                      }}</strong>
                    </div>
                    <div class="flex justify-between gap-4 text-gray-500">
                      <span>Opp</span>
                      <strong class="text-gray-900">{{
                        formatNumber(
                          getHoverValue(
                            getSeries(match, getOpponent(match, getSelectedPlayer(match))).xp,
                            chartHover[hoverKey(match.matchId, 'xp', 'xp')]
                          )?.value || 0
                        )
                      }}</strong>
                    </div>
                  </div>
                </div>
                <div class="flex justify-between text-xs mt-2">
                  <span class="text-purple-500 font-bold">You</span>
                  <span class="text-gray-400 font-bold">Opponent</span>
                </div>
              </div>

              <!-- Damage Distribution -->
              <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div class="mb-4">
                  <h4 class="font-bold text-sm">Damage Distribution</h4>
                  <p class="text-xs text-gray-500">Physical vs Magic vs True</p>
                </div>
                <div class="space-y-3">
                   <!-- You -->
                   <div>
                      <div class="flex justify-between text-xs mb-1">
                        <span class="font-bold text-gray-900">You</span>
                        <span class="text-gray-500">{{ formatNumber(getSelectedPlayer(match).totalDamageDealtToChampions) }}</span>
                      </div>
                      <div class="h-2.5 flex rounded-full overflow-hidden w-full bg-gray-100">
                        <div class="bg-orange-500 h-full" :style="{ width: (getSelectedPlayer(match).physicalDamageDealtToChampions / getSelectedPlayer(match).totalDamageDealtToChampions * 100) + '%' }"></div>
                        <div class="bg-blue-500 h-full" :style="{ width: (getSelectedPlayer(match).magicDamageDealtToChampions / getSelectedPlayer(match).totalDamageDealtToChampions * 100) + '%' }"></div>
                        <div class="bg-white border border-gray-200 h-full" :style="{ width: (getSelectedPlayer(match).trueDamageDealtToChampions / getSelectedPlayer(match).totalDamageDealtToChampions * 100) + '%' }"></div>
                      </div>
                   </div>
                   <!-- Opponent -->
                   <div v-if="getOpponent(match, getSelectedPlayer(match))">
                      <div class="flex justify-between text-xs mb-1">
                        <span class="font-bold text-gray-900">Opponent</span>
                        <span class="text-gray-500">{{ formatNumber(getOpponent(match, getSelectedPlayer(match))!.totalDamageDealtToChampions) }}</span>
                      </div>
                      <div class="h-2.5 flex rounded-full overflow-hidden w-full bg-gray-100">
                        <div class="bg-orange-500 h-full" :style="{ width: (getOpponent(match, getSelectedPlayer(match))!.physicalDamageDealtToChampions / getOpponent(match, getSelectedPlayer(match))!.totalDamageDealtToChampions * 100) + '%' }"></div>
                        <div class="bg-blue-500 h-full" :style="{ width: (getOpponent(match, getSelectedPlayer(match))!.magicDamageDealtToChampions / getOpponent(match, getSelectedPlayer(match))!.totalDamageDealtToChampions * 100) + '%' }"></div>
                        <div class="bg-white border border-gray-200 h-full" :style="{ width: (getOpponent(match, getSelectedPlayer(match))!.trueDamageDealtToChampions / getOpponent(match, getSelectedPlayer(match))!.totalDamageDealtToChampions * 100) + '%' }"></div>
                      </div>
                   </div>
                </div>
                <div class="flex gap-3 text-[10px] mt-3 justify-center text-gray-500">
                  <div class="flex items-center gap-1"><div class="w-2 h-2 rounded-full bg-orange-500"></div> Physical</div>
                  <div class="flex items-center gap-1"><div class="w-2 h-2 rounded-full bg-blue-500"></div> Magic</div>
                  <div class="flex items-center gap-1"><div class="w-2 h-2 rounded-full bg-white border border-gray-300"></div> True</div>
                </div>
              </div>

              <!-- CS / Min (Existing) -->
              <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div class="mb-4">
                  <h4 class="font-bold text-sm">CS / Min</h4>
                  <p class="text-xs text-gray-500">Farming performance vs opponent</p>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <div class="text-xs text-gray-500 mb-1">You</div>
                    <div class="space-y-1">
                      <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          class="h-full bg-blue-500"
                          :style="{
                            width:
                              Math.min(
                                (getSeriesStats(getSeries(match, getSelectedPlayer(match)).cs.values).avg / 12) *
                                  100,
                                100
                              ) + '%',
                          }"
                        ></div>
                      </div>
                      <div class="text-right text-xs font-bold text-gray-900">
                        {{
                          getSeriesStats(getSeries(match, getSelectedPlayer(match)).cs.values).avg.toFixed(1)
                        }}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div class="text-xs text-gray-500 mb-1">Opponent</div>
                    <div class="space-y-1">
                      <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          class="h-full bg-red-500"
                          :style="{
                            width:
                              Math.min(
                                (getSeriesStats(
                                  getSeries(match, getOpponent(match, getSelectedPlayer(match))).cs.values
                                ).avg /
                                  12) *
                                  100,
                                100
                              ) + '%',
                          }"
                        ></div>
                      </div>
                      <div class="text-right text-xs font-bold text-gray-900">
                        {{
                          getSeriesStats(
                            getSeries(match, getOpponent(match, getSelectedPlayer(match))).cs.values
                          ).avg.toFixed(1)
                        }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom scrollbar for tabs */
.overflow-x-auto::-webkit-scrollbar {
  height: 4px;
}
.overflow-x-auto::-webkit-scrollbar-track {
  background: transparent;
}
.overflow-x-auto::-webkit-scrollbar-thumb {
  background-color: #e5e7eb;
  border-radius: 20px;
}
</style>
