<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import type { Position } from '@invadelol/ui/logic'
import Icon from '../ui/Icon.vue'
import { championSplash, profileIcon } from '../../lib/assets.js'
import { SERVER } from '../../lib/board.js'
import { regionFlag } from '../../lib/flags.js'
import { since } from '../../lib/ladders.js'
import type { Summoner } from '../../lib/types.js'

/**
 * The identity sheet at the top of the profile rail (`.pl-id`): the icon with the level under it,
 * the Riot ID with a copy button, the role the player mostly plays, the server and a Pro tag, when
 * the last game was and how many times the profile was opened, then Update, Share and Compare. The
 * main champion's centred art fades into the top right corner.
 */
const props = defineProps<{
  summoner: Summoner
  roles: Position[]
  lastGameMs: number | null
  viewCount: number | null
  isSyncing: boolean
  syncMessage: string | null
  pro: { slug: string; name: string; team: { name: string } | null } | null
  champion: number | undefined
  compareHref: string
}>()
defineEmits<{ sync: []; share: [] }>()

const ROLE: Record<string, string> = {
  TOP: 'top',
  JUNGLE: 'jungle',
  MID: 'mid',
  ADC: 'bot',
  SUPPORT: 'support',
}

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
async function copy() {
  try {
    await navigator.clipboard.writeText(`${props.summoner.gameName}#${props.summoner.tagLine}`)
    copied.value = true
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (copied.value = false), 1600)
  } catch {
    /* The clipboard can be refused; the name is still there to select. */
  }
}
onBeforeUnmount(() => clearTimeout(copiedTimer))

const views = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'view' : 'views'}`
</script>

<template>
  <section class="card lit pl-id">
    <div v-if="champion" class="pl-art" aria-hidden="true">
      <img :src="championSplash(champion)" alt="" />
    </div>
    <div class="pl-ic">
      <img :src="profileIcon(summoner.profileIconId)" alt="" width="72" height="72" />
      <b v-if="summoner.summonerLevel" class="num">{{ summoner.summonerLevel }}</b>
    </div>
    <div class="pl-name">
      <h1 class="ell">{{ summoner.gameName }}</h1>
      <span class="pl-tagl">#{{ summoner.tagLine }}</span>
      <button
        type="button"
        class="pl-copy"
        :aria-label="copied ? 'Copied' : 'Copy the Riot ID'"
        :title="copied ? 'Copied' : 'Copy'"
        @click="copy"
      >
        <Icon :name="copied ? 'check' : 'copy'" :size="14" />
      </button>
    </div>
    <div class="pl-tags">
      <span v-if="roles[0]" class="pl-tag"
        ><RoleIcon :lane="roles[0]" :size="14" />Mostly {{ ROLE[roles[0]] }}</span
      >
      <span class="pl-tag"><img class="pl-flag" :src="regionFlag(summoner.platform)" alt="" />{{ SERVER[summoner.platform] ?? summoner.platform }}</span>
      <Link v-if="pro" class="pl-tag pro" :href="`/pro/${pro.slug}`"
        >Pro<template v-if="pro.team">, {{ pro.team.name }}</template></Link
      >
    </div>
    <p class="meta pl-last" role="status">
      <template v-if="syncMessage">{{ syncMessage }}</template>
      <template v-else>
        <template v-if="lastGameMs">Last game {{ since(lastGameMs) }}</template>
        <template v-if="lastGameMs && viewCount"> · </template>
        <template v-if="viewCount">{{ views(viewCount) }}</template>
      </template>
    </p>
    <div class="pl-acts">
      <button class="btn pri" type="button" :disabled="isSyncing" @click="$emit('sync')">
        <Icon name="refresh" :class="{ 'pl-spin': isSyncing }" />{{
          isSyncing ? 'Updating' : 'Update'
        }}
      </button>
      <button class="btn" type="button" @click="$emit('share')"><Icon name="share" />Share</button>
      <Link class="btn ico" :href="compareHref" aria-label="Compare" title="Compare" preserve-scroll
        ><Icon name="compare"
      /></Link>
    </div>
  </section>
</template>
