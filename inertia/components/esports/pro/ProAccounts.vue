<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import Icon from '../../ui/Icon.vue'
import CardHead from '../../ui/CardHead.vue'
import RankEmblem from '../../ui/RankEmblem.vue'
import { profileIcon } from '../../../lib/assets.js'
import { profilePath } from '../../../lib/format.js'
import { n, rankValue, rankWords } from '../../../lib/ladders.js'
import { APEX, PLATFORM, type ProAccount } from './types.js'

/**
 * A pro's solo queue accounts, best rank first, one line each: icon, Riot ID, server and record,
 * rank and LP. `limit` lines show first; `bare` drops the card (inside another sheet).
 */
const props = withDefaults(
  defineProps<{ accounts: ProAccount[]; limit?: number; bare?: boolean }>(),
  { limit: 4, bare: false }
)
const sorted = computed(() =>
  [...props.accounts].sort(
    (a, b) =>
      (rankValue(b.tier, b.division, b.lp) ?? -1) - (rankValue(a.tier, a.division, a.lp) ?? -1)
  )
)
const all = ref(false)
const rows = computed(() => (all.value ? sorted.value : sorted.value.slice(0, props.limit)))
/** Short enough for a narrow column: the LP of an apex rank, the division of any other. */
const rank = (a: ProAccount) =>
  a.tier
    ? APEX.includes(a.tier)
      ? `${n(a.lp ?? 0)} LP`
      : rankWords(a.tier, a.division)
    : 'Unranked'
const full = (a: ProAccount) =>
  a.tier ? `${rankWords(a.tier, a.division)}${a.lp !== null ? `, ${n(a.lp)} LP` : ''}` : 'Unranked'
</script>

<template>
  <component :is="bare ? 'div' : 'section'" :class="bare ? 'pv-acc bare' : 'card pv-acc'">
    <CardHead title="Accounts" icon="user" :meta="String(accounts.length)" />
    <Link v-for="a in rows" :key="a.id" class="pv-ac" :href="profilePath(a.gameName, a.tagLine)">
      <img
        class="pv-ic"
        loading="lazy"
        decoding="async"
        alt=""
        width="28"
        height="28"
        :src="profileIcon(a.icon)"
      />
      <span class="col" style="min-width: 0">
        <span class="h5 ell"
          >{{ a.gameName }}<span class="meta"> #{{ a.tagLine }}</span></span
        >
        <span class="meta ell"
          >{{ PLATFORM[a.platform] ?? a.platform
          }}{{
            a.wins !== null && a.losses !== null && a.wins + a.losses > 0
              ? `, ${a.wins}W ${a.losses}L`
              : ''
          }}</span
        >
      </span>
      <span class="pv-rk" :class="{ un: !a.tier }" :title="full(a)"
        ><RankEmblem v-if="a.tier" :tier="a.tier" :size="20" />{{ rank(a) }}</span
      >
    </Link>
    <button
      v-if="!all && sorted.length > rows.length"
      type="button"
      class="more pv-more"
      @click="all = true"
    >
      {{ sorted.length - rows.length }} more<Icon name="chev" />
    </button>
  </component>
</template>
