<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import AppHeader from '../components/AppHeader.vue'
import SearchBar from '../components/SearchBar.vue'
import SiteFooter from '../components/SiteFooter.vue'
import HomeBestGames from '../components/home/HomeBestGames.vue'
import HomeChampions from '../components/home/HomeChampions.vue'
import HomeClimbs from '../components/home/HomeClimbs.vue'
import HomeDesktop from '../components/home/HomeDesktop.vue'
import HomeRecent from '../components/home/HomeRecent.vue'
import HomeTrending from '../components/home/HomeTrending.vue'
import type { HomeData } from '../lib/home.js'

/**
 * `/`: the search first, then what invade.lol holds right now, read from storage
 * (app/services/home_service.ts): the best games of the day, Trending and Climbs side by side,
 * the champions of the patch, and the desktop app. A section with nothing to show is left out.
 */
defineProps<HomeData>()
</script>

<template>
  <Head title="Find a player" />

  <div class="flex min-h-screen flex-col">
    <AppHeader :search="false" />

    <main class="home mx-auto w-full max-w-[1040px] flex-1 px-4 pt-[clamp(32px,9vh,96px)] sm:px-6">
      <h1 class="text-[28px] font-semibold leading-[1.15] tracking-[-0.012em] sm:text-[32px]">
        Find a player
      </h1>
      <div class="mt-5">
        <SearchBar size="lg" autofocus />
      </div>
      <HomeRecent class="mt-3" />

      <HomeBestGames v-if="best?.length" :games="best" class="mt-12" />

      <div
        v-if="trending?.players.length || climbs?.length"
        class="mt-10 grid items-start gap-x-6 gap-y-10 lg:grid-cols-2"
      >
        <HomeTrending v-if="trending?.players.length" :trending="trending" />
        <HomeClimbs v-if="climbs?.length" :climbs="climbs" />
      </div>

      <HomeChampions v-if="champions?.rows.length" :champions="champions" class="mt-10" />
      <HomeDesktop class="mt-12" />
    </main>

    <SiteFooter />
  </div>
</template>

<style>
/*
 * The home's sheets, lit as the desktop app's tiles are: the package's sheen and lit edge, and
 * the window's one violet light reaching each sheet from the top right. Rows carry what they
 * are about as a soft tint from their leading side (a result, a tier). Only the strengths change
 * with the theme; the colours are the package's tokens.
 */
.home {
  --home-light: 0.07;
  --home-tint: 0.13;
  --home-tint-far: 0.035;
}

[data-theme='light'] .home {
  --home-light: 0.055;
  --home-tint: 0.1;
  --home-tint-far: 0.025;
}

@media (prefers-color-scheme: light) {
  [data-theme='system'] .home {
    --home-light: 0.055;
    --home-tint: 0.1;
    --home-tint-far: 0.025;
  }
}

.home .home-sheet {
  background:
    radial-gradient(
      120% 140% at 100% 0%,
      rgb(var(--brand-rgb) / var(--home-light)),
      rgb(var(--brand-rgb) / 0) 62%
    ),
    var(--sheen), var(--surface-1);
}
</style>
