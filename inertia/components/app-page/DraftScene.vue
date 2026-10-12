<script setup lang="ts">
import OvRunes from './overlay/OvRunes.vue'
import OvDraftOdds from './overlay/OvDraftOdds.vue'
import OvCounters from './overlay/OvCounters.vue'
import { DRAFT } from './draft.js'
import './overlay/overlay.css'

/**
 * Champ select on a 1440 × 810 screen: the League client in the middle (in outline), and the
 * champ select overlay where the app puts it by default (overlay-config.ts), around it: Runes &
 * build and Draft odds on the left, Counters on the right. The overlay covers the client's
 * monitor, so the widgets sit beside the client window.
 */
defineProps<{ stack?: boolean }>()

const ALLIES = [
  { id: 266, name: 'Northwind', role: 'Top' },
  { id: 64, name: 'Kestrel', role: 'Jungle', me: true },
  { id: 45, name: 'River Moon', role: 'Mid' },
  { id: 222, name: 'Afterglow', role: 'Bottom' },
  { id: 412, name: 'Lantern', role: 'Support' },
]
const ENEMIES = [897, 234, 103, 145, 111]
const GRID = [5, 254, 113, 104, 59, 120, 76, 28, 141, 427, 11, 421, 107, 60, 154, 32, 33]
</script>

<template>
  <div class="ds" :class="{ stack }">
    <div class="ds-desk" aria-hidden="true" />

    <!-- The client, outlined -->
    <div v-if="!stack" class="ds-client" aria-hidden="true">
      <header class="ds-top">
        <span>Choose your champion</span>
        <b class="ds-timer">0:27</b>
      </header>
      <ul class="ds-team">
        <li v-for="a in ALLIES" :key="a.id" :class="{ me: a.me }">
          <img :src="`/cdn/champion/${a.id}.png`" alt="" width="40" height="40" />
          <span><b>{{ a.name }}</b><small>{{ a.role }}</small></span>
        </li>
      </ul>
      <div class="ds-grid">
        <span class="ds-search" />
        <div>
          <i v-for="id in GRID" :key="id" :style="{ backgroundImage: `url(/cdn/champion/${id}.png)` }" />
          <i class="on" :style="{ backgroundImage: 'url(/cdn/champion/64.png)' }" />
        </div>
        <span class="ds-lock">Lock in</span>
      </div>
      <ul class="ds-team enemy">
        <li v-for="id in ENEMIES" :key="id">
          <img :src="`/cdn/champion/${id}.png`" alt="" width="40" height="40" />
        </li>
      </ul>
    </div>

    <!-- The overlay -->
    <div class="ov ds-ov">
      <div class="ds-w" style="left: 14px; top: 81px"><OvRunes v-bind="DRAFT.runes" /></div>
      <div class="ds-w" style="left: 14px; top: 446px"><OvDraftOdds v-bind="DRAFT.odds" /></div>
      <div class="ds-w" style="left: 1166px; top: 81px"><OvCounters v-bind="DRAFT.counters" /></div>
    </div>
  </div>
</template>

<style scoped>
.ds {
  position: relative;
  width: 1440px;
  height: 810px;
  overflow: hidden;
  font-family: var(--font);
  color: #ececf3;
  background: #0b0c10;
}

/* The desktop around the client: plain, dark, unlit. */
.ds-desk {
  position: absolute;
  inset: 0;
  background:
    url('../../css/grain.png'),
    radial-gradient(80% 70% at 50% 40%, rgb(40 44 58 / 0.5), transparent 75%),
    #0a0b0f;
}

.ds-client {
  position: absolute;
  left: 270px;
  top: 135px;
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr) 76px;
  grid-template-rows: 44px minmax(0, 1fr);
  width: 900px;
  height: 540px;
  overflow: hidden;
  background: linear-gradient(180deg, #12151b, #0d0f14);
  border: 1px solid rgb(255 255 255 / 0.08);
  border-radius: 6px;
  box-shadow: 0 24px 60px -20px rgb(0 0 0 / 0.8);
}

.ds-top {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(236 236 243 / 0.55);
  border-bottom: 1px solid rgb(255 255 255 / 0.06);
}

.ds-timer {
  font-size: 15px;
  letter-spacing: 0;
  color: #ececf3;
}

.ds-team {
  display: grid;
  align-content: start;
  gap: 6px;
  padding: 14px 12px;
}

.ds-team li {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  padding: 0 8px;
  border-radius: 4px;
}

.ds-team li.me {
  background: rgb(255 255 255 / 0.04);
  box-shadow: inset 2px 0 0 rgb(76 155 255 / 0.7);
}

.ds-team img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.12);
}

.ds-team span {
  display: grid;
  gap: 2px;
  line-height: 1.2;
}

.ds-team b {
  font-size: 13px;
  font-weight: 600;
}

.ds-team small {
  font-size: 11px;
  color: rgb(236 236 243 / 0.45);
}

.ds-team.enemy {
  justify-items: end;
}

.ds-team.enemy img {
  filter: saturate(0.85);
}

.ds-grid {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 14px;
  padding: 16px 20px 18px;
  border-inline: 1px solid rgb(255 255 255 / 0.05);
}

.ds-search {
  width: 200px;
  height: 26px;
  background: rgb(0 0 0 / 0.3);
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.06);
}

.ds-grid > div {
  display: grid;
  grid-template-columns: repeat(6, 66px);
  align-content: start;
  gap: 10px;
}

.ds-grid i {
  width: 66px;
  height: 66px;
  background: center / 108% no-repeat;
  border-radius: 3px;
  opacity: 0.42;
  filter: saturate(0.6);
}

.ds-grid i.on {
  opacity: 1;
  filter: none;
  box-shadow: 0 0 0 2px rgb(236 236 243 / 0.75);
}

.ds-lock {
  justify-self: center;
  display: grid;
  place-items: center;
  width: 150px;
  height: 34px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(236 236 243 / 0.8);
  border: 1px solid rgb(255 255 255 / 0.18);
  border-radius: 3px;
}

.ds-w {
  position: absolute;
}

/* A phone: the widgets one under the other, a little larger. */
.ds.stack {
  width: 100%;
  height: auto;
  padding: 28px 16px;
}

.stack .ds-ov {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  zoom: 1.2;
}

.stack .ds-w {
  position: static;
}
</style>
