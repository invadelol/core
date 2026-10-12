<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import OvObjectives from './overlay/OvObjectives.vue'
import OvPerf from './overlay/OvPerf.vue'
import OvNextItem from './overlay/OvNextItem.vue'
import type { NextItem, ObjTimer } from './overlay/types.js'
import './overlay/overlay.css'

/**
 * A game at 14 minutes on a 1280 × 720 screen, with the overlay drawn where the app puts its
 * widgets by default (overlay-config.ts): Objectives top centre, Performance on the left, Next
 * item above the minimap. The game itself is only its HUD's outline on a neutral dark field, so
 * the overlay is what the eye reads. A clock runs while the scene is on screen: timers count
 * down, minions are last hit, the dragon spawns, gold comes in.
 */
defineProps<{ stack?: boolean }>()

const START = 14 * 60 + 12
const LOOP = 48

const t = ref(START)
const game = shallowRef({ cs: 104, missing: 780, kills: 6, assists: 9, grubsUp: false })

function tick() {
  const next = t.value + 1 >= START + LOOP ? START : t.value + 1
  const at = next - START
  const g =
    at === 0 ? { cs: 104, missing: 780, kills: 6, assists: 9, grubsUp: false } : { ...game.value }
  g.missing = Math.max(0, g.missing - 3)
  if (at % 6 === 2) {
    g.cs += 1
    g.missing = Math.max(0, g.missing - 24)
  }
  if (at === 22) {
    g.assists += 1
    g.missing = Math.max(0, g.missing - 150)
  }
  t.value = next
  game.value = g
}

let timer: ReturnType<typeof setInterval> | undefined
let observer: IntersectionObserver | undefined
const root = ref<HTMLElement>()

onMounted(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !root.value) return
  observer = new IntersectionObserver(([entry]) => {
    clearInterval(timer)
    timer = entry.isIntersecting ? setInterval(tick, 1000) : undefined
  })
  observer.observe(root.value)
})

onBeforeUnmount(() => {
  clearInterval(timer)
  observer?.disconnect()
})

const timers = computed<ObjTimer[]>(() => [
  { key: 'dragon', label: 'Dragon', at: START + 53 },
  { key: 'grubs', label: 'Grubs', at: START + 30 },
  { key: 'baron', label: 'Baron', at: 22 * 60 + 26 },
])

const me = computed(() => {
  const g = game.value
  const minutes = t.value / 60
  return {
    csm: g.cs / minutes,
    cs: g.cs,
    gpm: 438 + (t.value - START) * 0.2,
    kp: (g.kills + g.assists) / 21,
    kda: (g.kills + g.assists) / 2,
    level: 12,
    vs: { cs: 96, level: 11 },
  }
})

/* The trends: the sample's shape, ending on the live value. */
const history = computed(() => {
  const end = me.value
  const wave = (i: number, amp: number, k: number) => Math.sin(i / k) * amp
  return {
    csm: Array.from({ length: 20 }, (_, i) => end.csm - 0.5 + (i / 20) * 0.45 + wave(i, 0.12, 3)),
    gpm: Array.from({ length: 20 }, (_, i) => end.gpm - 42 + (i / 20) * 40 + wave(i, 6, 4)),
    kp: Array.from({ length: 20 }, (_, i) => end.kp - 0.07 + (i / 20) * 0.06 + wave(i, 0.01, 3)),
    kda: Array.from({ length: 20 }, (_, i) => end.kda - 2 + (i / 20) * 1.9 + wave(i, 0.2, 3)),
  }
})

const build = computed<NextItem>(() => ({
  path: [
    { id: 6692, owned: true },
    { id: 3047, owned: true },
    { id: 3071, owned: false },
    { id: 6333, owned: false },
    { id: 3053, owned: false },
    { id: 3026, owned: false },
  ],
  next: {
    id: 3071,
    name: 'Black Cleaver',
    missing: game.value.missing,
    affordable: game.value.missing <= 0,
    options: [6610],
  },
}))

const clock = computed(() => {
  const s = t.value
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
})

/** Lee Sin's spells, as the HUD shows them. */
const ABILITIES = ['q', 'w', 'e', 'r'].map((k) => `/cdn/ability/64-${k}.png`)
</script>

<template>
  <div ref="root" class="gs" :class="{ stack }">
    <!-- The game: a neutral field and its HUD, outlined -->
    <div class="gs-field" aria-hidden="true">
      <i class="gs-river" />
    </div>

    <!-- Champions on the field: only their health bars, as the game floats them -->
    <div v-if="!stack" class="gs-units" aria-hidden="true">
      <span class="unit me" style="left: 560px; top: 352px"
        ><i>12</i><b><em style="width: 78%" /></b
      ></span>
      <span class="unit ally" style="left: 452px; top: 300px"
        ><i>11</i><b><em style="width: 54%" /></b
      ></span>
      <span class="unit enemy" style="left: 742px; top: 316px"
        ><i>11</i><b><em style="width: 31%" /></b
      ></span>
      <span class="unit enemy" style="left: 812px; top: 392px"
        ><i>10</i><b><em style="width: 66%" /></b
      ></span>
    </div>

    <div v-if="!stack" class="gs-stats" aria-hidden="true">
      <span><b class="ally">21</b> <i>vs</i> <b class="enemy">16</b></span>
      <span>6/2/9</span>
      <span>{{ game.cs }} CS</span>
      <span class="gs-clock">{{ clock }}</span>
    </div>

    <div v-if="!stack" class="gs-hud" aria-hidden="true">
      <img class="gs-portrait" :src="`/cdn/champion/64.png`" alt="" width="60" height="60" />
      <div class="gs-abilities">
        <img v-for="src in ABILITIES" :key="src" :src="src" alt="" width="38" height="38" />
      </div>
      <div class="gs-bars">
        <i class="hp"><b style="width: 78%" /></i>
        <i class="mp"><b style="width: 64%" /></i>
      </div>
      <div class="gs-spells">
        <img :src="`/cdn/spell/4.png`" alt="" width="26" height="26" />
        <img :src="`/cdn/spell/11.png`" alt="" width="26" height="26" />
      </div>
    </div>

    <div v-if="!stack" class="gs-map" aria-hidden="true">
      <svg viewBox="0 0 100 100">
        <path d="M8 92 V14 Q8 8 14 8 H92" />
        <path d="M8 92 H86 Q92 92 92 86 V8" />
        <path d="M8 92 L92 8" />
        <path class="river" d="M4 30 Q30 34 50 50 T96 70" />
      </svg>
      <i class="cam" />
    </div>

    <!-- The overlay -->
    <div class="ov gs-ov">
      <div class="gs-w" style="left: 461px; top: 9px">
        <OvObjectives
          :t="t"
          :timers="timers"
          :drakes="{ ally: ['Fire', 'Hextech'], enemy: ['Water'] }"
        />
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

/* A neutral field: a cool dark ground lit from the upper left, a river's faint band across it. */
.gs-field {
  position: absolute;
  inset: 0;
  background:
    url('../../css/grain.png'),
    radial-gradient(70% 80% at 32% 30%, rgb(70 92 96 / 0.34), transparent 70%),
    radial-gradient(60% 70% at 78% 76%, rgb(52 60 78 / 0.32), transparent 70%),
    linear-gradient(160deg, #141a1d, #0c0f12 60%, #090b0e);
}

.gs-river {
  position: absolute;
  left: -10%;
  top: 46%;
  width: 120%;
  height: 120px;
  background: linear-gradient(
    90deg,
    transparent,
    rgb(110 150 170 / 0.07) 30%,
    rgb(110 150 170 / 0.05) 70%,
    transparent
  );
  transform: rotate(-14deg);
}

.gs-units .unit {
  position: absolute;
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
  font-variant-numeric: tabular-nums;
  color: #ececf3;
}

/* The champion HUD, bottom centre: portrait, spells, bars. */
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
}

.gs-bars .hp b {
  background: rgb(98 160 110 / 0.75);
}

.gs-bars .mp b {
  background: rgb(92 132 196 / 0.7);
}

/* The minimap, bottom right: the three lanes and the river in outline. */
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

.gs-w {
  position: absolute;
}

/* A phone: the widgets one under the other, a little larger, on the same field. */
.gs.stack {
  width: 100%;
  height: auto;
  padding: 28px 16px;
}

.stack .gs-ov {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  zoom: 1.2;
}

.stack .gs-w {
  position: static;
}
</style>
