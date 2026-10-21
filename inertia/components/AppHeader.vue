<script setup lang="ts">
import { computed } from 'vue'
import { Link, usePage } from '@inertiajs/vue3'
import { ChevronRight } from 'lucide-vue-next'
import { Logo } from '@invadelol/ui'
import SearchBar from './SearchBar.vue'
import ThemeToggle from './ui/ThemeToggle.vue'

const page = usePage()
const path = computed(() => page.url.split('?')[0])
const onApp = computed(() => path.value === '/app')

/** The site's sections beside the players: champions, the tier list and the pros. */
const SECTIONS = [
  { href: '/champions', label: 'Champions', match: (p: string) => p.startsWith('/champions') },
  { href: '/tier-list', label: 'Tier list', match: (p: string) => p.startsWith('/tier-list') },
  {
    href: '/pros',
    label: 'Pros',
    match: (p: string) => p === '/pros' || p.startsWith('/pro/') || p.startsWith('/team/'),
  },
]

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

      <nav class="hidden items-center gap-0.5 lg:flex" aria-label="Sections">
        <Link
          v-for="s in SECTIONS"
          :key="s.href"
          :href="s.href"
          class="section-link"
          :class="{ on: s.match(path) }"
          :aria-current="s.match(path) ? 'page' : undefined"
        >
          {{ s.label }}
        </Link>
      </nav>

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
      </div>
    </div>
  </header>
</template>

<style scoped>
.section-link {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 11px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  border-radius: var(--r-sm);
  transition:
    color var(--t-fast),
    background-color var(--t-fast);
}

.section-link:hover {
  color: var(--text-1);
  background: var(--surface-1);
}

/* The current section: the violet-lit pill of the app's sidebar. */
.section-link.on {
  color: var(--text-1);
  background: var(--lit-pill);
  box-shadow: var(--lit-pill-edge);
}
</style>
