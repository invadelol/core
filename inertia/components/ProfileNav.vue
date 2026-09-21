<script setup lang="ts">
import { Link } from '@inertiajs/vue3'

defineProps<{ slug: string; section: string }>()

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'champions', label: 'Champions' },
  { key: 'friends', label: 'Friends' },
  { key: 'compare', label: 'Compare' },
  { key: 'live', label: 'Live', live: true },
] as const
</script>

<template>
  <nav class="tabs border-b border-line" aria-label="Player sections">
    <Link
      v-for="item in TABS"
      :key="item.key"
      :href="`/${encodeURIComponent(slug)}${item.key === 'overview' ? '' : '/' + item.key}`"
      :data-active="section === item.key"
      :aria-current="section === item.key ? 'page' : undefined"
      preserve-state
      preserve-scroll
    >
      {{ item.label }}
      <span v-if="'live' in item && item.live" class="pulse" />
    </Link>
  </nav>
</template>
