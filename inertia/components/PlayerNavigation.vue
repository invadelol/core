<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { LayoutDashboard, ScanEye, Swords, Radio } from 'lucide-vue-next'
defineProps<{ slug: string; section: string }>()
const tabs = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'lens', label: 'Lens', icon: ScanEye },
  { key: 'champions', label: 'Champions', icon: Swords },
  { key: 'live', label: 'Live', icon: Radio },
]
</script>
<template>
  <nav class="player-nav" aria-label="Player navigation">
    <Link
      v-for="item in tabs"
      :key="item.key"
      :href="`/${encodeURIComponent(slug)}${item.key === 'overview' ? '' : '/' + item.key}`"
      :class="{ active: section === item.key }"
      :aria-current="section === item.key ? 'page' : undefined"
      preserve-state
      preserve-scroll
      ><component :is="item.icon" :size="16" />{{ item.label
      }}<span v-if="item.key === 'live'" class="live-dot" /></Link
    ><span class="nav-caption">LEAGUE OF LEGENDS</span>
  </nav>
</template>
