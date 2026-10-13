<script setup lang="ts">
import { computed } from 'vue'
import { assetUrl } from '../../../lib/assets.js'
import { compactGold } from '../overlay/clock.js'
import { ease, inn, land, lerp, seg } from './motion.js'

/**
 * Tab held over the game (1280 × 720): the key goes down, the game's scoreboard opens (in outline,
 * where the game draws it: a 1600 × 1200 canvas centred and scaled by min(w / 1600, h / 1200)),
 * and the Scoreboard gold plates come in down its middle as src/scoreboard.ts places them: the
 * team's lead above the frame, then each lane on its row. Key up, all of it goes.
 */
const props = defineProps<{ p: number }>()

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
  {
    ally: { id: 266, name: 'Northwind', kda: '2/3/4', cs: 128 },
    enemy: { id: 897, name: 'Silver Thread', kda: '3/2/2', cs: 136 },
    gold: -750,
  },
  {
    ally: { id: 64, name: 'Kestrel', kda: '6/2/10', cs: 110 },
    enemy: { id: 234, name: 'Nightfall', kda: '3/4/3', cs: 101 },
    gold: 800,
  },
  {
    ally: { id: 45, name: 'River Moon', kda: '5/1/4', cs: 141 },
    enemy: { id: 103, name: 'Foxglove', kda: '2/5/3', cs: 122 },
    gold: 1500,
  },
  {
    ally: { id: 222, name: 'Afterglow', kda: '4/2/5', cs: 152 },
    enemy: { id: 145, name: 'Daybreak', kda: '4/3/2', cs: 144 },
    gold: 750,
  },
  {
    ally: { id: 412, name: 'Lantern', kda: '0/3/12', cs: 22 },
    enemy: { id: 111, name: 'Deep Blue', kda: '1/3/7', cs: 26 },
    gold: -200,
  },
]
const TEAM_GOLD = 2100

const LEFT = 'M8 1 2 5l6 4z'
const RIGHT = 'M2 1l6 4-6 4z'
const side = (n: number) => (n > 0 ? 'ally' : n < 0 ? 'enemy' : 'even')
const arrow = (n: number) => (n > 0 ? LEFT : RIGHT)
const ITEMS = [6692, 3047, 1036, 3364]

/** Key down, then up near the end. */
const key = computed(() => ease(props.p, 0.02, 0.1, land) * (1 - seg(props.p, 0.84, 0.9)))
const up = computed(() => seg(props.p, 0.84, 0.9))
/** The board: open while the key is held. */
const board = computed(() => Math.min(ease(props.p, 0.08, 0.2), 1 - inn(seg(props.p, 0.86, 0.94))))
const out = computed(() => 1 - inn(seg(props.p, 0.86, 0.92)))
/** The plates: the team's lead first, then each lane, 4% of the chapter apart. */
const plate = (i: number) => ease(props.p, 0.2 + i * 0.045, 0.32 + i * 0.045, land) * out.value
const shown = computed(() => props.p > 0 && props.p < 0.96)
</script>

<template>
  <div v-show="shown" class="tb">
    <div class="tb-dim" :style="{ opacity: board * 0.55 }" aria-hidden="true" />

    <div
      class="tb-game"
      :style="{ opacity: board, transform: `scale(${lerp(0.985, 1, board)})` }"
      aria-hidden="true"
    >
      <div
        class="tb-frame"
        :style="{
          left: `${FRAME.left}px`,
          top: `${FRAME.top}px`,
          width: `${FRAME.right - FRAME.left}px`,
          height: `${FRAME.bottom - FRAME.top}px`,
        }"
      >
        <div class="tb-band">
          <span class="ally">22</span>
          <span class="tb-band-mid">15:16</span>
          <span class="enemy">16</span>
        </div>
      </div>

      <template v-for="(lane, i) in LANES" :key="i">
        <div
          class="tb-row left"
          :style="{
            top: `${ROWS[i] - ROW_H / 2}px`,
            height: `${ROW_H}px`,
            left: `${FRAME.left + 8}px`,
          }"
        >
          <img :src="assetUrl('champion', lane.ally.id)" alt="" width="34" height="34" />
          <b>{{ lane.ally.name }}</b>
          <span class="kda">{{ lane.ally.kda }}</span>
          <span class="cs">{{ lane.ally.cs }}</span>
          <span class="items"
            ><i
              v-for="it in ITEMS"
              :key="it"
              :style="{ backgroundImage: `url(${assetUrl('item', it)})` }"
          /></span>
        </div>
        <div
          class="tb-row right"
          :style="{
            top: `${ROWS[i] - ROW_H / 2}px`,
            height: `${ROW_H}px`,
            right: `${W - FRAME.right + 8}px`,
          }"
        >
          <span class="items"
            ><i
              v-for="it in ITEMS"
              :key="it"
              :style="{ backgroundImage: `url(${assetUrl('item', it)})` }"
          /></span>
          <span class="cs">{{ lane.enemy.cs }}</span>
          <span class="kda">{{ lane.enemy.kda }}</span>
          <b>{{ lane.enemy.name }}</b>
          <img :src="assetUrl('champion', lane.enemy.id)" alt="" width="34" height="34" />
        </div>
      </template>
    </div>

    <!-- The overlay: the plates down the middle -->
    <div class="ov tb-gold">
      <span
        class="tab-gold-diff team"
        :class="side(TEAM_GOLD)"
        :style="{
          top: `${TEAM}px`,
          opacity: plate(0),
          transform: `translate(-50%, calc(-100% + ${(1 - plate(0)) * -10}px))`,
        }"
      >
        <svg viewBox="0 0 10 10" aria-hidden="true"><path :d="arrow(TEAM_GOLD)" /></svg>
        {{ compactGold(TEAM_GOLD) }}
      </span>
      <span
        v-for="(lane, i) in LANES"
        :key="i"
        class="tab-gold-diff"
        :class="side(lane.gold)"
        :style="{
          top: `${ROWS[i]}px`,
          opacity: Math.min(1, plate(i + 1) * 1.5),
          transform: `translate(-50%, -50%) scale(${lerp(0.7, 1, plate(i + 1))})`,
        }"
        :data-tip="`${lane.gold > 0 ? lane.ally.name : lane.enemy.name} leads the lane by ${Math.abs(lane.gold)} gold`"
      >
        <svg viewBox="0 0 10 10" aria-hidden="true"><path :d="arrow(lane.gold)" /></svg>
        {{ compactGold(lane.gold) }}
      </span>
    </div>

    <kbd
      class="tb-key"
      :class="{ down: key > 0.5 }"
      :style="{
        opacity: Math.min(1, ease(p, 0, 0.06) * (1 - seg(p, 0.92, 0.98))),
        transform: `translateY(${key * 3 - up * 0}px)`,
      }"
      >Tab</kbd
    >
  </div>
</template>

<style scoped>
.tb {
  position: absolute;
  inset: 0;
  z-index: 2;
}

.tb-dim {
  position: absolute;
  inset: 0;
  background: #06070a;
}

.tb-game {
  position: absolute;
  inset: 0;
  transform-origin: 50% 50%;
}

.tb-frame {
  position: absolute;
  background: rgb(9 11 14 / 0.9);
  border: 1px solid rgb(200 170 110 / 0.22);
  border-radius: 4px;
}

.tb-band {
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

.tb-band .ally {
  color: #4c9bff;
}

.tb-band .enemy {
  color: #ff5d6e;
  text-align: right;
}

.tb-band-mid {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  color: rgb(236 236 243 / 0.55);
}

.tb-row {
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

.tb-row.right {
  justify-content: flex-end;
}

.tb-row img {
  width: 34px;
  height: 34px;
  border-radius: 4px;
}

.tb-row b {
  width: 92px;
  overflow: hidden;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: rgb(236 236 243 / 0.85);
}

.tb-row.right b {
  text-align: right;
}

.tb-row .kda {
  width: 50px;
  font-variant-numeric: tabular-nums;
}

.tb-row .cs {
  width: 28px;
  color: rgb(236 236 243 / 0.5);
  font-variant-numeric: tabular-nums;
}

.tb-row .items {
  display: flex;
  gap: 3px;
}

.tb-row .items i {
  width: 22px;
  height: 22px;
  background: rgb(255 255 255 / 0.05) center / cover;
  border-radius: 3px;
  opacity: 0.8;
}

.tb-gold {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.tb-gold .tab-gold-diff {
  pointer-events: auto;
}

/* The key being held: a real keycap, pressed. */
.tb-key {
  position: absolute;
  left: 176px;
  bottom: 104px;
  display: grid;
  place-items: center;
  width: 74px;
  height: 46px;
  font: 600 14px/1 var(--font);
  color: #ececf3;
  background: linear-gradient(180deg, #2a2b36, #1c1d26);
  border-radius: 8px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.12),
    0 4px 0 #0c0d12,
    0 8px 18px rgb(0 0 0 / 0.5);
  transition: box-shadow 120ms;
}

.tb-key.down {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.08),
    0 1px 0 #0c0d12,
    0 3px 8px rgb(0 0 0 / 0.5);
}
</style>
