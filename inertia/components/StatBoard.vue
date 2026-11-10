<script setup lang="ts">
import { computed } from 'vue'
import { PerfDial } from '@invadelol/ui'
import FormStrip from './ui/FormStrip.vue'
import VioletLine from './ui/VioletLine.vue'
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
  /** The queue the board and the games below are filtered to. */
  queue?: string
}>()

const emit = defineEmits<{ queue: [value: string] }>()

const QUEUES = [
  ['all', 'All'],
  ['ranked', 'Solo/Duo'],
  ['flex', 'Flex'],
  ['normal', 'Normals'],
  ['aram', 'ARAM'],
] as const

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
        dmgMin: (me.totalDamageDealtToChampions || 0) / minutes,
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

/** The five key figures. Kill participation is in percent throughout. */
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
    label: 'Kill part.',
    name: 'Kill participation',
    of: (s: GlobalStats) => s.killParticipation * 100,
    game: (g: Game) => g.kp,
    digits: 0,
    percent: true,
    span: 40,
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
    id: 'dpm',
    label: 'Damage/min',
    name: 'Damage to champions per minute',
    of: (s: GlobalStats) => s.damagePerMinute,
    game: (g: Game) => g.dmgMin,
    digits: 0,
    span: 400,
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

/** A figure as shown: a percentage, or the number with its digits; '-' when there is none. */
const fmt = (f: Figure, v: number) =>
  !Number.isFinite(v)
    ? '-'
    : f.percent
      ? `${Math.round(v)}%`
      : f.digits === 0
        ? Math.round(v).toLocaleString('en-US')
        : v.toFixed(f.digits)

/** A sparkline's range: at least the figure's ordinary span, so noise stays gentle. */
function sparkRange(f: Figure) {
  const lo = Math.min(...f.values)
  const hi = Math.max(...f.values)
  const mid = (lo + hi) / 2
  const half = Math.max(hi - lo, f.span * 0.5) / 2
  return { min: mid - half, max: mid + half }
}

const form = computed(() => games.value.filter((g) => !g.remake).map((g) => g.win))

/** Signed gap to the base; percentages in points. A gap that rounds to nothing shows as 0. */
function gap(f: Figure) {
  const d = f.value - f.base
  if (!Number.isFinite(d)) return ''
  if (Math.abs(d) < 0.5 / 10 ** f.digits) return (0).toFixed(f.digits)
  return `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(f.digits)}`
}
</script>

<template>
  <!-- Performance: the featured sheet of the profile. The Invade score on the dial with the record
       and the form, then the five key figures with their gap to the games before and a line of
       each game. The queue filter here also filters the games below. -->
  <section class="rd-card rd-lit perf-card">
    <div class="rd-head">
      <h2>
        Performance<span v-if="stats?.total" class="rd-meta num"
          >Last {{ stats.total }} games<template v-if="previous?.total"
            >, against the {{ previous.total }} before</template
          ></span
        >
      </h2>
      <div class="rd-seg" role="group" aria-label="Queue">
        <button
          v-for="[value, label] in QUEUES"
          :key="value"
          type="button"
          :class="{ on: (queue ?? 'all') === value }"
          :aria-pressed="(queue ?? 'all') === value"
          @click="emit('queue', value)"
        >
          {{ label }}
        </button>
      </div>
    </div>

    <p v-if="!stats || !stats.total" class="perf-empty">No games in this window.</p>

    <template v-else>
      <div class="perf">
        <div
          class="perf-s"
          :title="
            score
              ? `Average Invade score ${score.average} of 100 over ${score.count} scored games, each rated against the other nine players`
              : undefined
          "
        >
          <PerfDial class="perf-dial" :score="score?.average ?? null" />
          <span class="min-w-0">
            <small>Invade score</small>
            <b class="num">{{ record.wins }}W {{ record.losses }}L</b>
            <FormStrip v-if="form.length" class="perf-form" :results="form" />
            <small v-if="score" class="num perf-best">
              Best {{ score.best
              }}<template v-if="score.trend"
                >,
                <em :class="Math.abs(score.trend) >= 5 ? (score.trend > 0 ? 'rd-up' : 'rd-dn') : ''"
                  >{{ score.trend > 0 ? '+' : '−' }}{{ Math.abs(score.trend) }}</em
                >
                in later games</template
              >
            </small>
          </span>
        </div>

        <div
          v-for="f in figures"
          :key="f.id"
          class="st"
          :title="
            Number.isFinite(f.base)
              ? `${f.name}: ${fmt(f, f.value)}, ${fmt(f, f.base)} over the ${previous?.total} games before`
              : f.name
          "
        >
          <label>{{ f.label }}</label>
          <div class="rd-fig">{{ fmt(f, f.value) }}</div>
          <small
            class="num"
            :class="f.tone === 'up' ? 'rd-up' : f.tone === 'down' ? 'rd-dn' : 'rd-flat'"
            >{{ gap(f) || '&nbsp;' }}</small
          >
          <VioletLine
            v-if="f.values.length > 1"
            class="spark"
            :values="f.values"
            :min="sparkRange(f).min"
            :max="sparkRange(f).max"
            :height="26"
            :pad="3"
            :area="false"
            thin
          />
        </div>
      </div>

      <ul v-if="score?.categories.length" class="parts">
        <li
          v-for="category in score.categories"
          :key="category.key"
          :title="`${category.label}: ${category.value} of 100, part of the Invade score`"
        >
          <span>{{ category.label }}</span>
          <b class="num">{{ category.value }}</b>
          <span class="rd-bar"><i :style="{ width: `${category.value}%` }" /></span>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.perf-card {
  container-type: inline-size;
}
.perf-empty {
  margin: 0;
  padding: 24px 20px;
  font-size: 13px;
  color: var(--text-2);
}
.perf {
  display: grid;
  grid-template-columns: auto repeat(5, minmax(0, 1fr));
  align-items: center;
  padding: 20px;
}
.perf-s {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-right: 22px;
}
.perf-s small {
  display: block;
  font-size: 12px;
  color: var(--text-3);
}
.perf-s b {
  display: block;
  font-size: 15px;
  font-weight: 650;
  color: var(--text-1);
}
.perf-s em {
  font-style: normal;
}
.perf-form {
  margin-top: 6px;
}
.perf-best {
  margin-top: 4px;
}
.perf-dial:deep(svg),
.perf-dial {
  width: 96px;
  height: 96px;
}
.perf-dial:deep(.iv-dial-track),
.perf-dial:deep(.iv-dial-arc) {
  stroke-width: 2.4;
}
.perf-dial:deep(b) {
  font-size: 34px;
  font-weight: 700;
}
.st {
  min-width: 0;
  padding: 0 0 0 20px;
}
.st label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}
.st .rd-fig {
  font-size: 24px;
  line-height: 1.15;
  white-space: nowrap;
}
.st small {
  display: block;
  font-size: 12px;
}
.spark {
  margin-top: 6px;
}
.parts {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px 20px;
  margin: 0;
  padding: 14px 20px 16px;
  list-style: none;
  box-shadow: inset 0 1px 0 var(--rd-line);
}
.parts li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 8px;
  align-items: baseline;
  min-width: 0;
  font-size: 12px;
  color: var(--text-3);
}
.parts b {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}
.parts .rd-bar {
  grid-column: 1 / -1;
  height: 3px;
}

@container (max-width: 860px) {
  .perf {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    row-gap: 18px;
  }
  .perf-s {
    grid-column: 1 / -1;
    padding: 0;
  }
  .st {
    padding: 0 12px 0 0;
  }
  .perf-dial,
  .perf-dial:deep(svg) {
    width: 72px;
    height: 72px;
  }
  .perf-dial:deep(b) {
    font-size: 26px;
  }
}
@container (max-width: 520px) {
  .perf {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: 16px;
  }
  .parts {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    padding: 12px 16px 14px;
  }
}
</style>
