<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Shot from './Shot.vue'
import type { ShotName } from './shots'
import { vReveal } from './motion'

/** The rest of the app, as a row of cards that snap: swipe, scroll or use the arrows. */
const CARDS: Array<{ name: ShotName; title: string; text: string; alt: string }> = [
  {
    name: 'g-champions',
    title: 'A tier list for every role and rank.',
    text: 'Win, pick and ban rates, grouped by tier. A row opens the champion’s page.',
    alt: 'Champions: the tier list for mid at Emerald, Fizz, Ahri and Viktor in S+',
  },
  {
    name: 'g-matchups',
    title: 'Every matchup, laid out.',
    text: 'The champions a pick beats and the ones it fears, lane by lane.',
    alt: 'Matchups for Veigar mid: the spread of 41 opponents from hard to favourable',
  },
  {
    name: 'g-live',
    title: 'The game, live.',
    text: 'Both teams with items, gold and the win estimate, once a second.',
    alt: 'The Live tab in game: both teams, kills 21 to 16, a 2.7k gold lead and a 68% win estimate',
  },
  {
    name: 'g-favorites',
    title: 'Star it, find it later.',
    text: 'Champions, builds, rune pages, matchups, games and clips, in one place.',
    alt: 'Favorites: a champion, a build, a rune page, a matchup, a game and a clip',
  },
  {
    name: 'g-search',
    title: 'One field for everything.',
    text: 'Press ⌘K or Ctrl K for players, champions and pages, even with League closed.',
    alt: 'The search: players, champions and pages matching “ve”',
  },
  {
    name: 'g-languages',
    title: 'In twelve languages.',
    text: 'It follows the League client’s language, and you can pick another.',
    alt: 'Home in French',
  },
  {
    name: 'g-sync',
    title: 'Synced with invade.lol.',
    text: 'Each game you finish reaches your web profile the moment it ends.',
    alt: 'Settings, invade.lol: your games are published to your profile',
  },
]

const rail = ref<HTMLElement>()
const atStart = ref(true)
const atEnd = ref(false)

function update() {
  const el = rail.value
  if (!el) return
  atStart.value = el.scrollLeft < 8
  atEnd.value = el.scrollLeft > el.scrollWidth - el.clientWidth - 8
}

function go(dir: 1 | -1) {
  const el = rail.value
  if (!el) return
  const card = el.querySelector<HTMLElement>('.card')
  const step = card ? card.offsetWidth + 20 : el.clientWidth * 0.8
  el.scrollBy({ left: dir * step, behavior: 'smooth' })
}

onMounted(() => {
  update()
  rail.value?.addEventListener('scroll', update, { passive: true })
})
onBeforeUnmount(() => rail.value?.removeEventListener('scroll', update))
</script>

<template>
  <section class="ap-section more">
    <header v-reveal class="ap-head start ap-wrap">
      <h2 class="ap-h2 ln">There’s more in the app.</h2>
    </header>

    <div v-reveal class="rail-wrap">
      <ul ref="rail" class="rail" aria-label="More of the app">
        <li v-for="(c, i) in CARDS" :key="c.name" class="card ln" :style="{ '--i': i }">
          <div class="card-pic">
            <Shot :name="c.name" :alt="c.alt" sizes="(min-width: 900px) 560px, 82vw" />
          </div>
          <p class="card-text">
            <strong>{{ c.title }}</strong> {{ c.text }}
          </p>
        </li>
      </ul>
    </div>

    <div class="arrows ap-wrap">
      <button type="button" :disabled="atStart" aria-label="Previous" @click="go(-1)">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
      </button>
      <button type="button" :disabled="atEnd" aria-label="Next" @click="go(1)">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3.5 4.5 4.5L6 12.5" /></svg>
      </button>
    </div>
  </section>
</template>

<style scoped>
.rail-wrap {
  margin-top: clamp(40px, 5vw, 64px);
}

/* The rail lines its first card up with the page's text and scrolls to the screen's edge. */
.rail {
  --inset: max(24px, calc((100vw - var(--ap-wide)) / 2));

  display: flex;
  gap: 20px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-snap-type: x mandatory;
  scroll-padding-inline: var(--inset);
  padding: 8px var(--inset) 40px;
  scrollbar-width: none;
}

.rail::-webkit-scrollbar {
  display: none;
}

.card {
  flex: none;
  display: flex;
  flex-direction: column;
  width: min(560px, 82vw);
  overflow: hidden;
  scroll-snap-align: start;
  background: var(--ap-card);
  border-radius: 28px;
  box-shadow: inset 0 0 0 1px var(--ap-card-edge);
}

.card-pic {
  overflow: hidden;
  margin: 12px 12px 0;
  border-radius: 18px;
  background: #0d0e13;
}

.card-pic :deep(img) {
  transition: transform 900ms var(--ap-ease);
}

.card:hover .card-pic :deep(img) {
  transform: scale(1.03);
}

.card-text {
  padding: 24px 28px 30px;
  font-size: 17px;
  font-weight: 500;
  line-height: 1.45;
  color: var(--ap-grey);
}

.card-text strong {
  font-weight: 600;
  color: var(--text-1);
}

.arrows {
  display: flex;
  justify-content: flex-end;
  gap: 14px;
  max-width: calc(var(--ap-wide) + 48px);
}

.arrows button {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  color: var(--text-1);
  background: var(--surface-3);
  border-radius: 50%;
  transition:
    opacity 300ms var(--ap-ease),
    background-color 300ms var(--ap-ease);
}

.arrows button:hover:not(:disabled) {
  background: var(--surface-4);
}

.arrows button:disabled {
  opacity: 0.35;
}

.arrows svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

@media (pointer: coarse) {
  .arrows {
    display: none;
  }
}
</style>
