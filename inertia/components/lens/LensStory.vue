<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
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

/**
 * One domain as a story: its rating and name, one big figure and one picture (the slots), the
 * plain sentence, and the rest of its figures and its rating over the games behind a quiet
 * "Figures" fold.
 */
const props = defineProps<{
  domain: LensDomain
  /** Under the name: how many games say this. */
  meta: string
  /** What each game of the window is, for the trend's hover. */
  labels: string[]
  wide?: boolean
  /** Figures the card already shows big: a read about one of them keeps to its first sentence. */
  shown?: string[]
}>()

const open = ref(false)

/**
 * The card rises in the first time it comes into view, and only then draws its picture, so each
 * picture's own motion plays where it can be seen. Without motion (or an observer), at once.
 */
const root = useTemplateRef<HTMLElement>('root')
const seen = ref(false)
let observer: IntersectionObserver | undefined
onMounted(() => {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (still || !('IntersectionObserver' in window) || !root.value) {
    seen.value = true
    return
  }
  observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return
      seen.value = true
      observer?.disconnect()
    },
    { rootMargin: '0px 0px -10% 0px' }
  )
  observer.observe(root.value)
})
onBeforeUnmount(() => observer?.disconnect())

const consistency = computed(() => props.domain.key === 'consistency')

const need = computed(() => {
  const d = props.domain
  if (d.need === 'timeline')
    return 'Needs games with a timeline. Newer games come with one; an older game gets its own when you open it.'
  if (d.need === 'games')
    return `Needs at least ${consistency.value ? 5 : MIN_GAMES} games in this role.`
  return null
})

function text(figure: LensFigure, value: number | null) {
  if (value === null) return '–'
  return `${figure.plusMinus ? '±' : ''}${figureText(value, figure.digits, figure.unit)}`
}
const refsOf = (figure: LensFigure) =>
  figure.refs.map((ref) => `${ref.label} ${text(figure, ref.value)}`).join(' · ')
function lean(figure: LensFigure) {
  if (figure.standing === null) return null
  const s = Math.max(-2, Math.min(2, figure.standing))
  return {
    left: 50 + s * 25,
    style: dot(Math.round(ratingOf(figure.standing))),
    word: Math.abs(figure.standing) < 0.2 ? 'Even' : figure.standing > 0 ? 'Ahead' : 'Behind',
  }
}
</script>

<template>
  <article
    :id="`lens-${domain.key}`"
    ref="root"
    class="iv-panel lv-story scroll-mt-20"
    :class="{ 'lv-story-wide': wide, 'unrated': domain.rating === null, seen }"
  >
    <header class="lv-story-head">
      <PerfDial :score="domain.rating" size="sm" />
      <div class="min-w-0">
        <h3>{{ domain.label }}</h3>
        <p class="num">{{ meta }}</p>
      </div>
    </header>

    <template v-if="domain.rating !== null">
      <div class="lv-story-body">
        <div class="lv-story-lead">
          <slot name="figure" />
          <p v-if="domain.read" class="lv-story-read">
            {{ shown?.includes(domain.readFigure ?? '') ? domain.headline : domain.read }}
          </p>
        </div>
        <div class="lv-story-visual">
          <slot v-if="seen" name="visual" />
        </div>
      </div>

      <button
        type="button"
        class="lv-fold"
        :aria-expanded="open"
        :aria-controls="`lens-${domain.key}-figures`"
        @click="open = !open"
      >
        Figures
        <ChevronDown :size="14" :class="{ 'rotate-180': open }" />
      </button>
      <div v-if="open" :id="`lens-${domain.key}-figures`" class="lv-fold-body">
        <ul class="lv-figures">
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
        <div class="lv-fold-trend">
          <div class="lv-fold-trend-head">
            <span>{{
              consistency ? 'Invade score, game by game' : 'Rating, five-game average'
            }}</span>
          </div>
          <LensTrend
            :values="domain.trend"
            :labels="labels"
            :smooth="consistency ? 1 : 5"
            :baseline="consistency ? null : PACE_RATING"
            :label="`${domain.label} over the last ${domain.trend.length} games`"
          />
        </div>
      </div>
    </template>

    <p v-else-if="need" class="lv-story-need">{{ need }}</p>
  </article>
</template>

<style scoped>
.lv-story {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 20px;
  opacity: 0;
  transform: translateY(18px);
  transition:
    opacity 700ms var(--ease-glide),
    transform 900ms var(--ease-glide);
}

.lv-story.seen {
  opacity: 1;
  transform: none;
}

.lv-story-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.lv-story-head h3 {
  font-size: 15px;
  font-weight: 600;
  line-height: 20px;
  color: var(--text-1);
}

.lv-story-head p {
  font-size: 12px;
  line-height: 16px;
  color: var(--text-3);
}

.lv-story-body {
  display: grid;
  flex: 1;
  gap: 20px;
  margin-top: 18px;
}

.lv-story-wide .lv-story-body {
  align-items: center;
}

@media (min-width: 64rem) {
  .lv-story-wide .lv-story-body {
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
    gap: 40px;
  }
}

.lv-story-read {
  margin-top: 12px;
  font-size: 14px;
  line-height: 21px;
  color: var(--text-2);
  text-wrap: pretty;
}

.lv-story-visual {
  min-width: 0;
  min-height: 120px;
}

.lv-story-need {
  margin-top: 14px;
  font-size: 13px;
  line-height: 19px;
  color: var(--text-3);
  text-wrap: pretty;
}

.lv-fold {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  min-height: 32px;
  margin-top: 14px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
  transition: color var(--t-fast) var(--ease);
}

.lv-fold:hover {
  color: var(--text-1);
}

.lv-fold svg {
  transition: transform var(--t-base) var(--ease);
}

@media (pointer: coarse) {
  .lv-fold {
    min-height: 40px;
  }
}

.lv-fold-body {
  animation: lv-unfold 240ms var(--ease) both;
}

@keyframes lv-unfold {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}

.lv-figures {
  border-top: 1px solid var(--line);
}

.lv-figure {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 44px minmax(56px, auto);
  align-items: center;
  gap: 14px;
  min-height: 46px;
  padding: 5px 0;
  border-bottom: 1px solid var(--line);
}

.lv-figure-label {
  font-size: 13px;
  line-height: 18px;
  color: var(--text-2);
}

.lv-figure-refs {
  overflow: hidden;
  font-size: 12px;
  line-height: 16px;
  color: var(--text-3);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.lv-figure-value {
  font-size: 15px;
  font-weight: 600;
  text-align: right;
  color: var(--text-1);
}

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

.lv-fold-trend {
  padding-top: 14px;
}

.lv-fold-trend-head {
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--text-3);
}

@media (prefers-reduced-motion: reduce) {
  .lv-story {
    opacity: 1;
    transform: none;
    transition: none;
  }

  .lv-fold-body {
    animation: none;
  }
}
</style>
