<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import AppHeader from '../components/AppHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import Story from '../components/app-page/story/Story.vue'
import LightSection from '../components/app-page/LightSection.vue'
import GetSection from '../components/app-page/GetSection.vue'

defineProps<{ version: string | null }>()

/**
 * /app: the desktop app, told by one game. A pinned stage plays it as the page scrolls (champ
 * select, the game, Tab, a kill and its clip, the score, invade.lol), every screen drawn live by
 * the overlay's own markup and the components the app and the site share (@invadelol/ui), on a
 * made-up player. Then, calmly: what it costs the computer, the download, the questions.
 */
</script>

<template>
  <Head title="Invade for desktop">
    <link rel="canonical" href="https://invade.lol/app" />
  </Head>

  <div class="flex min-h-screen flex-col">
    <AppHeader />

    <main class="app-page flex-1">
      <Story :version="version" />
      <LightSection />
      <GetSection :version="version" />
    </main>

    <SiteFooter />
  </div>
</template>

<style scoped>
.app-page {
  overflow-x: clip;
}
</style>
