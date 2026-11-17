<script setup lang="ts">
import { computed } from 'vue'
import EmptyState from '../ui/EmptyState.vue'
import FormStrip from '../ui/FormStrip.vue'
import ScoreDial from '../ui/ScoreDial.vue'
import {
  isRemake,
  killParticipation,
  scoreLobby,
  SCORE_CATEGORIES,
  teamTotals,
} from '../../lib/match.js'
import { signed, spark } from './rank.js'
import type { GlobalStats, Match } from '../../lib/types.js'

/**
 * Performance (`.pf`), the Overview's lit sheet: the win rate and form of the latest games, the
 * average Invade score with the best game and the change on the games before, the five parts of
 * the score, then KDA, kill participation, CS and gold per minute, each with its line over the
 * games and the change on the window before. About 41 is an average Emerald game.
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

const NAMES: Record<string, string> = {
  fighting: 'Fights',
  damage: 'Damage',
  farming: 'Farming',
  vision: 'Vision',
  objectives: 'Objectives',
}

const mine = (m: Match) => m.participants.find((p) => p.puuid === props.puuid)
const played = (list: Match[]) => list.filter((m) => m.queueId !== 0 && !isRemake(m) && mine(m))
const games = computed(() => played(props.matches))

const record = computed(() => {
  const wins = games.value.filter((m) => mine(m)!.win).length
  return { wins, losses: games.value.length - wins }
})
const winRate = computed(() =>
  games.value.length ? Math.round((record.value.wins / games.value.length) * 100) : null
)
const form = computed(() =>
  games.value
    .slice(0, 20)
    .map((m) => Boolean(mine(m)!.win))
    .reverse()
)

function scored(list: Match[]) {
  return played(list)
    .map((m) => {
      const s = scoreLobby(m)[props.puuid]
      if (!s) return null
      const best = Object.values(scoreLobby(m)).reduce((a, x) => Math.max(a, x.score), 0)
      return { s, mvp: s.score === best, win: Boolean(mine(m)!.win) }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
}
const rated = computed(() => scored(props.matches))
const ratedBefore = computed(() => scored(props.previous))
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const average = computed(() => {
  const v = mean(rated.value.map((r) => r.s.score))
  return v === null ? null : Math.round(v)
})
const best = computed(() =>
  rated.value.length ? rated.value.reduce((a, b) => (b.s.score > a.s.score ? b : a)) : null
)
const change = computed(() => {
  const before = mean(ratedBefore.value.map((r) => r.s.score))
  return average.value === null || before === null || ratedBefore.value.length < 5
    ? null
    : Math.round(average.value - before)
})
const parts = computed(() =>
  SCORE_CATEGORIES.map((c) => {
    const values = rated.value.map((r) => r.s.categories[c]).filter((v) => Number.isFinite(v))
    const v = mean(values)
    return { key: c, name: NAMES[c] ?? c, v: v === null ? null : Math.round(v) }
  }).filter((p): p is { key: (typeof SCORE_CATEGORIES)[number]; name: string; v: number } =>
    Boolean(p.v !== null)
  )
)

/* The trend rows: each game's own figure for the line, the window's average for the value. */
const ROWS = [
  {
    key: 'kda',
    name: 'KDA',
    per: (m: Match) => {
      const p = mine(m)!
      return (p.kills + p.assists) / Math.max(1, p.deaths)
    },
    format: (v: number) => v.toFixed(2),
  },
  {
    key: 'killParticipation',
    name: 'Kill participation',
    per: (m: Match) => killParticipation(mine(m)!, teamTotals(m)),
    format: (v: number) => `${Math.round(v * 100)}%`,
  },
  {
    key: 'csMin',
    name: 'CS per minute',
    per: (m: Match) => mine(m)!.cs / Math.max(1, m.duration / 60),
    format: (v: number) => v.toFixed(1),
  },
  {
    key: 'goldPerMinute',
    name: 'Gold per minute',
    per: (m: Match) => mine(m)!.goldEarned / Math.max(1, m.duration / 60),
    format: (v: number) => String(Math.round(v)),
  },
] as const

const trends = computed(() => {
  const now = props.stats
  const before = props.previousStats
  if (!now?.total) return []
  const oldest = [...games.value].reverse()
  return ROWS.map((row) => {
    const value = now[row.key]
    const was = before?.total ? before[row.key] : null
    const delta = was ? ((value - was) / was) * 100 : null
    return {
      key: row.key,
      name: row.name,
      value: row.format(value),
      delta: delta === null || !Number.isFinite(delta) ? null : Math.round(delta),
      line: spark(
        oldest.map((m) => row.per(m)),
        400,
        30
      ),
    }
  })
})
const pct = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)}%`
</script>

<template>
  <section class="card lit pf">
    <div class="row pf-h">
      <h2 class="h3">Performance</h2>
      <span class="meta"
        >Last {{ games.length }} {{ games.length === 1 ? 'game' : 'games'
        }}<template v-if="previous.length"
          >, against the {{ played(previous).length }} before</template
        ></span
      >
    </div>
    <EmptyState v-if="!games.length" compact icon="sliders" title="No game in these filters" />
    <template v-else>
      <div class="pf-top">
        <div class="col" style="gap: 10px; min-width: 0">
          <span class="lab">Win rate</span>
          <div class="row" style="gap: 10px; align-items: baseline">
            <span class="pf-big">{{ winRate }}<span class="u">%</span></span>
            <span class="meta num">{{ record.wins }}W {{ record.losses }}L</span>
          </div>
          <FormStrip :results="form" />
        </div>
        <div class="col" style="gap: 10px; min-width: 0">
          <span class="lab">Average score</span>
          <div v-if="average !== null" class="row" style="gap: 14px">
            <ScoreDial :value="average" size="lg" />
            <div class="col" style="gap: 4px; min-width: 0">
              <span v-if="best" class="meta"
                >Best <b class="t1 num">{{ Math.round(best.s.score) }}</b
                ><template v-if="best.mvp">, {{ best.win ? 'MVP' : 'ACE' }}</template></span
              >
              <span v-if="change !== null" class="meta num"
                ><b :class="change > 0 ? 'wn' : change < 0 ? 'ls' : 't2'">{{ signed(change) }}</b>
                on the games before</span
              >
              <span class="meta">Emerald pace 41</span>
            </div>
          </div>
          <span v-else class="meta">No scored game</span>
        </div>
        <div v-if="parts.length" class="pillars">
          <div v-for="p in parts" :key="p.key" class="col" style="min-width: 0">
            <span class="lab ell">{{ p.name }}</span>
            <span class="fg-s num" style="margin-top: 6px">{{ p.v }}</span>
            <div class="bar"><i :style="{ width: `${Math.max(0, Math.min(100, p.v))}%` }" /></div>
          </div>
        </div>
      </div>
      <div v-if="trends.length" class="pf-rows">
        <div v-for="t in trends" :key="t.key" class="pf-row">
          <span class="h5 t2">{{ t.name }}</span>
          <div class="chart spark">
            <template v-if="t.line">
              <svg
                class="fade"
                :viewBox="`0 0 ${t.line.w} ${t.line.h}`"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path class="area" :d="t.line.area" />
              </svg>
              <svg
                :viewBox="`0 0 ${t.line.w} ${t.line.h}`"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path class="ln" :d="t.line.d" />
              </svg>
            </template>
          </div>
          <span class="fg-xs num">{{ t.value }}</span>
          <span class="d num" :class="t.delta === null ? 't3' : t.delta >= 0 ? 'wn' : 'ls'">{{
            t.delta === null ? '' : pct(t.delta)
          }}</span>
        </div>
      </div>
    </template>
  </section>
</template>
