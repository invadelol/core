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
  <header>
    <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
      <div class="min-w-0">
        <h1 class="display text-[24px] text-ink">{{ queueName(match.queueId) }}</h1>
        <p class="num mt-1.5 text-[11.5px] text-ink-3">
          {{ duration(match.duration) }}
          <span class="text-ink-4">·</span>
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

    <!-- Score and economy on one line, so the result reads in a glance -->
    <div class="mt-5 flex items-end gap-5">
      <div class="shrink-0 text-right">
        <div
          class="num display text-[34px]"
          :style="{ color: sides[0].won ? sides[0].color : 'var(--color-ink-4)' }"
        >
          {{ sides[0].kills }}
        </div>
        <div class="mt-1 flex items-center justify-end gap-1.5">
          <span class="label !text-[9.5px]" :style="{ color: sides[0].color }">Blue</span>
          <span
            v-if="sides[0].won"
            class="text-[9.5px] font-semibold uppercase tracking-[0.07em] text-win"
          >
            Won
          </span>
        </div>
      </div>

      <div class="min-w-0 flex-1 pb-2">
        <div class="num mb-1.5 text-center text-[11.5px] font-medium">
          <span :class="lead > 0 ? 'text-blue' : lead < 0 ? 'text-red' : 'text-ink-3'">
            {{
              lead === 0
                ? 'Even gold'
                : `${lead > 0 ? 'Blue' : 'Red'} ${signed(Math.abs(lead))} gold`
            }}
          </span>
        </div>
        <div class="flex h-[6px] gap-[2px] overflow-hidden">
          <span :style="{ width: `${split}%`, background: 'var(--color-blue)' }" />
          <span class="flex-1" style="background: var(--color-red)" />
        </div>
        <div class="num mt-1.5 flex justify-between text-[11px] text-ink-3">
          <span>{{ compact(totals[100].gold) }}</span>
          <span>{{ compact(totals[200].gold) }}</span>
        </div>
      </div>

      <div class="shrink-0">
        <div
          class="num display text-[34px]"
          :style="{ color: sides[1].won ? sides[1].color : 'var(--color-ink-4)' }"
        >
          {{ sides[1].kills }}
        </div>
        <div class="mt-1 flex items-center gap-1.5">
          <span class="label !text-[9.5px]" :style="{ color: sides[1].color }">Red</span>
          <span
            v-if="sides[1].won"
            class="text-[9.5px] font-semibold uppercase tracking-[0.07em] text-win"
          >
            Won
          </span>
        </div>
      </div>
    </div>
  </header>
</template>
