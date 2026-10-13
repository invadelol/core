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
import HomeToday from '../components/home/HomeToday.vue'
import HomeTrending from '../components/home/HomeTrending.vue'
import type { HomeData } from '../lib/home.js'

/**
 * `/`: the search first, then what invade.lol holds right now, read from storage
 * (app/services/home_service.ts). A section with nothing to show is left out. `layout` 2 is the
 * same sections as a two-column dashboard (`?v=2`).
 */
defineProps<HomeData & { layout: 1 | 2 }>()
</script>

<template>
  <Head title="Find a player" />

  <div class="flex min-h-screen flex-col">
    <AppHeader :search="false" />

    <!-- One column: search, the day, the best games, two lists side by side, champions. -->
    <main
      v-if="layout !== 2"
      class="mx-auto w-full max-w-[1040px] flex-1 px-4 pt-[clamp(32px,9vh,96px)] sm:px-6"
    >
      <h1 class="text-[28px] font-semibold leading-[1.15] tracking-[-0.012em] sm:text-[32px]">
        Find a player
      </h1>
      <div class="mt-5">
        <SearchBar size="lg" autofocus />
      </div>
      <HomeRecent class="mt-3" />

      <HomeToday v-if="today" :today="today" class="mt-10" />
      <HomeBestGames v-if="best?.length" :games="best" class="mt-10" />

      <div
        v-if="trending?.players.length || climbs?.length"
        class="mt-10 grid items-start gap-x-6 gap-y-10 lg:grid-cols-2"
      >
        <HomeTrending v-if="trending?.players.length" :trending="trending" />
        <HomeClimbs v-if="climbs?.length" :climbs="climbs" />
      </div>

      <HomeChampions v-if="champions?.rows.length" :champions="champions" class="mt-10" />
      <HomeDesktop class="mt-10" />
    </main>

    <!-- Dashboard: the search and the long lists on the left, the day and the short lists beside. -->
    <main v-else class="page flex-1 pt-[clamp(24px,5vh,56px)]">
      <div
        class="grid items-start gap-x-8 gap-y-10 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]"
      >
        <div class="min-w-0">
          <h1 class="text-[28px] font-semibold leading-[1.15] tracking-[-0.012em] sm:text-[32px]">
            Find a player
          </h1>
          <div class="mt-5">
            <SearchBar size="lg" autofocus />
          </div>
          <HomeRecent class="mt-3" />

          <!-- Without the rail beside it, the day comes right under the search. -->
          <div v-if="today" class="mt-10 lg:hidden"><HomeToday :today="today" /></div>
          <HomeBestGames v-if="best?.length" :games="best" class="mt-10" />
          <HomeChampions v-if="champions?.rows.length" :champions="champions" class="mt-10" />
        </div>

        <aside class="grid min-w-0 gap-10">
          <div v-if="today" class="max-lg:hidden"><HomeToday :today="today" stacked /></div>
          <HomeTrending v-if="trending?.players.length" :trending="trending" />
          <HomeClimbs v-if="climbs?.length" :climbs="climbs" />
          <HomeDesktop />
        </aside>
      </div>
    </main>

    <SiteFooter />
  </div>
</template>
