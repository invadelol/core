<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import AppHeader from '../../components/AppHeader.vue'
import SearchBar from '../../components/SearchBar.vue'
import SiteFooter from '../../components/SiteFooter.vue'
</script>

<template>
  <Head title="Page not found" />

  <div class="flex min-h-screen flex-col">
    <AppHeader :search="false" />

    <main class="mx-auto w-full max-w-[560px] flex-1 px-5 pt-[clamp(56px,14vh,140px)] sm:px-6">
      <p class="num text-[13px] font-medium text-ink-3">404</p>
      <h1 class="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.012em] text-ink">
        This page doesn’t exist
      </h1>
      <p class="mt-3 text-[14px] leading-relaxed text-ink-2">
        The link may be out of date. Look the player up again:
      </p>
      <div class="mt-5">
        <SearchBar size="lg" />
      </div>
      <a href="/" class="btn btn-ghost mt-4 -ml-3">Back to the start</a>
    </main>

    <SiteFooter />
  </div>
</template>
