<script setup lang="ts">
import { computed } from 'vue'
import { RankCrest, TrendLine } from '@invadelol/ui'
import { rankFromCore, rankLabel, rankValue, tierColor } from '@invadelol/ui/logic'
import type { Rank, RanksPayload } from '../lib/types.js'

const props = defineProps<{ ranks: RanksPayload | null }>()

const QUEUES: Record<string, string> = { RANKED_SOLO_5x5: 'Solo/Duo', RANKED_FLEX_SR: 'Flex' }
const ORDER = Object.keys(QUEUES)
const name = (rank: Rank) => rankLabel(rankFromCore(rank), false)
/** The whole ladder on one axis, so a promotion reads as a climb, not a reset. */
const ladder = (rank: Rank) => rankValue(rankFromCore(rank)) ?? 0
const time = (rank: Rank) => new Date(rank.fetchedAt ?? 0).getTime()

/** Solo first, then flex, then anything else that has a tier. */
const queues = computed(() => {
  const at = (r: Rank) => (ORDER.includes(r.queueType) ? ORDER.indexOf(r.queueType) : 9)
  return (props.ranks?.current ?? []).filter((r) => r.tier).sort((a, b) => at(a) - at(b))
})

function historyFor(queueType: string) {
  return (props.ranks?.history ?? [])
    .filter((r) => r.queueType === queueType && r.tier)
    .sort((a, b) => time(a) - time(b))
}

/** The queue with the most snapshots gets the line. */
const charted = computed(() => {
  let best: { queueType: string; history: Rank[] } | null = null
  for (const queue of queues.value) {
    const history = historyFor(queue.queueType)
    if (!best || history.length > best.history.length)
      best = { queueType: queue.queueType, history }
  }
  return best && best.history.length > 2 ? best : null
})

const peak = computed(() =>
  charted.value?.history.reduce((best, entry) => (ladder(entry) > ladder(best) ? entry : best))
)

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
        .sort((a, b) => time(b) - time(a))[0]
  const total = basis ? basis.wins + (basis.losses ?? 0) : 0
  return {
    losses: knownLosses(rank) ? rank.losses : null,
    winrate: basis && total ? Math.round((basis.wins / total) * 100) : null,
  }
}
</script>

<template>
  <!-- Ranked, sized for the profile rail: one row per queue, then the climb. -->
  <section class="iv-panel">
    <div class="section">
      <h3>Ranked</h3>
      <span v-if="peak" class="meta ml-auto">
        Peak
        <b class="font-semibold" :style="{ color: tierColor(peak.tier) }">{{ name(peak) }}</b>
      </span>
    </div>

    <div>
      <ul v-if="queues.length" class="space-y-4">
        <li v-for="(rank, index) in queues" :key="rank.queueType" class="flex items-center gap-3">
          <span class="grid w-10 shrink-0 place-items-center">
            <RankCrest :tier="rank.tier" :size="index === 0 ? 36 : 28" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-baseline justify-between gap-2 text-[12px] text-ink-3">
              <span>Ranked {{ QUEUES[rank.queueType] || rank.queueType }}</span>
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
                {{ name(rank) }}
              </span>
              <span class="num shrink-0 text-[14px] font-semibold text-ink">
                {{ rank.leaguePoints }}<span class="iv-unit">LP</span>
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
        <span class="grid w-10 shrink-0 place-items-center opacity-70">
          <RankCrest :size="36" />
        </span>
        <div>
          <div class="text-[12px] text-ink-3">Ranked Solo/Duo and Flex</div>
          <div class="text-[16px] font-semibold text-ink-2">Unranked</div>
        </div>
      </div>

      <div v-if="charted" class="mt-5 min-w-0">
        <div class="mb-2 flex items-baseline justify-between text-[12px] text-ink-3">
          <span>LP history · {{ QUEUES[charted.queueType] || charted.queueType }}</span>
          <span class="num">{{ charted.history.length }} snapshots</span>
        </div>
        <span
          role="img"
          :aria-label="`From ${name(charted.history[0])} to ${name(charted.history[charted.history.length - 1])}`"
        >
          <TrendLine :values="charted.history.map(ladder)" :height="72" area />
        </span>
      </div>
    </div>
  </section>
</template>
