<script setup lang="ts">
import { computed } from 'vue'
import OvObjectives from '../overlay/OvObjectives.vue'
import OvPerf from '../overlay/OvPerf.vue'
import OvNextItem from '../overlay/OvNextItem.vue'
import type { NextItem, ObjTimer } from '../overlay/types.js'
import TabBoard from './TabBoard.vue'
import { assetUrl } from '../../../lib/assets.js'
import { ease, land, lerp, mmss, seg } from './motion.js'
import '../overlay/overlay.css'

/**
 * A game on a 1280 × 720 screen, the overlay where the app puts it by default: Objectives top
 * centre, Performance on the left, Next item above the minimap, REC in the corner. The game is its
 * HUD in outline on a neutral field, so the overlay is what the eye reads. Scroll is the game
 * clock: `p` runs 14:12 → 15:10 (dragon counts down, comes up, is taken; the figures tick; the
 * next item becomes affordable, then bought), `tab` holds Tab, `k` is the fight.
 */
const props = defineProps<{ p: number; tab: number; k: number }>()

const START = 14 * 60 + 12
/** Dragon spawns halfway through the chapter and is taken a little later. */
const SPAWN = START + 29
const TAKEN = 0.64

const t = computed(() => START + 58 * props.p + 6 * props.tab + 14 * props.k)
const taken = computed(() => props.p >= TAKEN)

/** The fight: two enemies go down, one after the other. */
const kill1 = computed(() => seg(props.k, 0.12, 0.22))
const kill2 = computed(() => seg(props.k, 0.24, 0.34))
const kills = computed(() => 6 + (kill1.value >= 1 ? 1 : 0) + (kill2.value >= 1 ? 1 : 0))
const assists = computed(() => 9 + (props.p >= 0.6 ? 1 : 0))
const teamKills = computed(() => 21 + (props.p >= 0.6 ? 1 : 0) + kills.value - 6)
const banner = computed(() => Math.min(seg(props.k, 0.34, 0.4), 1 - seg(props.k, 0.5, 0.56)))

const timers = computed<ObjTimer[]>(() => [
  { key: 'dragon', label: 'Dragon', at: taken.value ? START + 58 * TAKEN + 300 : SPAWN },
  { key: 'baron', label: 'Baron', at: 20 * 60 },
])
/** The new drake lands on the ally side when it is taken. */
const drake = computed(() => ease(props.p, TAKEN, TAKEN + 0.06, land))
const drakes = computed(() => ({
  ally: taken.value ? ['Fire', 'Hextech', 'Hextech'] : ['Fire', 'Hextech'],
  enemy: ['Water'],
}))

const me = computed(() => {
  const cs = 104 + Math.floor((t.value - START) / 8.5)
  const minutes = t.value / 60
  return {
    csm: cs / minutes,
    cs,
    gpm: 438 + (t.value - START) * 0.22,
    kp: (kills.value + assists.value) / teamKills.value,
    kda: (kills.value + assists.value) / 2,
    level: kills.value > 6 ? 13 : 12,
    vs: { cs: 96 + Math.floor((t.value - START) / 10), level: 11 },
  }
})

/* The trends: the sample's shape, ending on the live value. */
const history = computed(() => {
  const end = me.value
  const wave = (i: number, amp: number, k: number) => Math.sin(i / k) * amp
  return {
    csm: Array.from({ length: 20 }, (_, i) => end.csm - 0.5 + (i / 19) * 0.5 + wave(i, 0.12, 3)),
    gpm: Array.from({ length: 20 }, (_, i) => end.gpm - 42 + (i / 19) * 42 + wave(i, 6, 4)),
    kp: Array.from({ length: 20 }, (_, i) => end.kp - 0.07 + (i / 19) * 0.07 + wave(i, 0.01, 3)),
    kda: Array.from({ length: 20 }, (_, i) => end.kda - 2 + (i / 19) * 2 + wave(i, 0.2, 3)),
  }
})

/** Next item: Black Cleaver's gold comes in, it is bought, and Death's Dance is next. */
const BOUGHT = 0.9
const build = computed<NextItem>(() => {
  const bought = props.p >= BOUGHT
  const left = Math.round((780 * (1 - seg(props.p, 0.04, 0.8))) / 5) * 5
  return {
    path: [
      { id: 6692, owned: true },
      { id: 3047, owned: true },
      { id: 3071, owned: bought },
      { id: 6333, owned: false },
      { id: 3053, owned: false },
      { id: 3026, owned: false },
    ],
    next: bought
      ? {
          id: 6333,
          name: "Death's Dance",
          missing: 3300 - Math.round((seg(props.p, BOUGHT, 1) * 60) / 5) * 5,
          affordable: false,
          options: [6694],
        }
      : {
          id: 3071,
          name: 'Black Cleaver',
          missing: left,
          affordable: left <= 0,
          options: [6610],
        },
  }
})

/** The panels arrive with the game (the overlay shows once the game window is up). */
const panelIn = computed(() => ease(props.p, 0, 0.08))

const ABILITIES = ['q', 'w', 'e', 'r'].map((k) => `/cdn/ability/64-${k}.png`)

/** Champions on the field: only their health bars, as the game floats them. */
const units = computed(() => {
  const k = props.k
  const close = ease(k, 0, 0.12)
  return [
    {
      cls: 'me',
      lvl: kills.value > 6 ? 13 : 12,
      x: lerp(560, 650, close),
      y: lerp(352, 344, close),
      hp: 0.78 - 0.22 * seg(k, 0.06, 0.3),
      out: 0,
    },
    { cls: 'ally', lvl: 11, x: 452, y: 300, hp: 0.54, out: 0 },
    {
      cls: 'enemy',
      lvl: 11,
      x: lerp(742, 700, close),
      y: 316,
      hp: 0.31 * (1 - kill1.value),
      out: seg(k, 0.22, 0.28),
    },
    {
      cls: 'enemy',
      lvl: 10,
      x: lerp(812, 760, close),
      y: 392,
      hp: 0.66 * (1 - kill2.value),
      out: seg(k, 0.34, 0.4),
    },
  ]
})
</script>

<template>
  <div class="gs">
    <!-- The ground near the dragon pit, drawn as a quiet map: walls, the river, the pit, brush -->
    <div class="gs-field" aria-hidden="true">
      <svg viewBox="0 0 1280 720" preserveAspectRatio="none">
        <defs>
          <linearGradient id="gs-river" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#4c8fa8" stop-opacity="0" />
            <stop offset="0.35" stop-color="#4c8fa8" stop-opacity="0.13" />
            <stop offset="0.7" stop-color="#4c8fa8" stop-opacity="0.1" />
            <stop offset="1" stop-color="#4c8fa8" stop-opacity="0" />
          </linearGradient>
          <radialGradient id="gs-pit" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.6" stop-color="#0a0e10" stop-opacity="0" />
            <stop offset="0.92" stop-color="#0a0e10" stop-opacity="0.55" />
            <stop offset="1" stop-color="#9fb8c0" stop-opacity="0.08" />
          </radialGradient>
        </defs>
        <path
          class="river"
          d="M-40 170 C 260 250, 420 300, 640 380 S 1040 520, 1320 600 L1320 760 C 1000 650, 780 600, 560 520 S 160 360, -40 330 Z"
          fill="url(#gs-river)"
        />
        <g class="wall">
          <path d="M-20 -20 H 520 C 500 60, 420 120, 300 130 C 180 140, 80 120, -20 150 Z" />
          <path
            d="M760 -20 H 1300 V 300 C 1210 270, 1150 210, 1060 200 C 940 186, 820 120, 760 -20 Z"
          />
          <path d="M-20 520 C 120 500, 230 560, 300 640 C 330 680, 360 700, 380 740 H -20 Z" />
          <path d="M1000 740 C 1040 680, 1120 650, 1300 660 V 740 Z" />
        </g>
        <ellipse cx="900" cy="560" rx="150" ry="74" fill="url(#gs-pit)" />
      </svg>
    </div>

    <div class="gs-units" aria-hidden="true">
      <span
        v-for="(u, i) in units"
        :key="i"
        class="unit"
        :class="u.cls"
        :style="{
          transform: `translate3d(${u.x}px, ${u.y + u.out * 10}px, 0)`,
          opacity: 1 - u.out,
        }"
        ><i>{{ u.lvl }}</i
        ><b><em :style="{ transform: `scaleX(${u.hp})` }" /></b
      ></span>
    </div>

    <div
      class="gs-banner"
      aria-hidden="true"
      :style="{ opacity: banner, transform: `translateX(-50%) scale(${lerp(0.94, 1, banner)})` }"
    >
      <img :src="assetUrl('champion', 64)" alt="" width="40" height="40" />
      <b>Double kill</b>
    </div>

    <div class="gs-stats" aria-hidden="true">
      <span
        ><b class="ally">{{ teamKills }}</b> <i>vs</i> <b class="enemy">16</b></span
      >
      <span>{{ kills }}/2/{{ assists }}</span>
      <span>{{ me.cs }} CS</span>
      <span class="gs-clock">{{ mmss(t) }}</span>
    </div>

    <div class="gs-hud" aria-hidden="true">
      <img class="gs-portrait" :src="assetUrl('champion', 64)" alt="" width="60" height="60" />
      <div class="gs-abilities">
        <img v-for="src in ABILITIES" :key="src" :src="src" alt="" width="38" height="38" />
      </div>
      <div class="gs-bars">
        <i class="hp"><b :style="{ transform: `scaleX(${units[0].hp})` }" /></i>
        <i class="mp"><b style="transform: scaleX(0.64)" /></i>
      </div>
      <div class="gs-spells">
        <img :src="assetUrl('spell', 4)" alt="" width="26" height="26" />
        <img :src="assetUrl('spell', 11)" alt="" width="26" height="26" />
      </div>
    </div>

    <div class="gs-map" aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <path d="M8 92 V14 Q8 8 14 8 H92" />
        <path d="M8 92 H86 Q92 92 92 86 V8" />
        <path d="M8 92 L92 8" />
        <path class="river" d="M4 30 Q30 34 50 50 T96 70" />
      </svg>
      <i class="cam" />
    </div>

    <!-- The overlay -->
    <div class="ov gs-ov" :style="{ opacity: panelIn }">
      <div class="rec-dot"><i class="dot" />REC</div>
      <div class="gs-w obj-w" style="left: 516px; top: 9px" :style="{ '--drake': drake }">
        <OvObjectives :t="t" :timers="timers" :drakes="drakes" />
      </div>
      <div class="gs-w" style="left: 13px; top: 259px">
        <OvPerf
          :me="me"
          :bm="{ csm: 5.6, gpm: 421, kp: 0.6, kda: 3.1 }"
          rank="Diamond"
          :history="history"
        />
      </div>
      <div class="gs-w" style="left: 998px; top: 410px">
        <OvNextItem :build="build" />
      </div>
    </div>

    <TabBoard :p="tab" />
  </div>
</template>

<style scoped>
.gs {
  position: relative;
  width: 1280px;
  height: 720px;
  overflow: hidden;
  font-family: var(--font);
  color: #ececf3;
  background: #0c0f12;
}

.gs-field {
  position: absolute;
  inset: 0;
  background:
    url('../../../css/grain.png'),
    radial-gradient(70% 80% at 40% 40%, rgb(64 86 84 / 0.32), transparent 70%),
    radial-gradient(60% 70% at 78% 76%, rgb(48 58 74 / 0.3), transparent 70%),
    linear-gradient(160deg, #131a1c, #0d1214 55%, #0a0d10);
}

.gs-field svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.gs-field .wall path {
  fill: #080b0d;
  fill-opacity: 0.6;
  stroke: rgb(190 220 210 / 0.05);
  stroke-width: 2;
}

.unit {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  gap: 2px;
}

.unit i {
  display: grid;
  place-items: center;
  width: 16px;
  height: 14px;
  font-size: 9.5px;
  font-style: normal;
  font-weight: 700;
  color: rgb(236 236 243 / 0.85);
  background: rgb(8 9 12 / 0.9);
  border-radius: 2px;
}

.unit b {
  display: block;
  width: 86px;
  height: 9px;
  padding: 1px;
  background: rgb(8 9 12 / 0.9);
  border-radius: 2px;
}

.unit em {
  display: block;
  height: 100%;
  border-radius: 1px;
  transform-origin: left;
}

.unit.me em {
  background: rgb(120 186 110 / 0.9);
}

.unit.ally em {
  background: rgb(76 155 255 / 0.85);
}

.unit.enemy em {
  background: rgb(255 93 110 / 0.85);
}

/* The game's own announcement, in outline: the overlay never draws this. */
.gs-banner {
  position: absolute;
  left: 50%;
  top: 150px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 22px 8px 8px;
  background: rgb(8 9 12 / 0.72);
  border: 1px solid rgb(200 170 110 / 0.35);
  border-radius: 6px;
}

.gs-banner img {
  width: 40px;
  height: 40px;
  border-radius: 4px;
}

.gs-banner b {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #e9d7a8;
}

.gs-stats {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  gap: 14px;
  height: 26px;
  padding: 0 12px;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  color: rgb(236 236 243 / 0.7);
  background: rgb(8 9 12 / 0.7);
  border-bottom-left-radius: 6px;
  font-variant-numeric: tabular-nums;
}

.gs-stats i {
  font-style: normal;
  color: rgb(236 236 243 / 0.4);
}

.gs-stats .ally {
  color: #4c9bff;
}

.gs-stats .enemy {
  color: #ff5d6e;
}

.gs-clock {
  min-width: 34px;
  font-family: var(--font-mono);
  color: #ececf3;
}

.gs-hud {
  position: absolute;
  left: 50%;
  bottom: 10px;
  display: grid;
  grid-template-columns: 60px auto auto;
  grid-template-rows: auto auto;
  align-items: center;
  gap: 8px 10px;
  padding: 10px 14px 10px 10px;
  background: rgb(8 9 12 / 0.78);
  border: 1px solid rgb(255 255 255 / 0.07);
  border-radius: 10px;
  transform: translateX(-50%);
}

.gs-portrait {
  grid-row: 1 / 3;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 0 0 2px rgb(255 255 255 / 0.1);
}

.gs-abilities,
.gs-spells {
  display: flex;
  gap: 5px;
}

.gs-abilities img {
  width: 38px;
  height: 38px;
  border-radius: 5px;
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.1);
}

.gs-spells {
  grid-row: 1;
  grid-column: 3;
}

.gs-spells img {
  width: 26px;
  height: 26px;
  border-radius: 4px;
}

.gs-bars {
  display: grid;
  grid-column: 2 / 4;
  gap: 3px;
}

.gs-bars i {
  display: block;
  height: 7px;
  overflow: hidden;
  background: rgb(255 255 255 / 0.06);
  border-radius: 2px;
}

.gs-bars b {
  display: block;
  height: 100%;
  transform-origin: left;
}

.gs-bars .hp b {
  background: rgb(98 160 110 / 0.75);
}

.gs-bars .mp b {
  background: rgb(92 132 196 / 0.7);
}

.gs-map {
  position: absolute;
  right: 8px;
  bottom: 8px;
  width: 150px;
  height: 150px;
  overflow: hidden;
  background: rgb(10 14 16 / 0.9);
  border: 1px solid rgb(255 255 255 / 0.1);
  border-radius: 4px;
}

.gs-map svg {
  width: 100%;
  height: 100%;
}

.gs-map path {
  fill: none;
  stroke: rgb(255 255 255 / 0.14);
  stroke-width: 2.2;
  stroke-linecap: round;
}

.gs-map path.river {
  stroke: rgb(110 150 170 / 0.18);
  stroke-width: 5;
}

.gs-map .cam {
  position: absolute;
  left: 38%;
  top: 40%;
  width: 22%;
  height: 14%;
  border: 1px solid rgb(255 255 255 / 0.5);
}

.gs-ov {
  position: absolute;
  inset: 0;
}

.gs-w {
  position: absolute;
}

/* The drake that was just taken lands on its place in the soul race (the ally row's third). */
.obj-w :deep(.obj-drakes span.ally i:nth-child(3)) {
  opacity: var(--drake);
  transform: rotate(45deg) scale(calc(2.2 - 1.35 * var(--drake)));
}

/* The overlay's REC, as the app draws it: tiny, static, top-left. */
.rec-dot {
  position: absolute;
  top: 6px;
  left: 8px;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px 2px 6px;
  border-radius: 5px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: rgb(255 255 255 / 0.78);
  background: rgb(9 9 14 / 0.6);
}

.rec-dot .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ff5d6e;
}
</style>
