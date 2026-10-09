<script setup lang="ts">
import { computed, inject } from 'vue'
import { ordinal } from '../lib/format.js'
import { PLATE_REVEAL } from '../lib/plate.js'

/**
 * The performance indicator (DIRECTION.md §8.1): a dial open at the bottom, the score (0–100) in
 * its centre and the placement (MVP, ACE, 3rd…) in the opening. The arc is the score; its colour
 * slides from red (worst) through a muted Invade violet (middle) to blue (best), so most games read
 * calm and only the extremes stand out. The figure stays ink; MVP is gold. The arc draws in once.
 * Mirrors the desktop app's src/ui/PerfDial.vue.
 *
 *   lg  48px: the dial with the placement (or MVP / ACE) in its opening
 *   sm  34px: the dial alone; the placement or MVP / ACE sits beside it (scoreboards)
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
    /** Replaces the placement in the opening (lg only); '' for none. */
    caption?: string
    /** Overrides the tooltip. */
    hint?: string
  }>(),
  { place: 0, of: 10, tag: null, size: 'lg', caption: undefined, hint: undefined }
)

const TIERS: Array<[number, string]> = [
  [85, 'Exceptional game'],
  [70, 'Great game'],
  [55, 'Good game'],
  [40, 'Average game'],
  [0, 'Rough game'],
]

/** A demo counting the dial up (the /app page); absent everywhere else. */
const reveal = inject(PLATE_REVEAL, null)

const value = computed(() => {
  if (props.score === null || Number.isNaN(props.score)) return null
  const score = Math.max(0, Math.min(100, Math.round(props.score)))
  if (!reveal) return score
  // Before it counts, the dial is an empty slot rather than a zero.
  return reveal.value > 0 ? Math.round(score * reveal.value) : null
})
const settled = computed(() => !reveal || reveal.value >= 1)

/** Colour stops (score, rgb): loss red, a muted brand violet, win blue; linear in RGB between. */
const STOPS: Array<[number, [number, number, number]]> = [
  [25, [255, 93, 110]],
  [57, [134, 124, 200]],
  [92, [76, 155, 255]],
]
const color = computed(() => {
  const s = value.value ?? 0
  if (s <= STOPS[0][0]) return STOPS[0][1].join(' ')
  if (s >= STOPS[2][0]) return STOPS[2][1].join(' ')
  const [[a, ca], [b, cb]] = s < STOPS[1][0] ? [STOPS[0], STOPS[1]] : [STOPS[1], STOPS[2]]
  const k = (s - a) / (b - a)
  return ca.map((x, i) => Math.round(x + (cb[i] - x) * k)).join(' ')
})

/** In the opening (lg): MVP / ACE, else the placement. */
const line = computed(() => {
  if (props.size !== 'lg' || value.value === null || !settled.value) return ''
  if (props.caption !== undefined) return props.caption
  if (props.tag) return props.tag
  return props.place ? ordinal(props.place) : ''
})

const title = computed(() => {
  if (props.hint) return props.hint
  if (value.value === null) return reveal ? '' : 'Remakes are not scored'
  const v = value.value
  const parts = [`Score ${v} of 100`, TIERS.find(([min]) => v >= min)![1]]
  if (props.tag === 'MVP') parts.push('Best player of the winning team')
  else if (props.tag === 'ACE') parts.push('Best player of the losing team')
  else if (props.place) parts.push(`${ordinal(props.place)} of ${props.of}`)
  return parts.join(' · ')
})

/* The dial: 250° of a radius-15 circle in a 40×40 box, open at the bottom. */
const R = 15
const LEN = (250 / 360) * 2 * Math.PI * R
const ARC = (() => {
  const p = (deg: number) => {
    const a = (deg * Math.PI) / 180
    return `${(20 + R * Math.cos(a)).toFixed(2)} ${(20 + R * Math.sin(a)).toFixed(2)}`
  }
  return `M${p(145)}A${R} ${R} 0 1 1 ${p(395)}`
})()
/** Never a dot so short it reads as a glitch. */
const len = computed(() => (Math.max(3, Math.min(100, value.value ?? 0)) / 100) * LEN)
</script>

<template>
  <span class="pdial-wrap" :title="title">
    <!-- At 34px only the score fits: MVP / ACE or the placement sit beside it. -->
    <template v-if="size === 'sm' && value !== null && settled">
      <span v-if="tag" class="pdial-badge" :class="{ mvp: tag === 'MVP' }">{{ tag }}</span>
      <small v-else-if="place" class="pdial-beside">{{ ordinal(place) }}</small>
    </template>
    <span
      class="pdial"
      :class="{ 'pdial-sm': size === 'sm', 'pdial-empty': value === null }"
      :style="{ '--c': color }"
      :role="title ? 'img' : undefined"
      :aria-label="title || undefined"
    >
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <path class="pdial-track" :d="ARC" />
        <path
          v-if="value !== null"
          class="pdial-arc"
          :class="{ counting: !!reveal }"
          :d="ARC"
          :stroke-dasharray="`${len} ${LEN}`"
          :style="{ '--len': len }"
        />
      </svg>
      <b>{{ value ?? '–' }}</b>
      <small v-if="line" class="pdial-place" :class="{ mvp: line === 'MVP' }">{{ line }}</small>
    </span>
  </span>
</template>

<style scoped>
.pdial-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  vertical-align: middle;
}

.pdial {
  position: relative;
  display: inline-grid;
  flex: none;
  place-items: center;
  width: 48px;
  height: 48px;
  font-variant-numeric: tabular-nums;
}

.pdial svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.pdial-track,
.pdial-arc {
  fill: none;
  stroke-width: 2.8;
}

.pdial-track {
  stroke: color-mix(in srgb, var(--color-ink) 8%, transparent);
}

.pdial-arc {
  stroke: rgb(var(--c));
  stroke-linecap: round;
  animation: pdial-draw 700ms 80ms var(--ease) both;
}

/* The /app demo counts the score up itself: no second animation on top. */
.pdial-arc.counting {
  animation: none;
  transition: stroke-dasharray 120ms linear;
}

@keyframes pdial-draw {
  from {
    stroke-dashoffset: var(--len);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pdial-arc {
    animation: none;
  }
}

.pdial b {
  position: relative;
  margin-top: -3px;
  font-size: 15px;
  font-weight: 750;
  line-height: 1;
  letter-spacing: -0.01em;
  color: var(--color-ink);
}

.pdial-place {
  position: absolute;
  bottom: 2px;
  left: 50%;
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  color: var(--color-ink-2);
  transform: translateX(-50%);
}

.pdial-place.mvp,
.pdial-badge.mvp {
  color: var(--color-gold);
}

/* Small: scoreboards. */
.pdial-sm {
  width: 34px;
  height: 34px;
}

.pdial-sm .pdial-track,
.pdial-sm .pdial-arc {
  stroke-width: 3.2;
}

.pdial-sm b {
  margin-top: 0;
  font-size: 11.5px;
}

.pdial-beside,
.pdial-badge {
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--color-ink-3);
}

.pdial-badge {
  color: var(--color-ink-2);
}

/* Not scored: the empty dial, quiet. */
.pdial-empty b {
  color: var(--color-ink-4);
}
</style>
