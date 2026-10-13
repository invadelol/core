<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { PerfDial } from '@invadelol/ui'
import AppWindow from './AppWindow.vue'
import Shot from './Shot.vue'
import type { ShotName } from './shots'
import { ease, entering, onEnter, prefersReduced, useScrollFx, vReveal } from './motion'

/**
 * After the game: one game opened in the profile, its four views behind tabs that turn by
 * themselves while the window is on screen (a click takes over), then the score up close.
 */
const VIEWS: Array<{ id: ShotName; label: string; alt: string }> = [
  {
    id: 'match',
    label: 'Scoreboard',
    alt: 'An opened game: both teams with KDA, damage, gold, CS, vision, items and each player’s score',
  },
  {
    id: 'match-breakdown',
    label: 'Breakdown',
    alt: 'The game’s breakdown: damage, kills, deaths, gold and vision against the lane opponent',
  },
  {
    id: 'match-gold',
    label: 'Gold',
    alt: 'Gold over the game for all ten players, with the team gold lead',
  },
  {
    id: 'match-timeline',
    label: 'Timeline',
    alt: 'The game’s timeline: kills, skirmishes and objectives minute by minute',
  },
]
const view = ref(0)
let timer: ReturnType<typeof setInterval> | undefined
let held = false

function choose(i: number) {
  held = true
  if (timer) clearInterval(timer)
  view.value = i
}

const win = ref<HTMLElement>()
onEnter(win, () => {
  if (prefersReduced() || held) return
  timer = setInterval(() => (view.value = (view.value + 1) % VIEWS.length), 4200)
})
onBeforeUnmount(() => timer && clearInterval(timer))

// The close-up: the camera moves in on Home's score dial as the card rises.
const zoom = ref<HTMLElement>()
const zoomImg = ref<HTMLElement>()
useScrollFx(zoom, (box, vh) => {
  if (!zoomImg.value) return
  const p = prefersReduced() ? 0 : ease(entering(box, vh, 0.15))
  zoomImg.value.style.transform = `scale(${1 + 0.5 * p})`
})

// Three real dials, drawn by the app's own component when they come into view.
const dials = ref<HTMLElement>()
const dialsOn = ref(false)
onEnter(dials, () => (dialsOn.value = true), 0.5)
const DIALS = [
  { score: 69, tag: 'mvp' as const, rank: 1, text: 'The best player of the winning team.' },
  { score: 63, tag: '' as const, rank: 3, text: 'Third of the ten players.' },
  { score: 41, tag: 'ace' as const, rank: 1, text: 'The best of the losing team.' },
]
</script>

<template>
  <section class="ap-section score">
    <header v-reveal class="ap-head ap-wrap">
      <p class="ap-eyebrow ln">After the game</p>
      <h2 class="ap-h2 ln">Every game, scored.</h2>
      <p class="ap-lead ln">
        Each of the ten players gets an Invade score, weighed for their role: KDA, damage share,
        lane gold at 15, vision, objectives. <strong>You see where you placed</strong>, and why.
      </p>
    </header>

    <div ref="win" v-reveal class="views ap-wrap">
      <div class="seg iv-seg ln" role="tablist" aria-label="Views of the game">
        <button
          v-for="(v, i) in VIEWS"
          :key="v.id"
          type="button"
          role="tab"
          :aria-selected="view === i"
          :class="{ on: view === i }"
          @click="choose(i)"
        >
          {{ v.label }}
        </button>
      </div>
      <div class="views-win pic">
        <AppWindow :name="VIEWS[0].id" :alt="VIEWS[0].alt" :crop="[0.41, 0.1, 0.45, 0.55]">
          <div
            v-for="(v, i) in VIEWS.slice(1)"
            :key="v.id"
            class="layer"
            :class="{ on: view === i + 1 }"
          >
            <Shot :name="v.id" :alt="v.alt" sizes="(min-width: 1360px) 1240px, 92vw" />
          </div>
        </AppWindow>
      </div>
    </div>

    <article class="dial ap-wrap">
      <div ref="zoom" v-reveal class="dial-pic app-window iv-dark pic-self">
        <div ref="zoomImg" class="dial-move">
          <Shot
            name="c-dial"
            alt="Home’s performance tile: an Invade score of 59, 10 wins and 10 losses, against Diamond mid"
            sizes="(min-width: 900px) 600px, 92vw"
          />
        </div>
      </div>
      <div v-reveal class="dial-copy">
        <h3 class="ap-h3 ln">Your form, in one number.</h3>
        <p class="ap-copy ln">
          Home averages your last twenty scores and sets them against
          <strong>the rank above yours</strong>. The arc runs from red to blue, so a good week shows
          at a glance.
        </p>
      </div>
    </article>

    <ul ref="dials" class="dials ap-wrap">
      <li v-for="d in DIALS" :key="d.score">
        <span class="dial-big">
          <PerfDial v-if="dialsOn" :score="d.score" :rank="d.rank" :tag="d.tag" />
        </span>
        <p>{{ d.text }}</p>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.views {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  margin-top: clamp(48px, 6vw, 80px);
}

/* The package's segmented control, a size up: an inset well, the chosen view a raised key. */
.seg.iv-seg {
  flex-wrap: nowrap;
  padding: 3px;
  border-radius: var(--r-md);
}

.seg.iv-seg > button {
  height: 32px;
  padding: 0 14px;
  font-size: 13.5px;
}

@media (pointer: coarse) {
  .seg.iv-seg > button {
    height: 38px;
    padding: 0 12px;
  }
}

.views-win {
  width: 100%;
  /* The tabs and the window fit on one screen together. */
  max-width: min(var(--ap-wide), calc((100svh - 150px) * 1.6));
}

/* The other views lie over the scoreboard and cross-fade in, a touch larger first. */
.layer {
  position: absolute;
  inset: 0;
  opacity: 0;
  transform: scale(1.012);
  transition:
    opacity 700ms var(--ease-glide),
    transform 900ms var(--ease-glide);
}

.layer.on {
  opacity: 1;
  transform: none;
}

/* ── The dial, up close ── */

.dial {
  display: grid;
  align-items: center;
  gap: 40px 72px;
  max-width: 1080px;
  margin-top: clamp(100px, 11vw, 170px);
}

@media (min-width: 900px) {
  .dial {
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  }
}

.dial-pic {
  width: 100%;
  max-width: 620px;
  margin-inline: auto;
}

/* The move ends on the dial (13.6% across, 56% down the capture), kept whole in the card. */
.dial-move {
  transform-origin: 4% 64%;
  will-change: transform;
}

.dial-copy {
  display: grid;
  gap: 16px;
}

.dials {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 40px 12px;
  max-width: 980px;
  margin-top: clamp(80px, 9vw, 130px);
  text-align: center;
}

/* The app's dial at three times its size: the component is drawn at 48px. */
.dial-big {
  display: grid;
  place-items: center;
  height: 150px;
}

.dial-big :deep(.iv-dial) {
  transform: scale(3);
}

@media (max-width: 700px) {
  .dial-big {
    height: 104px;
  }

  .dial-big :deep(.iv-dial) {
    transform: scale(2);
  }
}

.dials p {
  max-width: 15em;
  margin: 18px auto 0;
  font-size: var(--ap-body);
  line-height: 1.55;
  color: var(--text-2);
}
</style>
