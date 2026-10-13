<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { tone } from './tone.js'
import { championName, championSplash, champIcon } from '../../lib/assets.js'
import { PACE_RATING, type LensDomain } from '../../lib/lens.js'

/**
 * The Lens at a glance, on the main champion's art: an aperture with one petal per domain, each
 * reaching as far as its rating, the Emerald pace a fine dashed ring through them, the champion
 * in the middle. Beside it the average score and, in words, the strongest and weakest domain.
 * The petals open when the stage first shows.
 */
const props = defineProps<{
  domains: LensDomain[]
  score: number | null
  games: number
  timelineGames: number
  roleName: string
  champion: number | null
}>()

const emit = defineEmits<{ open: [key: string] }>()

const SHORT: Record<string, string> = { fighting: 'Fighting' }

const rated = computed(() =>
  props.domains.filter((d): d is LensDomain & { rating: number } => d.rating !== null)
)
const calls = computed(() => {
  if (rated.value.length < 2) return []
  const sorted = [...rated.value].sort((a, b) => b.rating - a.rating)
  return [
    { title: 'Strongest', domain: sorted[0] },
    { title: 'Weakest', domain: sorted[sorted.length - 1] },
  ]
})

/* ── The aperture ─────────────────────────────────────────────── */
const R = 158
const HOLE = 42
const reach = (rating: number) => HOLE + ((R - HOLE) * Math.max(5, Math.min(100, rating))) / 100
const polar = (r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180
  return [r * Math.cos(a), r * Math.sin(a)] as const
}
const f = (v: number) => v.toFixed(2)
function sector(r0: number, r1: number, a0: number, a1: number) {
  const [x0, y0] = polar(r0, a0)
  const [x1, y1] = polar(r1, a0)
  const [x2, y2] = polar(r1, a1)
  const [x3, y3] = polar(r0, a1)
  return `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}A${r1} ${r1} 0 0 1 ${f(x2)} ${f(y2)}L${f(x3)} ${f(y3)}A${r0} ${r0} 0 0 0 ${f(x0)} ${f(y0)}Z`
}
const petals = computed(() => {
  const step = 360 / (props.domains.length || 1)
  return props.domains.map((d, i) => {
    const mid = i * step
    const a0 = mid - step / 2 + 2
    const a1 = mid + step / 2 - 2
    const [lx, ly] = polar(R + 30, mid)
    return {
      key: d.key,
      label: SHORT[d.key] ?? d.label,
      rating: d.rating,
      shape: d.rating === null ? null : sector(HOLE, reach(d.rating), a0, a1),
      slot: sector(HOLE, R, a0, a1),
      colour: tone(d.rating),
      ahead: d.rating !== null && d.rating >= PACE_RATING,
      lx,
      ly,
      anchor: Math.abs(lx) < 14 ? 'middle' : lx > 0 ? 'start' : 'end',
      delay: `${160 + i * 80}ms`,
      later: `${760 + i * 60}ms`,
    }
  })
})
const paceRadius = reach(PACE_RATING)

/** The petal under the pointer or focus: the others step back. */
const active = ref<string | null>(null)

function key(event: KeyboardEvent, domain: string) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    emit('open', domain)
  }
}

/* ── The score counts up as the petals open ───────────────────── */
const counted = ref(props.score ?? 0)
let frame = 0
function count() {
  cancelAnimationFrame(frame)
  const target = props.score ?? 0
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    counted.value = target
    return
  }
  const start = performance.now()
  const from = 0
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / 1100)
    const eased = 1 - (1 - t) ** 3
    counted.value = Math.round(from + (target - from) * eased)
    if (t < 1) frame = requestAnimationFrame(step)
  }
  frame = requestAnimationFrame(step)
}
onMounted(count)
watch(() => props.score, count)
onBeforeUnmount(() => cancelAnimationFrame(frame))

const splash = computed(() => (props.champion ? championSplash(props.champion) : null))
</script>

<template>
  <section class="lv-stage iv-dark">
    <img
      v-if="splash"
      :key="splash"
      class="lv-stage-art"
      :src="splash"
      alt=""
      aria-hidden="true"
      decoding="async"
    />
    <div class="lv-stage-light" aria-hidden="true" />

    <div class="lv-stage-copy">
      <p class="lv-stage-over">
        {{ roleName }}<template v-if="champion"> · {{ championName(champion) }}</template>
      </p>
      <div class="lv-stage-score">
        <span class="iv-fig" :aria-label="`Invade score ${score ?? 'not rated'}`">{{
          score === null ? '–' : counted
        }}</span>
        <span class="lv-stage-score-label num">
          Invade score<br />{{ games }} games · {{ timelineGames }} with a timeline
        </span>
      </div>
      <dl v-if="calls.length" class="lv-stage-calls">
        <div v-for="call in calls" :key="call.title">
          <dt>
            {{ call.title }}
            <button type="button" @click="emit('open', call.domain.key)">
              {{ call.domain.label }}
              <span class="num" :style="{ color: tone(call.domain.rating) }">{{
                call.domain.rating
              }}</span>
            </button>
          </dt>
          <dd>{{ call.domain.headline }}</dd>
        </div>
      </dl>
    </div>

    <div class="lv-aperture-wrap">
      <svg
        class="lv-aperture"
        :class="{ focused: active }"
        viewBox="-275 -232 550 464"
        role="group"
        aria-label="Each domain's rating, with the Emerald pace as a ring"
      >
        <circle :r="R" class="lv-ring-outer" />
        <path v-for="p in petals" :key="`slot-${p.key}`" :d="p.slot" class="lv-slot" />
        <g
          v-for="p in petals"
          :key="p.key"
          class="lv-domain"
          :class="{ on: active === p.key }"
          role="button"
          tabindex="0"
          :aria-label="`${p.label} ${p.rating ?? 'not rated yet'}`"
          @click="emit('open', p.key)"
          @keydown="key($event, p.key)"
          @pointerenter="active = p.key"
          @pointerleave="active = null"
          @focus="active = p.key"
          @blur="active = null"
        >
          <path :d="p.slot" class="lv-hit" />
          <path
            v-if="p.shape"
            :d="p.shape"
            class="lv-petal"
            :class="{ quiet: !p.ahead }"
            :style="{ '--c': p.colour, 'animationDelay': p.delay }"
          />
          <g class="lv-label" :style="{ animationDelay: p.later }">
            <text :x="p.lx" :y="p.ly - 3" :text-anchor="p.anchor" class="name">
              {{ p.label }}
            </text>
            <text :x="p.lx" :y="p.ly + 17" :text-anchor="p.anchor" class="value">
              {{ p.rating ?? '–' }}
            </text>
          </g>
        </g>
        <circle :r="paceRadius" class="lv-ring-pace" />
        <clipPath id="lv-hole"><circle :r="HOLE - 5" /></clipPath>
        <image
          v-if="champion"
          :href="champIcon(champion)"
          :x="-(HOLE - 5)"
          :y="-(HOLE - 5)"
          :width="(HOLE - 5) * 2"
          :height="(HOLE - 5) * 2"
          clip-path="url(#lv-hole)"
          preserveAspectRatio="xMidYMid slice"
        />
        <circle :r="HOLE - 5" class="lv-hole-rim" />
      </svg>
      <p class="lv-key"><i /> Emerald pace for {{ roleName }}</p>
    </div>
  </section>
</template>

<style scoped>
.lv-stage {
  position: relative;
  display: grid;
  gap: 8px;
  overflow: hidden;
  isolation: isolate;
  padding: 28px 28px 20px;
  color: var(--text-1);
  background: var(--ink-1);
  border-radius: var(--r-lg);
  box-shadow: var(--window-depth);
}

@media (min-width: 48rem) {
  .lv-stage {
    grid-template-columns: minmax(220px, 0.75fr) minmax(0, 1.25fr);
    align-items: center;
    min-height: 470px;
    padding: 28px 32px;
  }
}

/* The champion's art, behind the aperture, fading into the ink where the words sit. */
.lv-stage-art {
  position: absolute;
  inset: 0;
  z-index: -2;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 68% 22%;
  opacity: 0.4;
  mask-image: linear-gradient(90deg, transparent 6%, #000 60%);
  animation: lv-art 1600ms var(--ease-glide) both;
}

@keyframes lv-art {
  from {
    opacity: 0;
    transform: scale(1.06);
  }
}

.lv-stage-light {
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    linear-gradient(0deg, var(--ink-1), transparent 40%),
    radial-gradient(90% 120% at 100% 0%, rgb(var(--brand-rgb) / 0.14), transparent 60%);
}

/* The window's lit edge and rim. */
.lv-stage::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow:
    var(--lit),
    inset 0 0 0 1px var(--line);
  pointer-events: none;
}

.lv-stage-copy {
  animation: lv-rise 900ms 100ms var(--ease-glide) both;
}

@keyframes lv-rise {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
}

.lv-stage-over {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
}

.lv-stage-score {
  display: flex;
  align-items: flex-end;
  gap: 14px;
  margin-top: 10px;
}

.lv-stage-score .iv-fig {
  min-width: 2ch;
  font-size: 76px;
  line-height: 0.82;
  letter-spacing: -0.03em;
}

.lv-stage-score-label {
  padding-bottom: 3px;
  font-size: 12px;
  line-height: 17px;
  color: var(--text-3);
}

.lv-stage-calls {
  display: grid;
  gap: 18px;
  max-width: 340px;
  margin-top: 30px;
}

.lv-stage-calls dt {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 12px;
  color: var(--text-3);
}

.lv-stage-calls dt button {
  display: inline-flex;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  transition: color var(--t-fast) var(--ease);
}

.lv-stage-calls dt button:hover {
  color: var(--brand-hi);
}

.lv-stage-calls dd {
  margin-top: 3px;
  font-size: 16px;
  line-height: 22px;
  letter-spacing: -0.005em;
  color: var(--text-1);
  text-wrap: pretty;
}

/* ── The aperture ── */
.lv-aperture-wrap {
  display: grid;
  justify-items: center;
  min-width: 0;
}

.lv-aperture {
  width: 100%;
  max-width: 540px;
  height: auto;
  overflow: visible;
}

.lv-ring-outer {
  fill: none;
  stroke: var(--line);
}

.lv-slot {
  fill: var(--glint);
  stroke: var(--line);
}

.lv-hit {
  fill: transparent;
}

.lv-domain {
  cursor: pointer;
  outline: none;
  transition: opacity var(--t-base) var(--ease);
}

.focused .lv-domain:not(.on) {
  opacity: 0.45;
}

.lv-petal {
  fill: color-mix(in oklab, var(--c) 36%, transparent);
  stroke: var(--c);
  stroke-width: 1.5;
  stroke-linejoin: round;
  transform-origin: 0 0;
  transition: fill var(--t-base) var(--ease);
  animation: lv-open 1200ms var(--ease-glide) both;
}

.lv-domain.on .lv-petal {
  fill: color-mix(in oklab, var(--c) 52%, transparent);
}

.lv-petal.quiet {
  fill: color-mix(in oklab, var(--c) 14%, transparent);
  stroke-dasharray: 3 3;
}

@keyframes lv-open {
  from {
    opacity: 0;
    transform: scale(0.2) rotate(-28deg);
  }
}

.lv-ring-pace {
  fill: none;
  stroke: var(--text-2);
  stroke-width: 1;
  stroke-dasharray: 2 4;
  pointer-events: none;
  animation: lv-fade 900ms 500ms var(--ease-glide) both;
}

@keyframes lv-fade {
  from {
    opacity: 0;
  }
}

.lv-label {
  animation: lv-fade 700ms var(--ease-glide) both;
}

.lv-label .name {
  font-size: 13.5px;
  font-weight: 500;
  fill: var(--text-2);
  transition: fill var(--t-fast) var(--ease);
}

.lv-domain.on .lv-label .name,
.lv-domain:focus-visible .lv-label .name {
  fill: var(--text-1);
}

.lv-label .value {
  font-size: 17px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  fill: var(--text-1);
}

.lv-hole-rim {
  fill: none;
  stroke: var(--line-3);
  stroke-width: 1.5;
}

.lv-key {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  font-size: 11px;
  color: var(--text-3);
}

.lv-key i {
  width: 16px;
  height: 1px;
  background: repeating-linear-gradient(90deg, var(--text-3) 0 3px, transparent 3px 6px);
}

@media (max-width: 47.99rem) {
  .lv-stage-score .iv-fig {
    font-size: 60px;
  }

  .lv-stage-calls {
    margin-top: 22px;
  }

  .lv-stage-calls dd {
    font-size: 15px;
  }

  /* On a phone the art sits behind the words, fading out under the aperture. */
  .lv-stage-art {
    object-position: 62% 12%;
    opacity: 0.32;
    mask-image: linear-gradient(180deg, #000 20%, transparent 70%);
  }

  .lv-aperture {
    margin-top: 8px;
  }

  .lv-label .name {
    font-size: 21px;
  }

  .lv-label .value {
    font-size: 24px;
    transform: translateY(7px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .lv-stage-art,
  .lv-stage-copy,
  .lv-petal,
  .lv-ring-pace,
  .lv-label {
    animation: none;
  }
}
</style>
