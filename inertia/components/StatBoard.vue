<script setup lang="ts">
import { computed } from 'vue'
import { ArrowDown, ArrowUp } from 'lucide-vue-next'
import Sparkline from './ui/Sparkline.vue'
import { compact, percent } from '../lib/format.js'
import { killParticipation, matchMinutes, teamTotals } from '../lib/match.js'
import type { GlobalStats, Match } from '../lib/types.js'

const props = defineProps<{
  /** The window being shown, already filtered. */
  stats: GlobalStats | null
  /** The window immediately before it, for the trend. */
  previous: GlobalStats | null
  /** Recent matches, newest first. The sparklines are read from these. */
  matches: Match[]
  puuid: string
  /** How many games the window asks for. */
  window: number
}>()

/** One row per game, oldest first, so every sparkline shares an x axis. */
const games = computed(() =>
  props.matches
    .slice(0, props.window)
    .map((match) => {
      const me = match.participants.find((p) => p.puuid === props.puuid)
      if (!me) return null
      const minutes = matchMinutes(match)
      const totals = teamTotals(match)
      return {
        win: me.win,
        kda: (me.kills + me.assists) / Math.max(1, me.deaths),
        kp: killParticipation(me, totals),
        csMin: me.cs / minutes,
        goldMin: me.goldEarned / minutes,
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .reverse()
)

const form = computed(() => games.value.map((g) => g.win))

const record = computed(() => {
  const wins = form.value.filter(Boolean).length
  return { wins, losses: form.value.length - wins }
})

/** A rolling win rate reads as a trend; a run of ones and zeroes does not. */
const winTrend = computed(() => {
  const out: number[] = []
  let wins = 0
  games.value.forEach((game, index) => {
    if (game.win) wins++
    out.push((wins / (index + 1)) * 100)
  })
  return out
})

/**
 * Every figure is shown against the window before it, so a number answers
 * "better or worse than I was" rather than only "what am I".
 */
function delta(now: number | undefined, before: number | undefined) {
  if (now === undefined || before === undefined || !before) return null
  return ((now - before) / Math.abs(before)) * 100
}

const cells = computed(() => {
  const g = props.stats
  if (!g) return []
  const p = props.previous
  return [
    {
      label: 'Win rate',
      value: `${Math.round(g.winrate * 100)}%`,
      trend: winTrend.value,
      delta: delta(g.winrate, p?.winrate),
      tone: g.winrate >= 0.5 ? 'text-win' : 'text-loss',
    },
    {
      label: 'KDA',
      value: g.kda.toFixed(2),
      trend: games.value.map((x) => x.kda),
      delta: delta(g.kda, p?.kda),
    },
    {
      label: 'Kill part.',
      value: percent(g.killParticipation),
      trend: games.value.map((x) => x.kp),
      delta: delta(g.killParticipation, p?.killParticipation),
    },
    {
      label: 'CS / min',
      value: g.csMin.toFixed(1),
      trend: games.value.map((x) => x.csMin),
      delta: delta(g.csMin, p?.csMin),
    },
    {
      label: 'Gold / min',
      value: compact(g.goldPerMinute),
      trend: games.value.map((x) => x.goldMin),
      delta: delta(g.goldPerMinute, p?.goldPerMinute),
      tone: 'text-gold',
    },
  ]
})
</script>

<template>
  <section>
    <div class="section">
      <h2>Performance</h2>
      <span v-if="stats?.total" class="meta">last {{ stats.total }} games</span>
      <span v-if="previous?.total" class="meta text-ink-4">
        against the {{ previous.total }} before
      </span>

      <div v-if="form.length" class="ml-auto flex items-center gap-2.5">
        <div class="hidden gap-[2px] sm:flex" :title="`Last ${form.length} games, oldest first`">
          <span
            v-for="(win, index) in form"
            :key="index"
            class="h-[14px] w-[4px] rounded-[1px]"
            :style="{ background: win ? 'var(--color-win)' : 'var(--color-loss)' }"
          />
        </div>
        <span class="num text-[11px]">
          <b class="font-semibold text-win">{{ record.wins }}W</b>
          <b class="ml-1 font-semibold text-loss">{{ record.losses }}L</b>
        </span>
      </div>
    </div>

    <p v-if="!stats || !stats.total" class="py-10 text-center text-[12.5px] text-ink-3">
      No games in this window.
    </p>

    <!-- One row, one height. -->
    <div v-else class="grid grid-cols-2 gap-x-7 gap-y-7 sm:grid-cols-3 xl:grid-cols-5">
      <div v-for="cell in cells" :key="cell.label" class="min-w-0">
        <div class="label !text-[9.5px]">{{ cell.label }}</div>
        <div class="mt-1.5 flex items-baseline gap-1.5">
          <span class="num display text-[22px]" :class="cell.tone ?? 'text-ink'">
            {{ cell.value }}
          </span>
          <span
            v-if="cell.delta !== null && Math.abs(cell.delta) >= 1"
            class="num flex items-center text-[11px] font-medium"
            :class="cell.delta > 0 ? 'text-win' : 'text-loss'"
            :title="`Against the previous ${previous?.total ?? 0} games`"
          >
            <component :is="cell.delta > 0 ? ArrowUp : ArrowDown" :size="10" />
            {{ Math.abs(Math.round(cell.delta)) }}%
          </span>
        </div>
        <Sparkline
          class="mt-2.5 text-ink-3"
          :values="cell.trend"
          :label="`${cell.label} over the last ${cell.trend.length} games`"
          :width="96"
          :height="28"
        />
      </div>
    </div>
  </section>
</template>
