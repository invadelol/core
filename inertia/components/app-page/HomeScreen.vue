<script setup lang="ts">
import { Icon, MatchRow, PerfDial, RankCrest, TrendLine } from '@invadelol/ui'
import { assetUrl } from '../../lib/assets.js'
import AppWindow from './AppWindow.vue'
import { CHAMPION_ROWS, CLIPS, HOME_GAMES, LP_VALUES, PERF, SOLO, FLEX } from './demo.js'

/**
 * The desktop app's Home, as 0.2.9 draws it (src/dashboard in the app): one screen of tiles that
 * never scrolls. Rank and LP, the match history with every game's score, the clips, favorites,
 * the performance column and the champions, on the sample player. The views the app shares with
 * the site (MatchRow, PerfDial, TrendLine, RankCrest) are the real components.
 */
defineProps<{ dial?: number | null }>()

const FAVORITES = [
  { img: assetUrl('champion', 64), title: 'Lee Sin · Jungle', meta: 'Build and runes' },
  { img: assetUrl('champion', 64), title: 'Win · 31:14', meta: 'Game · Emerald II' },
  { img: CLIPS[0].img, title: 'Triple kill', meta: 'Clip · 0:24', clip: true },
]
</script>

<template>
  <AppWindow active="dashboard">
    <div class="hs">
      <header class="hs-head">
        <h1>Home</h1>
        <span class="hs-ctx">Last 20 games</span>
        <span class="iv-seg hs-seg">
          <button type="button" class="on">All queues</button>
          <button type="button">Solo/Duo</button>
          <button type="button">Flex</button>
          <button type="button">Normal</button>
          <button type="button">ARAM</button>
        </span>
      </header>

      <div class="bento">
        <!-- Rank: crest and tier, the LP line, today; the other queue underneath -->
        <section class="tile rank">
          <div class="rank-id">
            <RankCrest tier="EMERALD" :size="64" class="crest" />
            <div class="rank-text">
              <span class="lbl">Ranked Solo/Duo</span>
              <span class="tierline">
                <b class="tier">Emerald II</b>
                <span class="lp"><b class="fig">{{ SOLO.lp }}</b><span class="unit">LP</span></span>
              </span>
              <small>61W 52L · 54%</small>
            </div>
          </div>
          <div class="rank-chart">
            <TrendLine :values="LP_VALUES.slice(-18)" :height="44" area />
            <small>
              <span><b class="up">+96 LP</b> over 30 days</span>
              <span class="changes"><em class="up">+22</em><em class="down">−16</em><em class="up">+24</em></span>
            </small>
          </div>
          <div class="rank-session">
            <span class="lbl">Today</span>
            <span class="figs">
              <b class="fig">1<i>W</i> 1<i>L</i></b>
              <b class="fig up">+8<i>LP</i></b>
            </span>
            <small>2 games · 59:21</small>
          </div>
          <p class="rank-other">
            <RankCrest tier="PLATINUM" :size="18" />
            <span class="lbl">Ranked Flex</span>
            <b class="plat">Platinum I</b>
            <span>{{ FLEX.lp }} LP</span>
            <small>14W 11L · 56%</small>
          </p>
        </section>

        <!-- Match history -->
        <section class="tile games">
          <header class="tile-head">
            <h2>Match history</h2>
            <span class="more">See all<Icon name="right" :size="14" /></span>
          </header>
          <ul class="fit">
            <li v-for="row in HOME_GAMES" :key="row.game.gameId">
              <MatchRow :game="row.game" :score="row.game.score" :lp="row.lp" compact />
            </li>
          </ul>
        </section>

        <!-- Clips -->
        <section class="tile clips">
          <header class="tile-head">
            <h2>Clips</h2>
            <span class="meta">Recording on</span>
            <span class="more">See all<Icon name="right" :size="14" /></span>
          </header>
          <div class="cards">
            <figure v-for="clip in CLIPS.slice(0, 2)" :key="clip.title" class="card">
              <span class="thumb">
                <img :src="clip.img" alt="" width="480" height="270" loading="lazy" decoding="async" />
                <span class="len">{{ clip.length }}</span>
              </span>
              <b>{{ clip.title }}</b>
              <small>Lee Sin · 1 hour ago</small>
            </figure>
          </div>
        </section>

        <!-- Favorites -->
        <section class="tile favs">
          <header class="tile-head">
            <h2>Favorites</h2>
            <span class="more">See all<Icon name="right" :size="14" /></span>
          </header>
          <ul class="list">
            <li v-for="fav in FAVORITES" :key="fav.title">
              <img :src="fav.img" alt="" :class="{ clip: fav.clip }" loading="lazy" />
              <span>
                <b>{{ fav.title }}</b>
                <small>{{ fav.meta }}</small>
              </span>
              <Icon name="star" :size="14" class="star" />
            </li>
          </ul>
        </section>

        <!-- Performance: the dial and the record, then each figure with its line -->
        <section class="tile perf">
          <header class="tile-head">
            <h2>Performance</h2>
            <span class="more">See all<Icon name="right" :size="14" /></span>
          </header>
          <div class="perf-body">
            <div class="perf-head">
              <PerfDial :score="dial === undefined ? PERF.score : dial" />
              <p>
                <small>Invade score</small>
                <span>{{ PERF.wins }}W {{ PERF.losses }}L · 60%</span>
                <small>{{ PERF.against }}</small>
              </p>
            </div>
            <ul class="perf-rows">
              <li v-for="m in PERF.metrics" :key="m.label">
                <span>{{ m.label }}</span>
                <b>{{ m.value }}</b>
                <em :class="m.tone">{{ m.gap }}</em>
                <div class="spark">
                  <TrendLine :values="m.values" :baseline="m.base" :span="m.span" :height="32" area />
                </div>
              </li>
            </ul>
          </div>
        </section>

        <!-- Champions -->
        <section class="tile champs">
          <header class="tile-head">
            <h2>Champions</h2>
            <span class="more">See all<Icon name="right" :size="14" /></span>
          </header>
          <ul class="list">
            <li v-for="c in CHAMPION_ROWS" :key="c.id">
              <img :src="assetUrl('champion', c.id)" alt="" loading="lazy" />
              <span>
                <b>{{ c.name }}</b>
                <small>{{ c.record }}</small>
              </span>
              <span class="right">
                <b>{{ c.wr }}</b>
                <small>{{ c.kda }}</small>
              </span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </AppWindow>
</template>

<style scoped>
.hs {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
  padding: 0 24px 20px;
}

.hs-head {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 10px 0 6px;
}

.hs-head h1 {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 24px;
}

.hs-ctx {
  font-size: 13px;
  color: var(--text-3);
}

.hs-seg {
  margin-left: auto;
}

.bento {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr) minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr) minmax(0, 1fr);
  grid-template-areas:
    'rank rank perf'
    'games clips perf'
    'games favs champs';
  gap: 12px;
  min-height: 0;
}

.tile {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  padding: 8px 14px 12px;
  overflow: hidden;
  background: var(--sheen), var(--surface-1);
  border-radius: var(--r-md);
  box-shadow: var(--lit);
}

.tile-head {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 30px;
  margin-bottom: 6px;
}

.tile-head h2 {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.tile-head .meta {
  font-size: 12px;
  color: var(--text-3);
}

.more {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-2);
}

.lbl {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}

.fig {
  font-stretch: var(--fig);
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1;
}

.up {
  color: var(--win);
}

.down {
  color: var(--loss);
}

/* ── Rank ── */
.rank {
  grid-area: rank;
  grid-template-columns: auto minmax(160px, 1fr) auto;
  grid-template-rows: auto auto;
  align-items: center;
  gap: 12px 24px;
  padding: 14px 18px 10px;
  background:
    radial-gradient(
      320px 200px at 50px 36%,
      rgb(46 194 126 / 0.1),
      rgb(46 194 126 / 0.03) 55%,
      transparent 80%
    ),
    var(--sheen),
    var(--surface-1);
}

.rank-id {
  display: flex;
  align-items: center;
  gap: 16px;
}

.crest {
  filter: drop-shadow(0 6px 14px rgb(46 194 126 / 0.28));
}

.rank-text {
  display: grid;
  gap: 4px;
}

.rank small,
.perf small {
  font-size: 12px;
  color: var(--text-3);
}

.tierline {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.tier {
  font-size: 20px;
  font-weight: 600;
  line-height: 24px;
  color: var(--tier-emerald);
  white-space: nowrap;
}

.lp .fig {
  font-size: 24px;
}

.lp .unit {
  margin-left: 4px;
  font-size: 13px;
  color: var(--text-3);
}

.rank-chart,
.rank-session {
  display: grid;
  gap: 6px;
  align-self: stretch;
  align-content: center;
  min-width: 0;
  padding-left: 22px;
  border-left: 1px solid var(--line);
}

.rank-chart small {
  display: flex;
  gap: 12px;
  white-space: nowrap;
}

.rank-chart b {
  font-weight: 600;
}

.changes {
  display: flex;
  gap: 6px;
}

.changes em {
  font-style: normal;
  font-weight: 600;
}

.figs {
  display: flex;
  gap: 16px;
  white-space: nowrap;
}

.figs .fig {
  font-size: 22px;
}

.figs .fig i {
  margin: 0 2px 0 1px;
  font-size: 13px;
  font-style: normal;
  font-weight: 500;
  font-stretch: 100%;
  color: var(--text-3);
}

.rank-other {
  display: flex;
  align-items: center;
  grid-column: 1 / -1;
  gap: 8px;
  padding-top: 9px;
  font-size: 13px;
  white-space: nowrap;
  border-top: 1px solid var(--line);
}

.rank-other .lbl {
  margin-right: 4px;
}

.plat {
  font-weight: 600;
  color: var(--tier-platinum);
}

/* ── Games ── */
.games {
  grid-area: games;
}

.fit {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
  overflow: hidden;
}

/* ── Clips ── */
.clips {
  grid-area: clips;
}

.cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: 12px;
}

.card {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.thumb {
  position: relative;
  display: block;
  margin-bottom: 6px;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  background: var(--well);
  border-radius: var(--r-sm);
  box-shadow:
    0 2px 4px rgb(0 0 0 / 0.4),
    0 10px 24px -12px rgb(0 0 0 / 0.8);
}

.thumb::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.12),
    inset 0 0 0 1px rgb(255 255 255 / 0.07);
}

.thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.len {
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 0 5px;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  color: #fff;
  background: rgb(0 0 0 / 0.72);
  border-radius: var(--r-xs);
}

.card b {
  font-size: 13px;
  font-weight: 600;
}

.card small {
  font-size: 12px;
  color: var(--text-3);
}

/* ── Favorites and champions: one line each ── */
.favs {
  grid-area: favs;
}

.champs {
  grid-area: champs;
}

.list {
  display: grid;
  align-content: start;
  gap: 4px;
}

.list li {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
}

.list img {
  width: 30px;
  height: 30px;
  object-fit: cover;
  border-radius: var(--r-sm);
  box-shadow: var(--portrait-sm);
}

.list img.clip {
  width: 30px;
  object-position: 40% 50%;
}

.list span {
  display: grid;
  flex: 1;
  gap: 1px;
  min-width: 0;
  line-height: 1.25;
}

.list b {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.list small {
  font-size: 12px;
  color: var(--text-3);
  white-space: nowrap;
}

.list .right {
  flex: none;
  text-align: right;
}

.star {
  color: var(--gold-c);
}

.star :deep(path),
.star:deep(path) {
  fill: rgb(var(--gold-rgb) / 0.3);
}

/* ── Performance ── */
.perf {
  grid-area: perf;
}

.perf-body {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
}

.perf-head {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}

.perf-head :deep(.iv-dial) {
  width: 80px;
  height: 80px;
}

.perf-head :deep(.iv-dial b) {
  font-size: 24px;
}

.perf-head p {
  display: grid;
  gap: 3px;
}

.perf-head span {
  font-size: 15px;
  font-weight: 600;
}

.perf-rows {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.perf-rows li {
  display: grid;
  flex: 1 0 46px;
  grid-template-columns: minmax(0, 1fr) auto 44px;
  grid-template-rows: auto minmax(12px, 40px);
  align-content: center;
  align-items: baseline;
  gap: 5px 12px;
  font-size: 12.5px;
}

.perf-rows li > span {
  color: var(--text-2);
}

.perf-rows b {
  font-size: 15px;
  font-weight: 600;
  text-align: right;
}

.perf-rows em {
  font-size: 12px;
  font-style: normal;
  text-align: right;
  color: var(--text-3);
}

.perf-rows em.up {
  color: var(--win);
}

.spark {
  position: relative;
  grid-column: 1 / -1;
  align-self: stretch;
  min-height: 0;
  overflow: hidden;
}

.spark :deep(.iv-trend) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.spark :deep(.iv-trend-base) {
  opacity: 0.5;
}
</style>
