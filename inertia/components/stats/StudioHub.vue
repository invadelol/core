<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import Icon from '../ui/Icon.vue'
import { itemUrl, perkUrl, spellUrl } from '../../lib/champions.js'
import {
  CATEGORIES,
  STATS,
  emptyText,
  fmtMetric,
  type CategoryKey,
  type StatDef,
} from '../../lib/studio.js'

/**
 * The stats studio's hub: each category a tile under League's own objects for what it counts
 * (Riot's in-game art: items, spells, runes, monsters, pings), then the champion at the top of
 * its first statistic with that figure large, then the category's other statistics as links.
 * Every statistic is one click away.
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

/**
 * A cover's objects: square game art in a hairline ring (`sq`), a glyph drawn on transparency at
 * its own shape (`glyph`), or a ping, small as the game draws it (`ping`).
 */
type Obj = { src: string; name: string; kind: 'sq' | 'glyph' | 'ping' }
const sq = (src: string, name: string): Obj => ({ src, name, kind: 'sq' })
const glyph = (src: string, name: string): Obj => ({ src, name, kind: 'glyph' })
const ping = (file: string, name: string): Obj => ({
  src: `/game-objects/${file}.png`,
  name,
  kind: 'ping',
})
const art = (file: string) => `/game-objects/${file}.webp`
const COVERS: Record<CategoryKey, Obj[]> = {
  results: [glyph(art('victory'), 'Victory'), glyph(art('defeat'), 'Defeat')],
  combat: [
    glyph(perkUrl(8112), 'Electrocute'),
    glyph(perkUrl(8010), 'Conqueror'),
    glyph(perkUrl(8128), 'Dark Harvest'),
  ],
  damage: [
    sq(itemUrl(3031), 'Infinity Edge'),
    sq(itemUrl(3089), "Rabadon's Deathcap"),
    sq(itemUrl(6653), "Liandry's Torment"),
  ],
  laning: [
    sq(art('minion-melee'), 'Melee minion'),
    sq(art('minion-cannon'), 'Cannon minion'),
    sq(art('blue-sentinel'), 'Blue Sentinel'),
  ],
  objectives: [
    sq(art('infernal-drake'), 'Infernal Drake'),
    sq(art('baron-nashor'), 'Baron Nashor'),
    sq(art('voidgrub'), 'Voidgrub'),
  ],
  vision: [
    sq(itemUrl(3340), 'Stealth Ward'),
    sq(itemUrl(2055), 'Control Ward'),
    sq(itemUrl(3364), 'Oracle Lens'),
  ],
  length: [
    sq(itemUrl(2420), 'Stopwatch'),
    sq(itemUrl(3157), "Zhonya's Hourglass"),
    sq(art('elder-dragon'), 'Elder Dragon'),
  ],
  pings: [
    ping('ping-missing', 'Enemy missing'),
    ping('ping-on-my-way', 'On my way'),
    ping('ping-retreat', 'Retreat'),
    ping('ping-all-in', 'All in'),
  ],
  spells: [sq(spellUrl(4), 'Flash'), sq(spellUrl(14), 'Ignite'), sq(spellUrl(12), 'Teleport')],
}
const tiles = computed(() =>
  CATEGORIES.map((c) => {
    const stats = STATS.filter((s) => s.category === c.key)
    const first = stats.find((s) => !s.wide) ?? stats[0]
    return {
      ...c,
      first,
      rest: stats.filter((s) => s !== first),
      lead: props.leader(first),
      cover: COVERS[c.key] ?? [],
    }
  })
)
</script>

<template>
  <div class="st-tiles">
    <section v-for="t in tiles" :key="t.key" class="card st-tile" :aria-labelledby="`st-${t.key}`">
      <Link
        v-if="t.cover.length"
        class="fr st-art"
        :href="href(t.first.slug)"
        tabindex="-1"
        aria-hidden="true"
      >
        <span class="st-objs">
          <img
            v-for="o in t.cover"
            :key="o.src"
            :class="['st-o', `st-o-${o.kind}`]"
            :src="o.src"
            :title="o.name"
            alt=""
            loading="lazy"
            decoding="async"
          />
        </span>
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
