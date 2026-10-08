<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Check, Zap } from 'lucide-vue-next'
import Screen from './Screen.vue'
import RoleIcon from '../RoleIcon.vue'
import {
  champIcon,
  itemIcon,
  rankCrest,
  rankName,
  runeIcon,
  runeStyleIcon,
  spellIcon,
  tierColor,
} from '../../lib/assets.js'

/**
 * Champ select, as the app's Live page shows it: the state line and clock, both teams filling
 * in with each ally's rank, then the setup for your pick (runes, spells, skill order, items) and
 * its runes going into the client. Players and ranks are the app's preview sample; the setup is
 * the app's bundled data for Veigar mid at Emerald (patch 16.20).
 */
const props = defineProps<{ step: number; active: boolean; still: boolean; narrow?: boolean }>()

const W = 1280
const H = 720

/** The camera on each step: the page, your team, your pick, the import. */
const CAMERAS = [
  { x: W / 2, y: H / 2, z: 1 },
  { x: 330, y: 250, z: 1.55 },
  { x: 640, y: 540, z: 1.06 },
  { x: W / 2, y: H / 2, z: 1 },
]
/* A phone: your team, its ranks, your setup, the import, each up close. */
const NARROW = [
  { x: 330, y: 250, z: 1.9 },
  { x: 470, y: 250, z: 2.1 },
  { x: 330, y: 560, z: 1.9 },
  { x: 1060, y: 480, z: 2.2 },
]
const camera = computed(() => {
  if (props.still) return CAMERAS[0]
  return (props.narrow ? NARROW : CAMERAS)[props.step] ?? CAMERAS[0]
})

type Seat = {
  role: string
  champ: number
  name: string
  rank?: { tier: string; division: string }
  me?: boolean
}

const ALLY: Seat[] = [
  { role: 'TOP', champ: 266, name: 'Northwind', rank: { tier: 'EMERALD', division: 'II' } },
  { role: 'JUNGLE', champ: 64, name: 'River Moon', rank: { tier: 'PLATINUM', division: 'I' } },
  { role: 'MIDDLE', champ: 45, name: 'You', rank: { tier: 'EMERALD', division: 'II' }, me: true },
  { role: 'BOTTOM', champ: 222, name: 'Afterglow', rank: { tier: 'DIAMOND', division: 'IV' } },
  { role: 'UTILITY', champ: 412, name: 'Lantern', rank: { tier: 'EMERALD', division: 'III' } },
]

const ENEMY: Seat[] = [
  { role: 'TOP', champ: 887, name: 'Enemy 1' },
  { role: 'JUNGLE', champ: 234, name: 'Enemy 2' },
  { role: 'MIDDLE', champ: 103, name: 'Enemy 3' },
  { role: 'BOTTOM', champ: 145, name: 'Enemy 4' },
  { role: 'UTILITY', champ: 111, name: 'Enemy 5' },
]

const NAMES: Record<number, string> = {
  266: 'Aatrox',
  64: 'Lee Sin',
  45: 'Veigar',
  222: 'Jinx',
  412: 'Thresh',
  887: 'Gwen',
  234: 'Viego',
  103: 'Ahri',
  145: "Kai'Sa",
  111: 'Nautilus',
}

const BANS = { ally: [238, 157, 555], enemy: [84, 91, 360] }

/* The pick order, blue side first: one turn per entry, with what each seat does. */
type SeatState = 'waiting' | 'hovering' | 'picking' | 'locked'
interface Turn {
  ms: number
  ally: SeatState[]
  enemy: SeatState[]
  phase: string
  acting: string
  odds: number
}

const w = 'waiting' as const
const h = 'hovering' as const
const p = 'picking' as const
const l = 'locked' as const

const TURNS: Turn[] = [
  {
    ms: 0,
    ally: [p, h, h, w, w],
    enemy: [w, w, w, w, w],
    phase: 'Pick phase',
    acting: 'Northwind picking',
    odds: 0.5,
  },
  {
    ms: 900,
    ally: [l, h, h, h, w],
    enemy: [p, p, w, w, w],
    phase: 'Pick phase',
    acting: 'Enemy team picking',
    odds: 0.51,
  },
  {
    ms: 2100,
    ally: [l, p, p, h, h],
    enemy: [l, l, w, w, w],
    phase: 'Pick phase',
    acting: 'You are picking',
    odds: 0.49,
  },
  {
    ms: 3200,
    ally: [l, l, p, h, h],
    enemy: [l, l, w, w, w],
    phase: 'Pick phase',
    acting: 'You are picking',
    odds: 0.52,
  },
]

const LOCKED_ME: Turn = {
  ms: 0,
  ally: [l, l, l, h, h],
  enemy: [l, l, w, w, w],
  phase: 'Pick phase',
  acting: 'Enemy team picking',
  odds: 0.53,
}

const FINAL: Turn = {
  ms: 0,
  ally: [l, l, l, l, l],
  enemy: [l, l, l, l, l],
  phase: 'Final adjustments',
  acting: '',
  odds: 0.54,
}

/* ── Time inside a step ───────────────────────────────────────── */
const elapsed = ref(0)
let started = 0
let frame = 0

function run() {
  elapsed.value = performance.now() - started
  if (elapsed.value < 30_000) frame = requestAnimationFrame(run)
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

const turn = computed<Turn>(() => {
  if (props.still) return FINAL
  if (props.step === 0) return [...TURNS].reverse().find((t) => elapsed.value >= t.ms) ?? TURNS[0]
  if (props.step === 1) return TURNS[3]
  if (props.step === 2) return LOCKED_ME
  return FINAL
})

/** The clock: each turn starts at 30 seconds and counts down. */
const clock = computed(() => {
  const start = turn.value === FINAL ? 22 : 30
  const since = props.step === 0 ? elapsed.value - turn.value.ms : elapsed.value + 4000
  return Math.max(0, start - Math.floor(since / 1000))
})

const ranks = computed(() => props.still || props.step >= 1)
const setup = computed(() => props.still || props.step >= 2)
const imported = computed(() => props.still || props.step >= 3)

const teams = computed(() => [
  { id: 'ally', label: 'Your team', seats: ALLY, states: turn.value.ally, bans: BANS.ally },
  { id: 'enemy', label: 'Enemy team', seats: ENEMY, states: turn.value.enemy, bans: BANS.enemy },
])

const lockedCount = (states: SeatState[]) => states.filter((s) => s === 'locked').length

/** Enemy hovers are hidden by the client: only locked enemy picks show. */
const showChamp = (team: string, state: SeatState) =>
  team === 'ally' ? state !== 'waiting' : state === 'locked'

const STATE_LABEL: Record<SeatState, string> = {
  waiting: 'Waiting',
  hovering: 'Hovering',
  picking: 'Picking',
  locked: '',
}

/* ── The setup: bundled data, Veigar mid, Emerald ─────────────── */
const RUNES = {
  primary: 8300,
  keystone: 8369,
  minor: [8304, 8345, 8347],
  secondary: 8200,
  sub: [8210, 8226],
  shards: [5007, 5008, 5001],
}

const ROWS = [
  { label: 'Spells', items: [4, 12], kind: 'spell', stat: '47%', meta: '85% pick · 285 games' },
  {
    label: 'Starter',
    items: [1056, 2003, 2003],
    kind: 'item',
    stat: '46%',
    meta: '83% pick · 283 games',
  },
  { label: 'Boots', items: [3020], kind: 'item', stat: '55%', meta: '62% pick · 204 games' },
  {
    label: 'Core',
    items: [3070, 6657, 3040, 3089],
    kind: 'item',
    stat: '41%',
    meta: '14% pick · 29 games',
  },
]
</script>

<template>
  <Screen :w="W" :h="H" :camera="camera">
    <div class="dv">
      <!-- Page head -->
      <header class="dv-head">
        <h3>Live game</h3>
        <span class="dv-seg"><b>Draft</b><span>Scouting</span></span>
      </header>

      <!-- State line: phase, who acts, the draft odds and the clock -->
      <div class="dv-state">
        <b>Champ select</b>
        <span class="dot">·</span>
        <span>{{ turn.phase }}</span>
        <template v-if="turn.acting">
          <span class="dot">·</span>
          <span
            :class="
              turn.acting.startsWith('You') ? 'me' : turn.acting.startsWith('Enemy') ? 'enemy' : ''
            "
          >
            {{ turn.acting }}
          </span>
        </template>
        <span class="dv-odds">
          <span class="text-ink-3">Draft</span>
          <b class="num" :class="turn.odds >= 0.5 ? 'text-win' : 'text-loss'">
            {{ Math.round(turn.odds * 100) }}%
          </b>
          <i><i :style="{ transform: `scaleX(${turn.odds})` }" /></i>
        </span>
        <span class="dv-clock num">0:{{ String(clock).padStart(2, '0') }}</span>
      </div>

      <!-- The two teams -->
      <div class="dv-board">
        <section v-for="team in teams" :key="team.id" class="dv-team" :class="`is-${team.id}`">
          <header>
            <b>{{ team.label }}</b>
            <small class="num">{{ lockedCount(team.states) }}/5 locked</small>
            <span class="dv-bans">
              <span v-for="id in team.bans" :key="id" class="portrait h-[22px] w-[22px]">
                <img :src="champIcon(id)" alt="" loading="lazy" />
              </span>
            </span>
          </header>
          <ul>
            <li
              v-for="(seat, i) in team.seats"
              :key="seat.role"
              :class="{ me: seat.me, picking: team.states[i] === 'picking' }"
            >
              <RoleIcon :role="seat.role" :size="16" class="text-ink-3" />
              <span class="dv-pic portrait">
                <Transition name="pick">
                  <img
                    v-if="showChamp(team.id, team.states[i])"
                    :key="seat.champ"
                    :src="champIcon(seat.champ)"
                    :alt="NAMES[seat.champ]"
                    loading="lazy"
                    :class="{ hover: team.states[i] !== 'locked' }"
                  />
                </Transition>
              </span>
              <span class="dv-who">
                <b>{{ showChamp(team.id, team.states[i]) ? NAMES[seat.champ] : 'Not picked' }}</b>
                <small :class="{ me: seat.me }">{{ seat.name }}</small>
              </span>
              <span
                v-if="seat.rank"
                class="dv-rank"
                :class="{ on: ranks }"
                :style="{ transitionDelay: ranks ? `${i * 90}ms` : '0ms' }"
              >
                <img :src="rankCrest(seat.rank.tier)" alt="" />
                <b :style="{ color: tierColor(seat.rank.tier) }">
                  {{ rankName(seat.rank.tier, seat.rank.division) }}
                </b>
              </span>
              <span v-else />
              <span class="dv-seat-state" :class="team.states[i]">
                {{ STATE_LABEL[team.states[i]] }}
              </span>
            </li>
          </ul>
        </section>
      </div>

      <!-- Your pick: the setup, and its runes going into the client -->
      <section class="dv-pick" :class="{ on: setup }">
        <header>
          <span class="portrait h-9 w-9">
            <img :src="champIcon(45)" alt="Veigar" loading="lazy" />
          </span>
          <b class="text-[17px]">Veigar</b>
          <span class="text-[13px] text-ink-3">Mid · Emerald</span>
          <span class="dv-tab">Recommended <small>44%</small></span>
          <span class="dv-import" :class="{ done: imported }">
            <Transition name="swap" mode="out-in">
              <span v-if="imported" key="done" class="flex items-center gap-1.5">
                <Check :size="14" :stroke-width="2.4" />Runes imported
              </span>
              <span v-else key="todo" class="flex items-center gap-1.5">
                <Zap :size="14" />Use this setup &amp; import runes
              </span>
            </Transition>
          </span>
        </header>

        <div class="dv-setup">
          <!-- Runes -->
          <div class="dv-runes">
            <div class="dv-tree">
              <img :src="runeStyleIcon(RUNES.primary)" alt="Inspiration" class="tree" />
              <img :src="runeIcon(RUNES.keystone)" alt="First Strike" class="key" />
              <img v-for="id in RUNES.minor" :key="id" :src="runeIcon(id)" alt="" />
            </div>
            <div class="dv-tree">
              <img :src="runeStyleIcon(RUNES.secondary)" alt="Sorcery" class="tree" />
              <img v-for="id in RUNES.sub" :key="id" :src="runeIcon(id)" alt="" />
              <span class="dv-shards">
                <img v-for="(id, i) in RUNES.shards" :key="i" :src="runeIcon(id)" alt="" />
              </span>
            </div>
            <p class="text-[12px] text-ink-3"><b class="text-ink">44%</b> win · 108 games</p>
          </div>

          <!-- Skills, spells, items -->
          <ul class="dv-rows">
            <li>
              <span class="label">Skill order</span>
              <span class="dv-skills"><b>Q</b><i>›</i><b>W</b><i>›</i><b>E</b></span>
              <span class="dv-stat"><b>51%</b> · 120 games</span>
            </li>
            <li v-for="row in ROWS" :key="row.label">
              <span class="label">{{ row.label }}</span>
              <span class="flex gap-1.5">
                <img
                  v-for="(id, i) in row.items"
                  :key="i"
                  :src="row.kind === 'spell' ? spellIcon(id) : itemIcon(id)"
                  alt=""
                  loading="lazy"
                />
              </span>
              <span class="dv-stat">
                <b>{{ row.stat }}</b> · {{ row.meta }}
              </span>
            </li>
          </ul>
        </div>
      </section>
    </div>
  </Screen>
</template>

<style scoped>
.dv {
  width: 1280px;
  height: 720px;
  padding: 24px 34px;
  background: var(--color-bg);
  color: var(--color-ink);
  font-size: 13px;
}

.dv-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dv-head h3 {
  font-size: 22px;
  font-weight: 600;
}

.dv-seg {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: 7px;
  background: var(--color-panel);
  font-size: 12.5px;
  color: var(--color-ink-3);
}

.dv-seg > * {
  padding: 5px 12px;
  border-radius: 5px;
}

.dv-seg b {
  font-weight: 500;
  color: var(--color-ink);
  background: var(--color-track);
}

.dv-state {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  margin-top: 8px;
  font-size: 15px;
  color: var(--color-ink-3);
}

.dv-state > b {
  font-weight: 600;
  color: var(--color-ink);
}

.dv-state .dot {
  color: var(--color-ink-4);
}

.dv-state .me {
  font-weight: 600;
  color: var(--color-brand-hi);
}

.dv-state .enemy {
  color: var(--color-loss);
}

.dv-odds {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  font-size: 13px;
}

.dv-odds b {
  min-width: 34px;
  font-weight: 700;
}

.dv-odds > i {
  display: block;
  width: 120px;
  height: 4px;
  overflow: hidden;
  border-radius: 2px;
  background: rgb(var(--loss-rgb) / 0.7);
}

.dv-odds > i > i {
  display: block;
  height: 100%;
  background: var(--color-win);
  transform-origin: left;
  transition: transform 600ms var(--ease);
}

.dv-clock {
  width: 64px;
  margin-left: 24px;
  font-size: 26px;
  font-weight: 700;
  font-stretch: var(--fig);
  text-align: right;
  color: var(--color-ink);
}

.dv-board {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 22px;
  margin-top: 6px;
}

.dv-team > header {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 38px;
  border-top: 2px solid var(--color-win);
}

.dv-team.is-enemy > header {
  border-top-color: var(--color-loss);
}

.dv-team > header b {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-win);
}

.dv-team.is-enemy > header b {
  color: var(--color-loss);
}

.dv-team > header small {
  font-size: 12px;
  color: var(--color-ink-3);
}

.dv-bans {
  display: flex;
  gap: 4px;
  margin-left: auto;
  opacity: 0.45;
  filter: grayscale(1);
}

.dv-team ul {
  display: grid;
  gap: 3px;
}

.dv-team li {
  display: grid;
  grid-template-columns: 18px 40px minmax(0, 1fr) auto 64px;
  align-items: center;
  gap: 12px;
  height: 50px;
  padding: 0 14px 0 12px;
  border-radius: var(--radius-sm);
  background: var(--color-panel);
  box-shadow: var(--hi);
}

.dv-team li.me {
  background: rgb(var(--brand-rgb) / 0.1);
  box-shadow: inset 2px 0 0 var(--color-brand);
}

.dv-pic {
  position: relative;
  width: 40px;
  height: 40px;
}

.dv-pic img {
  position: absolute;
  inset: 0;
}

.dv-pic img.hover {
  opacity: 0.55;
}

.dv-who {
  display: grid;
  min-width: 0;
  line-height: 1.25;
}

.dv-who b {
  font-size: 14px;
  font-weight: 600;
}

.dv-who small {
  font-size: 12px;
  color: var(--color-ink-3);
}

.dv-who small.me {
  color: var(--color-brand-hi);
}

.dv-rank {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  opacity: 0;
  transform: translateX(6px);
  transition:
    opacity 360ms var(--ease),
    transform 360ms var(--ease);
}

.dv-rank.on {
  opacity: 1;
  transform: none;
}

.dv-rank img {
  width: 18px;
  height: 18px;
}

.dv-rank b {
  font-weight: 600;
}

.dv-seat-state {
  font-size: 12.5px;
  text-align: right;
  color: var(--color-ink-3);
}

.dv-seat-state.picking {
  font-weight: 600;
  color: var(--color-ink);
}

/* ── Your pick ────────────────────────────────────────────────── */
.dv-pick {
  margin-top: 16px;
  padding: 14px 18px 12px;
  border-radius: var(--radius-md);
  background: var(--color-panel);
  box-shadow: var(--hi);
  opacity: 0.3;
  transition: opacity 500ms var(--ease);
}

.dv-pick.on {
  opacity: 1;
}

.dv-pick > header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dv-tab {
  margin-left: 18px;
  padding: 0 2px 6px;
  font-size: 13px;
  font-weight: 600;
  box-shadow: inset 0 -2px 0 var(--color-brand);
}

.dv-tab small {
  margin-left: 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-ink-3);
}

.dv-import {
  display: inline-flex;
  align-items: center;
  height: 32px;
  margin-left: auto;
  padding: 0 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background: var(--color-brand);
  transition:
    background-color 300ms var(--ease),
    color 300ms var(--ease);
}

/* Pressed, the app keeps the button and says what it did. */
.dv-import.done {
  background: var(--color-brand);
}

.dv-setup {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 28px;
  margin-top: 12px;
}

.dv-runes {
  display: grid;
  align-content: start;
  gap: 10px;
  padding-top: 4px;
}

.dv-tree {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dv-tree img {
  width: 26px;
  height: 26px;
}

.dv-tree img.tree {
  width: 18px;
  height: 18px;
  opacity: 0.85;
}

.dv-tree img.key {
  width: 40px;
  height: 40px;
}

.dv-shards {
  display: flex;
  gap: 4px;
  margin-left: 8px;
}

.dv-shards img {
  width: 18px;
  height: 18px;
  padding: 2px;
  border-radius: 50%;
  background: var(--color-well);
}

.dv-rows {
  display: grid;
}

.dv-rows li {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  height: 36px;
  border-bottom: 1px solid var(--color-line);
}

.dv-rows li:last-child {
  border-bottom: 0;
}

.dv-rows img {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-xs);
}

.dv-skills {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
}

.dv-skills i {
  font-style: normal;
  color: var(--color-ink-4);
}

.dv-stat {
  font-size: 12px;
  color: var(--color-ink-3);
}

.dv-stat b {
  font-weight: 600;
  color: var(--color-ink);
}

.pick-enter-active {
  transition:
    opacity 260ms var(--ease),
    transform 260ms var(--ease);
}

.pick-enter-from {
  opacity: 0;
  transform: scale(1.12);
}

.swap-enter-active,
.swap-leave-active {
  transition: opacity 160ms var(--ease);
}

.swap-enter-from,
.swap-leave-to {
  opacity: 0;
}
</style>
