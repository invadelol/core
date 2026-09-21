<script setup lang="ts">
import { computed } from 'vue'
import { LineChart } from '../lib/lazy_charts.js'
import { QUEUE_LABELS, TIER_NAMES, rankCrest } from '../lib/assets.js'
import { longDate, shortDate } from '../lib/format.js'
import { lineOptions, palette } from '../lib/chart.js'
import type { Rank, RanksPayload } from '../lib/types.js'

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

/** Solo first, then flex, then anything else that has a tier. */
const queues = computed(() => {
  const order = ['RANKED_SOLO_5x5', 'RANKED_FLEX_SR']
  const current = (props.ranks?.current ?? []).filter((r) => r.tier)
  return [...current].sort((a, b) => {
    const ai = order.indexOf(a.queueType)
    const bi = order.indexOf(b.queueType)
    return (ai === -1 ? 9 : ai) - (bi === -1 ? 9 : bi)
  })
})

function historyFor(queueType: string) {
  return (props.ranks?.history ?? [])
    .filter((r) => r.queueType === queueType && r.tier)
    .sort((a, b) => new Date(a.fetchedAt ?? 0).getTime() - new Date(b.fetchedAt ?? 0).getTime())
}

/** The queue with the most snapshots gets the chart. */
const charted = computed(() => {
  let best: { queueType: string; history: Rank[] } | null = null
  for (const queue of queues.value) {
    const history = historyFor(queue.queueType)
    if (!best || history.length > best.history.length)
      best = { queueType: queue.queueType, history }
  }
  return best && best.history.length > 2 ? best : null
})

const chartData = computed(() => {
  const history = charted.value?.history ?? []
  return {
    labels: history.map((entry) => shortDate(entry.fetchedAt ?? Date.now())),
    datasets: [
      {
        label: 'Rank',
        data: history.map((entry) => ladderLP(entry.tier, entry.division, entry.leaguePoints)),
        borderColor: palette.ink,
        backgroundColor: 'transparent',
        borderWidth: 1.75,
        pointRadius: history.length > 30 ? 0 : 2,
        pointHoverRadius: 4,
        pointBackgroundColor: palette.ink,
        tension: 0.25,
      },
    ],
  }
})

const options = computed(() =>
  lineOptions({
    yFormat: ladderLabel,
    yTicks: 4,
    xTicks: 5,
    tooltipTitle: (items) => {
      const entry = charted.value?.history[items[0]?.dataIndex]
      if (!entry) return ''
      return `${TIER_NAMES[entry.tier] || entry.tier} ${entry.division} · ${entry.leaguePoints} LP`
    },
    tooltipLabel: (ctx) => {
      const entry = charted.value?.history[ctx.dataIndex]
      if (!entry) return ''
      const total = entry.wins + entry.losses
      const wr = total ? Math.round((entry.wins / total) * 100) : 0
      return [`${entry.wins}W ${entry.losses}L · ${wr}%`, longDate(entry.fetchedAt ?? Date.now())]
    },
  })
)

const peak = computed(() => {
  const history = charted.value?.history ?? []
  if (!history.length) return null
  return history.reduce((best, entry) =>
    ladderLP(entry.tier, entry.division, entry.leaguePoints) >
    ladderLP(best.tier, best.division, best.leaguePoints)
      ? entry
      : best
  )
})

function record(rank: Rank) {
  const total = rank.wins + rank.losses
  return { total, winrate: total ? Math.round((rank.wins / total) * 100) : 0 }
}
</script>

<template>
  <section>
    <div class="section" :class="queues.length ? '' : '!mb-0'">
      <h2>Ranked</h2>
      <span v-if="!queues.length" class="meta"> no ranked games recorded for this player </span>
      <span v-else-if="peak" class="meta ml-auto">
        Peak {{ TIER_NAMES[peak.tier] || peak.tier }} {{ peak.division }} ·
        {{ peak.leaguePoints }} LP
      </span>
    </div>

    <div
      v-if="queues.length"
      class="grid items-center gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
    >
      <div class="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <div v-for="rank in queues" :key="rank.queueType" class="flex items-center gap-3">
          <img
            :src="rankCrest(rank.tier)"
            :alt="rank.tier"
            class="h-[52px] w-[52px] shrink-0"
            loading="lazy"
          />
          <div class="min-w-0">
            <div class="label !text-[9.5px]">
              {{ QUEUE_LABELS[rank.queueType] || rank.queueType }}
            </div>
            <div class="mt-0.5 truncate text-[16px] font-semibold tracking-[-0.02em] text-ink">
              {{ TIER_NAMES[rank.tier] || rank.tier }} {{ rank.division }}
            </div>
            <div class="num mt-0.5 text-[11.5px] text-ink-2">
              {{ rank.leaguePoints }} LP
              <span class="text-ink-4">·</span>
              {{ rank.wins }}W {{ rank.losses }}L
              <span :class="record(rank).winrate >= 50 ? 'text-win' : 'text-loss'">
                {{ record(rank).winrate }}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="charted" class="min-w-0">
        <div class="label mb-2 !text-[9.5px]">
          {{ QUEUE_LABELS[charted.queueType] || charted.queueType }} climb ·
          {{ charted.history.length }} snapshots
        </div>
        <div class="h-[110px]">
          <LineChart :data="chartData" :options="options" />
        </div>
      </div>
      <p v-else-if="queues.length" class="text-[11.5px] leading-relaxed text-ink-3">
        Not enough snapshots yet to draw a climb. Check back after a few more days of games.
      </p>
    </div>
  </section>
</template>
