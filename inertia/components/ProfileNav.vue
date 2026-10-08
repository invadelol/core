<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { nextTick, onMounted, useTemplateRef, watch } from 'vue'
import { ArrowLeftRight, LayoutGrid, Radio, Swords, Users } from 'lucide-vue-next'

const props = defineProps<{ slug: string; section: string }>()

const nav = useTemplateRef<HTMLElement>('nav')

/* On narrow screens the tabs scroll sideways: bring the current one into view. */
function reveal() {
  const el = nav.value
  const active = el?.querySelector<HTMLElement>('[data-active="true"]')
  if (el && active && el.scrollWidth > el.clientWidth) {
    el.scrollTo({
      left: active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2,
      behavior: 'smooth',
    })
  }
}
onMounted(reveal)
watch(
  () => props.section,
  () => nextTick(reveal)
)

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
  <nav ref="nav" class="profile-nav" aria-label="Player sections">
    <Link
      v-for="item in TABS"
      :key="item.key"
      :href="`/${encodeURIComponent(slug)}${item.key === 'overview' ? '' : '/' + item.key}`"
      :data-active="section === item.key"
      :aria-current="section === item.key ? 'page' : undefined"
      preserve-state
      preserve-scroll
    >
      <component :is="item.icon" :size="16" />
      {{ item.label }}
    </Link>
  </nav>
</template>

<style scoped>
/* Narrow screens: tabs with a straight brand underline. */
.profile-nav {
  display: flex;
  gap: 20px;
  overflow-x: auto;
  scrollbar-width: none;
  box-shadow: inset 0 -1px 0 var(--color-line);
}

.profile-nav::-webkit-scrollbar {
  display: none;
}

.profile-nav a {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-ink-3);
  white-space: nowrap;
  transition:
    color var(--t-fast) var(--ease),
    background-color var(--t-fast) var(--ease);
}

.profile-nav a :deep(svg) {
  display: none;
}

.profile-nav a:hover {
  color: var(--color-ink);
}

.profile-nav a[data-active='true'] {
  color: var(--color-ink);
}

.profile-nav a[data-active='true']::after {
  content: '';
  position: absolute;
  inset: auto 0 0;
  height: 2px;
  background: var(--color-brand);
}

/* Wide screens: a vertical list in the rail, like the desktop app's sidebar. */
@media (min-width: 64rem) {
  .profile-nav {
    flex-direction: column;
    gap: 2px;
    box-shadow: none;
  }

  .profile-nav a {
    height: 34px;
    gap: 10px;
    padding: 0 10px;
    border-radius: var(--radius-sm);
    color: var(--color-ink-2);
  }

  .profile-nav a :deep(svg) {
    display: block;
    flex: none;
    color: var(--color-ink-3);
    transition: color var(--t-fast) var(--ease);
  }

  .profile-nav a:hover {
    background: var(--color-panel);
  }

  .profile-nav a[data-active='true'] {
    font-weight: 600;
    background: var(--color-raised);
  }

  .profile-nav a[data-active='true'] :deep(svg) {
    color: var(--color-brand-hi);
  }

  .profile-nav a[data-active='true']::after {
    display: none;
  }
}
</style>
