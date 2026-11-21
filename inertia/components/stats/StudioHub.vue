<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import Icon from '../ui/Icon.vue'
import { championSplash } from '../../lib/assets.js'
import { CATEGORIES, STATS, emptyText, fmtMetric, type StatDef } from '../../lib/studio.js'

/**
 * The stats studio's hub: each category a tile under the art of the champion at the top of its
 * first statistic, that figure large, then the category's other statistics as links. Every
 * statistic is one click away.
 */
export interface Leader {
  champion: number
  name: string
  value: number
}

const props = defineProps<{
  /** The champion at the top of a statistic's list: undefined while it loads, null without one. */
  leader: (stat: StatDef) => Leader | null | undefined
  query: string
}>()
const href = (slug: string) => `/stats/${slug}${props.query ? `?${props.query}` : ''}`
/** The champion's art at about the width the tile shows it (the proxy resizes it once). */
const art = (champion: number, width: number) => `${championSplash(champion)}?w=${width}`
const tiles = computed(() =>
  CATEGORIES.map((c) => {
    const stats = STATS.filter((s) => s.category === c.key)
    const first = stats.find((s) => !s.wide) ?? stats[0]
    return { ...c, first, rest: stats.filter((s) => s !== first), lead: props.leader(first) }
  })
)
</script>

<template>
  <div class="st-tiles">
    <section v-for="t in tiles" :key="t.key" class="card st-tile" :aria-labelledby="`st-${t.key}`">
      <Link
        v-if="t.lead !== null"
        class="fr st-art"
        :href="href(t.first.slug)"
        tabindex="-1"
        aria-hidden="true"
      >
        <img
          v-if="t.lead"
          loading="lazy"
          decoding="async"
          fetchpriority="low"
          width="960"
          height="540"
          alt=""
          sizes="(max-width: 767px) calc(100vw - 48px), (max-width: 1023px) calc(50vw - 48px), 380px"
          :srcset="`${art(t.lead.champion, 480)} 480w, ${art(t.lead.champion, 960)} 960w`"
          :src="art(t.lead.champion, 480)"
        />
      </Link>
      <div class="st-tb">
        <h2 :id="`st-${t.key}`" class="h3 st-th">
          <Icon :name="t.icon" :size="16" tone="auto" />{{ t.label }}
        </h2>
        <Link class="st-top" :href="href(t.first.slug)">
          <span class="meta">{{ t.first.label }}</span>
          <span v-if="t.lead" class="st-lead">
            <b class="num">{{ fmtMetric(t.first.key, t.lead.value) }}</b>
            <span class="t2 ell">{{ t.lead.name }}</span>
          </span>
          <span v-else-if="t.lead === undefined" class="st-lead wait" aria-hidden="true"
            ><i
          /></span>
          <span v-else class="st-lead none">{{ emptyText(t.first) }}</span>
        </Link>
        <nav v-if="t.rest.length" class="st-links" :aria-label="t.label">
          <Link v-for="s in t.rest" :key="s.slug" :href="href(s.slug)">{{ s.label }}</Link>
        </nav>
      </div>
    </section>
  </div>
</template>
