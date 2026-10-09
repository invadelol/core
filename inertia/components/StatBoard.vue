<script setup lang="ts">
import { computed } from 'vue'
import Sparkline from './ui/Sparkline.vue'
import PerfDial from './PerfDial.vue'
import { compact, percent } from '../lib/format.js'
import {
  isRemake,
  killParticipation,
  matchMinutes,
  SCORE_CATEGORIES,
  SCORE_CATEGORY_LABEL,
  scoreLobby,
  teamTotals,
} from '../lib/match.js'
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
        id: match.matchId,
        win: me.win,
        remake: isRemake(match),
        /* Null for a remake, which is left out of every score figure. */
        rated: scoreLobby(match)[props.puuid] ?? null,
        kda: (me.kills + me.assists) / Math.max(1, me.deaths),
        kp: killParticipation(me, totals),
        csMin: me.cs / minutes,
        goldMin: me.goldEarned / minutes,
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .reverse()
)

const record = computed(() => {
  const played = games.value.filter((g) => !g.remake)
  const wins = played.filter((g) => g.win).length
  return { wins, losses: played.length - wins }
})

/** The average score over the window, and what it is made of. */
const score = computed(() => {
  const list = games.value.flatMap((g) => (g.rated ? [g.rated] : []))
  if (!list.length) return null
  const mean = (rows: typeof list) => rows.reduce((s, g) => s + g.score, 0) / rows.length
  /* The first half of the window against the second: is the player trending up. */
  const half = Math.floor(list.length / 2)
  const early = list.slice(0, half)
  const late = list.slice(half)
  const trend = early.length && late.length ? Math.round(mean(late) - mean(early)) : null
  /* Categories averaged only over the games that weighted them, so an
     ARAM does not drag the vision average down with a zero. */
  const categories = SCORE_CATEGORIES.map((key) => {
    const counted = list.filter((g) => g.weights[key] > 0)
    const value = counted.length
      ? Math.round(counted.reduce((s, g) => s + g.categories[key], 0) / counted.length)
      : null
    return { key, label: SCORE_CATEGORY_LABEL[key], value }
  }).filter((c): c is { key: typeof c.key; label: string; value: number } => c.value !== null)
  return {
    categories,
    average: Math.round(mean(list)),
    count: list.length,
    best: Math.max(...list.map((g) => g.score)),
    trend,
  }
})

/** Change against the window before, in percent. */
function delta(now: number | undefined, before: number | undefined) {
  if (now === undefined || before === undefined || !before) return null
  return ((now - before) / Math.abs(before)) * 100
}

/** A change only takes a colour when it is big enough to mean something. */
const MEANINGFUL = 10

const cells = computed(() => {
  const g = props.stats
  if (!g) return []
  const p = props.previous
  return [
    {
      label: 'KDA',
      value: g.kda.toFixed(2),
      trend: games.value.map((x) => x.kda),
      reference: p?.kda ?? null,
      delta: delta(g.kda, p?.kda),
    },
    {
      label: 'Kill participation',
      value: percent(g.killParticipation),
      trend: games.value.map((x) => x.kp),
      reference: p ? p.killParticipation * 100 : null,
      delta: delta(g.killParticipation, p?.killParticipation),
    },
    {
      label: 'CS per minute',
      value: g.csMin.toFixed(1),
      trend: games.value.map((x) => x.csMin),
      reference: p?.csMin ?? null,
      delta: delta(g.csMin, p?.csMin),
    },
    {
      label: 'Gold per minute',
      value: compact(g.goldPerMinute),
      trend: games.value.map((x) => x.goldMin),
      reference: p?.goldPerMinute ?? null,
      delta: delta(g.goldPerMinute, p?.goldPerMinute),
    },
  ]
})
</script>

<template>
  <!-- Performance: the record, the score and what it is made of, then each metric over the games. -->
  <section>
    <div class="section">
      <h2>Performance</h2>
      <span v-if="stats?.total" class="meta num">Last {{ stats.total }} games</span>
      <span v-if="previous?.total" class="meta num hidden sm:inline">
        <span class="text-ink-4">·</span> against the {{ previous.total }} before
      </span>
    </div>

    <p v-if="!stats || !stats.total" class="py-6 text-[13px] text-ink-2">
      No games in this window.
    </p>

    <div v-else class="card">
      <div class="grid gap-x-10 gap-y-6 p-5 md:grid-cols-[auto_auto_minmax(0,1fr)]">
        <!-- Record -->
        <div>
          <div class="label">Win rate</div>
          <div class="mt-2 flex items-baseline gap-2.5">
            <span class="fig text-[32px] text-ink">{{ Math.round(stats.winrate * 100) }}%</span>
            <span class="num text-[13px] text-ink-3">{{ record.wins }}W {{ record.losses }}L</span>
          </div>
          <div
            v-if="games.length"
            class="form mt-3 max-w-[220px]"
            :title="`Last ${games.length} games, oldest first`"
          >
            <i
              v-for="game in games"
              :key="game.id"
              :class="{ w: game.win, r: game.remake }"
              :title="game.remake ? 'Remake' : game.win ? 'Win' : 'Loss'"
            />
          </div>
        </div>

        <!-- Score -->
        <div v-if="score">
          <div class="label" title="0–100, each game rated against the other nine players">
            Average score
          </div>
          <div class="mt-2 flex items-center gap-3">
            <PerfDial
              :score="score.average"
              caption=""
              :hint="`Average score ${score.average} of 100 over ${score.count} scored games`"
            />
            <div class="num text-[12px] leading-[18px] text-ink-3">
              <div>
                best <span class="font-semibold text-ink-2">{{ score.best }}</span>
              </div>
              <div v-if="score.trend">
                <span
                  :class="
                    Math.abs(score.trend) >= 5 ? (score.trend > 0 ? 'text-win' : 'text-loss') : ''
                  "
                  >{{ score.trend > 0 ? '+' : '−' }}{{ Math.abs(score.trend) }}</span
                >
                in the later games
              </div>
            </div>
          </div>
        </div>

        <!-- What the score is made of: plain figures, thin neutral bars -->
        <ul
          v-if="score"
          class="grid grid-cols-3 content-start gap-x-5 gap-y-4 sm:grid-cols-5 md:border-l md:border-line md:pl-10"
        >
          <li v-for="category in score.categories" :key="category.key" class="min-w-0">
            <div class="truncate text-[12px] text-ink-3">{{ category.label }}</div>
            <div class="num mt-2 text-[17px] font-semibold leading-none text-ink">
              {{ category.value }}
            </div>
            <div class="meter mt-2 !h-[3px]">
              <span :style="{ width: `${category.value}%` }" />
            </div>
          </li>
        </ul>
      </div>

      <!-- Metrics: label, the games as a line against the window before (dashed), value, change -->
      <ul class="border-t border-line px-5">
        <li
          v-for="cell in cells"
          :key="cell.label"
          class="grid h-[48px] grid-cols-[96px_minmax(0,1fr)_64px_48px] items-center gap-4 border-b border-line last:border-b-0 sm:grid-cols-[140px_minmax(0,1fr)_80px_56px] sm:gap-6"
        >
          <span class="truncate text-[13px] text-ink-2">{{ cell.label }}</span>
          <Sparkline
            class="h-[26px] w-full text-brand"
            :values="cell.trend"
            :reference="cell.reference"
            :label="`${cell.label} over the last ${cell.trend.length} games`"
            :width="400"
            :height="26"
          />
          <span class="num text-right text-[17px] font-semibold text-ink">{{ cell.value }}</span>
          <span
            class="num text-right text-[12px] font-medium"
            :class="
              cell.delta === null || Math.abs(cell.delta) < MEANINGFUL
                ? 'text-ink-3'
                : cell.delta > 0
                  ? 'text-win'
                  : 'text-loss'
            "
            :title="previous ? `Against the previous ${previous.total} games` : undefined"
          >
            <template v-if="cell.delta !== null && Math.round(cell.delta) !== 0">
              {{ cell.delta > 0 ? '+' : '−' }}{{ Math.abs(Math.round(cell.delta)) }}%
            </template>
          </span>
        </li>
      </ul>
    </div>
  </section>
</template>
