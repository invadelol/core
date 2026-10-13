<script setup lang="ts">
import { computed } from 'vue'
import { PerfDial } from '@invadelol/ui'
import LensTrend from './LensTrend.vue'
import { dot } from './tone.js'
import {
  figureText,
  MIN_GAMES,
  PACE_RATING,
  ratingOf,
  type LensDomain,
  type LensFigure,
} from '../../lib/lens.js'

const props = defineProps<{
  domain: LensDomain
  /** What each game of the window is, for the trend's hover. */
  labels: string[]
  /** Games read in the window, and how many of them have a timeline. */
  window: number
  timelineGames: number
  /** Across the whole grid: the figures beside a wider trend. */
  wide?: boolean
}>()

const laning = computed(() => props.domain.key === 'laning')
const consistency = computed(() => props.domain.key === 'consistency')

const meta = computed(() => {
  const d = props.domain
  if (laning.value) return `${props.timelineGames} of ${props.window} games have a timeline`
  return `${d.games} ${d.games === 1 ? 'game' : 'games'}`
})

/** Why there is no rating yet, said quietly. */
const need = computed(() => {
  const d = props.domain
  if (d.need === 'timeline')
    return d.games
      ? `Needs ${MIN_GAMES} games with a timeline. Newer games come with one; an older game gets its own when you open it.`
      : 'Needs games with a timeline. Newer games come with one; an older game gets its own when you open it.'
  if (d.need === 'games')
    return `Needs at least ${consistency.value ? 5 : MIN_GAMES} games in this role.`
  return null
})

function text(figure: LensFigure, value: number | null) {
  if (value === null) return '–'
  return `${figure.plusMinus ? '±' : ''}${figureText(value, figure.digits, figure.unit)}`
}

/**
 * Where a figure stands, on a short track: even in the middle, two spreads to either side. Ahead
 * is a filled dot in the rating's colour; behind stays a quiet hollow one, and the words say it.
 */
function lean(figure: LensFigure) {
  if (figure.standing === null) return null
  const s = Math.max(-2, Math.min(2, figure.standing))
  return {
    left: 50 + s * 25,
    style: dot(Math.round(ratingOf(figure.standing))),
    word: Math.abs(figure.standing) < 0.2 ? 'Even' : figure.standing > 0 ? 'Ahead' : 'Behind',
  }
}

const refsOf = (figure: LensFigure) =>
  figure.refs.map((ref) => `${ref.label} ${text(figure, ref.value)}`).join(' · ')

const trendLabel = computed(() =>
  consistency.value
    ? `Invade score in each of the last ${props.domain.trend.length} games`
    : `${props.domain.label} rating over the last ${props.domain.trend.length} games`
)
</script>

<template>
  <article
    :id="`lens-${domain.key}`"
    class="iv-panel lv-card scroll-mt-20"
    :class="{ 'lv-wide lg:col-span-2': wide }"
  >
    <header class="lv-card-head">
      <PerfDial :score="domain.rating" size="sm" />
      <div class="min-w-0">
        <h3>{{ domain.label }}</h3>
        <p class="meta num">{{ meta }}</p>
      </div>
    </header>

    <div class="lv-card-body">
      <div class="min-w-0">
        <p v-if="domain.read" class="lv-read">{{ domain.read }}</p>
        <p v-else-if="need" class="lv-need">{{ need }}</p>

        <ul v-if="domain.rating !== null && domain.figures.length" class="lv-figures">
          <li v-for="figure in domain.figures" :key="figure.key" class="lv-figure">
            <div class="min-w-0">
              <div class="lv-figure-label">{{ figure.label }}</div>
              <div v-if="figure.refs.length" class="lv-figure-refs num">{{ refsOf(figure) }}</div>
            </div>
            <span
              v-if="lean(figure)"
              class="lv-lean"
              role="img"
              :aria-label="lean(figure)!.word"
              :title="lean(figure)!.word"
            >
              <i :style="{ left: `${lean(figure)!.left}%`, ...lean(figure)!.style }" />
            </span>
            <span v-else />
            <span class="lv-figure-value num">{{ text(figure, figure.value) }}</span>
          </li>
        </ul>
      </div>

      <div v-if="domain.rating !== null" class="lv-card-trend">
        <div class="lv-card-trend-head">
          <span>{{
            consistency ? 'Invade score, game by game' : 'Rating, five-game average'
          }}</span>
          <span v-if="!consistency" class="lv-legend">Emerald pace</span>
        </div>
        <LensTrend
          :values="domain.trend"
          :labels="labels"
          :smooth="consistency ? 1 : 5"
          :baseline="consistency ? null : PACE_RATING"
          :height="wide ? 104 : 64"
          :label="trendLabel"
        />
      </div>
    </div>
  </article>
</template>

<style scoped>
.lv-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 16px;
}

.lv-card-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.lv-card-head h3 {
  font-size: 15px;
  font-weight: 600;
  line-height: 20px;
  letter-spacing: -0.005em;
  color: var(--text-1);
}

.lv-card-head .meta {
  margin-top: 1px;
  font-size: 12px;
  line-height: 16px;
}

.lv-read {
  margin-top: 12px;
  font-size: 13.5px;
  line-height: 20px;
  color: var(--text-2);
  text-wrap: pretty;
}

.lv-need {
  margin-top: 12px;
  font-size: 13px;
  line-height: 19px;
  color: var(--text-3);
  text-wrap: pretty;
}

.lv-figures {
  margin-top: 12px;
  border-top: 1px solid var(--line);
}

.lv-figure {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 44px minmax(56px, auto);
  align-items: center;
  gap: 14px;
  min-height: 48px;
  padding: 6px 0;
  border-bottom: 1px solid var(--line);
}

.lv-figure-label {
  font-size: 13px;
  line-height: 18px;
  color: var(--text-2);
}

.lv-figure-refs {
  font-size: 12px;
  line-height: 16px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lv-figure-value {
  font-size: 16px;
  font-weight: 600;
  line-height: 20px;
  text-align: right;
  color: var(--text-1);
}

/* Where the figure stands: a hairline, even marked in its middle, the dot to one side. */
.lv-lean {
  position: relative;
  height: 12px;
  background:
    linear-gradient(var(--line-3), var(--line-3)) 50% 50% / 1px 100% no-repeat,
    linear-gradient(var(--track), var(--track)) 0 50% / 100% 2px no-repeat;
}

.lv-lean i {
  position: absolute;
  top: 50%;
  width: 7px;
  height: 7px;
  margin: -3.5px 0 0 -3.5px;
  border-radius: 50%;
}

.lv-card-body {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.lv-card-trend {
  margin-top: auto;
  padding-top: 16px;
}

/* Across the grid: the read and figures on the left, the games on a wider chart beside them. */
@media (min-width: 64rem) {
  .lv-wide .lv-card-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
    gap: 40px;
    align-items: end;
  }

  .lv-wide .lv-card-trend {
    padding-top: 0;
    padding-bottom: 4px;
  }
}

/* The benchmark's key: a short dashed hairline before its name. */
.lv-legend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-4);
}

.lv-legend::before {
  content: '';
  width: 14px;
  height: 1px;
  background: repeating-linear-gradient(90deg, var(--line-3) 0 3px, transparent 3px 6px);
}

.lv-card-trend-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 12px;
  line-height: 16px;
  color: var(--text-3);
}
</style>
