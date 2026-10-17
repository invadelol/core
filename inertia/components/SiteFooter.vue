<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { Logo } from '@invadelol/ui'
import { DISCORD_URL, REPO_URL, X_URL } from '../lib/links.js'

/** The same quiet line at the bottom of every page: the source, the community, the policies, and Riot's notice. */
</script>

<template>
  <footer class="mt-16 border-t border-line">
    <div
      class="page flex flex-wrap items-center gap-x-6 gap-y-2 py-6 text-[12px] text-ink-3 pointer-coarse:gap-y-0 pointer-coarse:py-3"
    >
      <Link
        href="/"
        class="flex items-center gap-2 font-medium text-ink-2 hover:text-ink pointer-coarse:h-11"
      >
        <Logo :size="14" />invade.lol
      </Link>
      <Link href="/app" class="transition-colors hover:text-ink pointer-coarse:py-3.5"
        >Desktop app</Link
      >
      <Link href="/app/changelog" class="transition-colors hover:text-ink pointer-coarse:py-3.5">
        Changelog
      </Link>
      <Link href="/roadmap" class="transition-colors hover:text-ink pointer-coarse:py-3.5">
        Roadmap
      </Link>
      <a
        :href="REPO_URL"
        target="_blank"
        rel="noreferrer"
        class="transition-colors hover:text-ink pointer-coarse:py-3.5"
      >
        Source on GitHub
      </a>
      <a
        :href="DISCORD_URL"
        target="_blank"
        rel="noreferrer"
        class="transition-colors hover:text-ink pointer-coarse:py-3.5"
      >
        Discord
      </a>
      <a
        :href="X_URL"
        target="_blank"
        rel="noreferrer"
        class="transition-colors hover:text-ink pointer-coarse:py-3.5"
      >
        X
      </a>
      <Link href="/privacy" class="transition-colors hover:text-ink pointer-coarse:py-3.5"
        >Privacy</Link
      >
      <Link href="/legal" class="transition-colors hover:text-ink pointer-coarse:py-3.5"
        >Legal notice</Link
      >
      <span class="w-full text-ink-4 sm:ml-auto sm:w-auto pointer-coarse:pb-3">
        Not endorsed by Riot Games. League of Legends is a trademark of Riot Games, Inc.
      </span>
    </div>
  </footer>
</template>
