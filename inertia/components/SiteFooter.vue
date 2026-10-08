<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Glyph from './ui/Glyph.vue'
import { REPO_URL } from '../lib/links.js'

/** The same quiet line at the bottom of every page: where the source lives, and Riot's notice. */
</script>

<template>
  <footer class="mt-16 border-t border-line">
    <div
      class="mx-auto flex max-w-[1320px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-6 text-[12px] text-ink-3 sm:px-6 2xl:max-w-[1480px]"
    >
      <Link href="/" class="flex items-center gap-2 font-medium text-ink-2 hover:text-ink">
        <Glyph :size="14" />invade.lol
      </Link>
      <Link href="/app" class="transition-colors hover:text-ink">Desktop app</Link>
      <a :href="REPO_URL" target="_blank" rel="noreferrer" class="transition-colors hover:text-ink">
        Source on GitHub
      </a>
      <span class="w-full text-ink-4 sm:ml-auto sm:w-auto">
        Not endorsed by Riot Games. League of Legends is a trademark of Riot Games, Inc.
      </span>
    </div>
  </footer>
</template>
