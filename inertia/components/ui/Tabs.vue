<script setup lang="ts">
import { Link } from '@inertiajs/vue3'

/**
 * A page's tabs (`.tabs`): plain words on a hairline, the current one white with a violet bar.
 * Each tab is a real address (a visit, crawlable); `count` is the grey figure after a label.
 */
defineProps<{
  items: { key: string; label: string; href: string; count?: number | string | null }[]
  active: string
  label: string
  /** Keep the scroll position on a visit (tabs inside a page). */
  preserveScroll?: boolean
}>()
</script>

<template>
  <nav class="tabs" :aria-label="label">
    <Link
      v-for="t in items"
      :key="t.key"
      :href="t.href"
      :class="{ on: t.key === active }"
      :aria-current="t.key === active ? 'page' : undefined"
      :preserve-scroll="preserveScroll"
      prefetch
      >{{ t.label
      }}<span v-if="t.count !== null && t.count !== undefined" class="n num">{{
        t.count
      }}</span></Link
    >
  </nav>
</template>
