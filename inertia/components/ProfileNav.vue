<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { nextTick, onMounted, useTemplateRef, watch } from 'vue'

/** The profile's sections as tabs under its header, with the page's actions at the far end. */
const props = defineProps<{ slug: string; section: string }>()

const nav = useTemplateRef<HTMLElement>('nav')

/* On narrow screens the tabs scroll sideways: bring the current one into view. */
function reveal() {
  const el = nav.value
  const active = el?.querySelector<HTMLElement>('.on')
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
  { key: 'overview', label: 'Overview' },
  { key: 'champions', label: 'Champions' },
  { key: 'friends', label: 'Friends' },
  { key: 'compare', label: 'Compare' },
  { key: 'live', label: 'Live' },
] as const
</script>

<template>
  <div class="profile-nav">
    <nav ref="nav" class="iv-tabs" aria-label="Player sections">
      <Link
        v-for="item in TABS"
        :key="item.key"
        :href="`/${encodeURIComponent(slug)}${item.key === 'overview' ? '' : '/' + item.key}`"
        :class="{ on: section === item.key }"
        :aria-current="section === item.key ? 'page' : undefined"
        preserve-state
        preserve-scroll
      >
        {{ item.label }}
      </Link>
    </nav>
    <div class="profile-nav-actions"><slot /></div>
  </div>
</template>

<style scoped>
.profile-nav {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  border-bottom: 1px solid var(--line);
}

.iv-tabs {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  border-bottom: 0;
}

.iv-tabs::-webkit-scrollbar {
  display: none;
}

.iv-tabs > a {
  flex: none;
}

/* The rule is the row's, under the actions too; the scroller would clip a mark hanging below it. */
.iv-tabs > .on::after {
  bottom: 0;
}

.profile-nav-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 6px;
}
</style>
