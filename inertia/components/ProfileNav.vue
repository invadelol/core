<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'

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
  { key: 'overview', label: 'Overview' },
  // Hidden from the list for the launch (Oct 2026): /<player>/lens still opens, and the tab
  // shows only while it is the open section. Remove `hidden` to list it again.
  { key: 'lens', label: 'Lens', hidden: true },
  { key: 'champions', label: 'Champions' },
  { key: 'mastery', label: 'Mastery' },
  { key: 'friends', label: 'Friends' },
  { key: 'compare', label: 'Compare' },
  { key: 'live', label: 'Live game' },
] as const

const tabs = computed(() =>
  TABS.filter((item) => !('hidden' in item && item.hidden) || props.section === item.key)
)
</script>

<template>
  <!-- Sections of the profile: underline tabs under the header, scrolling sideways on a phone. -->
  <nav
    ref="nav"
    class="profile-nav rd-tabs"
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
      {{ item.label }}
    </Link>
  </nav>
</template>

<style scoped>
.profile-nav {
  margin-bottom: 20px;
  scrollbar-width: none;
}
.profile-nav::-webkit-scrollbar {
  display: none;
}
.profile-nav a {
  flex: none;
  text-decoration: none;
}
.profile-nav a:hover {
  color: var(--text-1);
}
.profile-nav a:focus-visible {
  outline: 2px solid var(--rd-violet);
  outline-offset: -2px;
  border-radius: 4px;
}
</style>
