<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import SearchBar from './SearchBar.vue'

defineProps<{
  /** Breadcrumb shown after the wordmark, e.g. the summoner being viewed. */
  crumbs?: Array<{ label: string; href?: string }>
}>()
</script>

<template>
  <header class="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur-sm">
    <div class="mx-auto flex max-w-[1180px] items-center gap-4 px-4 py-3">
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
    </div>
  </header>
</template>
