<script setup lang="ts">
import { computed } from 'vue'
import { Link, usePage } from '@inertiajs/vue3'
import { ChevronRight } from 'lucide-vue-next'
import SearchBar from './SearchBar.vue'
import ThemeToggle from './ui/ThemeToggle.vue'
import Wordmark from './ui/Wordmark.vue'

const page = usePage()
const onApp = computed(() => page.url.split('?')[0] === '/app')

withDefaults(
  defineProps<{
    /** Breadcrumb shown after the wordmark, e.g. the summoner being viewed. */
    crumbs?: Array<{ label: string; href?: string }>
    /** Hides the search field, for pages where the search is the page itself. */
    search?: boolean
  }>(),
  { search: true }
)
</script>

<template>
  <header class="sticky top-0 z-30 border-b border-line bg-chrome/90 backdrop-blur-md">
    <div
      class="mx-auto flex h-[56px] max-w-[1320px] items-center gap-3 px-5 sm:gap-5 sm:px-6 2xl:max-w-[1480px]"
    >
      <Link href="/" class="shrink-0" aria-label="invade.lol home">
        <Wordmark :size="16" />
      </Link>

      <nav
        v-if="crumbs?.length"
        class="hidden min-w-0 items-center gap-1.5 text-[13px] font-medium md:flex"
        aria-label="Breadcrumb"
      >
        <template v-for="crumb in crumbs" :key="crumb.label">
          <ChevronRight :size="14" class="shrink-0 text-ink-4" />
          <Link
            v-if="crumb.href"
            :href="crumb.href"
            class="max-w-[22ch] truncate text-ink-2 transition-colors hover:text-ink"
          >
            {{ crumb.label }}
          </Link>
          <span v-else class="max-w-[22ch] truncate text-ink">{{ crumb.label }}</span>
        </template>
      </nav>

      <div v-if="search" class="ml-auto w-full max-w-[340px]">
        <SearchBar />
      </div>

      <div class="flex shrink-0 items-center gap-1" :class="search ? '' : 'ml-auto'">
        <Link
          href="/app"
          class="btn btn-ghost hidden sm:inline-flex"
          :class="onApp ? '!text-ink' : ''"
          :aria-current="onApp ? 'page' : undefined"
        >
          App
        </Link>
        <ThemeToggle />
      </div>
    </div>
  </header>
</template>
