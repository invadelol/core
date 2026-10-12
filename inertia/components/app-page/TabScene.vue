<script setup lang="ts">
import { compactGold } from './overlay/clock.js'
import './overlay/overlay.css'

/**
 * Tab held, on a 1280 × 720 screen: the game's scoreboard (in outline, at the place and size the
 * game draws it: a 1600 × 1200 canvas centred and scaled by min(w / 1600, h / 1200)) and the
 * Scoreboard gold overlay down its middle, as src/scoreboard.ts places it: the team's lead just
 * above the frame, then each lane on its row, the arrow pointing at the half that is ahead.
 */
const W = 1280
const H = 720
const S = Math.min(W / 1600, H / 1200)
const y = (u: number) => H / 2 + (u - 600) * S
const x = (u: number) => W / 2 + (u - 800) * S

const FRAME = { top: y(262), bottom: y(347 + 5 * 84 + 6), left: x(0), right: x(1600) }
const TEAM = y(262 - 6)
const ROWS = [0, 1, 2, 3, 4].map((i) => y(388 + i * 84))
const ROW_H = 82 * S

const LANES = [
  { ally: { id: 266, name: 'Northwind', kda: '2/3/4', cs: 128 }, enemy: { id: 897, name: 'Silver Thread', kda: '3/2/2', cs: 136 }, gold: -750 },
  { ally: { id: 64, name: 'Kestrel', kda: '6/2/9', cs: 104 }, enemy: { id: 234, name: 'Nightfall', kda: '3/4/3', cs: 96 }, gold: 800 },
  { ally: { id: 45, name: 'River Moon', kda: '5/1/4', cs: 141 }, enemy: { id: 103, name: 'Foxglove', kda: '2/5/3', cs: 122 }, gold: 1500 },
  { ally: { id: 222, name: 'Afterglow', kda: '4/2/5', cs: 152 }, enemy: { id: 145, name: 'Daybreak', kda: '4/3/2', cs: 144 }, gold: 750 },
  { ally: { id: 412, name: 'Lantern', kda: '0/3/12', cs: 22 }, enemy: { id: 111, name: 'Deep Blue', kda: '1/3/7', cs: 26 }, gold: -200 },
]
const TEAM_GOLD = 2100

const LEFT = 'M8 1 2 5l6 4z'
const RIGHT = 'M2 1l6 4-6 4z'
const side = (n: number) => (n > 0 ? 'ally' : n < 0 ? 'enemy' : 'even')
const arrow = (n: number) => (n > 0 ? LEFT : RIGHT)

const ITEMS = [6692, 3047, 1036, 3364]
</script>

<template>
  <div class="ts">
    <div class="ts-field" aria-hidden="true" />

    <!-- The game's scoreboard, outlined -->
    <div
      class="ts-board"
      aria-hidden="true"
      :style="{
        left: `${FRAME.left}px`,
        top: `${FRAME.top}px`,
        width: `${FRAME.right - FRAME.left}px`,
        height: `${FRAME.bottom - FRAME.top}px`,
      }"
    >
      <div class="ts-band">
        <span class="ally">21</span>
        <span class="ts-band-mid">14:12</span>
        <span class="enemy">16</span>
      </div>
    </div>

    <template v-for="(lane, i) in LANES" :key="i">
      <div
        class="ts-row left"
        aria-hidden="true"
        :style="{ top: `${ROWS[i] - ROW_H / 2}px`, height: `${ROW_H}px`, left: `${FRAME.left + 8}px` }"
      >
        <img :src="`/cdn/champion/${lane.ally.id}.png`" alt="" width="34" height="34" />
        <b>{{ lane.ally.name }}</b>
        <span class="kda">{{ lane.ally.kda }}</span>
        <span class="cs">{{ lane.ally.cs }}</span>
        <span class="items"><i v-for="it in ITEMS" :key="it" :style="{ backgroundImage: `url(/cdn/item/${it}.png)` }" /></span>
      </div>
      <div
        class="ts-row right"
        aria-hidden="true"
        :style="{ top: `${ROWS[i] - ROW_H / 2}px`, height: `${ROW_H}px`, right: `${W - FRAME.right + 8}px` }"
      >
        <span class="items"><i v-for="it in ITEMS" :key="it" :style="{ backgroundImage: `url(/cdn/item/${it}.png)` }" /></span>
        <span class="cs">{{ lane.enemy.cs }}</span>
        <span class="kda">{{ lane.enemy.kda }}</span>
        <b>{{ lane.enemy.name }}</b>
        <img :src="`/cdn/champion/${lane.enemy.id}.png`" alt="" width="34" height="34" />
      </div>
    </template>

    <!-- The overlay: the plates down the middle -->
    <div class="ov ts-gold">
      <span class="tab-gold-diff team" :class="side(TEAM_GOLD)" :style="{ top: `${TEAM}px` }">
        <svg viewBox="0 0 10 10" aria-hidden="true"><path :d="arrow(TEAM_GOLD)" /></svg>
        {{ compactGold(TEAM_GOLD) }}
      </span>
      <span
        v-for="(lane, i) in LANES"
        :key="i"
        class="tab-gold-diff"
        :class="side(lane.gold)"
        :style="{ top: `${ROWS[i]}px` }"
      >
        <svg viewBox="0 0 10 10" aria-hidden="true"><path :d="arrow(lane.gold)" /></svg>
        {{ compactGold(lane.gold) }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.ts {
  position: relative;
  width: 1280px;
  height: 720px;
  overflow: hidden;
  font-family: var(--font);
  color: #ececf3;
  background: #0c0f12;
}

.ts-field {
  position: absolute;
  inset: 0;
  background:
    url('../../css/grain.png'),
    radial-gradient(70% 80% at 32% 30%, rgb(70 92 96 / 0.3), transparent 70%),
    linear-gradient(160deg, #141a1d, #0c0f12 60%, #090b0e);
}

.ts-board {
  position: absolute;
  background: rgb(9 11 14 / 0.86);
  border: 1px solid rgb(200 170 110 / 0.22);
  border-radius: 4px;
}

.ts-band {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  height: 34px;
  margin-top: 8px;
  padding: 0 24px;
  font-size: 18px;
  font-weight: 700;
  border-bottom: 1px solid rgb(255 255 255 / 0.06);
}

.ts-band .ally {
  color: #4c9bff;
}

.ts-band .enemy {
  color: #ff5d6e;
  text-align: right;
}

.ts-band-mid {
  font-size: 13px;
  font-weight: 600;
  color: rgb(236 236 243 / 0.55);
}

.ts-row {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 456px;
  padding: 0 10px;
  font-size: 12px;
  color: rgb(236 236 243 / 0.72);
  background: rgb(255 255 255 / 0.025);
  border-radius: 3px;
}

.ts-row.right {
  justify-content: flex-end;
}

.ts-row img {
  width: 34px;
  height: 34px;
  border-radius: 4px;
}

.ts-row b {
  width: 92px;
  overflow: hidden;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: rgb(236 236 243 / 0.85);
}

.ts-row.right b {
  text-align: right;
}

.ts-row .kda {
  width: 50px;
  font-variant-numeric: tabular-nums;
}

.ts-row .cs {
  width: 28px;
  color: rgb(236 236 243 / 0.5);
  font-variant-numeric: tabular-nums;
}

.ts-row .items {
  display: flex;
  gap: 3px;
}

.ts-row .items i {
  width: 22px;
  height: 22px;
  background: rgb(255 255 255 / 0.05) center / cover;
  border-radius: 3px;
  opacity: 0.8;
}

.ts-gold {
  position: absolute;
  inset: 0;
}
</style>
