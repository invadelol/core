<script setup lang="ts">
import Stage from './Stage.vue'
import DraftScene from './DraftScene.vue'
import { vReveal } from './reveal.js'
</script>

<template>
  <section id="champ-select" class="ap-section page">
    <header v-reveal class="ap-head">
      <div>
        <p class="ap-kicker">Champ select</p>
        <h2>Your runes are in before you lock in</h2>
      </div>
      <p>
        Hover a champion and its most played rune page for your role goes straight into the League
        client. Beside it, the odds of the draft and the best picks into your lane opponent.
      </p>
    </header>

    <div v-reveal class="ap-frame">
      <Stage
        :w="1280"
        :h="720"
        :narrow-at="0"
        class="wide-only"
        label="Champ select with Invade's Runes and build, Draft odds and Counters overlays around the League client"
      >
        <DraftScene />
      </Stage>
      <div class="narrow-only">
        <DraftScene stack />
      </div>
    </div>

    <ul class="ap-points" style="--n: 3">
      <li v-reveal>
        <b>Runes, spells and items</b>
        <p>
          The page, spells, skill order and core items played most at the rank you pick (Emerald+ by
          default). Imported again on every change of pick, keeping your own pages when it can.
        </p>
      </li>
      <li v-reveal>
        <b>Draft odds</b>
        <p>Your team's chance from the picks so far, and every lane matchup with its win rate.</p>
      </li>
      <li v-reveal>
        <b>Counters</b>
        <p>
          Once your lane opponent is known, the three best picks into them. Pairs under 50 games are
          left out, never guessed.
        </p>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.narrow-only {
  display: none;
}

@media (max-width: 639px) {
  .wide-only {
    display: none;
  }

  .narrow-only {
    display: block;
  }
}
</style>
