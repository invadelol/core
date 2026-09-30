<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { Download } from 'lucide-vue-next'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import AppWindow from '../components/AppWindow.vue'
import DownloadButton from '../components/DownloadButton.vue'
import OverlayStage from '../components/OverlayStage.vue'
import { detectDesktopTarget, targetLabel, type DesktopPlatform } from '../lib/platform.js'

defineProps<{ version: string | null }>()

const facts = [
  { title: 'Free', text: 'No account, no subscription' },
  { title: 'Runs locally', text: 'No memory reading, no injection' },
  { title: '12 languages', text: 'Follows your League client' },
  { title: 'Updates itself', text: 'In the background' },
]

const downloads: Array<{ id: DesktopPlatform; name: string; chip: string; detail: string }> = [
  { id: 'windows', name: 'Windows', chip: '64-bit', detail: 'Windows 10 or later' },
  { id: 'mac-arm', name: 'macOS', chip: 'Apple Silicon', detail: 'M1 and later, macOS 13+' },
  { id: 'mac-intel', name: 'macOS', chip: 'Intel', detail: 'macOS 13 or later' },
]

/** The build for this computer, once the browser is inspected. */
const mine = ref<DesktopPlatform | null>(null)

/** The floating download button shows once the hero's is gone, and hides again at the end. */
const hero = ref<HTMLElement>()
const end = ref<HTMLElement>()
const dock = ref(false)
let watch: IntersectionObserver | undefined

onMounted(async () => {
  const visible = new Map<Element, boolean>()
  watch = new IntersectionObserver((entries) => {
    for (const entry of entries) visible.set(entry.target, entry.isIntersecting)
    dock.value = ![...visible.values()].some(Boolean) && visible.size === 2
  })
  watch.observe(hero.value!)
  watch.observe(end.value!)
  mine.value = await detectDesktopTarget()
})
onBeforeUnmount(() => watch?.disconnect())
</script>

<template>
  <Head title="Invade for desktop" />

  <AppHeader />

  <main class="overflow-x-clip">
    <!-- Hero: the app, large, running off the edge of the screen -->
    <section class="hero relative">
      <div
        class="mx-auto grid w-full max-w-[1320px] px-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10"
      >
        <div class="relative z-10 pt-14 sm:pt-20 lg:pt-32 lg:pb-40">
          <p class="label flex items-center gap-2.5"><span class="bar" />Invade for desktop</p>
          <h1 class="display mt-5 text-[clamp(50px,7vw,104px)] text-balance text-ink">
            See more of <br class="hidden sm:inline" />every game.
          </h1>
          <p class="mt-6 max-w-[40ch] text-[15px] leading-relaxed text-ink-2 sm:text-[17px]">
            A free League of Legends companion for your overlay, champ select and every match after.
          </p>
          <div ref="hero" class="mt-9">
            <DownloadButton />
            <p v-if="version" class="mt-2 text-[11px] text-ink-4">Version {{ version }}</p>
          </div>
        </div>

        <div class="hero-shot relative mt-12 lg:mt-0">
          <div class="hero-tilt">
            <AppWindow
              src="shot-dashboard"
              alt="The Invade dashboard: win rate, trends over the last games, rank and recent matches"
              :width="2880"
              :height="1800"
              :cut="28"
              eager
            />
          </div>
        </div>
      </div>
    </section>

    <!-- Proof -->
    <section class="relative z-10 border-y border-line bg-bg">
      <ul
        class="mx-auto grid w-full max-w-[1320px] grid-cols-2 gap-y-5 px-5 py-6 lg:grid-cols-4 lg:py-7"
      >
        <li v-for="fact in facts" :key="fact.title" class="flex items-baseline gap-3">
          <span class="bar shrink-0 translate-y-[2px]" />
          <p class="min-w-0 text-[13px] leading-snug">
            <b class="font-bold text-ink">{{ fact.title }}</b>
            <span class="block text-ink-3 sm:inline"
              ><span class="hidden sm:inline"> · </span>{{ fact.text }}</span
            >
          </p>
        </li>
      </ul>
    </section>

    <!-- 1. Overlay: the showpiece -->
    <section id="overlay" class="pt-24 sm:pt-36">
      <div class="mx-auto w-full max-w-[1320px] px-5">
        <div class="grid gap-6 lg:grid-cols-2 lg:items-end">
          <div>
            <p class="label flex items-center gap-2.5"><span class="bar" />In game</p>
            <h2 class="display mt-4 text-balance text-[clamp(38px,5.6vw,72px)] text-ink">
              The numbers, over the&nbsp;game.
            </h2>
          </div>
          <p class="max-w-[44ch] text-[15px] leading-relaxed text-ink-2 lg:justify-self-end">
            Objective timers, win odds, gold lead and your next item, placed wherever you want them.
          </p>
        </div>
        <OverlayStage class="mt-10 sm:mt-14" />
      </div>
    </section>

    <!-- 2. Champ select -->
    <section id="champ-select" class="pt-28 sm:pt-44">
      <div
        class="mx-auto grid w-full max-w-[1320px] items-center gap-10 px-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16"
      >
        <AppWindow
          src="shot-champ-select"
          alt="Champ select: draft win probability of 56%, split into picks, lanes and duos, next to the lane matchups"
          :width="2430"
          :height="744"
          class="order-2 lg:order-1"
        />
        <div class="order-1 lg:order-2">
          <p class="label flex items-center gap-2.5"><span class="bar" />Champ select</p>
          <h2 class="display mt-4 text-balance text-[clamp(38px,5vw,64px)] text-ink">
            Read the draft before you lock&nbsp;in.
          </h2>
          <p class="mt-5 max-w-[38ch] text-[15px] leading-relaxed text-ink-2">
            Draft win chance, lane matchups and runes sent to your client.
          </p>
        </div>
      </div>
    </section>

    <!-- 3. After the game: the scoreboard, with one score pulled out -->
    <section id="history" class="pt-28 sm:pt-44">
      <div class="mx-auto w-full max-w-[1320px] px-5">
        <div class="max-w-[640px]">
          <p class="label flex items-center gap-2.5"><span class="bar" />After the game</p>
          <h2 class="display mt-4 text-balance text-[clamp(38px,5.6vw,72px)] text-ink">
            Every game, scored.
          </h2>
          <p class="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-ink-2">
            An Invade score from 0 to 10 for all ten players, with the scoreboard, graphs and
            timeline.
          </p>
        </div>

        <div class="relative mt-12 max-w-[1120px] sm:mt-16">
          <AppWindow
            src="shot-match"
            alt="Post-game analysis: Victory, a 4.6 score, the stat tiles and the blue side scoreboard with every player's score"
            :width="2000"
            :height="1527"
          />
          <span class="loupe-line" aria-hidden="true" />
          <figure class="loupe" aria-hidden="true">
            <img :src="`/landing/shot-ring.webp`" alt="" width="360" height="360" loading="lazy" />
            <figcaption><span class="mvp">MVP</span>Best score of the game</figcaption>
          </figure>
        </div>
      </div>
    </section>

    <!-- 4. Champions: two views, staggered -->
    <section id="champions" class="pt-28 sm:pt-44">
      <div class="mx-auto w-full max-w-[1320px] px-5">
        <div class="grid gap-6 lg:grid-cols-2 lg:items-end">
          <div>
            <p class="label flex items-center gap-2.5"><span class="bar" />Champions</p>
            <h2 class="display mt-4 text-balance text-[clamp(38px,5.6vw,72px)] text-ink">
              Builds and tiers, every&nbsp;patch.
            </h2>
          </div>
          <p class="max-w-[44ch] text-[15px] leading-relaxed text-ink-2 lg:justify-self-end">
            Runes, skill order and matchups for every champion, by role and rank.
          </p>
        </div>

        <div
          class="mt-12 grid items-start gap-5 sm:mt-16 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-6"
        >
          <AppWindow
            src="shot-champion"
            alt="Veigar's build: S tier, 51% win rate, runes, summoner spells and skill order"
            :width="2200"
            :height="1077"
          />
          <AppWindow
            src="shot-tiers"
            alt="The tier list: rank, role, tier and win rate for every champion"
            :width="1360"
            :height="884"
            class="lg:mt-24"
          />
        </div>
      </div>
    </section>

    <!-- 5. Recordings -->
    <section id="recording" class="pt-28 sm:pt-44">
      <div class="mx-auto w-full max-w-[1320px] px-5">
        <p class="label flex items-center gap-2.5"><span class="bar" />Recording</p>
        <h2 class="display mt-4 text-balance max-w-[14ch] text-[clamp(38px,5.6vw,72px)] text-ink">
          Your plays, already&nbsp;clipped.
        </h2>
        <p class="mt-5 max-w-[44ch] text-[15px] leading-relaxed text-ink-2">
          Every game records on its own, with kills, deaths and objectives cut out for you.
        </p>
        <AppWindow
          src="shot-recordings"
          alt="Recordings: a won game on Ahri with its full game, a triple kill, Baron and an assist as clips"
          :width="2344"
          :height="690"
          :cut="24"
          class="mt-12 sm:mt-16"
        />
      </div>
    </section>

    <!-- Download -->
    <section id="download" ref="end" class="scroll-mt-20 pt-28 pb-20 sm:pt-44 sm:pb-28">
      <div class="mx-auto w-full max-w-[1320px] px-5">
        <div class="relative">
          <span class="big-bar" aria-hidden="true" />
          <h2 class="display text-[clamp(52px,9vw,128px)] text-ink">Get Invade.</h2>
          <p class="mt-4 text-[15px] text-ink-2 sm:text-[17px]">
            Free, for Windows and macOS.<template v-if="version"> Version {{ version }}.</template>
          </p>
        </div>

        <ul class="mt-12 grid max-w-[1120px] gap-3 sm:grid-cols-3">
          <li v-for="target in downloads" :key="target.id">
            <a :href="`/download/${target.id}`" class="tile" :class="{ mine: mine === target.id }">
              <span class="flex items-center justify-between gap-3">
                <span class="label">{{ mine === target.id ? 'Your computer' : 'Download' }}</span>
                <Download :size="18" class="tile-icon" />
              </span>
              <span class="mt-4 block sm:mt-8">
                <span class="display block text-[34px] text-ink">{{ target.name }}</span>
                <span class="mt-1.5 block text-[13px] font-semibold text-ink-2">{{
                  target.chip
                }}</span>
                <span class="mt-0.5 block text-[12px] text-ink-3">{{ target.detail }}</span>
              </span>
            </a>
          </li>
        </ul>

        <p class="mt-6 max-w-[80ch] text-[11.5px] leading-relaxed text-ink-3">
          Builds are not code-signed yet, so your system may ask once. On Windows, choose
          <em class="not-italic text-ink-2">More info</em>, then
          <em class="not-italic text-ink-2">Run anyway</em>. On macOS, drag Invade to Applications,
          then right-click it and choose <em class="not-italic text-ink-2">Open</em>.
        </p>
      </div>
    </section>
  </main>

  <footer class="border-t border-line">
    <div class="mx-auto w-full max-w-[1320px] px-5 py-6 text-[10.5px] text-ink-4">
      Not affiliated with or endorsed by Riot Games. League of Legends is a trademark of Riot Games,
      Inc.
    </div>
  </footer>

  <!-- Always one click away once the hero has scrolled past -->
  <Transition name="dock">
    <div v-if="dock" class="dock">
      <a :href="mine ? `/download/${mine}` : '#download'" class="btn btn-primary dock-btn">
        <Download :size="15" />{{ mine ? `Download for ${targetLabel(mine)}` : 'Download Invade' }}
      </a>
    </div>
  </Transition>
</template>

<style scoped>
.bar {
  display: inline-block;
  width: 3px;
  height: 14px;
  transform: skewX(var(--slash));
  background: var(--color-brand);
}

/* ── Hero ─────────────────────────────────────────────────────── */
.hero {
  overflow: clip;
}
.hero-shot {
  perspective: 2200px;
  /* On phones the window runs off the right edge; on wide screens it starts in its column
     and runs past the page. */
  width: 170%;
  margin-bottom: -18%;
}
.hero-tilt {
  transform-origin: 0 50%;
  transform: rotateY(-16deg) rotateX(5deg) rotateZ(1deg);
  box-shadow: var(--shadow-e2);
}
@media (min-width: 1024px) {
  .hero-shot {
    width: clamp(900px, 84vw, 1320px);
    margin: 112px 0 -150px;
  }
}
@media (prefers-reduced-motion: no-preference) {
  .hero-tilt {
    animation: hero-in 1100ms var(--ease) both 120ms;
  }
  @supports (animation-timeline: scroll()) {
    /* Scrolling straightens the window a little. */
    .hero-shot {
      animation: hero-scroll linear both;
      animation-timeline: scroll(root);
      animation-range: 0 700px;
    }
  }
}
@keyframes hero-in {
  from {
    opacity: 0;
    transform: translate3d(80px, 30px, 0) rotateY(-28deg) rotateX(9deg) rotateZ(2deg);
  }
}
@keyframes hero-scroll {
  to {
    transform: translate3d(-40px, -40px, 0) rotateY(6deg);
  }
}

/* ── After the game: one score, magnified ───────────────────────── */
.loupe {
  position: absolute;
  right: 12px;
  bottom: -48px;
  width: clamp(124px, 19vw, 220px);
  margin: 0;
  padding: 1px;
  background: color-mix(in srgb, #ffd166 60%, transparent);
  clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%);
  box-shadow: var(--shadow-e2);
}
.loupe img {
  display: block;
  width: 100%;
  height: auto;
  background: #0f0f14;
  clip-path: polygon(0 0, calc(100% - 15.6px) 0, 100% 15.6px, 100% 100%, 0 100%);
}
.loupe figcaption {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 10px 9px;
  font-size: 11px;
  font-weight: 600;
  color: #c9c9d6;
  background: #0f0f14;
  border-top: 1px solid rgb(255 255 255 / 0.07);
}
.loupe .mvp {
  padding: 1px 5px;
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: #1a1400;
  background: #ffd166;
  border-radius: 2px;
}
/* Wide screens: beside the scoreboard, level with the 9.8 it magnifies, and tied to it. */
.loupe-line {
  display: none;
}
@media (min-width: 1300px) {
  .loupe {
    right: -196px;
    bottom: -37px;
    width: 180px;
  }
  .loupe-line {
    display: block;
    position: absolute;
    right: -16px;
    bottom: 68px;
    width: 32px;
    height: 1px;
    background: color-mix(in srgb, #ffd166 70%, transparent);
  }
}
@media (max-width: 639px) {
  .loupe figcaption {
    font-size: 0;
  }
  .loupe .mvp {
    font-size: 9.5px;
  }
}

/* ── Download ──────────────────────────────────────────────────── */
.big-bar {
  position: absolute;
  left: -34px;
  top: 4px;
  bottom: 38px;
  width: 10px;
  transform: skewX(var(--slash));
  background: var(--color-brand);
}
@media (max-width: 1199px) {
  .big-bar {
    display: none;
  }
}
.tile {
  position: relative;
  display: block;
  height: 100%;
  padding: 20px 22px 22px;
  background: var(--color-panel);
  border: 1px solid var(--color-line-2);
  transition:
    border-color var(--t-base) var(--ease),
    transform var(--t-base) var(--ease);
}
.tile:hover {
  border-color: color-mix(in srgb, var(--color-ink) 30%, transparent);
  transform: translateY(-2px);
}
.tile-icon {
  color: var(--color-ink-3);
}
.tile.mine {
  background: var(--color-accent);
  border-color: transparent;
  clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%);
}
.tile.mine :is(.label, .display, span, .tile-icon) {
  color: var(--color-accent-fg);
}
.tile.mine .text-ink-3 {
  opacity: 0.8;
}

/* ── Floating download ────────────────────────────────────────── */
.dock {
  position: fixed;
  z-index: 40;
  right: 20px;
  bottom: 20px;
}
.dock-btn {
  padding: 11px 18px;
  font-size: 13.5px;
  box-shadow: 0 10px 30px -8px rgb(0 0 0 / 0.5);
}
@media (max-width: 639px) {
  .dock {
    left: 16px;
    right: 16px;
    bottom: 16px;
  }
  .dock-btn {
    width: 100%;
  }
}
.dock-enter-active,
.dock-leave-active {
  transition:
    opacity var(--t-slow) var(--ease),
    translate var(--t-slow) var(--ease);
}
.dock-enter-from,
.dock-leave-to {
  opacity: 0;
  translate: 0 12px;
}
</style>
