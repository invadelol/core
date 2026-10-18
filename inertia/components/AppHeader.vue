<script setup lang="ts">
import { computed } from 'vue'
import { Link, usePage } from '@inertiajs/vue3'
import { ChevronRight } from 'lucide-vue-next'
import { Logo } from '@invadelol/ui'
import SearchBar from './SearchBar.vue'
import ThemeToggle from './ui/ThemeToggle.vue'
import AccountMenu from './account/AccountMenu.vue'

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
  <header class="chrome sticky top-0 z-30">
    <div class="page flex h-[56px] items-center gap-3 sm:gap-5">
      <Link
        href="/"
        class="shrink-0 pointer-coarse:flex pointer-coarse:h-10 pointer-coarse:items-center"
        aria-label="invade.lol home"
      >
        <Logo :size="22" word />
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
          class="iv-btn ghost hidden sm:inline-flex"
          :class="onApp ? '!text-ink' : ''"
          :aria-current="onApp ? 'page' : undefined"
        >
          App
        </Link>
        <ThemeToggle />
        <AccountMenu />
      </div>
    </div>
  </header>
</template>
