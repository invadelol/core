<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import AppHeader from '../components/AppHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import HeroSection from '../components/app-page/HeroSection.vue'
import GameSection from '../components/app-page/GameSection.vue'
import DraftSection from '../components/app-page/DraftSection.vue'
import ScoreSection from '../components/app-page/ScoreSection.vue'
import ClipsSection from '../components/app-page/ClipsSection.vue'
import MoreSection from '../components/app-page/MoreSection.vue'
import LightSection from '../components/app-page/LightSection.vue'
import GetSection from '../components/app-page/GetSection.vue'
import '../components/app-page/app-page.css'

defineProps<{ version: string | null }>()

/**
 * /app, the desktop app's page, laid out like a product page: one idea per section, each shown
 * by the real app (captures of its windows and overlays, fictional players), moving as the page
 * scrolls. Then what it costs the computer, the download and the questions.
 */
</script>

<template>
  <Head title="Invade for desktop">
    <link rel="canonical" href="https://invade.lol/app" />
  </Head>

  <div class="flex min-h-screen flex-col">
    <AppHeader />

    <main class="ap flex-1">
      <HeroSection :version="version" />
      <GameSection />
      <DraftSection />
      <ScoreSection />
      <ClipsSection />
      <MoreSection />
      <LightSection />
      <GetSection :version="version" />
    </main>

    <SiteFooter />
  </div>
</template>
