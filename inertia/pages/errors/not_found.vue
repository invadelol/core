<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import AppHeader from '../../components/AppHeader.vue'
</script>

<template>
  <Head title="Page not found" />

  <AppHeader />

  <main class="mx-auto max-w-[760px] px-5 py-10">
    <div class="py-20 text-center sm:py-28">
      <p class="label">Error 404</p>
      <h1 class="display mt-4 text-[clamp(34px,6vw,52px)] text-ink">This page doesn’t exist</h1>
      <p class="mx-auto mt-4 max-w-[42ch] text-[14px] leading-relaxed text-ink-2">
        The link may be out of date. Search for a summoner above, or head back to the start.
      </p>
      <a href="/" class="btn btn-primary mt-8 !px-4 !py-2">Back to search</a>
    </div>
  </main>
</template>
