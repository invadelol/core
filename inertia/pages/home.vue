<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { Github } from 'lucide-vue-next'
import SearchBar from '../components/SearchBar.vue'
import { REPO_URL } from '../lib/links.js'
</script>

<template>
  <Head title="Find a summoner" />

  <div class="flex min-h-screen flex-col bg-surface">
    <header class="mx-auto flex w-full max-w-[1180px] items-center gap-4 px-6 py-6">
      <span class="text-[0.9375rem] font-semibold tracking-tight text-ink">
        invade<span class="text-ink-3">.lol</span>
      </span>

      <a
        :href="REPO_URL"
        target="_blank"
        rel="noreferrer"
        class="ml-auto inline-flex items-center gap-1.5 text-[0.8125rem] text-ink-2 transition-colors hover:text-ink"
      >
        <Github class="h-4 w-4" />
        Open source
      </a>
    </header>

    <main class="mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center px-6 pb-28">
      <h1 class="text-[2rem] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
        Find a summoner
      </h1>

      <div class="mt-6">
        <SearchBar size="lg" autofocus />
      </div>
    </main>

    <footer class="mx-auto w-full max-w-[1180px] px-6 py-6 text-[0.6875rem] text-ink-3">
      Not affiliated with or endorsed by Riot Games.
    </footer>
  </div>
</template>
