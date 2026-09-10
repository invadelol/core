<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Line as LineChart } from 'vue-chartjs'
import Card from './ui/Card.vue'
import EmptyState from './ui/EmptyState.vue'
import Segmented from './ui/Segmented.vue'
import { QUEUE_LABELS, TIER_NAMES, rankCrest } from '../lib/ddragon.js'
import { longDate, shortDate } from '../lib/format.js'
import { CHART_COLORS, lineOptions, useChartJs } from '../lib/chart.js'
import type { RanksPayload } from '../lib/types.js'

useChartJs()

const props = defineProps<{ ranks: RanksPayload | null }>()

/* Every tier is 400 LP wide, every division 100, so the whole ladder fits on
   one continuous axis and a promotion reads as a climb, not a reset. */
const TIER_ORDER = [
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'EMERALD',
  'DIAMOND',
  'MASTER',
] as const
const APEX = ['MASTER', 'GRANDMASTER', 'CHALLENGER']
const DIVISIONS = ['IV', 'III', 'II', 'I']

function tierBase(tier: string) {
  if (APEX.includes(tier)) return 2800
  const index = TIER_ORDER.indexOf(tier as (typeof TIER_ORDER)[number])
  return index === -1 ? 0 : index * 400
}

function ladderLP(tier: string, division: string, lp: number) {
  const base = tierBase(tier)
  if (APEX.includes(tier)) return base + (lp || 0)
  return (
    base + (DIVISIONS.indexOf(division) === -1 ? 0 : DIVISIONS.indexOf(division) * 100) + (lp || 0)
  )
}

function ladderLabel(total: number) {
  for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
    const tier = TIER_ORDER[i]
    const base = tierBase(tier)
    if (total < base) continue
    if (APEX.includes(tier)) return `${TIER_NAMES[tier]} ${Math.round(total - base)}`
    return `${TIER_NAMES[tier]} ${DIVISIONS[Math.min(Math.floor((total - base) / 100), 3)]}`
  }
  return `${Math.round(total)}`
}

const selectedQueue = ref('RANKED_SOLO_5x5')

const availableQueues = computed(() => {
  const queues = new Set<string>()
  for (const entry of props.ranks?.history ?? []) if (entry.tier) queues.add(entry.queueType)
  for (const entry of props.ranks?.current ?? []) if (entry.tier) queues.add(entry.queueType)
  return [...queues]
})

const queueOptions = computed(() =>
  availableQueues.value.map((queue) => ({ value: queue, label: QUEUE_LABELS[queue] || queue }))
)

// Land on whichever queue the player actually has a history for.
watch(
  () => props.ranks,
  () => {
    const counts = new Map<string, number>()
    for (const entry of props.ranks?.history ?? []) {
      if (entry.tier) counts.set(entry.queueType, (counts.get(entry.queueType) ?? 0) + 1)
    }
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
    if (best) selectedQueue.value = best[0]
    else if (availableQueues.value.length) selectedQueue.value = availableQueues.value[0]
  },
  { immediate: true }
)

const history = computed(() =>
  (props.ranks?.history ?? [])
    .filter((r) => r.queueType === selectedQueue.value && r.tier)
    .sort((a, b) => new Date(a.fetchedAt ?? 0).getTime() - new Date(b.fetchedAt ?? 0).getTime())
)

const current = computed(
  () => props.ranks?.current.find((r) => r.queueType === selectedQueue.value) ?? null
)

const lpChange = computed(() => {
  if (history.value.length < 2) return null
  const first = history.value[0]
  const last = history.value[history.value.length - 1]
  return Math.round(
    ladderLP(last.tier, last.division, last.leaguePoints) -
      ladderLP(first.tier, first.division, first.leaguePoints)
  )
})

const peak = computed(() => {
  if (!history.value.length) return null
  return history.value.reduce((best, entry) =>
    ladderLP(entry.tier, entry.division, entry.leaguePoints) >
    ladderLP(best.tier, best.division, best.leaguePoints)
      ? entry
      : best
  )
})

const chartData = computed(() => ({
  labels: history.value.map((entry) => shortDate(entry.fetchedAt ?? Date.now())),
  datasets: [
    {
      label: 'Rank',
      data: history.value.map((entry) => ladderLP(entry.tier, entry.division, entry.leaguePoints)),
      borderColor: CHART_COLORS.ink,
      backgroundColor: 'rgba(22, 24, 29, 0.05)',
      borderWidth: 1.75,
      pointRadius: history.value.length > 30 ? 0 : 2,
      pointHoverRadius: 4,
      pointBackgroundColor: CHART_COLORS.ink,
      pointBorderColor: '#fff',
      pointBorderWidth: 1.5,
      tension: 0.25,
      fill: true,
    },
  ],
}))

const options = computed(() =>
  lineOptions({
    yFormat: ladderLabel,
    yTicks: 5,
    xTicks: 6,
    tooltipTitle: (items) => {
      const entry = history.value[items[0]?.dataIndex]
      if (!entry) return ''
      return `${TIER_NAMES[entry.tier] || entry.tier} ${entry.division} · ${entry.leaguePoints} LP`
    },
    tooltipLabel: (ctx) => {
      const entry = history.value[ctx.dataIndex]
      if (!entry) return ''
      const total = entry.wins + entry.losses
      const wr = total ? Math.round((entry.wins / total) * 100) : 0
      return [`${entry.wins}W ${entry.losses}L · ${wr}%`, longDate(entry.fetchedAt ?? Date.now())]
    },
  })
)
</script>

<template>
  <Card title="Rank" :note="history.length ? `${history.length} snapshots` : undefined">
    <template #actions>
      <Segmented v-if="queueOptions.length > 1" v-model="selectedQueue" :options="queueOptions" />
    </template>

    <EmptyState
      v-if="!current && !history.length"
      message="Unranked"
      hint="No ranked games recorded for this player."
    />

    <div v-else class="space-y-4">
      <div v-if="current" class="flex items-center gap-3">
        <img :src="rankCrest(current.tier)" :alt="current.tier" class="h-11 w-11" />
        <div class="min-w-0 flex-1">
          <div class="text-[0.9375rem] font-semibold text-ink">
            {{ TIER_NAMES[current.tier] || current.tier }} {{ current.division }}
            <span class="num font-normal text-ink-2">· {{ current.leaguePoints }} LP</span>
          </div>
          <div class="num text-[0.6875rem] text-ink-3">
            {{ current.wins }}W {{ current.losses }}L
            <span
              :class="
                current.wins / Math.max(1, current.wins + current.losses) >= 0.5
                  ? 'text-pos'
                  : 'text-neg'
              "
            >
              · {{ Math.round((current.wins / Math.max(1, current.wins + current.losses)) * 100) }}%
            </span>
          </div>
        </div>
        <div v-if="lpChange !== null" class="text-right">
          <div
            class="num text-[0.9375rem] font-semibold"
            :class="lpChange > 0 ? 'text-pos' : lpChange < 0 ? 'text-neg' : 'text-ink-3'"
          >
            {{ lpChange > 0 ? '+' : '' }}{{ lpChange }}
          </div>
          <div class="label">LP tracked</div>
        </div>
      </div>

      <template v-if="history.length > 2">
        <div class="h-40">
          <LineChart :data="chartData" :options="options" />
        </div>
        <p v-if="peak" class="text-[0.6875rem] text-ink-3">
          Peak {{ TIER_NAMES[peak.tier] || peak.tier }} {{ peak.division }} ·
          {{ peak.leaguePoints }} LP on {{ longDate(peak.fetchedAt ?? Date.now()) }}
        </p>
      </template>
      <p v-else class="text-[0.6875rem] text-ink-3">
        Not enough snapshots yet to draw a climb — check back after a few more days of games.
      </p>
    </div>
  </Card>
</template>
