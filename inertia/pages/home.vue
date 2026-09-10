<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import SearchBar from '../components/SearchBar.vue'

const capabilities = [
  {
    title: 'Every match, in full',
    body: 'Per-minute gold, XP and CS from the match timeline — yours against the player you actually laned into.',
  },
  {
    title: 'Scored against the lobby',
    body: 'Damage, gold and vision are read as a share of the ten players in the game, not as numbers without a scale.',
  },
  {
    title: 'Rank, over time',
    body: 'LP tracked across tiers on one continuous axis, so a promotion looks like progress instead of a reset.',
  },
]
</script>

<template>
  <Head title="Find a summoner" />

  <div class="flex min-h-screen flex-col bg-surface">
    <header class="mx-auto w-full max-w-[1180px] px-6 py-6">
      <span class="text-[0.9375rem] font-semibold tracking-tight text-ink">
        invade<span class="text-ink-3">.lol</span>
      </span>
    </header>

    <main class="mx-auto flex w-full max-w-[560px] flex-1 flex-col justify-center px-6 pb-24">
      <h1 class="text-[2rem] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
        League statistics,<br />without the noise.
      </h1>
      <p class="mt-3 text-[0.9375rem] leading-relaxed text-ink-2">
        Look up any summoner and read the whole game — not just the scoreboard.
      </p>

      <div class="mt-7">
        <SearchBar size="lg" autofocus />
      </div>

      <p class="mt-3 text-[0.75rem] text-ink-3">
        Type a name to search, or the full
        <span class="font-medium text-ink-2">Name#Tag</span> to jump straight to a profile.
      </p>

      <dl class="mt-14 grid gap-7 border-t border-line pt-8 sm:grid-cols-3">
        <div v-for="item in capabilities" :key="item.title">
          <dt class="text-[0.8125rem] font-semibold text-ink">{{ item.title }}</dt>
          <dd class="mt-1.5 text-[0.75rem] leading-relaxed text-ink-2">{{ item.body }}</dd>
        </div>
      </dl>
    </main>

    <footer class="mx-auto w-full max-w-[1180px] px-6 py-6 text-[0.6875rem] text-ink-3">
      Not affiliated with or endorsed by Riot Games.
    </footer>
  </div>
</template>
