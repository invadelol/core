<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Link } from '@inertiajs/vue3'
import { CATEGORIES, STATS, type StatDef } from '../../lib/studio.js'

/**
 * A statistic's page heading its list: the categories as tabs (each leads to its first
 * statistic), then the category's statistics as a segmented row. On a narrow screen both rows
 * scroll sideways, the current entries brought into view.
 */
const props = defineProps<{
  stat: StatDef
  /** The page's filters, as a query string, or ''. */
  query: string
}>()
const href = (slug: string) => `/stats/${slug}${props.query ? `?${props.query}` : ''}`
const firstOf = (category: string) => STATS.find((s) => s.category === category)!.slug
const siblings = computed(() => STATS.filter((s) => s.category === props.stat.category))
const label = computed(() => CATEGORIES.find((c) => c.key === props.stat.category)?.label)

const cats = ref<HTMLElement | null>(null)
const stats = ref<HTMLElement | null>(null)
/** Scrolls each row (not the page) so its current entry sits in view. */
function reveal() {
  for (const row of [cats.value, stats.value]) {
    const on = row?.querySelector<HTMLElement>('.on')
    if (!row || !on || row.scrollWidth <= row.clientWidth) continue
    row.scrollLeft = Math.max(0, on.offsetLeft - (row.clientWidth - on.offsetWidth) / 2)
  }
}
onMounted(reveal)
watch(
  () => props.stat.slug,
  () => nextTick(reveal)
)
</script>

<template>
  <div class="st-nav">
    <nav ref="cats" class="tabs st-cats" aria-label="Categories">
      <Link
        v-for="c in CATEGORIES"
        :key="c.key"
        :href="href(firstOf(c.key))"
        :class="{ on: c.key === stat.category }"
        :aria-current="c.key === stat.category ? 'true' : undefined"
        preserve-scroll
        >{{ c.label }}</Link
      >
    </nav>
    <nav ref="stats" class="seg st-stats" :aria-label="label">
      <Link
        v-for="s in siblings"
        :key="s.slug"
        :href="href(s.slug)"
        :class="{ on: s.slug === stat.slug }"
        :aria-current="s.slug === stat.slug ? 'page' : undefined"
        preserve-scroll
        >{{ s.label }}</Link
      >
    </nav>
  </div>
</template>
