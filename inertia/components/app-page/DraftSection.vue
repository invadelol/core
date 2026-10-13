<script setup lang="ts">
import { ref } from 'vue'
import AppWindow from './AppWindow.vue'
import Shot from './Shot.vue'
import type { ShotName } from './shots'
import { ease, entering, prefersReduced, useScrollFx, vReveal } from './motion'

/** Champ select: the three overlay panels, each on its own stage, then the Live tab's draft. */
const PANELS: Array<{ name: ShotName; title: string; text: string; alt: string }> = [
  {
    name: 'ov-runes',
    title: 'Runes & build',
    text: 'The most played page, spells, skill order and core items for your pick, in your role.',
    alt: 'Runes & build for Veigar mid: the rune page, spells, skill order and items, with “Runes set in the client”',
  },
  {
    name: 'ov-odds',
    title: 'Draft odds',
    text: 'Your team’s chance to win from the picks so far, and every lane matchup.',
    alt: 'Draft odds: 56% to win, and each lane’s win rate',
  },
  {
    name: 'ov-counters',
    title: 'Counters',
    text: 'The three best picks into your lane opponent, gone once you lock in.',
    alt: 'Picks into Yasuo: Vladimir +4.0%, Azir +3.8%, Yone +3.6%',
  },
]

// The three stages rise at different speeds as they come up the page.
const row = ref<HTMLElement>()
const cards = ref<HTMLElement[]>([])
useScrollFx(row, (box, vh) => {
  const p = prefersReduced() ? 1 : ease(entering(box, vh, 0.3))
  cards.value.forEach((el, i) => {
    el.style.transform = `translate3d(0, ${(1 - p) * (70 + i * 60)}px, 0)`
  })
})
</script>

<template>
  <section class="ap-section draft">
    <header v-reveal class="ap-head ap-wrap">
      <p class="ap-eyebrow ln">Champ select</p>
      <h2 class="ap-h2 ln">Runes in before you lock in.</h2>
      <p class="ap-lead ln">
        Hover a champion and
        <strong>the best rune page goes straight into the League client</strong>. Draft odds and the
        best counters sit beside it, about a second after champ select opens.
      </p>
    </header>

    <div ref="row" v-reveal class="panels ap-wrap">
      <figure
        v-for="(p, i) in PANELS"
        :key="p.name"
        ref="cards"
        class="panel ln"
        :style="{ '--d': `${i * 120}ms` }"
      >
        <div class="panel-stage">
          <Shot :name="p.name" :alt="p.alt" sizes="360px" class="panel-shot" />
        </div>
        <figcaption>
          <strong>{{ p.title }}</strong>
          {{ p.text }}
        </figcaption>
      </figure>
    </div>

    <article v-reveal class="live ap-wrap">
      <div class="live-copy">
        <h3 class="ap-h3 ln">The whole draft, on the Live tab.</h3>
        <p class="ap-copy ln">
          Win odds at your rank and what moves them, every lane head to head, the duos that do
          better together, and <strong>a scouting card for every player</strong>: rank, form, main
          role and their games on that champion.
        </p>
      </div>
      <div class="live-pic pic">
        <AppWindow
          name="live-draft"
          :crop="[0.155, 0.07, 0.42, 0.5]"
          alt="The Live tab in champ select: both teams with ranks, Veigar’s build choices and the strongest picks for mid"
          sizes="(min-width: 1100px) 760px, 92vw"
        />
      </div>
    </article>
  </section>
</template>

<style scoped>
.panels {
  display: grid;
  gap: 20px;
  max-width: var(--ap-wide);
  margin-top: clamp(56px, 7vw, 96px);
}

@media (min-width: 900px) {
  .panels {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--ap-card);
  border-radius: 28px;
  box-shadow: inset 0 0 0 1px var(--ap-card-edge);
  will-change: transform;
}

/* The panel on a dark stage, as over the League client: it is drawn for one. */
.panel-stage {
  display: grid;
  place-items: center;
  min-height: 380px;
  padding: 40px 24px 24px;
  background:
    radial-gradient(120% 90% at 50% 0%, rgb(var(--brand-rgb) / 0.1), transparent 60%), #0c0d12;
}

.panel-shot {
  width: min(100%, 340px);
}

@media (max-width: 700px) {
  .panel-stage {
    min-height: 0;
    padding: 36px 20px 20px;
  }
}

figcaption {
  padding: 22px 28px 28px;
  font-size: 17px;
  font-weight: 500;
  line-height: 1.45;
  color: var(--ap-grey);
}

figcaption strong {
  display: block;
  margin-bottom: 4px;
  font-size: 19px;
  font-weight: 600;
  color: var(--text-1);
}

/* The stages fade in with the reveal; their rise is the scroll's, so it is never delayed. */
.rv .panel.ln {
  transition: opacity 900ms var(--ap-ease) calc(var(--i, 0) * 120ms);
}

.live {
  display: grid;
  align-items: center;
  gap: 40px 64px;
  max-width: var(--ap-wide);
  margin-top: clamp(100px, 11vw, 170px);
}

@media (min-width: 1100px) {
  .live {
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.4fr);
  }
}

.live-copy {
  display: grid;
  gap: 16px;
  max-width: 460px;
}
</style>
