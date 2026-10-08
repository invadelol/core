<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Star } from 'lucide-vue-next'
import Screen from './Screen.vue'
import { champIcon } from '../../lib/assets.js'

/**
 * Recordings, as the app files a game: its header, the full recording with the moments marked
 * on its timeline, and the clips cut from those moments. The game records, the markers land as
 * the moments happen, then each marker is cut into its clip. Frames are Riot's own footage.
 */
const props = defineProps<{ step: number; active: boolean; still: boolean; narrow?: boolean }>()

const W = 1280
const H = 720
const LENGTH = 31 * 60 + 14

type Kind = 'kill' | 'assist' | 'saved' | 'death'
const MOMENTS: Array<{
  at: number
  kind: Kind
  title: string
  sub: string
  thumb: string
  length: string
}> = [
  {
    at: 8 * 60,
    kind: 'kill',
    title: 'Triple kill',
    sub: 'at 8:00',
    thumb: 'clip-kill',
    length: '0:24',
  },
  {
    at: 15 * 60 + 20,
    kind: 'assist',
    title: 'Assist',
    sub: 'at 15:20',
    thumb: 'clip-baron',
    length: '0:18',
  },
  {
    at: 22 * 60,
    kind: 'saved',
    title: 'Highlight',
    sub: 'Saved · at 22:00',
    thumb: 'clip-saved',
    length: '0:30',
  },
  {
    at: 27 * 60 + 40,
    kind: 'death',
    title: 'Death',
    sub: 'at 27:40',
    thumb: 'clip-death',
    length: '0:16',
  },
]

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/* ── Time inside a step ───────────────────────────────────────── */
const elapsed = ref(0)
let started = 0
let frame = 0

function run() {
  elapsed.value = performance.now() - started
  if (elapsed.value < 5000) frame = requestAnimationFrame(run)
}

function restart() {
  cancelAnimationFrame(frame)
  started = performance.now()
  elapsed.value = 0
  if (props.active && !props.still) frame = requestAnimationFrame(run)
}

watch(() => props.step, restart)
watch(
  () => props.active && !props.still,
  (on) => (on ? restart() : cancelAnimationFrame(frame))
)
onBeforeUnmount(() => cancelAnimationFrame(frame))

/** How much of the game is recorded: it fills over the first step, then stays full. */
const recorded = computed(() => {
  if (props.still || props.step > 0) return 1
  const x = Math.min(1, elapsed.value / 2600)
  return 1 - Math.pow(1 - x, 2)
})
const recording = computed(() => recorded.value < 1)

/** Markers land in order during step 1; all of them are there after. */
const marked = computed(() => {
  if (props.still || props.step > 1) return MOMENTS.length
  if (props.step < 1) return 0
  return Math.min(MOMENTS.length, Math.floor((elapsed.value + 200) / 380))
})

/** Clips are cut one after the other in step 2. */
const cut = computed(() => {
  if (props.still) return MOMENTS.length
  if (props.step < 2) return 0
  return Math.min(MOMENTS.length, Math.floor((elapsed.value + 150) / 260))
})

const camera = computed(() => {
  if (props.still) return { x: W / 2, y: H / 2, z: 1 }
  if (props.narrow) {
    if (props.step === 0) return { x: 400, y: 260, z: 2.1 }
    if (props.step === 1) return { x: 800, y: 300, z: 2.1 }
    return { x: 420, y: 520, z: 1.9 }
  }
  if (props.step === 0) return { x: 470, y: 230, z: 1.45 }
  if (props.step === 1) return { x: 640, y: 290, z: 1.12 }
  return { x: W / 2, y: H / 2 - 20, z: 1.04 }
})

/* Where a clip card starts from: under its marker on the timeline. */
const TRACK_LEFT = 64
const TRACK_WIDTH = W - 2 * 64 - 32
const CARD_W = 268
const CARD_GAP = 20
const cardFrom = (index: number) => {
  const marker = TRACK_LEFT + 16 + (MOMENTS[index].at / LENGTH) * TRACK_WIDTH
  const slot = 64 + index * (CARD_W + CARD_GAP) + CARD_W / 2
  return `translate(${marker - slot}px, -96px) scale(0.18)`
}
</script>

<template>
  <Screen :w="W" :h="H" :camera="camera">
    <div class="rc">
      <header class="rc-head">
        <h3>Recordings</h3>
        <span class="text-[13px] text-ink-3">4.9 GB used</span>
        <span class="rc-auto">
          Auto-record games
          <i class="rc-switch" />
        </span>
      </header>

      <nav class="rc-seg">
        <b>All</b><span>Kills <small>1</small></span
        ><span>Deaths <small>1</small></span> <span>Assists <small>1</small></span
        ><span>Objectives</span> <span>Saved <small>1</small></span
        ><span>Full games <small>1</small></span>
      </nav>

      <!-- The game -->
      <div class="rc-game">
        <span class="portrait h-9 w-9"
          ><img :src="champIcon(64)" alt="Lee Sin" loading="lazy"
        /></span>
        <span class="rc-game-name">
          <b>Lee Sin</b>
          <small>Summoner's Rift · Ranked Solo</small>
        </span>
        <span class="rc-game-kda">
          <b class="num">14<i>/</i>3<i>/</i>9</b>
          <small class="num">Win · {{ mmss(LENGTH) }}</small>
        </span>
        <span v-if="recording" class="rc-live"><i class="rc-rec" />Recording</span>
        <span v-else-if="cut" class="text-[13px] text-ink-3"
          >{{ cut }} {{ cut === 1 ? 'clip' : 'clips' }}</span
        >
        <Star :size="16" class="ml-auto text-[var(--color-gold)]" fill="currentColor" />
      </div>

      <!-- The full recording and its timeline -->
      <div class="rc-full">
        <div class="rc-thumb">
          <img :src="'/landing/rift-loop-poster.webp'" alt="" loading="lazy" />
          <span class="rc-badge num">
            <template v-if="recording"><i class="rc-rec" />{{ mmss(recorded * LENGTH) }}</template>
            <template v-else>{{ mmss(LENGTH) }}</template>
          </span>
        </div>
        <div class="rc-line">
          <div class="rc-line-head">
            <b>Full game</b>
            <span v-if="marked" class="text-ink-3">{{ marked }} moments</span>
          </div>
          <div class="rc-track">
            <i class="rc-fill" :style="{ transform: `scaleX(${recorded})` }" />
            <span
              v-for="(m, i) in MOMENTS"
              :key="m.at"
              class="rc-mark"
              :class="[m.kind, { on: i < marked, cut: i < cut }]"
              :style="{ left: `${(m.at / LENGTH) * 100}%` }"
            >
              <small>{{ m.title }}</small>
            </span>
          </div>
          <div class="rc-scale num">
            <span>0:00</span><span>10:00</span><span>20:00</span><span>30:00</span>
          </div>
        </div>
      </div>

      <!-- The clips, cut from the moments -->
      <ul class="rc-clips">
        <li
          v-for="(m, i) in MOMENTS"
          :key="m.at"
          class="rc-clip"
          :class="{ on: i < cut }"
          :style="{ '--from': cardFrom(i) }"
        >
          <span class="rc-clip-thumb">
            <img :src="`/landing/${m.thumb}.webp`" alt="" loading="lazy" />
            <span class="rc-badge num">{{ m.length }}</span>
          </span>
          <b>{{ m.title }}</b>
          <small>{{ m.sub }}</small>
        </li>
      </ul>
    </div>
  </Screen>
</template>

<style scoped>
.rc {
  width: 1280px;
  height: 720px;
  padding: 26px 64px;
  background: var(--color-bg);
  color: var(--color-ink);
  font-size: 13px;
}

.rc-head {
  display: flex;
  align-items: baseline;
  gap: 14px;
}

.rc-head h3 {
  font-size: 22px;
  font-weight: 600;
}

.rc-auto {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
  font-size: 13px;
  color: var(--color-ink-2);
}

.rc-switch {
  position: relative;
  width: 30px;
  height: 18px;
  border-radius: 9px;
  background: var(--color-brand);
}

.rc-switch::after {
  content: '';
  position: absolute;
  top: 3px;
  right: 3px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
}

.rc-seg {
  display: inline-flex;
  gap: 2px;
  margin-top: 16px;
  padding: 2px;
  border-radius: 7px;
  background: var(--color-panel);
  font-size: 12.5px;
  color: var(--color-ink-3);
}

.rc-seg > * {
  padding: 5px 11px;
  border-radius: 5px;
}

.rc-seg b {
  font-weight: 500;
  color: var(--color-ink);
  background: var(--color-track);
}

.rc-seg small {
  margin-left: 3px;
  font-size: 11px;
  color: var(--color-ink-4);
}

.rc-game {
  display: flex;
  align-items: center;
  gap: 14px;
  height: 56px;
  margin-top: 18px;
  padding: 0 18px 0 16px;
  border-radius: var(--radius-sm);
  background:
    linear-gradient(rgb(var(--win-rgb) / 0.06), rgb(var(--win-rgb) / 0.06)), var(--color-panel);
  box-shadow:
    inset 3px 0 0 var(--color-win),
    var(--hi);
}

.rc-game-name,
.rc-game-kda {
  display: grid;
  line-height: 1.3;
}

.rc-game-name {
  width: 240px;
}

.rc-game-kda {
  width: 150px;
}

.rc-game b {
  font-size: 14px;
  font-weight: 600;
}

.rc-game b i {
  margin: 0 4px;
  font-style: normal;
  font-weight: 400;
  color: var(--color-ink-4);
}

.rc-game small {
  font-size: 12px;
  color: var(--color-ink-3);
}

/* ── The full game ────────────────────────────────────────────── */
.rc-full {
  display: grid;
  grid-template-columns: 268px minmax(0, 1fr);
  gap: 28px;
  align-items: center;
  margin-top: 16px;
  padding: 16px;
  border-radius: var(--radius-md);
  background: var(--color-panel);
  box-shadow: var(--hi);
}

.rc-thumb,
.rc-clip-thumb {
  position: relative;
  display: block;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: var(--radius-sm);
  background: var(--color-well);
}

.rc-thumb img,
.rc-clip-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.rc-badge {
  position: absolute;
  right: 6px;
  bottom: 6px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 20px;
  padding: 0 6px;
  border-radius: var(--radius-xs);
  font-size: 11.5px;
  font-weight: 600;
  color: #fff;
  background: rgb(8 9 12 / 0.82);
}

.rc-live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--color-ink-2);
}

.rc-rec {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-loss);
}

.rc-line-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 13px;
}

.rc-line-head b {
  font-size: 14px;
  font-weight: 600;
}

.rc-track {
  position: relative;
  height: 6px;
  margin-top: 46px;
  border-radius: 3px;
  background: var(--color-track);
}

.rc-fill {
  position: absolute;
  inset: 0;
  border-radius: 3px;
  background: rgb(190 190 255 / 0.22);
  transform-origin: left;
}

.rc-mark {
  --c: var(--color-ink-2);
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  margin: -6px 0 0 -6px;
  border-radius: 3px;
  background: var(--c);
  box-shadow: 0 0 0 3px var(--color-solid);
  opacity: 0;
  transform: translateY(-14px) scale(0.6);
  transition:
    opacity 260ms var(--ease),
    transform 360ms cubic-bezier(0.3, 1.4, 0.5, 1);
}

.rc-mark.kill,
.rc-mark.assist {
  --c: var(--color-win);
}

.rc-mark.death {
  --c: var(--color-loss);
}

.rc-mark.saved {
  --c: var(--color-brand);
}

.rc-mark.on {
  opacity: 1;
  transform: none;
}

.rc-mark small {
  position: absolute;
  bottom: 18px;
  left: 50%;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-ink-2);
  white-space: nowrap;
  transform: translateX(-50%);
}

.rc-scale {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  font-size: 11px;
  color: var(--color-ink-3);
}

/* ── Clips ────────────────────────────────────────────────────── */
.rc-clips {
  display: flex;
  gap: 20px;
  margin-top: 22px;
}

.rc-clip {
  display: grid;
  gap: 2px;
  width: 268px;
  opacity: 0;
  transform: var(--from);
  transform-origin: 50% 0;
  transition:
    opacity 300ms var(--ease),
    transform 700ms cubic-bezier(0.65, 0, 0.35, 1);
}

.rc-clip.on {
  opacity: 1;
  transform: none;
}

.rc-clip b {
  margin-top: 8px;
  font-size: 14px;
  font-weight: 600;
}

.rc-clip small {
  font-size: 12px;
  color: var(--color-ink-3);
}
</style>
