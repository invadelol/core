<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import { Icon, type IconName } from '@invadelol/ui'
import AppHeader from './AppHeader.vue'
import SearchBar from './SearchBar.vue'
import SiteFooter from './SiteFooter.vue'

/**
 * A page that could not be shown (404, 500): what happened, the search, and the pages most
 * people go to next. Never indexed.
 */
defineProps<{ status: number; title: string; line: string; message?: string | null }>()

const NEXT: { href: string; label: string; line: string; icon: IconName }[] = [
  { href: '/tier-list', label: 'Tier list', line: 'Every role ranked', icon: 'chart' },
  { href: '/champions', label: 'Champions', line: 'Builds, runes and matchups', icon: 'grid' },
  { href: '/pros', label: 'Pro players', line: 'Their teams and accounts', icon: 'users' },
  { href: '/app', label: 'Desktop app', line: 'Free, Windows and macOS', icon: 'download' },
]
</script>

<template>
  <Head :title="title">
    <meta head-key="robots" name="robots" content="noindex" />
  </Head>

  <div class="flex min-h-screen flex-col">
    <AppHeader :search="false" />

    <main id="main" class="sh-error page flex-1">
      <p class="code num">{{ status }}</p>
      <h1>{{ title }}</h1>
      <p class="line">{{ line }}</p>
      <p v-if="message" class="msg">{{ message }}</p>
      <slot />
      <div class="find">
        <SearchBar
          size="lg"
          placeholder="Search a Riot ID, a champion or a pro"
          short-placeholder="Riot ID, champion or pro"
        />
      </div>
      <nav class="next" aria-label="Pages">
        <Link
          v-for="n in NEXT"
          :key="n.href"
          :href="n.href"
          prefetch
          class="sh-link"
          :data-track="`error_${n.label.toLowerCase().replace(/\W+/g, '_')}`"
        >
          <span class="ic"><Icon :name="n.icon" :size="16" /></span>
          <span class="t"
            ><b>{{ n.label }}</b
            ><span class="d">{{ n.line }}</span></span
          >
        </Link>
      </nav>
    </main>

    <SiteFooter />
  </div>
</template>
