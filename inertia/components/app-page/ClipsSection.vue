<script setup lang="ts">
import { ref } from 'vue'
import AppWindow from './AppWindow.vue'
import Shot from './Shot.vue'
import { ease, entering, onEnter, prefersReduced, useScrollFx, vReveal } from './motion'

/**
 * Recording: the Recordings page, a reel of clips sliding by as the page scrolls (gameplay stills
 * of the site's own, in the app's clip cards), the highlight key, then all PC sound up close.
 */
const REEL = [
  { img: '/landing/clip-kill.webp', title: 'Triple kill', meta: 'at 8:02', len: '0:24' },
  { img: '/app-page/still-2.webp', title: 'Assist', meta: 'at 12:40', len: '0:28' },
  { img: '/landing/clip-baron.webp', title: 'Baron', meta: 'Objective · at 22:10', len: '0:33' },
  { img: '/app-page/still-1.webp', title: 'Double kill', meta: 'at 15:18', len: '0:26' },
  { img: '/landing/clip-death.webp', title: 'Death', meta: 'at 17:51', len: '0:21' },
  { img: '/app-page/still-3.webp', title: 'Kill', meta: 'at 24:05', len: '0:19' },
  { img: '/landing/clip-saved.webp', title: 'Highlight', meta: 'Saved · at 27:40', len: '0:30' },
]

const win = ref<HTMLElement>()
const winInner = ref<HTMLElement>()
useScrollFx(win, (box, vh) => {
  const p = prefersReduced() ? 1 : ease(entering(box, vh, 0.2))
  if (winInner.value) winInner.value.style.transform = `scale(${0.9 + 0.1 * p})`
})

const reel = ref<HTMLElement>()
const track = ref<HTMLElement>()
useScrollFx(reel, (box, vh, vw) => {
  if (!track.value || prefersReduced()) return
  // Across the screen as the reel crosses it: from a little right to a little left.
  const p = (vh - box.top) / (vh + box.height)
  const run = Math.max(0, track.value.scrollWidth - vw)
  track.value.style.transform = `translate3d(${(0.15 - p * 1.1) * run}px, 0, 0)`
})

// The highlight key, pressed once when it comes into view.
const keys = ref<HTMLElement>()
const pressed = ref(false)
onEnter(keys, () => setTimeout(() => (pressed.value = true), 400), 0.6)
</script>

<template>
  <section class="ap-section clips">
    <header v-reveal class="ap-head ap-wrap">
      <p class="ap-eyebrow ln">Recording</p>
      <h2 class="ap-h2 ln">Your best plays, already cut.</h2>
      <p class="ap-lead ln">
        Invade records your games in the background and keeps
        <strong>your kills, deaths, assists and objectives as short clips</strong>. A triple kill is
        one clip, not three.
      </p>
    </header>

    <div ref="win" v-reveal class="clips-win ap-wrap">
      <div ref="winInner" class="clips-scale pic">
        <AppWindow
          name="recordings"
          :crop="[0.155, 0.06, 0.5, 0.58]"
          alt="Recordings: each game with its full recording and its clips, triple kill, Baron, assist, death, highlight"
        />
      </div>
    </div>

    <div ref="reel" class="reel" aria-hidden="true">
      <div ref="track" class="track">
        <figure v-for="c in REEL" :key="c.title" class="clip">
          <span class="thumb">
            <img :src="c.img" alt="" width="480" height="270" loading="lazy" decoding="async" />
            <span class="len">{{ c.len }}</span>
          </span>
          <figcaption>
            <b>{{ c.title }}</b>
            <span>{{ c.meta }}</span>
          </figcaption>
        </figure>
      </div>
    </div>

    <div class="pairs ap-wrap">
      <article v-reveal class="pair">
        <div ref="keys" class="keys ln" :class="{ pressed }" aria-hidden="true">
          <kbd>Ctrl</kbd><span>+</span><kbd>Shift</kbd><span>+</span><kbd>H</kbd>
        </div>
        <div class="pair-copy">
          <h3 class="ap-h3 ln">Missed the moment? Press a key.</h3>
          <p class="ap-copy ln">
            In game, the highlight key <strong>saves the last thirty seconds as a clip</strong>.
            Screen recordings start and stop from a key of their own.
          </p>
        </div>
      </article>

      <article v-reveal class="pair">
        <div class="pair-copy">
          <h3 class="ap-h3 ln">Your friends, in the clip.</h3>
          <p class="ap-copy ln">
            Record all PC sound adds Discord, music and every other app,
            <strong>with a volume of its own</strong>. It stays off until you turn it on.
          </p>
        </div>
        <div class="audio pic">
          <Shot
            name="c-audio"
            alt="Settings, Audio: game audio at 100%, Record all PC sound on at 70%, microphone off"
            sizes="(min-width: 900px) 560px, 92vw"
          />
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.clips-win {
  margin-top: clamp(56px, 7vw, 96px);
}

.clips-scale {
  max-width: var(--ap-wide);
  margin-inline: auto;
  transform-origin: 50% 30%;
  will-change: transform;
}

.rv .clips-scale.pic {
  transition:
    opacity 1100ms var(--ap-ease),
    filter 1100ms var(--ap-ease);
}

/* ── The reel ── */

.reel {
  overflow: hidden;
  margin-top: clamp(72px, 8vw, 120px);
}

.track {
  display: flex;
  gap: 20px;
  width: max-content;
  padding-inline: 24px;
  will-change: transform;
}

.clip {
  width: clamp(240px, 24vw, 340px);
}

.thumb {
  position: relative;
  display: block;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  border-radius: 14px;
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 0.07),
    0 20px 40px -18px rgb(0 0 0 / 0.6);
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.len {
  position: absolute;
  right: 10px;
  bottom: 10px;
  padding: 3px 7px;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  background: rgb(8 9 12 / 0.82);
  border-radius: 6px;
}

.clip figcaption {
  display: grid;
  gap: 2px;
  padding: 12px 2px 0;
  font-size: 15px;
}

.clip figcaption b {
  font-weight: 600;
  color: var(--text-1);
}

.clip figcaption span {
  color: var(--text-3);
}

/* ── Pairs ── */

.pairs {
  display: grid;
  gap: clamp(88px, 10vw, 150px);
  margin-top: clamp(100px, 11vw, 170px);
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

.pair-copy {
  display: grid;
  gap: 16px;
}

.keys {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  min-height: 260px;
  background: var(--ap-card);
  border-radius: 28px;
  box-shadow: inset 0 0 0 1px var(--ap-card-edge);
}

.keys span {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-4);
}

.keys kbd {
  display: grid;
  place-items: center;
  min-width: 72px;
  height: 72px;
  padding: 0 18px;
  font: 600 20px/1 var(--font);
  color: var(--text-1);
  background: linear-gradient(var(--surface-3), var(--surface-2));
  border-radius: 14px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.1),
    0 5px 0 rgb(0 0 0 / 0.5),
    0 14px 24px -10px rgb(0 0 0 / 0.6);
  transition:
    transform 180ms var(--ap-ease),
    box-shadow 180ms var(--ap-ease);
}

/* The keys go down in turn and come back up, once. */
.keys.pressed kbd {
  animation: press 900ms var(--ap-ease) both;
}

.keys.pressed kbd:nth-of-type(2) {
  animation-delay: 120ms;
}

.keys.pressed kbd:nth-of-type(3) {
  animation-delay: 240ms;
}

@keyframes press {
  0%,
  100% {
    transform: none;
  }

  25%,
  70% {
    transform: translateY(4px);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 0.1),
      0 1px 0 rgb(0 0 0 / 0.5),
      0 6px 12px -8px rgb(0 0 0 / 0.6);
  }
}

@media (prefers-reduced-motion: reduce) {
  .keys.pressed kbd {
    animation: none;
  }
}

.audio {
  overflow: hidden;
  border-radius: 20px;
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 0.06),
    var(--ap-shadow);
}

@media (max-width: 600px) {
  .keys {
    gap: 8px;
    min-height: 180px;
  }

  .keys kbd {
    min-width: 56px;
    height: 56px;
    padding: 0 12px;
    font-size: 17px;
  }
}
</style>
