<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Line as LineChart } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { TrendingUp, Trophy } from 'lucide-vue-next'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const props = defineProps<{
  puuid: string
}>()

interface RankEntry {
  queueType: string
  tier: string
  rank: string
  leaguePoints: number
  wins: number
  losses: number
  fetchedAt: string
}

interface RanksData {
  current: RankEntry[]
  history: RankEntry[]
}

const ranks = ref<RanksData | null>(null)
const isLoading = ref(true)
const selectedQueue = ref('RANKED_SOLO_5x5')

// ── Tier / Division constants ─────────────────────────────────────
const TIER_ORDER = [
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'EMERALD',
  'DIAMOND',
  'MASTER',
  'GRANDMASTER',
  'CHALLENGER',
]

const TIER_BASE: Record<string, number> = {
  IRON: 0,
  BRONZE: 400,
  SILVER: 800,
  GOLD: 1200,
  PLATINUM: 1600,
  EMERALD: 2000,
  DIAMOND: 2400,
  MASTER: 2800,
  GRANDMASTER: 2800,
  CHALLENGER: 2800,
}

const DIVISION_OFFSET: Record<string, number> = {
  IV: 0,
  III: 100,
  II: 200,
  I: 300,
}

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

const tierColors: Record<string, string> = {
  IRON: '#6b7280',
  BRONZE: '#b45309',
  SILVER: '#9ca3af',
  GOLD: '#eab308',
  PLATINUM: '#06b6d4',
  EMERALD: '#10b981',
  DIAMOND: '#6366f1',
  MASTER: '#a855f7',
  GRANDMASTER: '#ef4444',
  CHALLENGER: '#f59e0b',
}

const queueNames: Record<string, string> = {
  RANKED_SOLO_5x5: 'Solo/Duo',
  RANKED_FLEX_SR: 'Flex',
}

// ── Total LP calculation ──────────────────────────────────────────
function calculateTotalLP(tier: string, division: string, lp: number): number {
  const base = TIER_BASE[tier] ?? 0
  // Master, Grandmaster, Challenger have no divisions
  if (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier)) {
    return base + (lp || 0)
  }
  const divOffset = DIVISION_OFFSET[division] ?? 0
  return base + divOffset + (lp || 0)
}

// ── Y-axis tick label from total LP ──────────────────────────────
function totalLPToLabel(totalLP: number): string {
  for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
    const tier = TIER_ORDER[i]
    const base = TIER_BASE[tier]
    if (totalLP >= base) {
      if (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier)) {
        return `${tierNames[tier]} ${totalLP - base} LP`
      }
      const remaining = totalLP - base
      const divIndex = Math.min(Math.floor(remaining / 100), 3)
      const divisions = ['IV', 'III', 'II', 'I']
      return `${tierNames[tier]} ${divisions[divIndex]}`
    }
  }
  return `${totalLP} LP`
}

// ── Fetch ─────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const res = await fetch(`/api/summoners/puuid/${props.puuid}/ranks`)
    if (res.ok) {
      ranks.value = await res.json()
      // Auto-select the queue that has the most history
      if (ranks.value && ranks.value.history.length > 0) {
        const queueCounts = new Map<string, number>()
        for (const entry of ranks.value.history) {
          queueCounts.set(entry.queueType, (queueCounts.get(entry.queueType) || 0) + 1)
        }
        let maxQueue = 'RANKED_SOLO_5x5'
        let maxCount = 0
        for (const [queue, count] of queueCounts) {
          if (count > maxCount) {
            maxQueue = queue
            maxCount = count
          }
        }
        selectedQueue.value = maxQueue
      }
    }
  } catch (e) {
    console.error('Failed to load rank history:', e)
  } finally {
    isLoading.value = false
  }
})

// ── Filtered & sorted history ─────────────────────────────────────
const filteredHistory = computed(() => {
  if (!ranks.value) return []
  return ranks.value.history
    .filter((r) => r.queueType === selectedQueue.value && r.tier)
    .sort((a, b) => new Date(a.fetchedAt).getTime() - new Date(b.fetchedAt).getTime())
})

// ── Current rank for selected queue ───────────────────────────────
const currentRank = computed(() => {
  if (!ranks.value) return null
  return ranks.value.current.find((r) => r.queueType === selectedQueue.value) || null
})

// ── Available queues ──────────────────────────────────────────────
const availableQueues = computed(() => {
  if (!ranks.value) return []
  const queues = new Set<string>()
  for (const entry of ranks.value.history) {
    if (entry.tier) queues.add(entry.queueType)
  }
  return Array.from(queues)
})

// ── LP change indicator ───────────────────────────────────────────
const lpChange = computed(() => {
  if (filteredHistory.value.length < 2) return null
  const first = filteredHistory.value[0]
  const last = filteredHistory.value[filteredHistory.value.length - 1]
  const firstTotal = calculateTotalLP(first.tier, first.rank, first.leaguePoints)
  const lastTotal = calculateTotalLP(last.tier, last.rank, last.leaguePoints)
  return lastTotal - firstTotal
})

// ── Win rate ──────────────────────────────────────────────────────
function getWinrate(wins: number, losses: number) {
  const total = wins + losses
  if (total === 0) return 0
  return Math.round((wins / total) * 100)
}

// ── Chart data ────────────────────────────────────────────────────
const chartData = computed(() => {
  const history = filteredHistory.value
  if (history.length === 0) return { labels: [], datasets: [] }

  const labels = history.map((entry) => {
    const date = new Date(entry.fetchedAt)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })

  const data = history.map((entry) => calculateTotalLP(entry.tier, entry.rank, entry.leaguePoints))

  // Determine the gradient color based on the latest tier
  const latestTier = history[history.length - 1]?.tier || 'GOLD'
  const lineColor = tierColors[latestTier] || '#3b82f6'

  return {
    labels,
    datasets: [
      {
        label: 'Rank',
        data,
        borderColor: lineColor,
        backgroundColor: lineColor + '18',
        borderWidth: 2.5,
        pointRadius: history.length > 30 ? 0 : 3,
        pointHoverRadius: 6,
        pointBackgroundColor: lineColor,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        tension: 0.35,
        fill: true,
      },
    ],
  }
})

// ── Chart options ─────────────────────────────────────────────────
const chartOptions = computed(() => {
  const history = filteredHistory.value

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#ffffff',
        titleColor: '#111827',
        bodyColor: '#6b7280',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        titleFont: { weight: 'bold' as const, size: 12 },
        bodyFont: { size: 11 },
        displayColors: false,
        callbacks: {
          title: (items: any[]) => {
            const idx = items[0]?.dataIndex
            if (idx == null || !history[idx]) return ''
            const entry = history[idx]
            return `${tierNames[entry.tier] || entry.tier} ${entry.rank}`
          },
          label: (ctx: any) => {
            const idx = ctx.dataIndex
            if (idx == null || !history[idx]) return ''
            const entry = history[idx]
            return `${entry.leaguePoints} LP`
          },
          afterLabel: (ctx: any) => {
            const idx = ctx.dataIndex
            if (idx == null || !history[idx]) return ''
            const entry = history[idx]
            const date = new Date(entry.fetchedAt)
            const dateStr = date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
            return [
              `${entry.wins}W ${entry.losses}L (${getWinrate(entry.wins, entry.losses)}%)`,
              dateStr,
            ]
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        ticks: {
          maxTicksLimit: 8,
          font: { size: 10 },
          color: '#9ca3af',
        },
        grid: { display: false },
      },
      y: {
        display: true,
        ticks: {
          maxTicksLimit: 6,
          font: { size: 10 },
          color: '#9ca3af',
          callback: (value: any) => totalLPToLabel(Number(value)),
        },
        grid: { color: '#f3f4f6' },
      },
    },
  }
})

function getRankIcon(tier: string) {
  const tierLower = tier.toLowerCase()
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/${tierLower}.svg`
}
</script>

<template>
  <div class="bg-white rounded-lg shadow p-4">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <TrendingUp class="w-4 h-4 text-gray-500" />
        <h2 class="text-lg font-semibold">Rank History</h2>
      </div>

      <!-- Queue selector -->
      <div v-if="availableQueues.length > 1" class="flex gap-1">
        <button
          v-for="queue in availableQueues"
          :key="queue"
          @click="selectedQueue = queue"
          class="px-2.5 py-1 text-xs rounded-full font-medium transition-colors"
          :class="
            selectedQueue === queue
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          "
        >
          {{ queueNames[queue] || queue }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="text-center py-8 text-gray-500">Loading rank history...</div>

    <!-- Empty state -->
    <div
      v-else-if="!ranks || filteredHistory.length === 0"
      class="text-center py-8 text-gray-400"
    >
      <Trophy class="w-8 h-8 mx-auto mb-2 opacity-40" />
      <p class="text-sm">No rank history available</p>
    </div>

    <!-- Chart + Current Rank -->
    <div v-else>
      <!-- Current rank summary -->
      <div v-if="currentRank" class="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
        <img
          :src="getRankIcon(currentRank.tier)"
          :alt="currentRank.tier"
          class="w-10 h-10"
        />
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-gray-800 text-sm">
            {{ tierNames[currentRank.tier] || currentRank.tier }} {{ currentRank.rank }}
            <span class="font-normal text-gray-500">· {{ currentRank.leaguePoints }} LP</span>
          </div>
          <div class="text-xs text-gray-500">
            {{ currentRank.wins }}W {{ currentRank.losses }}L
            <span
              :class="
                getWinrate(currentRank.wins, currentRank.losses) >= 50
                  ? 'text-green-600'
                  : 'text-red-500'
              "
            >
              ({{ getWinrate(currentRank.wins, currentRank.losses) }}%)
            </span>
          </div>
        </div>

        <!-- LP change badge -->
        <div v-if="lpChange !== null" class="text-right">
          <div
            class="text-sm font-bold"
            :class="lpChange > 0 ? 'text-green-600' : lpChange < 0 ? 'text-red-500' : 'text-gray-400'"
          >
            {{ lpChange > 0 ? '+' : '' }}{{ lpChange }} LP
          </div>
          <div class="text-[10px] text-gray-400">overall</div>
        </div>
      </div>

      <!-- Chart -->
      <div class="h-48">
        <LineChart :data="chartData" :options="chartOptions" />
      </div>

      <!-- Footer info -->
      <div class="mt-3 text-xs text-gray-400 text-right">
        {{ filteredHistory.length }} data points
      </div>
    </div>
  </div>
</template>
