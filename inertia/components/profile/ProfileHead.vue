<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import type { Position } from '@invadelol/ui/logic'
import Frame from '../ui/Frame.vue'
import Icon from '../ui/Icon.vue'
import { profileIcon } from '../../lib/assets.js'
import { SERVER } from '../../lib/board.js'
import { since } from '../../lib/ladders.js'
import type { Summoner } from '../../lib/types.js'

/**
 * The top of a profile (`.pf-head`): the icon with the level under it, the Riot ID, the role the
 * player mostly plays, the server and when the profile was last updated; share and update at the
 * right. A pro's account says so and leads to their page.
 */
defineProps<{
  summoner: Summoner
  roles: Position[]
  lastGameMs: number | null
  isSyncing: boolean
  syncMessage: string | null
  pro: { slug: string; name: string; team: { name: string } | null } | null
}>()
defineEmits<{ sync: []; share: [] }>()
const ROLE: Record<string, string> = {
  TOP: 'top',
  JUNGLE: 'jungle',
  MID: 'mid',
  ADC: 'bot',
  SUPPORT: 'support',
}
</script>

<template>
  <section class="pf-head">
    <div class="pf-icon">
      <Frame :src="profileIcon(summoner.profileIconId)" size="m" eager style="--cut: 14px" />
      <b v-if="summoner.summonerLevel">{{ summoner.summonerLevel }}</b>
    </div>
    <div class="col grow" style="gap: 8px; padding-bottom: 4px; min-width: 0">
      <div class="row pf-id" style="gap: 12px; align-items: baseline">
        <h1 class="h1 ell" style="font-size: 36px">{{ summoner.gameName }}</h1>
        <span class="h2 t3" style="font-weight: 500">#{{ summoner.tagLine }}</span>
        <Link v-if="pro" class="tagx pf-pro" :href="`/pro/${pro.slug}`"
          >Pro<template v-if="pro.team">, {{ pro.team.name }}</template></Link
        >
      </div>
      <div class="row meta pf-facts" style="gap: 16px">
        <span v-if="roles[0]" class="row" style="gap: 6px"
          ><RoleIcon :lane="roles[0]" :size="14" />Mostly {{ ROLE[roles[0]] }}</span
        >
        <span>{{ SERVER[summoner.platform] ?? summoner.platform }}</span>
        <span v-if="syncMessage">{{ syncMessage }}</span>
        <span v-else-if="lastGameMs">Last game {{ since(lastGameMs) }}</span>
      </div>
    </div>
    <div class="row pf-act" style="gap: 8px; padding-bottom: 4px">
      <button class="btn ico" type="button" aria-label="Share" @click="$emit('share')">
        <Icon name="share" />
      </button>
      <button class="btn pri" type="button" :disabled="isSyncing" @click="$emit('sync')">
        <Icon name="refresh" />{{ isSyncing ? 'Updating' : 'Update' }}
      </button>
    </div>
  </section>
</template>
