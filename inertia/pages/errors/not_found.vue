<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import AppHeader from '../../components/AppHeader.vue'
</script>

<template>
  <Head title="Page not found" />

  <AppHeader />

  <main class="mx-auto max-w-[1180px] px-4 py-6">
    <div class="card px-6 py-20 text-center">
      <p class="label">404</p>
      <h1 class="mt-2 text-[1.25rem] font-semibold text-ink">This page doesn’t exist</h1>
      <p class="mx-auto mt-2 max-w-sm text-[0.8125rem] text-ink-2">
        The link may be out of date. Search for a summoner above, or head back to the start.
      </p>
      <a href="/" class="btn mt-6">Back to search</a>
    </div>
  </main>
</template>
