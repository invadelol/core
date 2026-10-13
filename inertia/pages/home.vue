<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import AppHeader from '../components/AppHeader.vue'
import SearchBar from '../components/SearchBar.vue'
import SiteFooter from '../components/SiteFooter.vue'
import HomeDesktop from '../components/home/HomeDesktop.vue'
import HomeRecent from '../components/home/HomeRecent.vue'

/** `/`: the search, the profiles this browser opened last, and the desktop app. */
</script>

<template>
  <Head title="Find a player" />

  <div class="flex min-h-screen flex-col">
    <AppHeader :search="false" />

    <main class="mx-auto w-full max-w-[1040px] flex-1 px-4 pt-[clamp(32px,9vh,96px)] sm:px-6">
      <h1 class="text-[28px] font-semibold leading-[1.15] tracking-[-0.012em] sm:text-[32px]">
        Find a player
      </h1>
      <div class="mt-5">
        <SearchBar size="lg" autofocus />
      </div>

      <HomeRecent class="mt-8" />
      <HomeDesktop class="mt-12" />
    </main>

    <SiteFooter />
  </div>
</template>
