<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { championName } from '../../lib/assets.js'
import { champIconUrl, pct, thousands, type Matchup } from '../../lib/champions.js'

/** Champions with a win rate (lane opponents, teammates); blue or red against 50 % when `polar`. */
defineProps<{
  rows: Matchup[]
  title?: string
  polar?: boolean
  note?: string
  href?: (champion: number) => string | null
}>()
</script>

<template>
  <div>
    <span v-if="title" class="cs-h">{{ title }}</span>
    <component
      :is="href && href(r.champion) ? Link : 'div'"
      v-for="r in rows"
      :key="r.champion"
      :href="href ? (href(r.champion) ?? undefined) : undefined"
      class="cs-ch"
      :class="{ low: r.level < 1 }"
    >
      <img :src="champIconUrl(r.champion)" alt="" loading="lazy" />
      <span class="nm"
        >{{ championName(r.champion)
        }}<small>{{ thousands(r.games) }} {{ note ?? 'games' }}</small></span
      >
      <span class="v" :class="polar ? (r.win >= 0.5 ? 'cs-up' : 'cs-down') : ''">{{
        pct(r.win)
      }}</span>
    </component>
  </div>
</template>
