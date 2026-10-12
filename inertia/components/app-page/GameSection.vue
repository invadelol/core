<script setup lang="ts">
import Stage from './Stage.vue'
import GameScene from './GameScene.vue'
import TabScene from './TabScene.vue'
import { vReveal } from './reveal.js'
</script>

<template>
  <section id="in-game" class="ap-section page">
    <header v-reveal class="ap-head">
      <div>
        <p class="ap-kicker">In game</p>
        <h2>Know when dragon spawns, and how far ahead you are</h2>
      </div>
      <p>
        Timers, your pace against the rank above yours and the next item to buy, drawn over the game
        from Riot's live game data. Nothing is injected and nothing is read from memory.
      </p>
    </header>

    <div v-reveal class="ap-frame game-frame">
      <Stage :w="1280" :h="720" :narrow-at="0" class="wide-only" label="A game at 14 minutes with Invade's Objectives, Performance and Next item overlays">
        <GameScene />
      </Stage>
      <div class="narrow-only">
        <GameScene stack />
      </div>
    </div>

    <ul class="ap-points" style="--n: 3">
      <li v-reveal>
        <b>Objectives</b>
        <p>Dragon, grubs, herald and Baron as countdowns, and the dragons each team holds.</p>
      </li>
      <li v-reveal>
        <b>Your pace</b>
        <p>
          CS, gold, kill participation and KDA against the rank above yours at the same minute, CS
          and level against your lane opponent.
        </p>
      </li>
      <li v-reveal>
        <b>Next item</b>
        <p>The next item of your build and the gold it still takes, counting the parts you own.</p>
      </li>
    </ul>

    <div class="tab">
      <div v-reveal class="tab-copy">
        <span class="tab-key">Tab</span>
        <h3>Hold Tab for every lane's gold</h3>
        <p>
          One figure per lane, down the middle of the scoreboard, and your team's lead above it.
          Placed from the game's own layout, so it lines up at any resolution.
        </p>
      </div>
      <div v-reveal class="ap-frame tab-frame">
        <Stage
          :w="1280"
          :h="720"
          :crop="{ x: 150, y: 132, w: 980, h: 352 }"
          :focus="{ x: 400, y: 132, w: 480, h: 352 }"
          label="The scoreboard held open with Tab, and Invade's gold difference down its middle"
        >
          <TabScene />
        </Stage>
      </div>
    </div>
  </section>
</template>

<style scoped>
.narrow-only {
  display: none;
}

/* A phone sees the middle of the scoreboard: the cut edges fade out. */
@media (max-width: 639px) {
  .tab-frame :deep(.stage) {
    mask-image: linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent);
  }
}

@media (max-width: 639px) {
  .wide-only {
    display: none;
  }

  .narrow-only {
    display: block;
  }
}

/* ── Tab: the copy beside a close view of the scoreboard ── */
.tab {
  display: grid;
  gap: 32px 64px;
  align-items: center;
  margin-top: clamp(72px, 9vw, 120px);
}

@media (min-width: 900px) {
  .tab {
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  }
}

.tab-key {
  display: inline-grid;
  place-items: center;
  min-width: 46px;
  height: 30px;
  padding: 0 10px;
  margin-bottom: 20px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  background: var(--key);
  border-radius: 6px;
  box-shadow:
    var(--key-shadow),
    0 2px 0 rgb(0 0 0 / 0.25);
}

.tab h3 {
  font-size: clamp(22px, 2.4vw, 28px);
  font-weight: 650;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--text-1);
  text-wrap: balance;
}

.tab p {
  max-width: 30em;
  margin-top: 12px;
  font-size: 15.5px;
  line-height: 1.6;
  color: var(--text-2);
}
</style>
