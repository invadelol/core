<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import Frame from '../../ui/Frame.vue'
import RankEmblem from '../../ui/RankEmblem.vue'
import ProPic from '../../pros/ProPic.vue'
import Logo from '../../pros/Logo.vue'
import Flag from '../../pros/Flag.vue'
import { champIcon, championName, championSplash, profileIcon } from '../../../lib/assets.js'
import { laneOf, n, roleLabel, tierWord, winPct } from '../../../lib/ladders.js'
import { ord, type TopPlayer } from './types.js'

/**
 * The ladder's first three as a podium, second, first, third, the first raised: each before the
 * art of the champion they play most, with what the table does not say: their three champions
 * with games and win rate, their record, a win streak.
 */
const props = defineProps<{ players: TopPlayer[] }>()
const order = computed(() => {
  const [a, b, c] = props.players
  return [b, a, c].filter(Boolean) as TopPlayer[]
})
const lead = computed(() => props.players[0]?.lp ?? null)
const gap = (p: TopPlayer) => {
  if (lead.value === null || p.lp === null) return ''
  if (p.place === props.players[0]?.place) {
    const second = props.players[1]?.lp
    return second !== null && second !== undefined ? `${n(p.lp - second)} LP ahead` : ''
  }
  return `${n(lead.value - p.lp)} LP behind`
}
</script>

<template>
  <div class="tp-pod">
    <Link
      v-for="p in order"
      :key="p.place"
      class="tp-card"
      :class="{ one: p.place === players[0]?.place }"
      :href="p.href"
    >
      <Frame
        class="tp-art"
        :src="p.champions[0] ? championSplash(p.champions[0].champion) : null"
        stage
        :eager="p.place === players[0]?.place"
      >
        <span v-if="p.pro" class="tp-pic pro"
          ><ProPic
            :slug="p.pro.slug"
            :photo="p.pro.photo"
            :team="p.pro.team"
            :size="144"
            position="50% 6%"
        /></span>
        <span v-else class="tp-pic"><img :src="profileIcon(p.icon)" alt="" /></span>
        <span class="tp-no"
          >{{ p.place }}<sup>{{ ord(p.place) }}</sup></span
        >
      </Frame>
      <span class="tp-body">
        <span class="tp-nm ell"
          ><span :data-riot="p.riot ? '' : undefined">{{ p.name }}</span
          ><span v-if="p.tag && p.riot" class="lb-tag" data-riot-tag>{{ p.tag }}</span></span
        >
        <span class="meta row tp-mt"
          ><RoleIcon v-if="laneOf(p.role)" :lane="laneOf(p.role)!" :size="13" /><span
            v-if="laneOf(p.role)"
            >{{ roleLabel(p.role) }}</span
          ><template v-if="p.pro?.team"
            ><Logo :team="p.pro.team.id" :size="14" class="tp-lg" /><span class="ell">{{
              p.pro.team.name
            }}</span></template
          ><Flag v-if="p.country" :code="p.country" :size="14"
        /></span>
        <span class="tp-lp">
          <RankEmblem :tier="p.tier" :size="30" />
          <span class="col" style="min-width: 0">
            <span class="fg-m num"
              >{{ p.lp === null ? '-' : n(p.lp) }}<span class="u">LP</span></span
            >
            <span class="meta">{{ gap(p) || tierWord(p.tier) }}</span>
          </span>
        </span>
        <span class="tp-pool">
          <span v-for="c in p.champions.slice(0, 3)" :key="c.champion" class="tp-ch">
            <Frame :src="champIcon(c.champion)" :width="24" size="xs" />
            <span class="ell grow">{{ championName(c.champion) }}</span>
            <span class="meta num">{{ c.games }} {{ c.games === 1 ? 'game' : 'games' }}</span>
            <span v-if="c.wins !== undefined" class="h5 num tp-wr">{{
              winPct(c.wins, c.games)
            }}</span>
          </span>
          <span v-if="!p.champions.length" class="meta">No stored game lately</span>
        </span>
        <span class="meta tp-ft">
          <template v-if="p.record"
            >{{ winPct(p.record.wins, p.record.games) }} of {{ n(p.record.games) }}
            {{ p.record.games === 1 ? 'game' : 'games' }}, {{ p.record.span }}</template
          >
          <span v-if="p.hot" class="vi">, on a win streak</span>
        </span>
      </span>
    </Link>
  </div>
</template>
