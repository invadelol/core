<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Link } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import type { Position } from '@invadelol/ui/logic'
import Icon from '../ui/Icon.vue'
import { championSplash, profileIcon } from '../../lib/assets.js'
import { SERVER } from '../../lib/board.js'
import { regionFlag } from '../../lib/flags.js'
import { since } from '../../lib/ladders.js'
import type { Summoner } from '../../lib/types.js'
import { useViewer } from '../../lib/account.js'
import '../../css/account.css'

/**
 * The identity sheet at the top of the profile rail (`.pl-id`): the icon with the level under it,
 * the Riot ID with a copy button and the favorite star, the role the player mostly plays, the server and a Pro tag, when
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
  syncFailed?: boolean
  pro: { slug: string; name: string; team: { name: string } | null } | null
  champion: number | undefined
  compareHref: string
  /** In the signed-in visitor's favorites when the page was drawn. */
  favorite?: boolean
}>()
defineEmits<{ sync: []; share: [] }>()

const ROLE: Record<string, string> = {
  TOP: 'top',
  JUNGLE: 'jungle',
  MID: 'mid',
  ADC: 'bot',
  SUPPORT: 'support',
}

/**
 * The Update button is a gauge. Riot gives no progress, so it is simulated the way a download bar
 * moves: uneven steps every few hundred ms, quick at first, slower as it nears 90%. When the update
 * is back it keeps going for at least `MIN_MS` (a fast update does not just blink), fills to the
 * end and says "Updated"; when the update failed it simply empties (the line under the name says
 * why).
 */
const MIN_MS = 1300
const phase = ref<'idle' | 'run' | 'done'>('idle')
const progress = ref(0)
let started = 0
let back = false
let tick: ReturnType<typeof setTimeout> | undefined
let doneTimer: ReturnType<typeof setTimeout> | undefined
const still = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
function trickle() {
  const room = 0.92 - progress.value
  // once the update is back, bigger steps closer together, so the end is not a wait
  progress.value += room * (back ? 0.3 + Math.random() * 0.25 : 0.1 + Math.random() * 0.22)
  tick = setTimeout(trickle, back ? 120 + Math.random() * 90 : 170 + Math.random() * 260)
}
function stop() {
  clearTimeout(tick)
  clearTimeout(doneTimer)
}
watch(
  () => props.isSyncing,
  (on) => {
    if (on) {
      stop()
      back = false
      started = Date.now()
      progress.value = 0
      phase.value = 'run'
      if (still()) progress.value = 0.5
      else
        requestAnimationFrame(() => {
          progress.value = 0.05 + Math.random() * 0.05
          tick = setTimeout(trickle, 200)
        })
      return
    }
    if (phase.value !== 'run') return
    if (props.syncFailed) {
      stop()
      phase.value = 'idle'
      progress.value = 0
      return
    }
    back = true
    clearTimeout(doneTimer)
    doneTimer = setTimeout(
      () => {
        clearTimeout(tick)
        progress.value = 1
        doneTimer = setTimeout(() => {
          phase.value = 'done'
          doneTimer = setTimeout(() => {
            phase.value = 'idle'
            progress.value = 0
          }, 900)
        }, 280)
      },
      Math.max(0, MIN_MS - (Date.now() - started))
    )
  }
)
// another profile opened mid-update: the bar belongs to the one left, start clean
watch(
  () => props.summoner.puuid,
  () => {
    stop()
    phase.value = 'idle'
    progress.value = 0
  }
)
onBeforeUnmount(stop)

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

/** The star: this player in the signed-in person's favorites (a visitor is sent to sign in). */
const { isFavorite, toggleFavorite } = useViewer()
const favorite = computed(() => isFavorite(props.summoner.puuid, props.favorite ?? false))
function star() {
  toggleFavorite(props.summoner.puuid, props.favorite ?? false).catch(() => {})
}
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
      <button
        type="button"
        class="pl-copy ac-fav"
        :class="{ on: favorite }"
        :aria-pressed="favorite"
        :aria-label="favorite ? 'Remove from favorites' : 'Add to favorites'"
        :title="favorite ? 'In your favorites' : 'Add to favorites'"
        data-track="profile_favorite"
        @click="star"
      >
        <Icon name="star" :size="15" />
      </button>
    </div>
    <div class="pl-tags">
      <span v-if="roles[0]" class="pl-tag"
        ><RoleIcon :lane="roles[0]" :size="14" />Mostly {{ ROLE[roles[0]] }}</span
      >
      <span class="pl-tag"
        ><img class="pl-flag" :src="regionFlag(summoner.platform)" alt="" />{{
          SERVER[summoner.platform] ?? summoner.platform
        }}</span
      >
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
      <button
        class="btn pri pl-upd"
        :class="{ 'is-run': phase === 'run', 'is-done': phase === 'done' }"
        :style="{ '--p': progress }"
        type="button"
        :disabled="isSyncing || phase !== 'idle'"
        :aria-busy="phase === 'run'"
        @click="$emit('sync')"
      >
        <Icon v-if="phase === 'idle'" name="refresh" /><Icon v-else-if="phase === 'done'" name="check" /><span>{{
          phase === 'run' ? 'Updating' : phase === 'done' ? 'Updated' : 'Update'
        }}</span>
      </button>
      <button class="btn" type="button" @click="$emit('share')"><Icon name="share" />Share</button>
      <Link class="btn ico" :href="compareHref" aria-label="Compare" title="Compare" preserve-scroll
        ><Icon name="compare"
      /></Link>
    </div>
  </section>
</template>
