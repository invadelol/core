<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { ArrowLeftRight, LayoutGrid, Radio, ScanEye, Swords, Users } from 'lucide-vue-next'

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
/* While tabs remain past an edge, that edge fades: there is more to scroll to. */
const before = ref(false)
const more = ref(false)
function measure() {
  const el = nav.value
  before.value = Boolean(el && el.scrollLeft > 4)
  more.value = Boolean(el && el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
}
let resize: ResizeObserver | undefined
onMounted(() => {
  reveal()
  measure()
  resize = new ResizeObserver(measure)
  if (nav.value) resize.observe(nav.value)
})
onBeforeUnmount(() => resize?.disconnect())
watch(
  () => props.section,
  () => nextTick(reveal)
)

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  // Hidden from the list for the launch (Oct 2026): /<player>/lens still opens, and the tab
  // shows only while it is the open section. Remove `hidden` to list it again.
  { key: 'lens', label: 'Lens', icon: ScanEye, hidden: true },
  { key: 'champions', label: 'Champions', icon: Swords },
  { key: 'friends', label: 'Friends', icon: Users },
  { key: 'compare', label: 'Compare', icon: ArrowLeftRight },
  { key: 'live', label: 'Live', icon: Radio },
] as const

const tabs = computed(() =>
  TABS.filter((item) => !('hidden' in item && item.hidden) || props.section === item.key)
)
</script>

<template>
  <!-- Sections of the profile: the shared tabs on narrow screens, a vertical list in the rail on
       wide ones, like the desktop app's sidebar. -->
  <nav
    ref="nav"
    class="profile-nav iv-tabs"
    :class="{ 'fade-l': before, 'fade-r': more, 'fade-x': before && more }"
    aria-label="Player sections"
    @scroll.passive="measure"
  >
    <Link
      v-for="item in tabs"
      :key="item.key"
      :href="`/${encodeURIComponent(slug)}${item.key === 'overview' ? '' : '/' + item.key}`"
      :class="{ on: section === item.key }"
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
.profile-nav {
  overflow-x: auto;
  scrollbar-width: none;
}

.profile-nav::-webkit-scrollbar {
  display: none;
}

.profile-nav a {
  flex: none;
  height: 40px;
  white-space: nowrap;
}

.profile-nav a :deep(svg) {
  display: none;
}

@media (min-width: 64rem) {
  .profile-nav {
    flex-direction: column;
    align-items: stretch;
    gap: 2px;
    overflow: visible;
    border-bottom: 0;
  }

  .profile-nav a {
    gap: 10px;
    height: 34px;
    padding: 0 10px;
    color: var(--text-2);
    border-radius: var(--r-sm);
    transition:
      color var(--t-fast),
      background-color var(--t-fast);
  }

  .profile-nav a :deep(svg) {
    display: block;
    flex: none;
    color: var(--text-3);
    transition: color var(--t-fast);
  }

  .profile-nav a:hover {
    background: var(--surface-1);
  }

  .profile-nav a:hover :deep(svg) {
    color: var(--text-2);
  }

  /* The current section: the violet-lit pill of the app's sidebar. */
  .profile-nav a.on {
    color: var(--text-1);
    background: var(--lit-pill);
    box-shadow: var(--lit-pill-edge);
  }

  .profile-nav a.on :deep(svg) {
    color: var(--brand-hi);
    filter: drop-shadow(0 0 6px rgb(var(--brand-rgb) / 0.5));
  }

  .profile-nav a.on::after {
    display: none;
  }
}
</style>
