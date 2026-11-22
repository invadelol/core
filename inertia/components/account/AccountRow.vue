<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import RankEmblem from '../ui/RankEmblem.vue'
import { profileIcon } from '../../lib/assets.js'
import { SERVER, tierColor, tierName } from '../../lib/board.js'
import { profilePath } from '../../lib/format.js'
import type { AccountProfile } from '../../lib/account_types.js'

/**
 * One League account in an account's lists: its icon and Riot ID (a link to the profile), its
 * server, its Solo/Duo rank, and the row's own controls at the end (slot).
 */
const props = defineProps<{ profile: AccountProfile }>()

const APEX = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER'])
const rank = computed(() => {
  const p = props.profile
  if (!p.tier) return 'Unranked'
  return `${tierName(p.tier)}${APEX.has(p.tier) || !p.division ? '' : ` ${p.division}`}`
})
</script>

<template>
  <div class="ac-row">
    <Link class="ac-who" :href="profilePath(profile.gameName, profile.tagLine)" prefetch>
      <img :src="profileIcon(profile.profileIconId)" alt="" width="32" height="32" loading="lazy" />
      <span class="ac-name">
        <b class="ell"
          >{{ profile.gameName }}<small>#{{ profile.tagLine }}</small></b
        >
        <span class="ac-sv">{{ SERVER[profile.platform] ?? profile.platform }}</span>
      </span>
    </Link>
    <span class="ac-rank">
      <RankEmblem :tier="profile.tier" :size="20" />
      <span :style="tierColor(profile.tier)">{{ rank }}</span>
      <span v-if="profile.tier && profile.lp !== null" class="ac-lp num">{{ profile.lp }} LP</span>
    </span>
    <span class="ac-end"><slot /></span>
  </div>
</template>
