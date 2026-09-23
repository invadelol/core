<script setup lang="ts">
import { computed } from 'vue'
import { ArrowDown, ArrowUp } from 'lucide-vue-next'
import Sparkline from './ui/Sparkline.vue'
import ScoreRing from './ScoreRing.vue'
import { compact, percent } from '../lib/format.js'
import {
  killParticipation,
  matchMinutes,
  SCORE_CATEGORIES,
  SCORE_CATEGORY_LABEL,
  scoreLobby,
  SCORE_LABEL,
  SCORE_TONE,
  scoreTier,
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

const form = computed(() => games.value.map((g) => g.win))

const record = computed(() => {
  const wins = form.value.filter(Boolean).length
  return { wins, losses: form.value.length - wins }
})

/** The profile's headline: the average score over the window. */
const score = computed(() => {
  const list = games.value.flatMap((g) =>
    g.rated
      ? [
          {
            id: g.id,
            win: g.win,
            score: g.rated.score,
            categories: g.rated.categories,
            weights: g.rated.weights,
          },
        ]
      : []
  )
  if (!list.length) return null
  const average = Math.round(list.reduce((sum, g) => sum + g.score, 0) / list.length)
  const tier = scoreTier(average)
  /* The first half of the window against the second, so the tile says
     whether the player is trending up without a second request. */
  const half = Math.floor(list.length / 2)
  const early = list.slice(0, half)
  const late = list.slice(half)
  const mean = (rows: typeof list) => rows.reduce((s, g) => s + g.score, 0) / rows.length
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
    games: list,
    categories,
    average,
    tier,
    tone: SCORE_TONE[tier],
    label: SCORE_LABEL[tier],
    best: Math.max(...list.map((g) => g.score)),
    trend,
  }
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
      <span v-if="previous?.total" class="meta hidden text-ink-4 sm:inline">
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
        <span class="num stat text-[14px]">
          <b class="text-win">{{ record.wins }}W</b>
          <b class="ml-1 text-loss">{{ record.losses }}L</b>
        </span>
      </div>
    </div>

    <p v-if="!stats || !stats.total" class="card py-10 text-center text-[12.5px] text-ink-3">
      No games in this window.
    </p>

    <div v-else class="space-y-2">
      <!-- The score: the average, what it is made of, and every game behind it -->
      <div
        v-if="score"
        class="card grid items-center gap-x-8 gap-y-5 p-5 md:grid-cols-[auto_minmax(0,1fr)] xl:grid-cols-[auto_minmax(0,1fr)_minmax(0,300px)]"
      >
        <div class="flex items-center gap-4">
          <ScoreRing :score="score.average" :size="84" />
          <div>
            <div class="label">Avg. score</div>
            <div class="mt-1 text-[15px] font-semibold" :style="{ color: score.tone }">
              {{ score.label }}
            </div>
            <div class="num mt-0.5 text-[11.5px] text-ink-3">
              Best {{ score.best }}
              <template v-if="score.trend !== null && score.trend !== 0">
                ·
                <span :class="score.trend > 0 ? 'text-win' : 'text-loss'">
                  {{ score.trend > 0 ? '+' : '' }}{{ score.trend }}
                </span>
                lately
              </template>
            </div>
          </div>
        </div>

        <ul class="grid grid-cols-3 gap-x-5 gap-y-3 sm:grid-cols-5">
          <li v-for="category in score.categories" :key="category.key" class="min-w-0">
            <div class="flex items-baseline justify-between gap-2">
              <span class="truncate text-[11.5px] text-ink-3">{{ category.label }}</span>
              <span class="num stat text-[17px] text-ink">{{ category.value }}</span>
            </div>
            <div class="meter mt-1.5">
              <span
                :style="{
                  width: `${category.value}%`,
                  background: SCORE_TONE[scoreTier(category.value)],
                }"
              />
            </div>
          </li>
        </ul>

        <div class="min-w-0 md:col-span-2 xl:col-span-1">
          <div class="label mb-2">Game by game</div>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="game in score.games"
              :key="game.id"
              class="num grid h-[26px] w-[30px] place-items-center rounded-[5px] text-[12px] font-semibold [font-stretch:88%]"
              :style="{
                color: SCORE_TONE[scoreTier(game.score)],
                background: `color-mix(in srgb, ${SCORE_TONE[scoreTier(game.score)]} 13%, transparent)`,
                boxShadow: `inset 0 -2px 0 ${game.win ? 'var(--color-win)' : 'var(--color-loss)'}`,
              }"
              :title="`${game.score} · ${game.win ? 'Win' : 'Loss'}`"
            >
              {{ game.score }}
            </span>
          </div>
        </div>
      </div>

      <!-- Hairlines between cells are the card showing through a 1px gap. -->
      <div class="card grid grid-cols-2 gap-px !bg-line sm:grid-cols-3 xl:grid-cols-5">
        <div
          v-for="cell in cells"
          :key="cell.label"
          class="flex min-w-0 items-end justify-between gap-3 bg-panel px-4 py-3.5 first:max-sm:col-span-2 last:sm:max-xl:col-span-2"
        >
          <div class="min-w-0">
            <div class="label">{{ cell.label }}</div>
            <div class="mt-1.5 flex items-baseline gap-1.5">
              <span class="num stat text-[26px]" :class="cell.tone ?? 'text-ink'">
                {{ cell.value }}
              </span>
              <span
                v-if="cell.delta !== null && Math.abs(cell.delta) >= 1"
                class="num flex items-center text-[11px] font-semibold"
                :class="cell.delta > 0 ? 'text-win' : 'text-loss'"
                :title="`Against the previous ${previous?.total ?? 0} games`"
              >
                <component :is="cell.delta > 0 ? ArrowUp : ArrowDown" :size="10" />
                {{ Math.abs(Math.round(cell.delta)) }}%
              </span>
            </div>
          </div>
          <Sparkline
            class="mb-1 shrink-0 text-ink-3"
            :values="cell.trend"
            :label="`${cell.label} over the last ${cell.trend.length} games`"
            :width="72"
            :height="28"
            :fill="false"
          />
        </div>
      </div>
    </div>
  </section>
</template>
