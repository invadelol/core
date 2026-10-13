<script setup lang="ts">
import { computed } from 'vue'
import { Icon, Logo, MatchRow, PerfDial, RankCrest } from '@invadelol/ui'
import { score100, summaryOf } from '@invadelol/ui/logic'
import { assetUrl } from '../../../lib/assets.js'
import { detailOf } from '../../../lib/match.js'
import AppWindow from '../AppWindow.vue'
import { DEMO, HOME_GAMES, LP_VALUES } from '../demo.js'
import { DEMO_MATCH, DEMO_PUUID } from '../demo_match.js'
import { ease, inOut, land, lerp, seg } from './motion.js'

/**
 * After the game, on a 1280 × 720 screen. `rec`: the app's Recordings, where the fight's clip
 * slides into its place among the game's clips. `after`: the Profile page: the game slides in on
 * top of the history, its score dial draws from 0, the LP rolls and the LP line reaches its new
 * point. `web`: the same page becomes invade.lol: the app's chrome gives way to the browser's while
 * the content (the shared element) moves to where the website draws it.
 */
const props = defineProps<{ rec: number; after: number; web: number }>()

/* ── Recordings ── */
const CLIPS = [
  { title: 'Triple kill', meta: 'at 8:02', length: '0:24', img: '/landing/clip-kill.webp' },
  {
    title: 'Double kill',
    meta: 'at 15:19',
    length: '0:24',
    img: '/landing/clip-death.webp',
    fresh: true,
  },
  { title: 'Baron', meta: 'Objective · at 22:10', length: '0:33', img: '/landing/clip-baron.webp' },
  { title: 'Highlight', meta: 'Saved · at 27:40', length: '0:42', img: '/landing/clip-saved.webp' },
]
const CARD_W = 236
const GAP = 16
/** Each card's slot: the fresh one takes the second, the ones after it move over. */
const fresh = computed(() => ease(props.rec, 0.35, 0.75, land))
const shift = computed(() => ease(props.rec, 0.2, 0.6, inOut))
const cardStyle = (i: number) => {
  const c = CLIPS[i]
  if (c.fresh) {
    const k = fresh.value
    return {
      transform: `translate3d(${i * (CARD_W + GAP)}px, ${(1 - k) * 18}px, 0) scale(${lerp(0.94, 1, k)})`,
      opacity: Math.min(1, k * 1.4),
    }
  }
  const slot = i > 1 ? i - 1 + shift.value : i
  return { transform: `translate3d(${slot * (CARD_W + GAP)}px, 0, 0)` }
}
const clipCount = computed(() => (fresh.value > 0.5 ? 4 : 3))

/* ── Profile ── */
const detail = detailOf(DEMO_MATCH)
const game = summaryOf(detail, DEMO_PUUID)!
const SCORE = score100(game.score!.score)
const LP_GAIN = 24
const OLDER = HOME_GAMES.slice(1, 7)

/** The page swaps from Recordings to Profile as the chapter starts. */
const swap = computed(() => ease(props.after, 0, 0.1))
const active = computed(() => (props.after > 0.05 ? 'profile' : 'recordings'))

/** The new row arrives, pushing the history down. */
const ROW = 68
const row = computed(() => ease(props.after, 0.08, 0.3))
/** The dial draws, the number rolls with it. */
const dialK = computed(() => ease(props.after, 0.3, 0.6, inOut))
const dial = computed(() => Math.round(SCORE * dialK.value))
const placeIn = computed(() => ease(props.after, 0.56, 0.64))
/** LP: the number rolls, the line reaches its new point. */
const lpK = computed(() => ease(props.after, 0.62, 0.86, inOut))
const lp = computed(() => Math.round(64 - LP_GAIN + LP_GAIN * lpK.value))
const dot = computed(() => ease(props.after, 0.82, 0.92, land))

const TIER = [
  [85, 'Exceptional game'],
  [70, 'Great game'],
  [55, 'Good game'],
  [40, 'Average game'],
  [0, 'Rough game'],
] as const
const verdict = TIER.find(([min]) => SCORE >= min)![1]

/* The LP line: the last 16 changes, the newest drawn by the chapter. One violet line, a soft fade. */
const LW = 300
const LH = 118
const vals = LP_VALUES.slice(-16)
const lo = Math.min(...vals) - 12
const hi = Math.max(...vals) + 12
const pts = vals.map(
  (v, i) => [(i / (vals.length - 1)) * LW, LH - ((v - lo) / (hi - lo)) * LH] as const
)
const toPath = (list: ReadonlyArray<readonly [number, number]>) =>
  list.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')
const lineOld = toPath(pts.slice(0, -1))
const [px, py] = pts[pts.length - 2]
const [nx, ny] = pts[pts.length - 1]
const tip = computed(() => [lerp(px, nx, lpK.value), lerp(py, ny, lpK.value)] as const)
const lineNew = computed(
  () => `M${px.toFixed(1)} ${py.toFixed(1)}L${tip.value[0].toFixed(1)} ${tip.value[1].toFixed(1)}`
)
const area = computed(
  () =>
    `${lineOld}L${tip.value[0].toFixed(1)} ${tip.value[1].toFixed(1)}L${tip.value[0].toFixed(1)} ${LH}L0 ${LH}Z`
)

/* ── The morph to invade.lol ── */
const chrome = computed(() => ease(props.web, 0.05, 0.45))
const move = computed(() => ease(props.web, 0.12, 0.72, inOut))
/** The content block: where the app's page puts it, then where the website does. */
const APP = { x: 232, y: 68 }
const WEB = { x: 128, y: 108 }
const block = computed(() => ({
  transform: `translate3d(${lerp(APP.x, WEB.x, move.value)}px, ${lerp(APP.y, WEB.y, move.value)}px, 0)`,
}))
const recShown = computed(() => props.after < 0.12)
</script>

<template>
  <div class="dk">
    <!-- The app -->
    <div class="dk-app">
      <AppWindow :active="active">
        <div v-if="recShown" class="rec iv-root" :style="{ opacity: 1 - swap }">
          <div class="rec-head">
            <h3>Recordings</h3>
            <span class="rec-used">4.9 GB used</span>
          </div>
          <div class="iv-seg rec-filters">
            <span class="on">All</span><span>Kills<small>2</small></span
            ><span>Deaths<small>0</small></span
            ><span>Objectives<small>1</small></span
            ><span>Saved<small>1</small></span
            ><span>Full games<small>1</small></span>
          </div>
          <div class="rec-game">
            <img :src="assetUrl('champion', 64)" alt="" width="36" height="36" />
            <span class="rec-name"
              ><b>Lee Sin</b><small>Summoner's Rift · Ranked Solo · Just now</small></span
            >
            <span class="rec-kda"><b>11<i>/</i>2<i>/</i>15</b><small>Win · 31:14</small></span>
            <span class="rec-count">{{ clipCount }} clips</span>
            <Icon name="star" :size="16" class="rec-star" />
          </div>
          <div class="rec-grid">
            <figure
              v-for="(clip, i) in CLIPS"
              :key="clip.title"
              class="rec-card"
              :class="{ fresh: clip.fresh }"
              :style="cardStyle(i)"
            >
              <span class="rec-thumb">
                <img :src="clip.img" alt="" width="480" height="270" decoding="async" />
                <span class="rec-len">{{ clip.length }}</span>
                <span class="rec-play"><Icon name="play" :size="14" /></span>
              </span>
              <b>{{ clip.title }}</b>
              <small>{{ clip.meta }}</small>
            </figure>
          </div>
        </div>
      </AppWindow>
    </div>

    <!-- invade.lol: the browser's chrome and the site's header, over the app's -->
    <div class="dk-web" :style="{ opacity: chrome }" aria-hidden="true">
      <div class="web-bar">
        <i class="web-lights"><b /><b /><b /></i>
        <span class="web-url">
          <svg viewBox="0 0 16 16"><path d="M4.5 7V5.5a3.5 3.5 0 0 1 7 0V7M3.5 7h9v6.5h-9z" /></svg>
          invade.lol/{{ DEMO.name }}-{{ DEMO.tag }}
        </span>
      </div>
      <div class="web-head">
        <Logo :size="18" word />
        <span class="web-crumb"
          >{{ DEMO.name }} <small>#{{ DEMO.tag }}</small></span
        >
        <span class="web-search"><Icon name="search" :size="13" />Search a player</span>
        <span class="web-app">App</span>
      </div>
    </div>

    <!-- The page's content: the shared element between the two -->
    <div class="dk-block iv-root" :style="[block, { opacity: swap }]">
      <div class="col">
        <section class="card score">
          <header>
            <span class="lbl">This game</span>
            <span class="meta">Ranked Solo · 31:14</span>
          </header>
          <div class="score-body">
            <span class="big-dial">
              <PerfDial
                :score="dial"
                :rank="placeIn > 0.5 ? game.score!.rank : 0"
                :tag="placeIn > 0.5 ? game.score!.tag : ''"
              />
            </span>
            <div class="score-text">
              <b :style="{ opacity: placeIn }">{{ verdict }}</b>
              <span class="kda"
                >{{ game.kills }}<i>/</i>{{ game.deaths }}<i>/</i>{{ game.assists }}</span
              >
              <small>Lee Sin · Jungle · Win</small>
            </div>
          </div>
          <p class="score-note">Against the other nine players, weighted for the jungle.</p>
        </section>

        <section class="card lp">
          <header>
            <RankCrest tier="EMERALD" :size="40" />
            <span class="lp-text">
              <span class="lbl">Ranked Solo/Duo</span>
              <b
                >Emerald II <span class="lp-num">{{ lp }}<small>LP</small></span></b
              >
            </span>
            <em class="lp-gain" :style="{ opacity: lpK > 0.02 ? 1 : 0 }"
              >+{{ Math.round(LP_GAIN * lpK) }} LP</em
            >
          </header>
          <div class="lp-plot">
            <span class="guide" style="top: 0" />
            <span class="guide" style="top: 50%" />
            <span class="guide base" style="top: 100%" />
            <svg :viewBox="`0 0 ${LW} ${LH}`" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="dk-lp-fade" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stop-color="#7b6dff" stop-opacity="0.26" />
                  <stop offset="1" stop-color="#7b6dff" stop-opacity="0" />
                </linearGradient>
              </defs>
              <path :d="area" fill="url(#dk-lp-fade)" />
              <path :d="lineOld" class="ln" />
              <path :d="lineNew" class="ln" />
            </svg>
            <i
              class="lp-dot"
              :style="{
                left: `${(tip[0] / LW) * 100}%`,
                top: `${(tip[1] / LH) * 100}%`,
                transform: `translate(-50%, -50%) scale(${dot})`,
              }"
            />
          </div>
          <p class="lp-axis"><span>16 games ago</span><span>Now</span></p>
        </section>
      </div>

      <section class="card hist">
        <header>
          <span class="lbl">Match history</span>
          <span class="meta">Today</span>
        </header>
        <div class="hist-clip">
          <ul class="hist-list" :style="{ transform: `translate3d(0, ${(row - 1) * ROW}px, 0)` }">
            <li :style="{ opacity: row, transform: `scale(${lerp(0.97, 1, row)})` }">
              <MatchRow :game="game" :score="game.score" :lp="LP_GAIN" />
            </li>
            <li v-for="r in OLDER" :key="r.game.gameId">
              <MatchRow :game="r.game" :score="r.game.score" :lp="r.lp" />
            </li>
          </ul>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.dk {
  position: relative;
  width: 1280px;
  height: 720px;
  overflow: hidden;
  font-family: var(--font);
  color: #ececf3;
  background: #08090c;
}

.dk-app {
  position: absolute;
  inset: 0;
}

/* ── Recordings ── */
.rec {
  height: 100%;
  padding: 22px 24px;
}

.rec-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
}

.rec-head h3 {
  font-size: 22px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.rec-used {
  font-size: 12.5px;
  color: var(--text-3);
}

.rec-filters {
  display: inline-flex;
  margin-bottom: 18px;
}

.rec-filters span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 11px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-2);
  border-radius: var(--r-sm);
}

.rec-filters span.on {
  color: var(--text-1);
  background: var(--key);
  box-shadow: var(--key-shadow);
}

.rec-filters small {
  font-size: 11px;
  color: var(--text-3);
}

.rec-game {
  position: relative;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto auto 20px;
  align-items: center;
  column-gap: 14px;
  min-height: 56px;
  padding: 0 14px 0 16px;
  background:
    linear-gradient(90deg, rgb(var(--win-rgb) / 0.12), rgb(var(--win-rgb) / 0) 45%),
    var(--surface-1);
  border-radius: var(--r-sm);
  box-shadow: var(--row);
}

.rec-game::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--win);
  border-radius: var(--r-sm) 0 0 var(--r-sm);
}

.rec-game img {
  width: 36px;
  height: 36px;
  border-radius: var(--r-sm);
}

.rec-name,
.rec-kda {
  display: grid;
  gap: 3px;
}

.rec-game b {
  font-size: 14px;
  font-weight: 600;
}

.rec-game small {
  font-size: 12px;
  color: var(--text-3);
}

.rec-kda i {
  margin: 0 4px;
  font-style: normal;
  font-weight: 400;
  color: var(--text-4);
}

.rec-count {
  font-size: 12px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

.rec-star {
  color: var(--text-4);
}

.rec-grid {
  position: relative;
  height: 210px;
  margin-top: 16px;
}

.rec-card {
  position: absolute;
  top: 0;
  left: 0;
  display: grid;
  gap: 4px;
  width: 236px;
  margin: 0;
}

.rec-thumb {
  position: relative;
  display: block;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  margin-bottom: 6px;
  border-radius: var(--r-md);
  box-shadow: var(--portrait);
}

.rec-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 400ms cubic-bezier(0.16, 1, 0.3, 1);
}

.rec-card:hover .rec-thumb img {
  transform: scale(1.04);
}

.rec-len {
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 1px 6px;
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-mono);
  color: #fff;
  background: rgb(0 0 0 / 0.65);
  border-radius: 4px;
}

.rec-play {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #fff;
  opacity: 0;
  background: rgb(0 0 0 / 0.25);
  transition: opacity 160ms;
}

.rec-card:hover .rec-play {
  opacity: 1;
}

.rec-card b {
  font-size: 13.5px;
  font-weight: 600;
}

.rec-card small {
  font-size: 12px;
  color: var(--text-3);
}

.rec-card.fresh .rec-thumb {
  box-shadow:
    0 0 0 1.5px rgb(var(--brand-rgb) / 0.7),
    0 8px 24px -8px rgb(0 0 0 / 0.7);
}

/* ── invade.lol's chrome ── */
.dk-web {
  position: absolute;
  inset: 0;
  background: url('../../../css/grain.png'), var(--light), #0d0e13;
  pointer-events: none;
}

.web-bar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  background: #08090c;
  border-bottom: 1px solid var(--line);
}

.web-lights {
  position: absolute;
  top: 18px;
  left: 18px;
  display: flex;
  gap: 8px;
}

.web-lights b {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ff5f57;
}

.web-lights b:nth-child(2) {
  background: #febc2e;
}

.web-lights b:nth-child(3) {
  background: #28c840;
}

.web-url {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 380px;
  height: 28px;
  font-size: 12.5px;
  color: var(--text-2);
  background: var(--surface-2);
  border-radius: 7px;
}

.web-url svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
}

.web-head {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 48px;
  padding: 0 128px;
  background: #08090c;
  border-bottom: 1px solid var(--line);
}

.web-crumb {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}

.web-crumb small {
  font-weight: 500;
  color: var(--text-3);
}

.web-search {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 240px;
  height: 30px;
  margin-left: auto;
  padding: 0 10px;
  font-size: 12.5px;
  color: var(--text-3);
  background: rgb(0 0 0 / 0.3);
  border-radius: var(--r-sm);
  box-shadow: var(--inset-shadow);
}

.web-app {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
}

/* ── The content block (1024 × 600) ── */
.dk-block {
  position: absolute;
  top: 0;
  left: 0;
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 20px;
  width: 1024px;
  height: 600px;
}

.col {
  display: grid;
  grid-template-rows: 236px minmax(0, 1fr);
  gap: 16px;
  min-height: 0;
}

.card {
  position: relative;
  min-height: 0;
  padding: 16px 18px;
  background: var(--sheen), var(--surface-1);
  border-radius: var(--r-lg);
  box-shadow: var(--lit);
}

.card header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.lbl {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text-2);
}

.meta {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-3);
}

.score-body {
  display: flex;
  align-items: center;
  gap: 26px;
  margin-top: 18px;
}

.big-dial {
  display: grid;
  place-items: center;
  width: 120px;
  height: 120px;
  flex: none;
}

.big-dial :deep(.iv-dial) {
  transform: scale(2.5);
}

.score-text {
  display: grid;
  gap: 6px;
}

.score-text b {
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.score-text .kda {
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.score-text .kda i {
  margin: 0 4px;
  font-style: normal;
  font-weight: 400;
  color: var(--text-4);
}

.score-text small {
  font-size: 12px;
  color: var(--text-3);
}

.score-note {
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 14px;
  font-size: 11.5px;
  color: var(--text-3);
}

.lp header {
  gap: 12px;
}

.lp-text {
  display: grid;
  gap: 2px;
}

.lp-text b {
  font-size: 16px;
  font-weight: 650;
  color: var(--tier-emerald);
}

.lp-num {
  margin-left: 6px;
  font-variant-numeric: tabular-nums;
  color: var(--text-1);
}

.lp-num small {
  margin-left: 3px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
}

.lp-gain {
  margin-left: auto;
  padding: 3px 8px;
  font-size: 12px;
  font-style: normal;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  color: var(--win);
  background: rgb(var(--win-rgb) / 0.12);
  border-radius: 999px;
}

.lp-plot {
  position: relative;
  height: 160px;
  margin-top: 26px;
}

.lp-plot svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.ln {
  fill: none;
  stroke: #7b6dff;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

.guide {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px dashed var(--line-2);
}

.guide.base {
  border-top-style: solid;
}

.lp-dot {
  position: absolute;
  width: 9px;
  height: 9px;
  background: #7b6dff;
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgb(var(--brand-rgb) / 0.25);
}

.lp-axis {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  font-size: 11px;
  color: var(--text-3);
}

.hist {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 14px;
}

.hist-clip {
  min-height: 0;
  overflow: hidden;
  margin: 0 -6px;
  padding: 0 6px;
}

.hist-list {
  display: grid;
  gap: 4px;
}

.hist-list li {
  transform-origin: 50% 0;
}
</style>
