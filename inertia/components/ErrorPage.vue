<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import SiteLayout from './SiteLayout.vue'
import SearchBar from './SearchBar.vue'
import MenuArt from './header/MenuArt.vue'
import type { MenuArtName } from '../lib/site_nav.js'

/**
 * A page that could not be shown (404, 500), in Facet: what happened, the search, and the pages
 * most people go to next, each with its picture from the header's menus. Never indexed.
 */
defineProps<{ status: number; title: string; line: string; message?: string | null }>()

const NEXT: { href: string; label: string; line: string; art: MenuArtName }[] = [
  {
    href: '/tier-list',
    label: 'Tier list',
    line: 'Every champion in every role',
    art: 'champions',
  },
  {
    href: '/leaderboards/solo',
    label: 'Leaderboards',
    line: 'The best players of each region',
    art: 'solo',
  },
  { href: '/pros', label: 'Pros', line: 'Their teams and solo queue accounts', art: 'pros' },
  { href: '/app', label: 'Desktop app', line: 'Free, Windows and macOS', art: 'app' },
]
</script>

<template>
  <Head :title="title">
    <meta head-key="robots" name="robots" content="noindex" />
  </Head>
  <SiteLayout :search="false">
    <div class="wrap er">
      <p class="er-code num">{{ status }}</p>
      <h1 class="h1">{{ title }}</h1>
      <p class="body er-line">{{ line }}</p>
      <p v-if="message" class="meta er-msg">{{ message }}</p>
      <slot />
      <div class="er-find">
        <SearchBar variant="header" size="lg" placeholder="Riot ID, champion or pro" />
      </div>
      <nav class="er-next" aria-label="Pages">
        <Link
          v-for="n in NEXT"
          :key="n.href"
          :href="n.href"
          prefetch
          class="dm-r card"
          :data-track="`error_${n.label.toLowerCase().replace(/\W+/g, '_')}`"
        >
          <span class="dm-i"><MenuArt :name="n.art" :size="56" /></span>
          <span class="dm-t"
            ><b>{{ n.label }}</b
            ><span>{{ n.line }}</span></span
          >
        </Link>
      </nav>
    </div>
  </SiteLayout>
</template>

<style>
.vb .er {
  padding-top: 72px;
  padding-bottom: 24px;
  text-align: center;
}
.vb .er-code {
  font-size: 112px;
  line-height: 1;
  font-weight: 650;
  letter-spacing: -0.045em;
  color: var(--v300);
}
.vb .er .h1 {
  margin-top: 18px;
}
.vb .er-line {
  max-width: 520px;
  margin: 10px auto 0;
}
.vb .er-msg {
  margin-top: 8px;
}
.vb .er-acts {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 22px;
}
.vb .er-find {
  margin-top: 8px;
}
.vb .er-next {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  max-width: 1080px;
  margin: 48px auto 0;
  text-align: left;
}
.vb .er-next .dm-r {
  padding: 14px 16px;
}
@media (max-width: 1023px) {
  .vb .er-next {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 639px) {
  .vb .er {
    padding-top: 40px;
  }
  .vb .er-code {
    font-size: 76px;
  }
  .vb .er-next {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
