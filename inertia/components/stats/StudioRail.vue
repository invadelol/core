<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Icon from '../ui/Icon.vue'
import { CATEGORIES, STATS } from '../../lib/studio.js'

/**
 * The studio's statistics as a side list, by category (like the profile's sections): the hub
 * first, then each category's name and its statistics. Every entry keeps the page's filters.
 */
const props = defineProps<{
  /** The statistic shown, null on the hub. */
  stat: string | null
  /** The page's filters, as a query string (`role=mid&rank=all`), or ''. */
  query: string
}>()
const href = (slug: string | null) =>
  `/stats${slug ? `/${slug}` : ''}${props.query ? `?${props.query}` : ''}`
const groups = CATEGORIES.map((c) => ({ ...c, stats: STATS.filter((s) => s.category === c.key) }))
</script>

<template>
  <nav class="st-rail" aria-label="Statistics">
    <Link
      :href="href(null)"
      class="st-rl st-home"
      :class="{ on: !stat }"
      :aria-current="!stat ? 'page' : undefined"
      preserve-scroll
      ><Icon name="grid" :size="16" />Every statistic</Link
    >
    <section v-for="g in groups" :key="g.key" class="st-rg">
      <h2 class="st-rgh"><Icon :name="g.icon" :size="14" />{{ g.label }}</h2>
      <Link
        v-for="s in g.stats"
        :key="s.slug"
        :href="href(s.slug)"
        class="st-rl"
        :class="{ on: stat === s.slug }"
        :aria-current="stat === s.slug ? 'page' : undefined"
        preserve-scroll
        >{{ s.label }}</Link
      >
    </section>
  </nav>
</template>
