<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { LpGraph, MatchDetailPanel, MatchRow, PerfDial } from '@invadelol/ui'
import { summaryOf } from '@invadelol/ui/logic'
import { detailOf } from '../../lib/match.js'
import WindowFrame from './WindowFrame.vue'
import { DEMO_EARLIER, DEMO_MATCH, DEMO_PUUID } from './demo_match.js'
import { CARD, LP_POINTS, dayLabel } from './demo.js'
import { vReveal } from './reveal.js'

/**
 * After the game: the profile's match list (the shared rows, the first one open on its detail),
 * the LP history and what the score is. All live components on the sample game, at their real
 * size: they reflow to the width like they do in the app and on invade.lol.
 */
const detail = detailOf(DEMO_MATCH)
const rows = [
  { match: DEMO_MATCH, record: '1W 0L', lp: 24 },
  { match: DEMO_EARLIER[0], record: '0W 1L', lp: -16 },
  { match: DEMO_EARLIER[1], record: '1W 0L', lp: 21 },
].map((r) => ({
  ...r,
  day: dayLabel(r.match.gameStartMs),
  game: summaryOf(r.match === DEMO_MATCH ? detail : detailOf(r.match), DEMO_PUUID)!,
}))

const open = ref(true)

/** Dates read in the visitor's time zone: the rows are drawn in the browser only. */
const mounted = ref(false)
onMounted(() => (mounted.value = true))

const SCALE = [
  { score: 91, label: 'Exceptional' },
  { score: 74, label: 'Great' },
  { score: 58, label: 'Good' },
  { score: 44, label: 'Average' },
  { score: 22, label: 'Rough' },
]

const FACTORS = [
  'KDA',
  'Kill participation',
  'Damage share',
  'Lane gold and XP at 15',
  'CS',
  'Vision',
  'Objectives',
  'Damage taken',
  'Crowd control',
]
</script>

<template>
  <section id="scores" class="ap-section page">
    <header v-reveal class="ap-head">
      <div>
        <p class="ap-kicker">After the game</p>
        <h2>Every game gets a score, for all ten players</h2>
      </div>
      <p>
        A score from 0 to 100, rated against the other nine and weighted for each role. Open a game
        for the full scoreboard and a breakdown of every number, then watch your LP move over the
        weeks.
      </p>
    </header>

    <div v-reveal class="ap-frame scored-frame">
      <WindowFrame title="Profile">
        <div class="list iv-root">
          <template v-if="mounted">
            <section v-for="(row, i) in rows" :key="row.day" class="day">
              <h3 class="iv-mr-day">{{ row.day }}<span>{{ row.record }}</span></h3>
              <MatchRow
                :game="row.game"
                :score="row.game.score"
                :lp="row.lp"
                :open="i === 0 && open"
                @toggle="i === 0 && (open = !open)"
              />
              <MatchDetailPanel v-if="i === 0 && open" :detail="detail" :puuid="DEMO_PUUID" />
            </section>
          </template>
          <div v-else class="list-hold" />
        </div>
      </WindowFrame>
    </div>

    <div class="pair">
      <div v-reveal class="lp iv-root">
        <LpGraph v-if="mounted" :points="LP_POINTS" :card="CARD" />
        <div v-else class="iv-panel lp-hold" />
      </div>

      <div v-reveal class="score iv-panel">
        <div class="score-top">
          <PerfDial :score="87" tag="mvp" />
          <div>
            <h3>The Invade score</h3>
            <p>
              Each figure of the game is compared with the nine other players, then weighted for
              the role. MVP and ACE go to the best player of each team.
            </p>
          </div>
        </div>
        <ul class="scale">
          <li v-for="s in SCALE" :key="s.score">
            <PerfDial :score="s.score" size="sm" />
            <span>{{ s.label }}</span>
          </li>
        </ul>
        <p class="factors-label">What it weighs</p>
        <ul class="factors">
          <li v-for="f in FACTORS" :key="f">{{ f }}</li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.list {
  display: grid;
  gap: 16px;
  padding: 20px 24px 24px;
}

@media (max-width: 639px) {
  .list {
    padding: 14px 10px 16px;
  }
}

.list-hold {
  min-height: 780px;
}

.day {
  display: grid;
  gap: 6px;
}

/* ── LP history and the score, side by side ── */
.pair {
  display: grid;
  gap: 16px;
  margin-top: 16px;
}

@media (min-width: 960px) {
  .pair {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  }
}

.lp :deep(.iv-panel) {
  height: 100%;
}

.lp-hold {
  min-height: 320px;
}

.score {
  display: grid;
  align-content: start;
  gap: 20px;
  padding: 20px;
}

.score-top {
  display: flex;
  gap: 18px;
  align-items: center;
}

.score-top :deep(.iv-dial) {
  width: 76px;
  height: 76px;
}

.score-top :deep(.iv-dial b) {
  font-size: 24px;
}

.score h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
}

.score-top p {
  margin-top: 4px;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--text-2);
}

.scale {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  padding: 14px 0;
  border-block: 1px solid var(--line);
}

.scale li {
  display: grid;
  justify-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-3);
}

.factors-label {
  margin-bottom: -10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}

.factors {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.factors li {
  padding: 3px 9px;
  font-size: 12.5px;
  color: var(--text-2);
  background: var(--surface-2);
  border-radius: 999px;
}
</style>
