<script lang="ts">
/**
 * Christmas on the site (../lib/season.ts), the desktop app's dress translated to its layout: snow
 * falling in the header behind its content (`part="chrome"`), and where the page starts under it
 * (`part="ground"`) a string of lights along the header's edge. The ground
 * part sits in the document, not the sticky header, so it scrolls away with the top of the page.
 * Everything is drawn once as SVG; only transforms and opacity move, nothing with reduced motion.
 *
 * Each page renders its own header, so this mounts again on every visit: the snow and the bulbs'
 * beats are set from the clock to carry on where they were, and the lights switch on only once.
 */
const NS = 'http://www.w3.org/2000/svg'

/** A fixed pseudo-random sequence, so the snow looks the same on every visit. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

/** A seamless square of flakes (a mask): soft dots, and a few hairline six-arm crystals. */
function flakes(
  seed: number,
  size: number,
  count: number,
  radius: [number, number],
  crystals: number
) {
  const rand = rng(seed)
  let out = ''
  for (let i = 0; i < count; i++) {
    const x = rand() * size
    const y = rand() * size
    const r = radius[0] + rand() * (radius[1] - radius[0])
    const o = 0.45 + rand() * 0.55
    for (const dy of [-size, 0, size])
      out += `<circle cx="${x.toFixed(1)}" cy="${(y + dy).toFixed(1)}" r="${r.toFixed(2)}" fill-opacity="${o.toFixed(2)}"/>`
  }
  for (let i = 0; i < crystals; i++) {
    const x = rand() * size
    const y = rand() * size
    const s = 3.2 + rand() * 1.6
    const turn = rand() * 60
    let arms = ''
    for (let a = 0; a < 6; a++)
      arms += `<path transform="rotate(${a * 60})" d="M0 0V${-s}M0 ${-s * 0.55}l${s * 0.28} ${-s * 0.28}M0 ${-s * 0.55}l${-s * 0.28} ${-s * 0.28}"/>`
    for (const dy of [-size, 0, size])
      out += `<g transform="translate(${x.toFixed(1)} ${(y + dy).toFixed(1)}) rotate(${turn.toFixed(0)})" fill="none" stroke-width="0.7" stroke-linecap="round" stroke-opacity="0.8">${arms}</g>`
  }
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="${NS}" width="${size}" height="${size}" fill="white" stroke="white">${out}</svg>`)}")`
}

/** Two depths: a far layer of fine dots, a near one of larger flakes that sways. */
const FAR = flakes(3, 360, 46, [0.6, 1.1], 0)
const NEAR = flakes(11, 520, 22, [1.1, 1.8], 4)

/** Lights hung in shallow swags from pins every 168px, three bulbs a swag, wide enough for any screen. */
const SPAN = 168
const SAG = 12
const WIDTH = SPAN * 24
const TONES = ['gold', 'warm', 'violet', 'warm', 'gold', 'violet'] as const
const WIRE = Array.from(
  { length: WIDTH / SPAN },
  (_, p) => `M${p * SPAN} 1Q${p * SPAN + SPAN / 2} ${1 + SAG} ${(p + 1) * SPAN} 1`
).join('')
const BULBS = Array.from({ length: WIDTH / SPAN }, (_, p) =>
  [0.2, 0.5, 0.8].map((t, j) => {
    const i = p * 3 + j
    const x0 = p * SPAN
    return {
      i,
      tone: TONES[i % TONES.length],
      x: (1 - t) ** 2 * x0 + 2 * (1 - t) * t * (x0 + SPAN / 2) + t ** 2 * (x0 + SPAN),
      y: 1 + 2 * (1 - t) * t * SAG,
      beat: 4.6 + ((i * 0.83) % 2.4),
      phase: (i * 1.37) % 5,
    }
  })
).flat()

/** The lights switch on with the first page of a visit, not again on each page after it. */
let lit = false
</script>

<script setup lang="ts">
import { onMounted } from 'vue'

defineProps<{ part: 'chrome' | 'ground' }>()

/** Where a loop of `seconds` stands now, as a negative delay: the same on every page. */
const now = Date.now() / 1000
const at = (seconds: number, offset = 0) => `${(-((now + offset) % seconds)).toFixed(2)}s`

const switchOn = !lit
onMounted(() => {
  lit = true
})
</script>

<template>
  <div v-if="part === 'chrome'" class="season-snow" aria-hidden="true">
    <i class="far" :style="{ '--flakes': FAR, 'animationDelay': at(46) }" />
    <i class="near" :style="{ '--flakes': NEAR, 'animationDelay': `${at(34)}, ${at(18)}` }" />
  </div>
  <Teleport v-else to="body">
    <div class="season-lights" aria-hidden="true">
      <svg :width="WIDTH" height="20" :viewBox="`0 0 ${WIDTH} 20`">
        <path class="season-wire" :d="WIRE" />
        <g
          v-for="b in BULBS"
          :key="b.i"
          :class="{ 'season-bulb-on': switchOn }"
          :style="switchOn ? { animationDelay: `${Math.min(b.i, 40) * 45}ms` } : undefined"
          :transform="`translate(${b.x.toFixed(1)} ${b.y.toFixed(1)})`"
        >
          <g
            class="season-bulb"
            :class="b.tone"
            :style="{
              animationDuration: `${b.beat.toFixed(2)}s`,
              animationDelay: at(b.beat, b.phase),
            }"
          >
            <rect class="cap" x="-1.2" y="0" width="2.4" height="2" rx="0.5" />
            <ellipse class="glass" cx="0" cy="5" rx="2.6" ry="3.4" />
            <ellipse class="shine" cx="-0.9" cy="3.9" rx="0.65" ry="1.1" />
          </g>
        </g>
      </svg>
    </div>
  </Teleport>
</template>

<style>
/* Snow: two masks of flakes slide down on the GPU, the near one swaying. Behind the header's content. */
.season-snow {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}
.season-snow > i {
  position: absolute;
  left: -12px;
  right: -12px;
  background: var(--season-snow);
  -webkit-mask-image: var(--flakes);
  mask-image: var(--flakes);
  will-change: translate, transform;
}
.season-snow > .far {
  top: -360px;
  height: calc(100% + 360px);
  opacity: 0.32;
  animation: season-fall-far 46s linear infinite;
}
.season-snow > .near {
  top: -520px;
  height: calc(100% + 520px);
  opacity: 0.55;
  animation:
    season-fall-near 34s linear infinite,
    season-sway 9s ease-in-out infinite alternate;
}
[data-theme='light'] .season-snow > .far {
  opacity: 0.4;
}
[data-theme='light'] .season-snow > .near {
  opacity: 0.6;
}
@media (prefers-color-scheme: light) {
  [data-theme='system'] .season-snow > .far {
    opacity: 0.4;
  }
  [data-theme='system'] .season-snow > .near {
    opacity: 0.6;
  }
}
@keyframes season-fall-far {
  to {
    translate: 0 360px;
  }
}
@keyframes season-fall-near {
  to {
    translate: 0 520px;
  }
}
@keyframes season-sway {
  from {
    transform: translateX(-10px);
  }
  to {
    transform: translateX(10px);
  }
}

/* Lights hung from the header's edge, over the top of the page; the header covers them on scroll. */
.season-lights {
  position: absolute;
  top: 56px;
  left: 0;
  right: 0;
  z-index: 1;
  height: 20px;
  overflow: hidden;
  pointer-events: none;
}
.season-lights svg {
  display: block;
}
.season-wire {
  fill: none;
  stroke: var(--season-wire);
  stroke-width: 0.8;
}
.season-bulb .cap {
  fill: var(--season-cap);
}
.season-bulb .shine {
  fill: rgb(255 255 255 / 0.75);
}
.season-bulb .glass {
  stroke: var(--season-bulb-rim);
  stroke-width: 0.5;
}
.season-bulb.gold .glass {
  fill: var(--season-bulb-gold);
}
.season-bulb.warm .glass {
  fill: var(--season-bulb-warm);
}
.season-bulb.violet .glass {
  fill: var(--season-bulb-violet);
}
/* Switched on once, from the left; then each bulb breathes on its own beat and phase. No glow. */
.season-bulb-on {
  animation: season-on 0.9s var(--ease) both;
}
.season-bulb {
  animation: season-breathe 5s ease-in-out infinite;
}
@keyframes season-on {
  from {
    opacity: 0.12;
  }
}
@keyframes season-breathe {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@media (prefers-reduced-motion: reduce) {
  .season-snow > .far,
  .season-snow > .near,
  .season-bulb-on,
  .season-bulb {
    animation: none !important;
  }
}
</style>
