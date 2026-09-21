<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { Github } from 'lucide-vue-next'
import SearchBar from './SearchBar.vue'
import ThemeToggle from './ui/ThemeToggle.vue'
import { REPO_URL } from '../lib/links.js'

defineProps<{
  /** Breadcrumb shown after the wordmark, e.g. the summoner being viewed. */
  crumbs?: Array<{ label: string; href?: string }>
}>()
</script>

<template>
  <header class="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-md">
    <div
      class="mx-auto flex h-[52px] max-w-[1320px] items-center gap-3 px-5 sm:gap-4 2xl:max-w-[1480px]"
    >
      <Link
        href="/"
        class="shrink-0 text-[14.5px] font-semibold tracking-[-0.02em] text-ink"
        aria-label="invade.lol home"
      >
        invade<span class="text-ink-4">.lol</span>
      </Link>

      <nav v-if="crumbs?.length" class="hidden items-center gap-1.5 text-[12.5px] md:flex">
        <template v-for="crumb in crumbs" :key="crumb.label">
          <span class="text-ink-4">/</span>
          <Link
            v-if="crumb.href"
            :href="crumb.href"
            class="max-w-[18ch] truncate text-ink-2 transition-colors hover:text-ink"
          >
            {{ crumb.label }}
          </Link>
          <span v-else class="max-w-[18ch] truncate text-ink-2">{{ crumb.label }}</span>
        </template>
      </nav>

      <div class="ml-auto w-full max-w-[300px]">
        <SearchBar />
      </div>

      <div class="flex shrink-0 items-center gap-0.5">
        <ThemeToggle />
        <a
          :href="REPO_URL"
          target="_blank"
          rel="noreferrer"
          title="Free and open source on GitHub"
          class="icon-btn hidden sm:inline-flex"
        >
          <Github :size="16" />
          <span class="sr-only">Source code on GitHub</span>
        </a>
      </div>
    </div>
  </header>
</template>
