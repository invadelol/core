<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, Copy } from 'lucide-vue-next'
import { queueName } from '../lib/assets.js'
import { compact, duration, shortDate, signed, timeAgo } from '../lib/format.js'
import { teamTotals, teamWon } from '../lib/match.js'
import type { Match } from '../lib/types.js'

const props = defineProps<{ match: Match }>()

const totals = computed(() => teamTotals(props.match))
const lead = computed(() => totals.value[100].gold - totals.value[200].gold)
const split = computed(() => {
  const sum = totals.value[100].gold + totals.value[200].gold
  return sum ? (totals.value[100].gold / sum) * 100 : 50
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

const sides = computed(() =>
  [100, 200].map((teamId) => ({
    teamId,
    name: teamId === 100 ? 'Blue' : 'Red',
    won: teamWon(props.match, teamId),
    kills: totals.value[teamId].kills,
    gold: totals.value[teamId].gold,
    color: teamId === 100 ? 'var(--color-blue)' : 'var(--color-red)',
  }))
)
</script>

<template>
  <header class="card">
    <div
      class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line px-5 py-3"
    >
      <div class="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 class="display text-[22px] text-ink">{{ queueName(match.queueId) }}</h1>
        <p class="num text-[11.5px] text-ink-3">
          {{ shortDate(Number(match.gameStartMs)) }}, {{ timeAgo(match.gameStartMs) }}
          <span class="text-ink-4">·</span>
          Patch {{ match.patch }}
          <span class="text-ink-4">·</span>
          {{ match.platform }}
        </p>
      </div>

      <button
        class="num flex shrink-0 items-center gap-1.5 text-[11px] text-ink-4 transition-colors hover:text-ink-2"
        :title="copied ? 'Copied' : 'Copy match id'"
        @click="copyId"
      >
        {{ match.matchId }}
        <Check v-if="copied" :size="12" />
        <Copy v-else :size="12" />
      </button>
    </div>

    <!-- The scorebug: kills either side, the clock and the gold race between -->
    <div
      class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 py-5 sm:gap-8 sm:px-8"
    >
      <div class="flex items-center gap-3 sm:gap-4">
        <span class="h-11 w-[3px] rounded-full" :style="{ background: sides[0].color }" />
        <div>
          <div class="flex items-center gap-2">
            <span class="label" :style="{ color: sides[0].color }"> Blue </span>
            <span v-if="sides[0].won" class="tag !text-win">Won</span>
          </div>
          <div
            class="num stat mt-1 text-[48px] sm:text-[56px]"
            :class="sides[0].won ? 'text-ink' : 'text-ink-3'"
          >
            {{ sides[0].kills }}
          </div>
        </div>
      </div>

      <div class="min-w-0">
        <div class="num stat text-center text-[26px] text-ink">{{ duration(match.duration) }}</div>
        <div class="num mb-2 mt-2 text-center text-[11.5px] font-semibold">
          <span :class="lead > 0 ? 'text-blue' : lead < 0 ? 'text-red' : 'text-ink-3'">
            {{
              lead === 0
                ? 'Even gold'
                : `${lead > 0 ? 'Blue' : 'Red'} ${signed(Math.abs(lead))} gold`
            }}
          </span>
        </div>
        <div class="flex h-[6px] gap-[2px] overflow-hidden">
          <span
            class="rounded-l-[2px]"
            :style="{ width: `${split}%`, background: 'var(--color-blue)' }"
          />
          <span class="flex-1 rounded-r-[2px]" style="background: var(--color-red)" />
        </div>
        <div class="num mt-1.5 flex justify-between text-[11px] text-ink-3">
          <span class="text-gold">{{ compact(totals[100].gold) }}</span>
          <span class="text-gold">{{ compact(totals[200].gold) }}</span>
        </div>
      </div>

      <div class="flex items-center justify-end gap-3 text-right sm:gap-4">
        <div>
          <div class="flex items-center justify-end gap-2">
            <span v-if="sides[1].won" class="tag !text-win">Won</span>
            <span class="label" :style="{ color: sides[1].color }"> Red </span>
          </div>
          <div
            class="num stat mt-1 text-[48px] sm:text-[56px]"
            :class="sides[1].won ? 'text-ink' : 'text-ink-3'"
          >
            {{ sides[1].kills }}
          </div>
        </div>
        <span class="h-11 w-[3px] rounded-full" :style="{ background: sides[1].color }" />
      </div>
    </div>
  </header>
</template>
