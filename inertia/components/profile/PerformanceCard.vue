<script setup lang="ts">
import { computed } from 'vue'
import EmptyState from '../ui/EmptyState.vue'
import FormStrip from '../ui/FormStrip.vue'
import ScoreDial from '../ui/ScoreDial.vue'
import {
  isRemake,
  killParticipation,
  matchMinutes,
  scoreLobby,
  SCORE_CATEGORIES,
  teamTotals,
  type ScoreCategory,
} from '../../lib/match.js'
import { signed, spark } from './rank.js'
import type { GlobalStats, Match } from '../../lib/types.js'

/**
 * Performance (`.pf`), as the desktop app draws it: the average Invade score on its dial with the
 * record, then the five key figures side by side, each with its value, the gap to the window
 * before and its game-by-game line. Under a hairline, on the same columns, the form and the parts
 * of the score.
 */
const props = defineProps<{
  /** The window, newest first. */
  matches: Match[]
  /** The same number of games before it, newest first. */
  previous: Match[]
  stats: GlobalStats | null
  previousStats: GlobalStats | null
  puuid: string
}>()

const NAMES: Record<ScoreCategory, string> = {
  fighting: 'Fighting',
  damage: 'Damage',
  farming: 'Farming',
  vision: 'Vision',
  objectives: 'Objectives',
}

const mine = (m: Match) => m.participants.find((p) => p.puuid === props.puuid)
const played = (list: Match[]) => list.filter((m) => m.queueId !== 0 && !isRemake(m) && mine(m))
/** The window's games, oldest first, so every line shares an x axis. */
const games = computed(() => played(props.matches).reverse())

const record = computed(() => {
  const wins = games.value.filter((m) => mine(m)!.win).length
  const total = games.value.length
  return { wins, losses: total - wins, rate: total ? Math.round((wins / total) * 100) : 0 }
})
const form = computed(() => games.value.map((m) => Boolean(mine(m)!.win)))

const scored = (list: Match[]) =>
  played(list).flatMap((m) => {
    const s = scoreLobby(m)[props.puuid]
    return s ? [s] : []
  })
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

const score = computed(() => {
  const list = scored(props.matches)
  const average = mean(list.map((s) => s.score))
  if (average === null) return null
  const before = scored(props.previous)
  const was = before.length >= 5 ? mean(before.map((s) => s.score)) : null
  /* Each part averaged over the games that weighted it, so an ARAM's zero vision stays out. */
  const parts = SCORE_CATEGORIES.flatMap((key) => {
    const counted = list.filter((s) => s.weights[key] > 0 && Number.isFinite(s.categories[key]))
    const v = mean(counted.map((s) => s.categories[key]))
    return v === null ? [] : [{ key, name: NAMES[key], value: Math.round(v) }]
  })
  return {
    average: Math.round(average),
    count: list.length,
    best: Math.round(Math.max(...list.map((s) => s.score))),
    change: was === null ? null : Math.round(average - was),
    parts,
  }
})

/** The app's five key figures, in its order. */
const FIGURES = [
  {
    key: 'csm',
    label: 'CS/min',
    name: 'CS per minute',
    of: (s: GlobalStats) => s.csMin,
    game: (m: Match) => mine(m)!.cs / matchMinutes(m),
    format: (v: number) => v.toFixed(1),
    digits: 1,
  },
  {
    key: 'kp',
    label: 'KP',
    name: 'Kill participation',
    of: (s: GlobalStats) => s.killParticipation * 100,
    game: (m: Match) => killParticipation(mine(m)!, teamTotals(m)),
    format: (v: number) => `${Math.round(v)}%`,
    digits: 0,
  },
  {
    key: 'vpm',
    label: 'Vision/min',
    name: 'Vision score per minute',
    of: (s: GlobalStats) => s.visionMin,
    game: (m: Match) => (mine(m)!.visionScore || 0) / matchMinutes(m),
    format: (v: number) => v.toFixed(2),
    digits: 2,
  },
  {
    key: 'kda',
    label: 'KDA',
    name: 'KDA',
    of: (s: GlobalStats) => s.kda,
    game: (m: Match) => {
      const p = mine(m)!
      return (p.kills + p.assists) / Math.max(1, p.deaths)
    },
    format: (v: number) => v.toFixed(2),
    digits: 2,
  },
  {
    key: 'gpm',
    label: 'Gold/min',
    name: 'Gold per minute',
    of: (s: GlobalStats) => s.goldPerMinute,
    game: (m: Match) => mine(m)!.goldEarned / matchMinutes(m),
    format: (v: number) => String(Math.round(v)),
    digits: 0,
  },
] as const

const figures = computed(() => {
  const now = props.stats
  if (!now?.total) return []
  const before = props.previousStats?.total ? props.previousStats : null
  return FIGURES.map((f) => {
    const value = f.of(now)
    const base = before ? f.of(before) : null
    const gap = base === null || !Number.isFinite(base) ? null : value - base
    return {
      key: f.key,
      label: f.label,
      value: f.format(value),
      base: base === null ? null : f.format(base),
      gap: gap === null ? '' : signed(gap, f.digits),
      title: base === null ? f.name : `${f.name}: ${f.format(value)}, ${f.format(base)} before`,
      line: spark(games.value.map(f.game), 200, 26, 3, 2),
    }
  })
})
</script>

<template>
  <section class="card lit pf">
    <div class="pf-h">
      <h2 class="h3">Performance</h2>
      <span class="meta num"
        >Last {{ games.length }} {{ games.length === 1 ? 'game' : 'games'
        }}<template v-if="played(previous).length"
          >, against the {{ played(previous).length }} before</template
        ></span
      >
    </div>
    <EmptyState v-if="!games.length" compact icon="sliders" title="No game in these filters" />
    <div v-else class="pf-g">
      <div
        class="pf-sc"
        :title="
          score
            ? `Average Invade score ${score.average} over ${score.count} scored games; about 41 is an average Emerald game`
            : undefined
        "
      >
        <ScoreDial :value="score?.average ?? null" />
        <div class="pf-sc-t">
          <span class="lab">Invade score</span>
          <span class="pf-rec num"
            >{{ record.wins }}W {{ record.losses }}L · {{ record.rate }}%</span
          >
          <span v-if="score" class="pf-sub num"
            >Best {{ score.best
            }}<template v-if="score.change !== null">
              · {{ signed(score.change) }} on before</template
            ></span
          >
        </div>
      </div>

      <ul class="pf-figs">
        <li v-for="f in figures" :key="f.key" :title="f.title">
          <span class="lab ell">{{ f.label }}</span>
          <span class="pf-v num"
            ><b>{{ f.value }}</b
            ><em v-if="f.gap">{{ f.gap }}</em></span
          >
          <div class="chart pf-sp" aria-hidden="true">
            <template v-if="f.line">
              <svg class="fade" :viewBox="`0 0 ${f.line.w} ${f.line.h}`" preserveAspectRatio="none">
                <path class="area" :d="f.line.area" />
              </svg>
              <svg :viewBox="`0 0 ${f.line.w} ${f.line.h}`" preserveAspectRatio="none">
                <path class="ln" :d="f.line.d" />
              </svg>
            </template>
          </div>
        </li>
      </ul>

      <div class="pf-rule" />

      <div class="pf-form">
        <span class="lab">Form</span>
        <FormStrip :results="form" small />
      </div>

      <ul v-if="score?.parts.length" class="pf-parts">
        <li
          v-for="p in score.parts"
          :key="p.key"
          :title="`${p.name}: ${p.value} of 100, part of the Invade score`"
        >
          <span class="lab ell">{{ p.name }}</span>
          <b class="num">{{ p.value }}</b>
          <div class="bar"><i :style="{ width: `${Math.max(0, Math.min(100, p.value))}%` }" /></div>
        </li>
      </ul>
    </div>
  </section>
</template>
