<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import CardHead from '../ui/CardHead.vue'
import { CATEGORIES, METRICS, STATS, fmtMetric, type StatDef } from '../../lib/studio.js'

/**
 * The studio's hub: each category a card, each statistic a row with the champion at the top of
 * its list and its figure, the row leading to the statistic's page.
 */
export interface Leader {
  champion: number
  name: string
  value: number
}

const props = defineProps<{
  /** The champion at the top of a statistic's list; undefined while its figures load. */
  leader: (stat: StatDef) => Leader | null | undefined
  query: string
}>()
const href = (slug: string) => `/stats/${slug}${props.query ? `?${props.query}` : ''}`
const groups = CATEGORIES.map((c) => ({
  ...c,
  stats: STATS.filter((s) => s.category === c.key && !s.wide),
}))
</script>

<template>
  <div class="st-hub">
    <section v-for="g in groups" :key="g.key" class="card st-cat">
      <CardHead :title="g.label" :icon="g.icon" />
      <Link v-for="s in g.stats" :key="s.slug" class="st-hr" :href="href(s.slug)">
        <span class="h5 st-hl">{{ s.label }}</span>
        <template v-if="leader(s)">
          <span class="st-ld">
            <img
              class="pic xs"
              loading="lazy"
              decoding="async"
              width="22"
              height="22"
              alt=""
              :src="`/cdn/champion/${leader(s)!.champion}.png`"
            />
            <span class="ell">{{ leader(s)!.name }}</span>
          </span>
          <span class="num st-hv">{{ fmtMetric(s.key, leader(s)!.value) }}</span>
        </template>
        <span v-else-if="leader(s) === undefined" class="st-ld st-wait" aria-hidden="true"
          ><i /><i
        /></span>
        <span v-else class="st-ld meta">{{
          s.key === 'change'
            ? 'No earlier patch'
            : METRICS[s.key].source === 'lane'
              ? 'Not counted yet'
              : 'Too few games'
        }}</span>
      </Link>
    </section>
  </div>
</template>
