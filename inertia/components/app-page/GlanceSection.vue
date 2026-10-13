<script setup lang="ts">
import { ref } from 'vue'
import AppWindow from './AppWindow.vue'
import Shot from './Shot.vue'
import { ease, entering, prefersReduced, useScrollFx, vReveal } from './motion'

/** Home, then the profile: the performance strip and the LP history, each up close. */
const win = ref<HTMLElement>()
const winInner = ref<HTMLElement>()
useScrollFx(win, (box, vh) => {
  const p = prefersReduced() ? 1 : ease(entering(box, vh, 0.2))
  if (winInner.value) winInner.value.style.transform = `scale(${0.9 + 0.1 * p})`
})

// The strip comes in close on the score, then pulls back to its full width as it rises.
const strip = ref<HTMLElement>()
const stripImg = ref<HTMLElement>()
useScrollFx(strip, (box, vh) => {
  if (!stripImg.value) return
  const p = prefersReduced() ? 1 : ease(entering(box, vh, 0.35))
  stripImg.value.style.transform = `scale(${1 + 0.22 * (1 - p)})`
})
</script>

<template>
  <section class="ap-section glance">
    <header v-reveal class="ap-head ap-wrap">
      <p class="ap-eyebrow ln">Home and profile</p>
      <h2 class="ap-h2 ln">Your whole game, at a glance.</h2>
      <p class="ap-lead ln">
        Home fits on one screen: your rank and LP, the last twenty games with their scores, your
        clips and favorites, and <strong>how you play against the rank above you</strong>.
      </p>
    </header>

    <div ref="win" v-reveal class="glance-win ap-wrap">
      <div ref="winInner" class="glance-scale pic">
        <AppWindow
          name="profile"
          :crop="[0.155, 0.105, 0.31, 0.55]"
          alt="The profile: rank, LP history, champions, the performance strip and the match history"
        />
      </div>
    </div>

    <div class="pairs ap-wrap">
      <article v-reveal class="pair wide">
        <div class="pair-copy">
          <h3 class="ap-h3 ln">Your pace, measured.</h3>
          <p class="ap-copy ln">
            CS, kill participation, vision, KDA and gold per minute over your last twenty games,
            each with its trend and <strong>the gap to a target rank</strong>.
          </p>
        </div>
        <div ref="strip" class="pair-pic strip pic">
          <div ref="stripImg" class="strip-move">
            <Shot
              name="c-perf"
              alt="The performance strip: Invade score 59, CS per minute 6.9, kill participation 67%, vision 1.09, KDA 6.30, gold per minute 431, each against its target"
              sizes="(min-width: 1300px) 1240px, 100vw"
            />
          </div>
        </div>
      </article>

      <article v-reveal class="pair">
        <div class="pair-pic card pic">
          <Shot
            name="c-lp"
            alt="LP history: Emerald II, 73 LP, 101 LP gained since September 6"
            sizes="(min-width: 900px) 504px, 92vw"
          />
        </div>
        <div class="pair-copy">
          <h3 class="ap-h3 ln">The LP history the client never kept.</h3>
          <p class="ap-copy ln">
            Invade notes your rank every time it changes, on every account you play, so
            <strong>your LP graph grows with each game</strong>. Your peak and last season sit under
            it.
          </p>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.glance-win {
  margin-top: clamp(56px, 7vw, 96px);
}

.glance-scale {
  max-width: var(--ap-wide);
  margin-inline: auto;
  transform-origin: 50% 30%;
  will-change: transform;
}

.rv .glance-scale.pic {
  transition:
    opacity 1100ms var(--ap-ease),
    filter 1100ms var(--ap-ease);
}

.pairs {
  display: grid;
  gap: clamp(88px, 10vw, 150px);
  margin-top: clamp(110px, 12vw, 180px);
}

.pair {
  display: grid;
  align-items: center;
  gap: 40px 72px;
  max-width: 1080px;
  margin-inline: auto;
}

@media (min-width: 900px) {
  .pair {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}

.pair.wide {
  grid-template-columns: minmax(0, 1fr);
  max-width: var(--ap-wide);
}

.pair.wide .pair-copy {
  max-width: 640px;
}

.pair-copy {
  display: grid;
  gap: 16px;
}

.card {
  width: 100%;
  max-width: 504px;
  margin-inline: auto;
  overflow: hidden;
  border-radius: 18px;
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 0.06),
    var(--ap-shadow);
}

/* A strip of the profile, larger than life, sliding slowly sideways as it passes. */
.strip {
  overflow: hidden;
  border-radius: 20px;
  background: #0f1016;
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 0.06),
    var(--ap-shadow);
}

.strip-move {
  transform-origin: 0 50%;
  will-change: transform;
}

@media (max-width: 700px) {
  /* On a phone the strip is a crop: the score and the first two measures, larger. */
  .strip-move {
    width: 210%;
  }

  .strip {
    border-radius: 14px;
  }
}
</style>
