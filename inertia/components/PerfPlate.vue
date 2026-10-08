<script setup lang="ts">
import { computed, inject } from 'vue'
import { ordinal } from '../lib/format.js'
import { PLATE_REVEAL } from '../lib/plate.js'

/**
 * The performance indicator (DIRECTION.md §8.1): how well one player played, as a 0–100 score in
 * a dark capsule, the number and its placement on the left, a ring gauge on the right. The tier
 * colours the number and the ring (gold, champagne, white, grey, orange: their own scale, never
 * win/loss, ally/enemy or Invade); an exceptional game lights the capsule with a soft gold halo.
 * Mirrors the desktop app's src/ui/PerfPlate.vue.
 *
 *   lg  40px: the score, its placement (or MVP / ACE) and the ring
 *   sm  30px: the score and the ring; the placement or MVP / ACE sits beside it (scoreboards)
 *
 * A parent sets `--plate-hover: 1` (a hovered or open row) to lift the halo.
 */
const props = withDefaults(
  defineProps<{
    /** 0–100, or null for a game that is not scored (a remake). */
    score: number | null
    /** Place in the lobby, 1 for the best score; 0 when unknown. */
    place?: number
    /** Players ranked, for the tooltip. */
    of?: number
    /** MVP: best score of the winning team. ACE: best score of the losing team. */
    tag?: 'MVP' | 'ACE' | null
    size?: 'lg' | 'sm'
    /** A line under the score instead of the placement (lg only); '' for none. */
    caption?: string
    /** Overrides the tooltip. */
    hint?: string
  }>(),
  { place: 0, of: 10, tag: null, size: 'lg', caption: undefined, hint: undefined }
)

type Tier = 'elite' | 'great' | 'good' | 'fair' | 'poor'

const TIER_NAMES: Record<Tier, string> = {
  elite: 'Exceptional game',
  great: 'Great game',
  good: 'Good game',
  fair: 'Average game',
  poor: 'Rough game',
}

function tierOf(score: number): Tier {
  if (score >= 85) return 'elite'
  if (score >= 70) return 'great'
  if (score >= 55) return 'good'
  if (score >= 40) return 'fair'
  return 'poor'
}

/** A demo counting the plate up (the /app page); absent everywhere else. */
const reveal = inject(PLATE_REVEAL, null)

const value = computed(() => {
  if (props.score === null || Number.isNaN(props.score)) return null
  const score = Math.max(0, Math.min(100, Math.round(props.score)))
  if (!reveal) return score
  // Before it counts, the plate is an empty slot rather than a zero.
  return reveal.value > 0 ? Math.round(score * reveal.value) : null
})
const settled = computed(() => !reveal || reveal.value >= 1)
const tier = computed<Tier | 'none'>(() => (value.value === null ? 'none' : tierOf(value.value)))

/** Inside a 52px plate: MVP / ACE, else the placement. */
const line = computed(() => {
  if (props.size !== 'lg' || value.value === null || !settled.value) return ''
  if (props.caption !== undefined) return props.caption
  if (props.tag) return props.tag
  return props.place ? ordinal(props.place) : ''
})

const title = computed(() => {
  if (props.hint) return props.hint
  if (value.value === null) return reveal ? '' : 'Remakes are not scored'
  const parts = [`Score ${value.value} of 100`, TIER_NAMES[tier.value as Tier]]
  if (props.tag === 'MVP') parts.push('Best player of the winning team')
  else if (props.tag === 'ACE') parts.push('Best player of the losing team')
  else if (props.place) parts.push(`${ordinal(props.place)} of ${props.of}`)
  return parts.join(' · ')
})

/* The ring: radius 12 in a 30px box; the arc never shorter than a readable sliver. */
const R = 12
const C = 2 * Math.PI * R
const arc = computed(() => (value.value === null ? 0 : (Math.max(3, value.value) / 100) * C))
const uid = `pp-${Math.random().toString(36).slice(2, 9)}`
</script>

<template>
  <span class="perf" :class="[`is-${size}`, `t-${tier}`, { counting: !!reveal }]" :title="title">
    <!-- At 30px only the score and the ring fit: MVP / ACE or the placement sit beside it. -->
    <template v-if="size === 'sm' && value !== null && settled">
      <span v-if="tag" class="perf-badge" :class="{ mvp: tag === 'MVP' }">{{ tag }}</span>
      <small v-else-if="place" class="perf-place">{{ ordinal(place) }}</small>
    </template>
    <span class="perf-cap" role="img" :aria-label="title">
      <span class="perf-txt">
        <b class="perf-score">{{ value ?? '–' }}</b>
        <small v-if="line" class="perf-line" :class="{ mvp: line === 'MVP', ace: line === 'ACE' }">{{ line }}</small>
      </span>
      <svg v-if="value !== null" class="perf-ring" viewBox="0 0 30 30" aria-hidden="true">
        <defs>
          <linearGradient :id="uid" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" class="perf-s0" />
            <stop offset="1" class="perf-s1" />
          </linearGradient>
        </defs>
        <circle cx="15" cy="15" :r="R" class="perf-track" />
        <circle
          cx="15"
          cy="15"
          :r="R"
          class="perf-arc"
          :stroke="`url(#${uid})`"
          :stroke-dasharray="`${arc} ${C}`"
          :style="{ '--len': arc }"
        />
      </svg>
    </span>
  </span>
</template>

<style scoped>
/*
 * --pt is the tier colour of the number, --pf the light of the ring and halo, as "r g b". They are
 * the same colour except in light mode, where the number must stay dark enough to read while the
 * ring keeps the bright hue. --h is 1 while the row holding it is hovered or open.
 */
.perf {
  --pt: var(--perf-fair);
  --pf: var(--pt);
  --cap: var(--perf-cap);
  --cap-ring: var(--perf-cap-ring);
  --halo: 0 0 0 0 transparent;
  --h: var(--plate-hover, 0);

  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-shrink: 0;
  vertical-align: middle;
}

.perf-cap {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 5px 0 12px;
  border-radius: 999px;
  color: rgb(var(--pt));
  background: var(--cap);
  box-shadow:
    inset 0 0 0 1px var(--cap-ring),
    var(--halo);
  transition: box-shadow var(--t-base) var(--ease);
  font-variant-numeric: tabular-nums;
  user-select: none;
}

.perf-txt {
  display: grid;
  justify-items: end;
}

.perf-score {
  font-size: 17px;
  font-weight: 800;
  line-height: 18px;
  letter-spacing: -0.01em;
}

.perf-line {
  margin-top: 1px;
  font-size: 10.5px;
  font-weight: 650;
  line-height: 12px;
  white-space: nowrap;
  color: var(--color-ink-3);
}

/* MVP is gold whatever the tier: the best of the winning team. */
.perf-line.mvp {
  color: rgb(var(--perf-elite));
}

.perf-line.ace {
  color: var(--color-ink-2);
}

.perf-ring {
  display: block;
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  overflow: visible;
}

.perf-s0 {
  stop-color: color-mix(in srgb, rgb(var(--pf)) var(--ring-mix, 100%), white);
}

.perf-s1 {
  stop-color: color-mix(in srgb, rgb(var(--pf)) var(--ring-mix-end, 100%), #a8600a);
}

.perf-track,
.perf-arc {
  fill: none;
  stroke-width: 3.5;
}

.perf-track {
  stroke: var(--perf-track);
}

.perf-arc {
  stroke-linecap: round;
  transform: rotate(-90deg);
  transform-origin: 15px 15px;
  animation: perf-draw 700ms 120ms var(--ease) both;
}

/* The /app demo counts the score up itself: no draw-in on top of it. */
.counting .perf-arc {
  animation: none;
}

@keyframes perf-draw {
  from {
    stroke-dashoffset: var(--len);
  }
}

@media (prefers-reduced-motion: reduce) {
  .perf-arc {
    animation: none;
  }
}

/* ── Tiers ────────────────────────────────────────────────────── */
.t-elite {
  --pt: var(--perf-elite);
  --pf: var(--perf-elite-fill);
  --ring-mix: 62%;
  --ring-mix-end: 88%;
  --cap: radial-gradient(90% 120% at 100% 50%, rgb(var(--pf) / 0.16), transparent 70%), var(--perf-cap);
  --cap-ring: rgb(var(--pf) / 0.3);
  --halo: 0 0 calc(22px + 6px * var(--h)) -8px rgb(var(--pf) / calc(0.55 + 0.12 * var(--h)));
}

.t-elite .perf-score {
  text-shadow: 0 0 12px rgb(var(--pf) / 0.4);
}

.t-elite .perf-ring {
  filter: drop-shadow(0 0 4px rgb(var(--pf) / 0.5));
}

.t-great {
  --pt: var(--perf-great);
  --pf: var(--perf-great-fill);
  --ring-mix: 80%;
  --ring-mix-end: 94%;
  --cap-ring: rgb(var(--pf) / 0.16);
}

.t-good {
  --pt: var(--perf-good);
}

.t-fair {
  --pt: var(--perf-fair);
}

.t-poor {
  --pt: var(--perf-poor);
}

/* Not scored (a remake): an empty capsule, so columns keep their place. */
.t-none .perf-cap {
  justify-content: center;
  width: 76px;
  padding: 0;
  background: var(--color-well);
  box-shadow: none;
}

.t-none .perf-score {
  font-weight: 500;
  color: var(--color-ink-4);
}

/* ── 30px: scoreboards and compact rows ───────────────────────── */
.is-sm .perf-cap {
  gap: 6px;
  height: 30px;
  padding: 0 4px 0 9px;
}

.is-sm .perf-score {
  font-size: 13.5px;
  line-height: 14px;
}

.is-sm .perf-ring {
  width: 22px;
  height: 22px;
}

.is-sm .perf-track,
.is-sm .perf-arc {
  stroke-width: 4;
}

.is-sm.t-elite {
  --halo: 0 0 14px -6px rgb(var(--pf) / 0.5);
}

.is-sm.t-none .perf-cap {
  width: 58px;
}

.perf-place {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-ink-3);
}

/* Beside a 30px capsule: the badge (§7), one step smaller. */
.perf-badge {
  display: inline-flex;
  align-items: center;
  height: 16px;
  padding: 0 5px;
  border-radius: var(--radius-xs);
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  background: var(--color-control);
  color: var(--color-ink-2);
}

.perf-badge.mvp {
  background: color-mix(in srgb, var(--color-gold) 12%, transparent);
  color: var(--color-gold);
}
</style>
