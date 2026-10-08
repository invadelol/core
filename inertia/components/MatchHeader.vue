<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, Copy } from 'lucide-vue-next'
import ObjectiveTally from './ObjectiveTally.vue'
import { queueName, regionLabel } from '../lib/assets.js'
import { compact, duration, longDate, signed, timeAgo } from '../lib/format.js'
import { teamTotals, teamWon } from '../lib/match.js'
import type { Match } from '../lib/types.js'

const props = defineProps<{ match: Match; ownerPuuid?: string }>()

const totals = computed(() => teamTotals(props.match))

/** The viewed player's team on the left; blue side when nobody is being viewed. */
const order = computed(() => {
  const owner = props.match.participants.find((p) => p.puuid === props.ownerPuuid)
  return owner?.teamId === 200 ? [200, 100] : [100, 200]
})
const hasOwner = computed(() => props.match.participants.some((p) => p.puuid === props.ownerPuuid))

const sides = computed(() =>
  order.value.map((teamId) => ({
    teamId,
    side: teamId === 100 ? 'Blue side' : 'Red side',
    won: teamWon(props.match, teamId),
    kills: totals.value[teamId].kills,
    gold: totals.value[teamId].gold,
  }))
)

/** Gold lead of the left team: blue when ahead, red when behind (good or bad for you). */
const lead = computed(() => sides.value[0].gold - sides.value[1].gold)
const split = computed(() => {
  const sum = sides.value[0].gold + sides.value[1].gold
  return sum ? (sides.value[0].gold / sum) * 100 : 50
})

const copied = ref(false)
async function copyId() {
  try {
    await navigator.clipboard.writeText(props.match.matchId)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    /* the id is selectable either way */
  }
}
</script>

<template>
  <header class="card">
    <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 pt-4">
      <div class="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 class="text-[20px] font-semibold leading-6 tracking-[-0.01em] text-ink">
          {{ queueName(match.queueId) }}
        </h1>
        <p class="num text-[12.5px] text-ink-3">
          {{ longDate(match.gameStartMs) }}, {{ timeAgo(match.gameStartMs) }}
          <span class="text-ink-4">·</span> Patch {{ match.patch }}
          <span class="text-ink-4">·</span> {{ regionLabel(match.platform) }}
        </p>
      </div>

      <button
        class="num flex shrink-0 items-center gap-1.5 text-[12px] text-ink-4 transition-colors hover:text-ink-2"
        :title="copied ? 'Copied' : 'Copy match id'"
        @click="copyId"
      >
        {{ match.matchId }}
        <Check v-if="copied" :size="12" />
        <Copy v-else :size="12" />
      </button>
    </div>

    <!-- The scorebug: each team's result and kills, the clock and the gold race between -->
    <div
      class="grid grid-cols-2 items-center gap-x-4 gap-y-5 px-5 pb-5 pt-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)] sm:gap-10"
    >
      <div
        v-for="(side, index) in sides"
        :key="side.teamId"
        :class="index ? 'text-right sm:order-3' : ''"
      >
        <div class="text-[13px] font-semibold">
          <span :class="side.won ? 'text-win' : 'text-loss'">{{
            side.won ? 'Victory' : 'Defeat'
          }}</span>
          <span class="font-medium text-ink-3"> · {{ side.side }}</span>
        </div>
        <div class="fig mt-2 text-[40px] text-ink sm:text-[44px]">{{ side.kills }}</div>
        <div
          class="mt-2.5 hidden text-[12px] text-ink-3 sm:flex"
          :class="index ? 'justify-end' : ''"
        >
          <ObjectiveTally :match="match" :team-id="side.teamId" />
        </div>
      </div>

      <div class="col-span-2 min-w-0 sm:order-2 sm:col-span-1">
        <div class="fig text-center text-[24px] text-ink">{{ duration(match.duration) }}</div>
        <div class="num mb-2 mt-2 text-center text-[12px] font-medium">
          <span v-if="lead === 0" class="text-ink-3">Even gold</span>
          <span v-else :class="lead > 0 ? 'text-win' : 'text-loss'">
            {{ signed(lead) }} gold
            <span class="text-ink-3">{{
              hasOwner ? 'for your team' : `for ${sides[0].side.toLowerCase()}`
            }}</span>
          </span>
        </div>
        <div class="flex h-[4px] gap-[2px]">
          <span
            class="rounded-l-[2px]"
            :style="{ width: `${split}%`, background: 'var(--color-win)' }"
          />
          <span class="flex-1 rounded-r-[2px]" style="background: var(--color-loss)" />
        </div>
        <div class="num mt-1.5 flex justify-between text-[12px] text-ink-3">
          <span>{{ compact(sides[0].gold) }}</span>
          <span>{{ compact(sides[1].gold) }}</span>
        </div>
      </div>
    </div>
  </header>
</template>
