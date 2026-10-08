<script setup lang="ts">
import { computed } from 'vue'
import { LineChart } from '../lib/lazy_charts.js'
import { QUEUE_LABELS, TIER_NAMES, rankCrest, rankName, tierColor } from '../lib/assets.js'
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
        borderColor: palette.accent,
        backgroundColor: palette.accentFill,
        fill: 'start',
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 3,
        pointBackgroundColor: palette.accent,
        tension: 0,
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
      return `${rankName(entry.tier, entry.division)} · ${entry.leaguePoints} LP`
    },
    tooltipLabel: (ctx) => {
      const entry = charted.value?.history[ctx.dataIndex]
      if (!entry) return ''
      const when = longDate(entry.fetchedAt ?? Date.now())
      // Another player's client hides losses: wins alone, no made-up win rate.
      if (entry.losses === null || entry.losses === undefined) return [`${entry.wins}W`, when]
      const total = entry.wins + entry.losses
      const wr = total ? Math.round((entry.wins / total) * 100) : 0
      return [`${entry.wins}W ${entry.losses}L · ${wr}%`, when]
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

const knownLosses = (rank: Rank) => rank.losses !== null && rank.losses !== undefined

/**
 * Wins and losses when both are known. A rank the Invade app read from
 * another player's client has no losses (the client hides them), so its
 * line shows wins only and the win rate comes from the newest row of the
 * queue that has losses, if any; never a made-up 100%.
 */
function record(rank: Rank) {
  const basis = knownLosses(rank)
    ? rank
    : (props.ranks?.history ?? [])
        .filter((r) => r.queueType === rank.queueType && knownLosses(r))
        .sort(
          (a, b) => new Date(b.fetchedAt ?? 0).getTime() - new Date(a.fetchedAt ?? 0).getTime()
        )[0]
  const total = basis ? basis.wins + (basis.losses ?? 0) : 0
  return {
    losses: knownLosses(rank) ? rank.losses : null,
    winrate: basis && total ? Math.round((basis.wins / total) * 100) : null,
  }
}
</script>

<template>
  <!-- Ranked, sized for the profile rail: one row per queue, then the climb. -->
  <section class="card">
    <div class="section">
      <h3>Ranked</h3>
      <span v-if="peak" class="meta ml-auto">
        Peak
        <b class="font-semibold" :style="{ color: tierColor(peak.tier) }">
          {{ rankName(peak.tier, peak.division) }}
        </b>
      </span>
    </div>

    <div>
      <ul v-if="queues.length" class="space-y-4">
        <li v-for="(rank, index) in queues" :key="rank.queueType" class="flex items-center gap-3">
          <span class="grid w-10 shrink-0 place-items-center">
            <img
              :src="rankCrest(rank.tier)"
              :alt="TIER_NAMES[rank.tier] || rank.tier"
              :class="index === 0 ? 'h-10 w-10' : 'h-8 w-8'"
              loading="lazy"
            />
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-baseline justify-between gap-2 text-[12px] text-ink-3">
              <span>Ranked {{ QUEUE_LABELS[rank.queueType] || rank.queueType }}</span>
              <span
                v-if="rank.source === 'desktop'"
                title="Read from the League client by the Invade app"
              >
                Via Invade app
              </span>
            </div>
            <div class="flex items-baseline justify-between gap-2">
              <span
                class="truncate font-semibold"
                :class="index === 0 ? 'text-[16px]' : 'text-[14px]'"
                :style="{ color: tierColor(rank.tier) }"
              >
                {{ rankName(rank.tier, rank.division) }}
              </span>
              <span class="num shrink-0 text-[14px] font-semibold text-ink">
                {{ rank.leaguePoints }}<span class="unit">LP</span>
              </span>
            </div>
            <div class="num text-[12px] text-ink-3">
              {{ rank.wins }}W{{ record(rank).losses === null ? '' : ` ${record(rank).losses}L` }}
              <template v-if="record(rank).winrate !== null">
                <span class="text-ink-4">·</span>
                {{ record(rank).winrate }}%
              </template>
            </div>
          </div>
        </li>
      </ul>

      <!-- Said, not left out: a missing panel reads as a broken page. -->
      <div v-else class="flex items-center gap-3">
        <span class="grid w-10 shrink-0 place-items-center">
          <img :src="rankCrest('unranked')" alt="" class="h-9 w-9 opacity-70" loading="lazy" />
        </span>
        <div>
          <div class="text-[12px] text-ink-3">Ranked Solo/Duo and Flex</div>
          <div class="text-[16px] font-semibold text-ink-2">Unranked</div>
        </div>
      </div>

      <div v-if="charted" class="mt-5 min-w-0">
        <div class="mb-2 flex items-baseline justify-between text-[12px] text-ink-3">
          <span>LP history · {{ QUEUE_LABELS[charted.queueType] || charted.queueType }}</span>
          <span class="num">{{ charted.history.length }} snapshots</span>
        </div>
        <div class="h-[96px]">
          <LineChart :data="chartData" :options="options" />
        </div>
      </div>
    </div>
  </section>
</template>
