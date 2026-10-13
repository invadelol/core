<script setup lang="ts">
import { ref } from 'vue'
import { onEnter, prefersReduced, vReveal } from './motion'

/**
 * What Invade costs the computer, in figures measured for the 0.2.9 release (the app's
 * performance audit, 12 October 2026). Each figure counts up once, when it comes into view.
 */
const FIGURES = [
  { to: 0.02, decimals: 2, unit: '%', text: 'CPU with League closed and Invade in the tray.' },
  { to: 20, decimals: 0, unit: 'kB', text: 'Sent to invade.lol for a finished game, compressed.' },
  {
    to: 0,
    decimals: 0,
    unit: '',
    text: 'Overlay windows between games. It opens for champ select.',
  },
  {
    to: 1,
    decimals: 0,
    unit: 's',
    text: 'Roughly how long the champ select panels take to appear.',
  },
]

const list = ref<HTMLElement>()
const shown = ref(FIGURES.map((f) => f.to))

function format(v: number, decimals: number) {
  return v.toFixed(decimals)
}

onEnter(
  list,
  () => {
    if (prefersReduced()) return
    const t0 = performance.now()
    const duration = 1600
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration)
      // Ease out: fast, then settling on the figure.
      const k = 1 - Math.pow(1 - t, 3)
      shown.value = FIGURES.map((f) => (f.to === 0 ? 0 : f.to * k))
      if (t < 1) requestAnimationFrame(step)
    }
    shown.value = FIGURES.map(() => 0)
    requestAnimationFrame(step)
  },
  0.4
)
</script>

<template>
  <section class="ap-section light">
    <header v-reveal class="ap-head ap-wrap">
      <p class="ap-eyebrow ln">Performance</p>
      <h2 class="ap-h2 ln">Light on your PC.</h2>
      <p class="ap-lead ln">
        The work happens in a small native core that waits quietly between games. Recording uses
        your graphics card’s encoder, and
        <strong>the overlay window only exists while you play</strong>.
      </p>
    </header>

    <ul ref="list" v-reveal class="figures ap-wrap">
      <li
        v-for="(f, i) in FIGURES"
        :key="f.text"
        class="iv-panel lit-sheet ap-sheet ln"
        :style="{ '--i': i }"
      >
        <b class="figure iv-fig">
          <span class="num">{{ format(shown[i], f.decimals) }}</span>
          <small v-if="f.unit">{{ f.unit }}</small>
        </b>
        <span class="what">{{ f.text }}</span>
      </li>
    </ul>

    <p v-reveal class="note ap-wrap ap-fine">
      <span class="ln">
        Measured with the 0.2.9 release build on macOS, League closed for the first figure.
      </span>
    </p>
  </section>
</template>

<style scoped>
/* Four tiles, as the app's Home shows its figures: a sheet each, the figure large and engraved. */
.figures {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  max-width: 1080px;
  margin-top: clamp(56px, 7vw, 96px);
}

@media (min-width: 1100px) {
  .figures {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.figures li {
  display: grid;
  align-content: start;
  gap: 14px;
  padding: 24px 22px 24px;
}

.figure {
  display: flex;
  align-items: baseline;
  font-size: clamp(40px, 4.4vw, 60px);
  color: var(--text-1);
}

.figure small {
  margin-left: 4px;
  font-size: 0.4em;
  font-weight: 600;
  font-stretch: 100%;
  letter-spacing: 0;
  color: var(--text-3);
}

.what {
  max-width: 16em;
  font-size: var(--ap-body);
  line-height: 1.5;
  color: var(--text-2);
}

@media (max-width: 600px) {
  .figures {
    gap: 10px;
  }

  .figures li {
    padding: 18px 16px;
  }
}

.note {
  max-width: 1080px;
  margin-top: 24px;
}
</style>
