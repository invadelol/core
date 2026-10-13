<script setup lang="ts">
import { computed } from 'vue'
import { LpGraph, RankCrest } from '@invadelol/ui'
import { rankFromCore, rankLabel, rankValue, tierColor, type LpPoint } from '@invadelol/ui/logic'
import type { Rank, RanksPayload } from '../lib/types.js'

const props = defineProps<{ ranks: RanksPayload | null }>()

const QUEUES: Record<string, string> = { RANKED_SOLO_5x5: 'Solo/Duo', RANKED_FLEX_SR: 'Flex' }
const ORDER = Object.keys(QUEUES)
const name = (rank: Rank) => rankLabel(rankFromCore(rank), false)
const time = (rank: Rank) => new Date(rank.fetchedAt ?? 0).getTime()

/** Solo first, then flex; no other queue is shown. */
const queues = computed(() =>
  (props.ranks?.current ?? [])
    .filter((r) => r.tier && ORDER.includes(r.queueType))
    .sort((a, b) => ORDER.indexOf(a.queueType) - ORDER.indexOf(b.queueType))
)

const LP_QUEUES: Record<string, LpPoint['queue']> = {
  RANKED_SOLO_5x5: 'solo',
  RANKED_FLEX_SR: 'flex',
}

/** The stored snapshots as the shared LP graph reads them: the whole ladder on one axis. */
const points = computed(() =>
  (props.ranks?.history ?? [])
    .flatMap((r): LpPoint[] => {
      const queue = LP_QUEUES[r.queueType]
      const rank = rankFromCore(r)
      const value = rankValue(rank)
      return queue && value !== null && r.fetchedAt
        ? [{ ...rank, t: time(r), queue, value: Math.round(value * 100) }]
        : []
    })
    .sort((a, b) => a.t - b.t)
)

/** A line needs a few snapshots of one queue; fewer read as noise. */
const charted = computed(() =>
  (['solo', 'flex'] as const).some((q) => points.value.filter((p) => p.queue === q).length > 2)
)
const card = computed(() => {
  const current = (q: LpPoint['queue']) => {
    const r = queues.value.find((x) => LP_QUEUES[x.queueType] === q)
    return r ? rankFromCore(r) : null
  }
  return { solo: current('solo'), flex: current('flex') }
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
        .sort((a, b) => time(b) - time(a))[0]
  const total = basis ? basis.wins + (basis.losses ?? 0) : 0
  return {
    losses: knownLosses(rank) ? rank.losses : null,
    winrate: basis && total ? Math.round((basis.wins / total) * 100) : null,
  }
}
</script>

<template>
  <!-- Ranked, sized for the profile rail: one row per queue, then the climb, read point by point. -->
  <section class="iv-panel">
    <div class="section">
      <h3>Ranked</h3>
    </div>

    <div>
      <ul v-if="queues.length" class="space-y-4">
        <li v-for="(rank, index) in queues" :key="rank.queueType" class="flex items-center gap-3">
          <span class="grid w-10 shrink-0 place-items-center">
            <RankCrest :tier="rank.tier" :size="index === 0 ? 36 : 28" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-baseline justify-between gap-2 text-[12px] text-ink-3">
              <span>Ranked {{ QUEUES[rank.queueType] }}</span>
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
    </div>
  </section>
  <LpGraph v-if="charted" :points="points" :card="card" />
</template>
