<script setup lang="ts">
import { computed } from 'vue'
import { Icon, RoleIcon, useNames } from '@invadelol/ui'
import { assetUrl } from '../../../lib/assets.js'
import { DRAFT } from '../draft.js'
import { ease, land, lerp, mmss, rise, seg, span } from './motion.js'
import '../overlay/overlay.css'

/**
 * Champ select on a 1280 × 720 screen: the League client in the middle (in outline) and the
 * overlay where the app puts it by default, around it. `p` plays the chapter: the enemy jungler
 * shows, Counters ranks three picks into him, the hover lands on Lee Sin, lock in, Counters goes
 * (as it does once you lock), and the rune page fills in, slot by slot, until the client has it.
 * `idle` (seconds) keeps the room alive before the chapter starts: the timer runs, the hover roams.
 */
const props = defineProps<{ p: number; idle: number }>()

const { runeIcon, runeName, styleIcon } = useNames()

const ALLIES = [
  { id: 266, name: 'Northwind', role: 'Top' },
  { id: 64, name: 'Kestrel', role: 'Jungle', me: true },
  { id: 45, name: 'River Moon', role: 'Mid' },
  { id: 222, name: 'Afterglow', role: 'Bottom' },
  { id: 412, name: 'Lantern', role: 'Support' },
]
/** The enemy team: four are in, the jungler is their last pick. */
const ENEMIES = [897, 234, 103, 145, 111]
const GRID = [5, 254, 113, 104, 59, 120, 76, 64, 28, 141, 427, 11, 421, 107, 60, 154, 32, 33]
const LEE = GRID.indexOf(64)
/** Where the hover roams while nobody scrolls. */
const ROAM = [1, 2, 9, 4, 13, 7, 15, 3]

const runes = DRAFT.runes
const counters = DRAFT.counters

const p = computed(() => props.p)

/** The enemy jungler, in. */
const viego = computed(() => ease(p.value, 0.02, 0.14, land))

/** Counters: in after Viego, gone once you lock. */
const countersIn = computed(() => span(p.value, 0.1, 0.24, 0.54, 0.64))
const rowIn = (i: number) => ease(p.value, 0.16 + i * 0.035, 0.3 + i * 0.035)
const edge = (i: number) => counters.picks[i].edge * ease(p.value, 0.2 + i * 0.03, 0.4 + i * 0.03)
const signed = (x: number) => `+${(x * 100).toFixed(1)}%`

/** The hover: roaming, then onto Lee Sin, then locked. */
const hover = computed(() => {
  if (p.value >= 0.4) return LEE
  return GRID.indexOf(GRID[ROAM[Math.floor(props.idle / 1.1) % ROAM.length]])
})
const locked = computed(() => p.value >= 0.5)
const press = computed(() => {
  const k = seg(p.value, 0.46, 0.52)
  return 1 - Math.sin(k * Math.PI) * 0.05
})
const portrait = computed(() => ease(p.value, 0.5, 0.58, land))
/** Counters' Lee Sin row lights while the hover is on him. */
const leeRowOn = computed(() => p.value >= 0.4 && p.value < 0.54)

/** The client's timer: 0:30 running down on its own, frozen at lock. */
const timer = computed(() => {
  if (locked.value) return mmss(14)
  if (p.value > 0) return mmss(lerp(27, 14, seg(p.value, 0, 0.5)))
  return mmss(30 - (Math.floor(props.idle) % 16))
})

/** Runes & build: the panel, then each slot. */
const runesIn = computed(() => ease(p.value, 0.56, 0.66))
const slot = (i: number) => ease(p.value, 0.62 + i * 0.026, 0.68 + i * 0.026, land)
const tail = computed(() => ease(p.value, 0.82, 0.9))
const done = computed(() => ease(p.value, 0.9, 0.97))
/** The stat shards, named here: the site's name maps have no entry for them. */
const SHARD: Record<number, string> = {
  5005: 'Attack Speed',
  5007: 'Ability Haste',
  5008: 'Adaptive Force',
  5010: 'Move Speed',
  5011: 'Health',
  5013: 'Tenacity',
  5001: 'Health Scaling',
}
const shards = runes.page.m.map((id) => SHARD[id] ?? runeName(id)).join(' · ')

/** Draft odds: on by default, it reads the draft as it fills. */
const win = computed(
  () =>
    0.52 - 0.03 * ease(p.value, 0.04, 0.14) + (DRAFT.odds.win - 0.49) * ease(p.value, 0.52, 0.66)
)

const scale = (k: number, from = 0.6) => ({
  opacity: Math.min(1, k * 1.6).toFixed(3),
  transform: `scale(${lerp(from, 1, k).toFixed(4)})`,
})
</script>

<template>
  <div class="ds">
    <div class="ds-desk" aria-hidden="true" />

    <!-- The client, outlined -->
    <div class="ds-client" aria-hidden="true">
      <header class="ds-top">
        <span>{{ locked ? 'Waiting for others' : 'Choose your champion' }}</span>
        <b class="ds-timer">{{ timer }}</b>
      </header>
      <ul class="ds-team">
        <li v-for="a in ALLIES" :key="a.id" :class="{ me: a.me }">
          <span class="ds-face">
            <img
              v-if="!a.me"
              :src="assetUrl('champion', a.id)"
              alt=""
              width="36"
              height="36"
              loading="lazy"
            />
            <template v-else>
              <img
                :src="assetUrl('champion', 64)"
                alt=""
                width="36"
                height="36"
                class="ghost"
                :style="{ opacity: p >= 0.4 ? 0.4 : 0 }"
              />
              <img
                :src="assetUrl('champion', 64)"
                alt=""
                width="36"
                height="36"
                :style="scale(portrait, 1.25)"
              />
            </template>
          </span>
          <span
            ><b>{{ a.name }}</b
            ><small>{{ a.me && locked ? 'Lee Sin' : a.role }}</small></span
          >
        </li>
      </ul>
      <div class="ds-grid">
        <span class="ds-search" />
        <div>
          <i
            v-for="(id, i) in GRID"
            :key="id"
            :class="{ on: i === hover, locked: locked && i === LEE }"
            :style="{ backgroundImage: `url(${assetUrl('champion', id)})` }"
          />
        </div>
        <span class="ds-lock" :class="{ done: locked }" :style="{ transform: `scale(${press})` }">{{
          locked ? 'Locked in' : 'Lock in'
        }}</span>
      </div>
      <ul class="ds-team enemy">
        <li v-for="(id, i) in ENEMIES" :key="i">
          <span class="ds-face empty">
            <img
              v-if="id"
              :src="assetUrl('champion', id)"
              alt=""
              width="36"
              height="36"
              :style="i === 1 ? scale(viego) : undefined"
            />
          </span>
        </li>
      </ul>
    </div>

    <!-- The overlay -->
    <div class="ov ds-ov">
      <div class="ds-w" style="left: 13px; top: 72px" :style="rise(runesIn, 12)">
        <div class="ov-panel runes">
          <div class="runes-head">
            <strong>{{ runes.champion }}</strong>
            <span class="muted">{{ runes.position }}</span>
          </div>
          <div class="iv-runes">
            <div class="iv-runes-row">
              <img class="tree" :src="styleIcon(runes.page.p[0])" alt="" :style="scale(slot(0))" />
              <img
                v-for="(id, i) in runes.page.p.slice(1)"
                :key="id"
                :class="{ key: i === 0 }"
                :src="runeIcon(id)"
                alt=""
                :style="scale(slot(i + 1))"
              />
            </div>
            <div class="iv-runes-row">
              <img class="tree" :src="styleIcon(runes.page.s[0])" alt="" :style="scale(slot(5))" />
              <img
                v-for="(id, i) in runes.page.s.slice(1)"
                :key="id"
                :src="runeIcon(id)"
                alt=""
                :style="scale(slot(i + 6))"
              />
            </div>
            <div class="iv-runes-shards" :style="{ opacity: slot(8) }">{{ shards }}</div>
          </div>
          <div class="runes-row" :style="{ opacity: tail }">
            <img
              v-for="id in runes.spells"
              :key="id"
              :src="assetUrl('spell', id)"
              alt=""
              width="22"
              height="22"
            />
            <span class="skills">{{ runes.skills }}</span>
          </div>
          <div class="runes-items" :style="{ opacity: tail }">
            <img
              v-for="id in runes.boots"
              :key="`b${id}`"
              :src="assetUrl('item', id)"
              alt=""
              width="24"
              height="24"
            />
            <i class="sep" />
            <img
              v-for="id in runes.core"
              :key="`c${id}`"
              :src="assetUrl('item', id)"
              alt=""
              width="24"
              height="24"
            />
          </div>
          <p class="runes-import" :style="rise(done, 4)">
            <svg viewBox="0 0 12 12" width="11" height="11" class="tick" aria-hidden="true">
              <path
                d="M2.5 6.4 5 8.8l4.6-5.4"
                pathLength="1"
                :style="{ strokeDashoffset: 1 - done }"
              />
            </svg>
            Runes set in the client
          </p>
        </div>
      </div>

      <div class="ds-w" style="left: 13px; top: 380px">
        <div class="ov-panel draft-odds">
          <div class="odds-win">
            <small>Win</small>
            <div class="wp-bar">
              <div class="wp-fill" :style="{ transform: `scaleX(${win})` }" />
            </div>
            <b :class="win >= 0.5 ? 'ally' : 'enemy'">{{ Math.round(win * 100) }}%</b>
          </div>
          <ul class="odds-lanes">
            <li v-for="(l, i) in DRAFT.odds.lanes" :key="l.lane">
              <RoleIcon :lane="l.lane" />
              <img
                :src="assetUrl('champion', l.ally)"
                alt=""
                width="24"
                height="24"
                :style="i === 1 ? { opacity: portrait } : undefined"
              />
              <b
                :class="l.w >= 0.52 ? 'ally' : l.w <= 0.48 ? 'enemy' : ''"
                :style="i === 1 ? { opacity: Math.min(portrait, viego) } : undefined"
                >{{ Math.round(l.w * 100) }}%</b
              >
              <img
                :src="assetUrl('champion', l.enemy)"
                alt=""
                width="24"
                height="24"
                :style="i === 1 ? { opacity: viego } : undefined"
              />
            </li>
          </ul>
        </div>
      </div>

      <div class="ds-w" style="left: 1035px; top: 72px" :style="rise(countersIn, 0, 18)">
        <div class="ov-panel counters">
          <div class="counters-head">
            <img :src="assetUrl('champion', counters.enemy.id)" alt="" width="20" height="20" />
            <strong>Picks into {{ counters.enemy.name }}</strong>
            <RoleIcon :lane="counters.lane" />
          </div>
          <ul>
            <li
              v-for="(c, i) in counters.picks"
              :key="c.id"
              :class="{ on: i === 0 && leeRowOn }"
              :style="rise(rowIn(i), 6)"
              :data-tip="`${c.games} games in this lane at your rank`"
            >
              <img :src="assetUrl('champion', c.id)" alt="" width="28" height="28" />
              <span>
                <b>{{ c.name }}</b>
                <small
                  >{{ c.games }} games<i v-if="c.mine"
                    ><Icon name="user" :size="10" />{{ c.mine }}</i
                  ></small
                >
              </span>
              <em class="ahead">{{ signed(edge(i)) }}</em>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ds {
  position: relative;
  width: 1280px;
  height: 720px;
  overflow: hidden;
  font-family: var(--font);
  color: #ececf3;
  background: #0b0c10;
}

.ds-desk {
  position: absolute;
  inset: 0;
  background:
    url('../../../css/grain.png'),
    radial-gradient(80% 70% at 50% 40%, rgb(40 44 58 / 0.5), transparent 75%), #0a0b0f;
}

.ds-client {
  position: absolute;
  left: 258px;
  top: 120px;
  display: grid;
  grid-template-columns: 176px minmax(0, 1fr) 64px;
  grid-template-rows: 40px minmax(0, 1fr);
  width: 764px;
  height: 480px;
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
  min-width: 36px;
  font-family: var(--font-mono);
  font-size: 14px;
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
  height: 50px;
  padding: 0 8px;
  border-radius: 4px;
}

.ds-team li.me {
  background: rgb(255 255 255 / 0.04);
  box-shadow: inset 2px 0 0 rgb(76 155 255 / 0.7);
}

.ds-face {
  position: relative;
  display: block;
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.12);
}

.ds-face.empty {
  background: rgb(255 255 255 / 0.03);
}

.ds-face img {
  position: absolute;
  inset: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}

.ds-face img.ghost {
  filter: saturate(0.4);
}

.ds-team span:not(.ds-face) {
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
  grid-template-columns: repeat(6, 60px);
  align-content: start;
  gap: 10px;
}

.ds-grid i {
  width: 60px;
  height: 60px;
  background: center / 108% no-repeat;
  border-radius: 3px;
  opacity: 0.42;
  filter: saturate(0.6);
  transition:
    opacity 220ms cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

.ds-grid i.on {
  opacity: 1;
  filter: none;
  box-shadow: 0 0 0 2px rgb(236 236 243 / 0.75);
}

.ds-grid i.locked {
  box-shadow: 0 0 0 2px #c8aa6e;
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
  color: rgb(236 236 243 / 0.85);
  border: 1px solid rgb(200 170 110 / 0.55);
  border-radius: 3px;
}

.ds-lock.done {
  color: rgb(236 236 243 / 0.4);
  border-color: rgb(255 255 255 / 0.1);
}

.ds-w {
  position: absolute;
}

.ds-ov .iv-runes img {
  transform-origin: center;
}

.ds-ov .counters li {
  position: relative;
  margin: 0 -5px;
  padding: 2px 5px;
  border-radius: 6px;
  transition: background-color 160ms;
}

.ds-ov .counters li.on,
.ds-ov .counters li:hover {
  background: rgb(255 255 255 / 0.06);
}

.tick {
  fill: none;
  stroke: var(--up);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 1;
}
</style>
