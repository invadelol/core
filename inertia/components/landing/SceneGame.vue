<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import Screen from './Screen.vue'
import OvObjectives from './overlay/OvObjectives.vue'
import OvPerf from './overlay/OvPerf.vue'
import OvNextItem from './overlay/OvNextItem.vue'
import type { NextItem, ObjTimer } from './overlay/types.js'
import OvLead from './overlay/OvLead.vue'
import './overlay/overlay.css'

/**
 * In game: Riot's own footage with the overlay drawn over it, at the places the app puts its
 * widgets by default (overlay-config.ts), on a 1280×720 screen. A small game clock runs while
 * the chapter is on screen: timers count down, a fight is won, the dragon is taken, gold comes in
 * and the next item becomes affordable. The figures start from the app's own preview sample.
 */
const props = defineProps<{ step: number; active: boolean; still: boolean; narrow?: boolean }>()

const W = 1280
const H = 720
/* Public files, kept out of the bundler. */
const POSTER = '/landing/rift-loop-poster.webp'

/** Default places, as fractions of the screen (overlay-config.ts). */
const PLACE = {
  objectives: { x: 0.36, y: 0.012 },
  lead: { x: 0.01, y: 0.1 },
  perf: { x: 0.01, y: 0.36 },
  build: { x: 0.78, y: 0.62 },
}

/** Where the camera looks on each step: the screen, then each widget. */
const CAMERAS = [
  { x: W / 2, y: H / 2, z: 1 },
  { x: 0.36 * W + 128, y: 44, z: 2.3 },
  { x: 0.01 * W + 96, y: 0.36 * H + 88, z: 2.4 },
  { x: 0.78 * W + 106, y: 0.62 * H + 56, z: 2.4 },
  { x: W / 2, y: H / 2, z: 1 },
]

const camera = computed(() => {
  const cam = props.still ? CAMERAS[0] : (CAMERAS[props.step] ?? CAMERAS[0])
  // A phone gets closer to each widget.
  return props.narrow && cam.z > 1 ? { ...cam, z: cam.z * 1.2 } : cam
})
/** Win & gold is off by default: it is switched on in the last step. */
const leadOn = computed(() => props.still || props.step >= 4)

/* ── The game clock ───────────────────────────────────────────── */
const START = 14 * 60 + 12
const LOOP = 56

const t = ref(START)
const shown = ref(props.still)

interface Game {
  cs: number
  kills: number
  deaths: number
  assists: number
  allyKills: number
  enemyKills: number
  missing: number
  /** Seconds the next item has been affordable: it is bought a few seconds later. */
  ready: number
  bought: boolean
  dragonTaken: boolean
  grubsTaken: boolean
  gold: number
}

const fresh = (): Game => ({
  cs: 118,
  kills: 7,
  deaths: 2,
  assists: 6,
  allyKills: 21,
  enemyKills: 16,
  missing: 520,
  ready: 0,
  bought: false,
  dragonTaken: false,
  grubsTaken: false,
  gold: 2100,
})

const game = shallowRef<Game>(fresh())
/** The trend lines and the gold line, drawn in once the widgets appear. */
const drawn = ref(props.still ? 1 : 0)

/* One second of game: what happens at each moment of the loop. */
function tick() {
  const next = t.value + 1 >= START + LOOP ? START : t.value + 1
  const g = next === START ? fresh() : { ...game.value }
  const at = next - START
  // Passive income, and a minion every seven seconds or so.
  g.missing -= 2
  g.gold += 3
  if (at % 7 === 3) {
    g.cs += 1
    g.missing -= 21
    g.gold += 14
  }
  // A fight at the dragon pit: a kill and an assist for the team.
  if (at === 14) {
    g.kills += 1
    g.allyKills += 1
    g.missing -= 300
    g.gold += 300
  }
  if (at === 16) {
    g.assists += 1
    g.allyKills += 1
    g.missing -= 150
    g.gold += 150
  }
  if (at === 25) g.dragonTaken = true
  if (at === 45) g.grubsTaken = true
  g.missing = Math.max(0, g.missing)
  if (!g.bought && g.missing === 0 && ++g.ready > 6) {
    // Back to base: the staff is bought, the route moves on to the Deathcap.
    g.bought = true
    g.missing = 3480
  }
  t.value = next
  game.value = g
}

let timer: ReturnType<typeof setInterval> | undefined
let reveal: ReturnType<typeof setTimeout> | undefined
let draw = 0

function start() {
  if (timer || props.still) return
  timer = setInterval(tick, 1000)
  if (!shown.value) {
    reveal = setTimeout(() => {
      shown.value = true
      const from = performance.now()
      const step = (now: number) => {
        drawn.value = Math.min(1, (now - from) / 1200)
        if (drawn.value < 1) draw = requestAnimationFrame(step)
      }
      draw = requestAnimationFrame(step)
    }, 500)
  }
}

function stop() {
  clearInterval(timer)
  timer = undefined
}

const video = ref<HTMLVideoElement>()

watch(
  () => props.active && !props.still,
  (on) => {
    if (on) {
      start()
      void video.value?.play().catch(() => {})
    } else {
      stop()
      video.value?.pause()
    }
  }
)

watch(
  () => props.still,
  (still) => {
    if (!still) return
    stop()
    shown.value = true
    drawn.value = 1
  }
)

onBeforeUnmount(() => {
  stop()
  clearTimeout(reveal)
  cancelAnimationFrame(draw)
})

/* ── What the widgets show ────────────────────────────────────── */
const timers = computed<ObjTimer[]>(() => {
  const g = game.value
  const list: ObjTimer[] = [
    g.dragonTaken
      ? { key: 'dragon', label: 'Dragon', at: START + 25 + 300 }
      : { key: 'dragon', label: 'Dragon', at: START + 19 },
  ]
  if (!g.grubsTaken) list.push({ key: 'grubs', label: 'Grubs', at: START + 39 })
  list.push({ key: 'baron', label: 'Baron', at: 22 * 60 + 26 })
  return list
})

const drakes = computed(() => ({
  ally: game.value.dragonTaken ? ['Fire', 'Hextech'] : ['Fire'],
  enemy: ['Water'],
}))

const minutes = computed(() => t.value / 60)

const me = computed(() => {
  const g = game.value
  return {
    csm: g.cs / minutes.value,
    cs: g.cs,
    gpm: 452 + (g.kills - 7) * 9,
    kp: (g.kills + g.assists) / g.allyKills,
    kda: (g.kills + g.assists) / Math.max(1, g.deaths),
    level: g.kills > 7 ? 13 : 12,
    vs: { cs: 104 + Math.floor((t.value - START) / 8), level: 11 },
  }
})

/* Series for the trend lines: the sample's shape, ending on the live value. */
const history = computed(() => {
  const n = 20
  const end = me.value
  const wave = (i: number, amp: number, k: number) => Math.sin(i / k) * amp
  return {
    csm: Array.from({ length: n }, (_, i) => end.csm - 0.45 + (i / n) * 0.4 + wave(i, 0.12, 3)),
    gpm: Array.from({ length: n }, (_, i) => end.gpm - 40 + (i / n) * 38 + wave(i, 6, 4)),
    kp: Array.from({ length: n }, (_, i) => end.kp - 0.06 + (i / n) * 0.05 + wave(i, 0.01, 3)),
    kda: Array.from({ length: n }, (_, i) => end.kda - 1.6 + (i / n) * 1.5 + wave(i, 0.15, 3)),
  }
})

const build = computed<NextItem>(() => {
  const g = game.value
  const path = [
    { id: 6657, owned: true },
    { id: 3020, owned: true },
    { id: 3003, owned: g.bought },
    { id: 3089, owned: false },
    { id: 3135, owned: false },
    { id: 3157, owned: false },
  ]
  return g.bought
    ? {
        path,
        next: {
          id: 3089,
          name: "Rabadon's Deathcap",
          missing: g.missing,
          affordable: false,
          options: [],
        },
      }
    : {
        path,
        next: {
          id: 3003,
          name: "Archangel's Staff",
          missing: g.missing,
          affordable: g.missing <= 0,
          options: [4645],
        },
      }
})

const lead = computed(() => {
  const g = game.value
  const diff = g.gold
  // The sample's shape (overlay-sample.ts), ending on the live lead.
  const series = Array.from({ length: 40 }, (_, i) => Math.sin(i / 6) * 900 + i * 38 - 200)
  series.push(diff)
  return {
    goldDiff: diff,
    winProb: Math.min(0.72, 0.63 + (diff - 2100) / 12000),
    history: series,
    kills: { ally: g.allyKills, enemy: g.enemyKills },
  }
})

const place = (id: keyof typeof PLACE) => ({
  left: `${PLACE[id].x * W}px`,
  top: `${PLACE[id].y * H}px`,
})
</script>

<template>
  <Screen :w="W" :h="H" :camera="camera">
    <div class="game" :style="{ backgroundImage: `url(${POSTER})` }">
      <video
        ref="video"
        class="game-video"
        muted
        loop
        playsinline
        preload="metadata"
        :poster="POSTER"
        aria-hidden="true"
        tabindex="-1"
      >
        <source :src="'/landing/rift-loop-480.mp4'" type="video/mp4" media="(max-width: 640px)" />
        <source :src="'/landing/rift-loop-720.mp4'" type="video/mp4" />
      </video>

      <div class="ov" :class="{ shown }">
        <div class="ov-w" :style="place('objectives')" style="--d: 0ms">
          <OvObjectives :t="t" :timers="timers" :drakes="drakes" />
        </div>
        <div class="ov-w" :class="{ off: !leadOn }" :style="place('lead')" style="--d: 0ms">
          <OvLead v-bind="lead" :drawn="drawn" />
        </div>
        <div class="ov-w" :style="place('perf')" style="--d: 140ms">
          <OvPerf
            :me="me"
            :bm="{ csm: 7.4, gpm: 442, kp: 0.57, kda: 2.7 }"
            rank="Diamond"
            :history="history"
            :drawn="drawn"
          />
        </div>
        <div class="ov-w" :style="place('build')" style="--d: 280ms">
          <OvNextItem :build="build" />
        </div>
      </div>
    </div>
  </Screen>
</template>

<style scoped>
.game {
  position: relative;
  width: 1280px;
  height: 720px;
  overflow: hidden;
  background: #0d0e13 center / cover no-repeat;
}

.game-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ov-w {
  position: absolute;
  opacity: 0;
  transform: translateY(6px);
  transition:
    opacity 420ms var(--ease) var(--d),
    transform 420ms var(--ease) var(--d);
}

.shown .ov-w {
  opacity: 1;
  transform: none;
}

.shown .ov-w.off {
  opacity: 0;
  transform: translateY(6px);
}

@media (prefers-reduced-motion: reduce) {
  .ov-w {
    transition: none;
  }
}
</style>
