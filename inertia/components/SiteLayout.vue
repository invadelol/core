<script setup lang="ts">
import AppHeader from './AppHeader.vue'
import SiteFooter from './SiteFooter.vue'
import type { SectionKey } from '../lib/site_nav.js'
import type { SubLink } from './header/sub_art.js'

/**
 * Every rebuilt page's frame (Facet): the header, the page in `<main id="main">`, the footer, all
 * under `.vb` so the design's classes apply (inertia/css/facet.css). The page lays itself out in
 * `.wrap` (1280 px, 32 px gutters; 16 px on a phone). The header's options pass through.
 */
withDefaults(
  defineProps<{
    search?: boolean
    sub?: SubLink[] | null
    section?: SectionKey | null
    patchOn?: boolean
  }>(),
  { search: true, sub: null, section: null, patchOn: false }
)
</script>

<template>
  <div class="vb site">
    <AppHeader :search="search" :sub="sub" :section="section" :patch-on="patchOn" />
    <main id="main" class="site-main"><slot /></main>
    <SiteFooter />
  </div>
</template>
