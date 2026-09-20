<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { Github } from 'lucide-vue-next'
import SearchBar from './SearchBar.vue'
import { REPO_URL } from '../lib/links.js'

defineProps<{
  /** Breadcrumb shown after the wordmark, e.g. the summoner being viewed. */
  crumbs?: Array<{ label: string; href?: string }>
}>()
</script>

<template>
  <header class="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur-sm">
    <div class="mx-auto flex max-w-[1320px] items-center gap-4 px-4 py-3">
      <Link href="/" class="shrink-0 text-[0.9375rem] font-semibold tracking-tight text-ink">
        invade<span class="text-ink-3">.lol</span>
      </Link>

      <nav v-if="crumbs?.length" class="hidden items-center gap-1.5 text-[0.8125rem] sm:flex">
        <template v-for="crumb in crumbs" :key="crumb.label">
          <span class="text-ink-4">/</span>
          <Link
            v-if="crumb.href"
            :href="crumb.href"
            class="max-w-[16ch] truncate text-ink-2 hover:text-ink"
          >
            {{ crumb.label }}
          </Link>
          <span v-else class="max-w-[16ch] truncate text-ink-2">{{ crumb.label }}</span>
        </template>
      </nav>

      <div class="ml-auto w-full max-w-[280px]">
        <SearchBar />
      </div>

      <a
        :href="REPO_URL"
        target="_blank"
        rel="noreferrer"
        title="Free and open source on GitHub"
        class="shrink-0 rounded-md p-1.5 text-ink-3 transition-colors hover:bg-[#f4f4f6] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <Github class="h-[18px] w-[18px]" />
        <span class="sr-only">Source code on GitHub</span>
      </a>
    </div>
  </header>
</template>
