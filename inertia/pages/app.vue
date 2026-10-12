<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import AppHeader from '../components/AppHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import DownloadCta from '../components/app-page/DownloadCta.vue'
import HomeScreen from '../components/app-page/HomeScreen.vue'
import Stage from '../components/app-page/Stage.vue'
import GameSection from '../components/app-page/GameSection.vue'
import DraftSection from '../components/app-page/DraftSection.vue'
import ScoredSection from '../components/app-page/ScoredSection.vue'
import ClipsSection from '../components/app-page/ClipsSection.vue'
import SyncSection from '../components/app-page/SyncSection.vue'
import LightSection from '../components/app-page/LightSection.vue'
import MoreSection from '../components/app-page/MoreSection.vue'
import GetSection from '../components/app-page/GetSection.vue'
import { vReveal } from '../components/app-page/reveal.js'
import '../components/app-page/app-page.css'

defineProps<{ version: string | null }>()

/**
 * /app: the desktop app, shown by its own UI. Every screen on the page is drawn live by the
 * components the app and the site share (@invadelol/ui) or by the overlay's own markup, on a
 * made-up player, so it is sharp at any size and always the current design.
 */
</script>

<template>
  <Head title="Invade for desktop">
    <link rel="canonical" href="https://invade.lol/app" />
  </Head>

  <div class="flex min-h-screen flex-col">
    <AppHeader />

    <main class="app-page flex-1">
      <!-- Hero: what it is, the download, then the app itself -->
      <section class="hero">
        <div class="page hero-copy">
          <a href="#champ-select" class="hero-new">
            <span class="hero-new-ver">{{ version ?? '0.2.9' }}</span>
            Counters for your lane, in champ select
          </a>
          <h1>Every game of League, timed, scored and clipped</h1>
          <p class="hero-lead">
            A free desktop companion for League of Legends. Objective timers and your pace while you
            play, runes set before you lock in, a score for every game, and your best plays saved as
            clips.
          </p>
          <DownloadCta />
          <p class="hero-meta">
            <span v-if="version">Version {{ version }}</span>
            <span>Free</span>
            <span>Windows 10+</span>
            <span>macOS 13+</span>
          </p>
        </div>

        <div v-reveal class="page hero-shot">
          <div class="shot">
            <Stage
              :w="1320"
              :h="840"
              :focus="{ x: 222, y: 44, w: 404, h: 560 }"
              label="Invade's Home: rank and LP, the last games with their scores, clips, performance and champions"
            >
              <HomeScreen />
            </Stage>
          </div>
        </div>
      </section>

      <GameSection />
      <DraftSection />
      <ScoredSection />
      <ClipsSection />
      <SyncSection />
      <LightSection />
      <MoreSection />
      <GetSection :version="version" />
    </main>

    <SiteFooter />
  </div>
</template>

<style scoped>
.app-page {
  overflow-x: clip;
}

/* ── Hero ── */
.hero {
  padding-top: clamp(48px, 9vh, 96px);
}

.hero-copy {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.hero-new {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 30px;
  padding: 0 12px 0 4px;
  margin-bottom: 28px;
  font-size: 13px;
  color: var(--text-2);
  background: var(--surface-1);
  border-radius: 999px;
  box-shadow: var(--lit);
  transition:
    color var(--t-fast),
    background-color var(--t-fast);
}

.hero-new:hover {
  color: var(--text-1);
  background: var(--surface-2);
}

.hero-new-ver {
  display: inline-grid;
  place-items: center;
  height: 22px;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--brand-hi);
  background: var(--brand-a16);
  border-radius: 999px;
}

.hero h1 {
  max-width: 13em;
  font-size: clamp(38px, 6.2vw, 72px);
  font-weight: 650;
  line-height: 1.02;
  letter-spacing: -0.035em;
  color: var(--text-1);
  text-wrap: balance;
}

.hero-lead {
  max-width: 600px;
  margin: 22px 0 32px;
  font-size: clamp(16px, 1.5vw, 18px);
  line-height: 1.55;
  color: var(--text-2);
  text-wrap: pretty;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px 0;
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--text-3);
}

.hero-meta span + span::before {
  content: '·';
  margin: 0 10px;
  color: var(--text-4);
}

.hero-shot {
  margin-top: clamp(44px, 7vh, 72px);
}

/* The window on the page: its own rim, and a long soft shadow under it. */
.shot {
  position: relative;
  max-width: 1240px;
  margin-inline: auto;
  border-radius: 12px;
  box-shadow:
    0 0 0 1px rgb(0 0 0 / 0.5),
    0 2px 4px rgb(0 0 0 / 0.3),
    0 24px 48px -16px rgb(0 0 0 / 0.55),
    0 64px 120px -40px rgb(0 0 0 / 0.7);
}

.shot :deep(.stage) {
  border-radius: 12px;
}

/* A phone sees a crop of the window: its cut edge fades out instead of stopping. */
@media (max-width: 639px) {
  .shot :deep(.stage) {
    mask-image: linear-gradient(90deg, #000 85%, transparent);
  }
}

:global([data-theme='light']) .shot {
  box-shadow:
    0 0 0 1px rgb(12 12 20 / 0.12),
    0 2px 4px rgb(12 12 20 / 0.06),
    0 24px 48px -16px rgb(12 12 20 / 0.18),
    0 64px 120px -40px rgb(12 12 20 / 0.28);
}
</style>
