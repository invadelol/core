<script setup lang="ts">
import { computed } from 'vue'
import { PerfDial, TrendLine } from '@invadelol/ui'
import {
  isRemake,
  killParticipation,
  matchMinutes,
  SCORE_CATEGORIES,
  scoreLobby,
  teamTotals,
  type ScoreCategory,
} from '../lib/match.js'
import type { GlobalStats, Match } from '../lib/types.js'

/**
 * The profile's Performance panel, built as the desktop app's: the average Invade score on the dial
 * with the record, then each key figure with its value, the gap to the window before and its
 * game-by-game line over that dashed value. Below, aligned on the same columns, the form and what
 * the score is made of.
 */
const props = defineProps<{
  /** The window being shown, already filtered. */
  stats: GlobalStats | null
  /** The window immediately before it, for the trend. */
  previous: GlobalStats | null
  /** Recent matches, newest first. The trend lines are read from these. */
  matches: Match[]
  puuid: string
  /** How many games the window asks for. */
  window: number
}>()

const CATEGORY_LABEL: Record<ScoreCategory, string> = {
  fighting: 'Fighting',
  damage: 'Damage',
  farming: 'Farming',
  vision: 'Vision',
  objectives: 'Objectives',
}

/** One row per game, oldest first, so every line shares an x axis. */
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
        visionMin: (me.visionScore || 0) / minutes,
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
    return { key, label: CATEGORY_LABEL[key], value }
  }).filter((c): c is { key: typeof c.key; label: string; value: number } => c.value !== null)
  return {
    categories,
    average: Math.round(mean(list)),
    count: list.length,
    best: Math.max(...list.map((g) => g.score)),
    trend,
  }
})

type Game = (typeof games.value)[number]

interface Figure {
  id: string
  label: string
  /** The figure's full name, for its tooltip. */
  name: string
  /** Game by game, oldest first. */
  values: number[]
  value: number
  /** The window before; NaN when there is none. */
  base: number
  /** The least range its line stands for, so ordinary noise stays gentle. */
  span: number
  digits: number
  percent?: boolean
  tone: '' | 'up' | 'down'
}

/** The app's five key figures, in its order. Kill participation is in percent throughout. */
const FIGURES = [
  {
    id: 'csm',
    label: 'CS/min',
    name: 'CS per minute',
    of: (s: GlobalStats) => s.csMin,
    game: (g: Game) => g.csMin,
    digits: 1,
    span: 3,
  },
  {
    id: 'kp',
    label: 'KP',
    name: 'Kill participation',
    of: (s: GlobalStats) => s.killParticipation * 100,
    game: (g: Game) => g.kp,
    digits: 0,
    percent: true,
    span: 40,
  },
  {
    id: 'vpm',
    label: 'Vision/min',
    name: 'Vision score per minute',
    of: (s: GlobalStats) => s.visionMin,
    game: (g: Game) => g.visionMin,
    digits: 2,
    span: 1,
  },
  {
    id: 'kda',
    label: 'KDA',
    name: 'KDA',
    of: (s: GlobalStats) => s.kda,
    game: (g: Game) => g.kda,
    digits: 2,
    span: 6,
  },
  {
    id: 'gpm',
    label: 'Gold/min',
    name: 'Gold per minute',
    of: (s: GlobalStats) => s.goldPerMinute,
    game: (g: Game) => g.goldMin,
    digits: 0,
    span: 200,
  },
] as const

const figures = computed<Figure[]>(() => {
  const now = props.stats
  if (!now) return []
  const before = props.previous?.total ? props.previous : null
  const played = games.value.filter((g) => !g.remake)
  return FIGURES.map((f) => {
    const value = f.of(now)
    const base = before ? f.of(before) : NaN
    const d = value - base
    /* A gap counts when it is more than 5% of the line, as in the app. */
    const tone = Math.abs(d) >= Math.abs(base) * 0.05 && d !== 0 ? (d > 0 ? 'up' : 'down') : ''
    return {
      id: f.id,
      label: f.label,
      name: f.name,
      values: played.map(f.game).filter((v) => Number.isFinite(v)),
      value,
      base,
      span: f.span,
      digits: f.digits,
      percent: 'percent' in f,
      tone,
    }
  })
})

/** A figure as shown: a percentage, or the number with its digits; '–' when there is none. */
const fmt = (f: Figure, v: number) =>
  !Number.isFinite(v) ? '–' : f.percent ? `${Math.round(v)}%` : v.toFixed(f.digits)

/** Signed gap to the base; percentages in points. A gap that rounds to nothing shows as 0. */
function gap(f: Figure) {
  const d = f.value - f.base
  if (!Number.isFinite(d)) return ''
  if (Math.abs(d) < 0.5 / 10 ** f.digits) return (0).toFixed(f.digits)
  return `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(f.digits)}`
}

const winrate = computed(() => Math.round((props.stats?.winrate ?? 0) * 100))
</script>

<template>
  <!-- Performance: the desktop app's strip (score, record, the key figures over the games), then
       the form and the parts of the score on the same columns. -->
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

    <div v-else class="iv-panel lit-sheet sb">
      <div class="sb-grid">
        <div
          class="sb-head"
          :title="
            score
              ? `Average Invade score ${score.average} of 100 over ${score.count} scored games, each rated against the other nine players`
              : undefined
          "
        >
          <PerfDial :score="score?.average ?? null" />
          <p>
            <small>Invade score</small>
            <span>{{ record.wins }}W {{ record.losses }}L · {{ winrate }}%</span>
            <small v-if="score">
              Best {{ score.best }}
              <template v-if="score.trend">
                ·
                <em :class="Math.abs(score.trend) >= 5 ? (score.trend > 0 ? 'up' : 'down') : ''"
                  >{{ score.trend > 0 ? '+' : '−' }}{{ Math.abs(score.trend) }}</em
                >
                in later games
              </template>
            </small>
          </p>
        </div>

        <ul class="sb-figs">
          <li
            v-for="f in figures"
            :key="f.id"
            :title="
              Number.isFinite(f.base)
                ? `${f.name}: ${fmt(f, f.value)}, ${fmt(f, f.base)} over the ${previous?.total} games before`
                : f.name
            "
          >
            <span>{{ f.label }}</span>
            <p>
              <b>{{ fmt(f, f.value) }}</b
              ><em :class="f.tone">{{ gap(f) }}</em>
            </p>
            <div
              class="sb-spark"
              role="img"
              :aria-label="`${f.name} over the last ${f.values.length} games`"
            >
              <TrendLine
                :values="f.values"
                :baseline="Number.isFinite(f.base) ? f.base : null"
                :span="f.span"
                :height="32"
                area
              />
            </div>
            <small>{{ Number.isFinite(f.base) ? `Before ${fmt(f, f.base)}` : '' }}</small>
          </li>
        </ul>

        <template v-if="games.length || score?.categories.length">
          <div class="sb-rule" />

          <div v-if="games.length" class="sb-form">
            <small>Form</small>
            <span class="iv-form" :title="`Last ${games.length} games, oldest first`">
              <i
                v-for="game in games"
                :key="game.id"
                :class="game.remake ? 'r' : game.win ? 'w' : 'l'"
                :title="game.remake ? 'Remake' : game.win ? 'Win' : 'Loss'"
              />
            </span>
          </div>

          <ul v-if="score?.categories.length" class="sb-parts">
            <li
              v-for="category in score.categories"
              :key="category.key"
              :title="`${category.label}: ${category.value} of 100, part of the Invade score`"
            >
              <span>{{ category.label }}</span>
              <b>{{ category.value }}</b>
              <div class="meter">
                <span :style="{ width: `${category.value}%` }" />
              </div>
            </li>
          </ul>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* One wide strip, as the app's profile: the dial and the record on the left, then the five figures
   side by side, each with its value and gap, a short line over the dashed window before, and that
   value in small type. A narrow strip puts the record on top and the figures 3 + 2. */
.sb {
  padding: 16px 20px;
  container-type: inline-size;
}
.sb-grid {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0 24px;
}
.sb-head {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding-right: 24px;
  border-right: 1px solid var(--line);
}
.sb-head :deep(.iv-dial) {
  width: 56px;
  height: 56px;
}
.sb-head :deep(.iv-dial b) {
  font-size: 18px;
}
.sb-head p {
  display: grid;
  gap: 2px;
  min-width: 0;
  margin: 0;
}
.sb-head span {
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: var(--text-1);
}
.sb-head small {
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: var(--text-3);
}
.sb em {
  font-style: normal;
}
.sb em.up {
  color: var(--win);
}
.sb em.down {
  color: var(--loss);
}

.sb-figs,
.sb-parts {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px 20px;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}
.sb-figs li,
.sb-parts li {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.sb-figs li > span,
.sb-figs li > small,
.sb-parts li > span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.sb-figs li > span,
.sb-parts li > span {
  font-size: 12px;
  color: var(--text-2);
}
.sb-figs p {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.sb-figs b,
.sb-parts b {
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-1);
}
.sb-figs em {
  font-size: 12px;
  color: var(--text-3);
}
/* The line in a box of a fixed height with the SVG pinned to it. */
.sb-spark {
  position: relative;
  height: 32px;
  margin-top: 4px;
  overflow: hidden;
}
.sb-spark :deep(.iv-trend) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.sb-spark :deep(.iv-trend-base) {
  opacity: 0.5;
}
.sb-figs li > small {
  min-height: 1.3em;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--text-4);
}

/* The second row: a hairline across, then the form under the record and the parts of the score
   under the figures. */
.sb-rule {
  grid-column: 1 / -1;
  height: 1px;
  margin: 14px 0;
  background: var(--line);
}
.sb-form {
  display: grid;
  gap: 6px;
  min-width: 0;
  align-self: start;
}
.sb-form small {
  font-size: 12px;
  color: var(--text-2);
}
/* The games as one row of ticks that fills the column, however many there are. */
.sb-form .iv-form {
  display: flex;
  flex-wrap: nowrap;
  gap: 2px;
  width: 100%;
}
.sb-form .iv-form i {
  flex: 1 1 0;
  min-width: 2px;
  max-width: 8px;
  height: 12px;
}
.sb-parts {
  grid-column: 2;
  align-self: start;
}
.sb-parts li {
  gap: 4px;
}
.sb-parts .meter {
  height: 3px;
  margin-top: 2px;
}

/* Narrow: the record above, the figures and the parts 3 + 2. */
@container (max-width: 760px) {
  .sb-grid {
    grid-template-columns: minmax(0, 1fr);
    row-gap: 12px;
  }
  .sb-head {
    padding: 0 0 12px;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
  .sb-head :deep(.iv-dial) {
    width: 44px;
    height: 44px;
  }
  .sb-head :deep(.iv-dial b) {
    font-size: 15px;
  }
  .sb-head p {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 10px;
  }
  .sb-figs,
  .sb-parts {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    row-gap: 10px;
  }
  .sb-spark {
    height: 28px;
  }
  .sb-rule {
    margin: 2px 0;
  }
  .sb-parts {
    grid-column: 1;
  }
}
</style>
