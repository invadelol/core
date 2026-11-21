<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import Frame from '../ui/Frame.vue'
import RankEmblem from '../ui/RankEmblem.vue'
import ProPic from '../pros/ProPic.vue'
import Logo from '../pros/Logo.vue'
import Flag from '../pros/Flag.vue'
import { champIcon, championName, championSplash, profileIcon } from '../../lib/assets.js'
import { laneOf, n, roleLabel, tierWord, winPct } from '../../lib/ladders.js'
import { countryName } from '../../lib/board.js'
import { ord, type PodiumPlayer } from './podium.js'

/**
 * A ladder's first three as a podium, second, first, third, the first raised. Each card stands
 * the player before the art of the champion they play most, then says what the table does not:
 * the gap to the others, their three champions with games and win rate, their record. A pro whose
 * photo is a cutout stands on the art; any other picture sits in a square.
 */
const props = defineProps<{ players: PodiumPlayer[] }>()
const first = computed(() => props.players[0] ?? null)
/** Podium order: second, first, third (whoever of them there is). */
const order = computed(() => {
  const [a, b, c] = props.players
  return [b, a, c].filter(Boolean) as PodiumPlayer[]
})
const gap = (p: PodiumPlayer) => {
  const lead = first.value?.lp
  if (lead === null || lead === undefined || p.lp === null) return tierWord(p.tier)
  if (p === first.value) {
    const second = props.players[1]?.lp
    return second !== null && second !== undefined
      ? `${n(p.lp - second)} LP ahead`
      : tierWord(p.tier)
  }
  return lead - p.lp ? `${n(lead - p.lp)} LP behind` : 'Level with 1st'
}
/** What a short pool says in the room the missing champions leave. */
const few = (p: PodiumPlayer) =>
  p.champions.length === 0
    ? `No ranked game stored ${p.span}`
    : p.champions.length === 1
      ? `Only ${championName(p.champions[0].champion)} ${p.span}`
      : `Two champions ${p.span}`
</script>

<template>
  <div class="pod" :style="{ '--n': order.length }">
    <Link
      v-for="p in order"
      :key="p.place"
      class="pod-c"
      :class="{ one: p === first }"
      :href="p.href"
    >
      <Frame
        class="pod-art"
        :src="p.champions[0] ? championSplash(p.champions[0].champion) : null"
        stage
        :eager="p === first"
      >
        <span v-if="p.pro && p.cutout" class="pod-pic stand"
          ><ProPic
            :slug="p.pro.slug"
            :photo="p.pro.photo"
            :team="p.pro.team"
            :size="240"
            position="50% 6%"
            :eager="p === first"
        /></span>
        <span v-else-if="p.pro" class="pod-pic box"
          ><ProPic
            :slug="p.pro.slug"
            :photo="p.pro.photo"
            :team="p.pro.team"
            :size="96"
            position="50% 8%"
        /></span>
        <span v-else class="pod-pic box"
          ><img :src="profileIcon(p.icon)" alt="" width="88" height="88"
        /></span>
        <span class="pod-no"
          >{{ p.place }}<sup>{{ ord(p.place) }}</sup></span
        >
      </Frame>
      <span class="pod-b">
        <span class="pod-nm"
          ><span class="ell">{{ p.name }}</span
          ><span v-if="p.tag" class="lb-tag">{{ p.tag }}</span></span
        >
        <span class="meta pod-mt">
          <span v-if="laneOf(p.role)" class="row"
            ><RoleIcon :lane="laneOf(p.role)!" :size="13" />{{ roleLabel(p.role) }}</span
          >
          <span v-if="p.pro?.team" class="row ell"
            ><Logo :team="p.pro.team.id" :size="14" class="pod-lg" /><span class="ell">{{
              p.pro.team.name
            }}</span></span
          >
          <Flag
            v-if="p.country"
            :code="p.country"
            :size="14"
            :title="countryName(p.country) ?? undefined"
          />
        </span>
        <span class="pod-lp">
          <RankEmblem :tier="p.tier" :size="32" />
          <span class="col" style="min-width: 0">
            <span class="fg-m num"
              >{{ p.lp === null ? '-' : n(p.lp) }}<span class="u">LP</span></span
            >
            <span class="meta">{{ gap(p) }}</span>
          </span>
        </span>
        <span class="pod-pool">
          <span v-for="c in p.champions.slice(0, 3)" :key="c.champion" class="pod-ch">
            <Frame :src="champIcon(c.champion)" :width="24" size="xs" />
            <span class="ell grow">{{ championName(c.champion) }}</span>
            <span class="meta num">{{ n(c.games) }} {{ c.games === 1 ? 'game' : 'games' }}</span>
            <span v-if="c.wins !== undefined" class="h5 num pod-wr">{{
              winPct(c.wins, c.games)
            }}</span>
          </span>
          <span v-if="p.champions.length < 3" class="meta pod-few">{{ few(p) }}</span>
        </span>
        <span class="meta pod-ft">
          <template v-if="p.record && p.record.games"
            >{{ winPct(p.record.wins, p.record.games) }} of {{ n(p.record.games) }}
            {{ p.record.games === 1 ? 'game' : 'games' }} {{ p.record.span }}</template
          ><template v-else>No record {{ p.span }}</template
          ><span v-if="p.hot" class="vi">, on a win streak</span>
        </span>
      </span>
    </Link>
  </div>
</template>
