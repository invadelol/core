<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { ArrowLeftRight, LayoutGrid, Radio, Swords, Users } from 'lucide-vue-next'

defineProps<{ slug: string; section: string }>()

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'champions', label: 'Champions', icon: Swords },
  { key: 'friends', label: 'Friends', icon: Users },
  { key: 'compare', label: 'Compare', icon: ArrowLeftRight },
  { key: 'live', label: 'Live', icon: Radio },
] as const
</script>

<template>
  <!-- Sections of the profile: a vertical list in the rail on wide screens, tabs on narrow ones. -->
  <nav class="profile-nav" aria-label="Player sections">
    <Link
      v-for="item in TABS"
      :key="item.key"
      :href="`/${encodeURIComponent(slug)}${item.key === 'overview' ? '' : '/' + item.key}`"
      :data-active="section === item.key"
      :aria-current="section === item.key ? 'page' : undefined"
      preserve-state
      preserve-scroll
    >
      <component :is="item.icon" :size="15" />
      {{ item.label }}
    </Link>
  </nav>
</template>

<style scoped>
.profile-nav {
  display: flex;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: none;
  border-bottom: 1px solid var(--color-line);
}

.profile-nav::-webkit-scrollbar {
  display: none;
}

.profile-nav a {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  font-size: 13.5px;
  font-weight: 560;
  color: var(--color-ink-3);
  white-space: nowrap;
  transition:
    color var(--t-fast) ease,
    background-color var(--t-fast) ease;
}

.profile-nav a:hover {
  color: var(--color-ink);
}

.profile-nav a[data-active='true'] {
  color: var(--color-ink);
  font-weight: 650;
}

.profile-nav a[data-active='true'] :deep(svg) {
  color: var(--color-brand);
}

.profile-nav a[data-active='true']::after {
  content: '';
  position: absolute;
  inset: auto 8px -1px;
  height: 2px;
  background: var(--color-brand);
}

@media (min-width: 64rem) {
  .profile-nav {
    flex-direction: column;
    border-bottom: 0;
  }

  .profile-nav a {
    height: 36px;
    padding: 0 12px;
    border-radius: var(--radius-sm);
  }

  .profile-nav a:hover {
    background: color-mix(in srgb, var(--color-ink) 4%, transparent);
  }

  .profile-nav a[data-active='true'] {
    background: var(--color-panel);
  }

  /* The slash, as in the desktop app's sidebar. */
  .profile-nav a[data-active='true']::after {
    inset: 10px auto 10px 0;
    width: 3px;
    height: auto;
    transform: skewX(var(--slash));
  }
}
</style>
