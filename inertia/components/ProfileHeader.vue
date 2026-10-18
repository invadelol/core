<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { ArrowLeftRight, Check, Copy, RefreshCw, Share2 } from 'lucide-vue-next'
import { Link } from '@inertiajs/vue3'
import { Icon, StarButton, useFormat } from '@invadelol/ui'
import { useAccount } from '../lib/account.js'
import ProfileSwitcher from './account/ProfileSwitcher.vue'
import { championName, championSplash, profileIcon, regionLabel } from '../lib/assets.js'
import { profilePath } from '../lib/format.js'
import type { Summoner } from '../lib/types.js'

const props = defineProps<{
  summoner: Summoner
  viewCount: number | null
  isSyncing: boolean
  syncMessage: string | null
  lastGameMs: number | null
  mainChampion?: number
}>()

defineEmits<{ sync: []; share: [] }>()

const { ago } = useFormat()
/* Signed in: favorite this player, or see that it is one of your own accounts. */
const { state: accountState, viewer, favorite } = useAccount()
const saved = computed(() =>
  accountState.value.favorites.some((f) => f.puuid === props.summoner.puuid)
)
const owned = computed(() =>
  accountState.value.accounts.some((a) => a.puuid === props.summoner.puuid)
)
const isMain = computed(() => accountState.value.mainPuuid === props.summoner.puuid)
const path = computed(() => profilePath(props.summoner.gameName, props.summoner.tagLine))

/** The Riot ID as the client's friend search takes it. */
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
async function copyRiotId() {
  try {
    await navigator.clipboard.writeText(`${props.summoner.gameName}#${props.summoner.tagLine}`)
    copied.value = true
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (copied.value = false), 1600)
  } catch {
    /* No clipboard (insecure context, denied): the name stays selectable. */
  }
}
onBeforeUnmount(() => clearTimeout(copiedTimer))
</script>

<template>
  <!-- The identity panel at the top of the profile rail: who this is, and what you can do. -->
  <header class="iv-panel identity relative isolate">
    <!-- The main champion, faded in from the right: the player's own material, not wallpaper. -->
    <img
      v-if="mainChampion"
      :src="championSplash(mainChampion)"
      :alt="`${championName(mainChampion)} splash art`"
      class="splash pointer-events-none absolute right-0 top-0 -z-10 h-[150px] w-[88%] object-cover object-[60%_18%]"
    />

    <div class="p-5">
      <!-- The avatar and the name lead back to Overview from any section, like the side menu. -->
      <div class="flex items-start justify-between gap-3">
        <Link :href="path" class="block w-fit" preserve-state preserve-scroll>
          <img
            :src="profileIcon(summoner.profileIconId)"
            :alt="summoner.gameName"
            width="72"
            height="72"
            class="thumb h-[72px] w-[72px] rounded-[8px]"
          />
        </Link>
        <ProfileSwitcher v-if="viewer" :active="summoner.puuid" />
      </div>

      <h1
        class="mt-4 flex flex-wrap items-center gap-x-1 text-[22px] font-semibold leading-[28px] tracking-[-0.012em] text-ink [overflow-wrap:anywhere]"
        :title="`${summoner.gameName}#${summoner.tagLine}`"
      >
        <Link :href="path" class="name" preserve-state preserve-scroll
          >{{ summoner.gameName
          }}<span class="ml-1 text-[16px] font-medium tracking-normal text-ink-3"
            >#{{ summoner.tagLine }}</span
          ></Link
        ><button
          type="button"
          class="iv-btn ghost sm icon-only"
          :title="copied ? 'Copied' : 'Copy Riot ID'"
          :aria-label="copied ? 'Copied' : 'Copy Riot ID'"
          @click="copyRiotId"
        >
          <Check v-if="copied" :size="13" />
          <Copy v-else :size="13" />
        </button>
        <span v-if="copied" class="text-[12px] font-medium tracking-normal text-ink-3" role="status"
          >Copied</span
        >
      </h1>

      <p class="num mt-1 text-[12.5px] leading-5 text-ink-3">
        <span>{{ regionLabel(summoner.platform) }}</span>
        <span v-if="summoner.summonerLevel">
          <span class="mx-1 text-ink-4">·</span>Level {{ summoner.summonerLevel }}
        </span>
        <br v-if="lastGameMs || viewCount" />
        <span v-if="lastGameMs">Last game {{ ago(lastGameMs) }}</span>
        <span v-if="viewCount">
          <span v-if="lastGameMs" class="mx-1 text-ink-4">·</span>{{ viewCount }}
          {{ viewCount === 1 ? 'view' : 'views' }}
        </span>
      </p>
      <p v-if="owned" class="identity-owned">
        <Icon :name="isMain ? 'crown' : 'shield'" :size="12" />{{
          isMain ? 'Your main account' : 'One of your accounts'
        }}
      </p>

      <div class="mt-4 flex items-center gap-2">
        <button
          type="button"
          class="iv-btn primary flex-1"
          :disabled="isSyncing"
          @click="$emit('sync')"
        >
          <RefreshCw :size="13" :class="{ 'animate-spin': isSyncing }" />
          {{ isSyncing ? 'Updating' : 'Update' }}
        </button>
        <button type="button" class="iv-btn" @click="$emit('share')">
          <Share2 :size="13" />
          Share
        </button>
        <Link :href="`${path}/compare`" class="iv-btn icon-only" title="Compare">
          <ArrowLeftRight :size="14" />
          <span class="sr-only">Compare</span>
        </Link>
        <StarButton
          v-if="!owned"
          :saved="saved"
          :label="summoner.gameName"
          @toggle="favorite(summoner)"
        />
      </div>
      <p v-if="syncMessage" class="mt-2.5 text-[12px] text-ink-2" role="status">
        {{ syncMessage }}
      </p>
    </div>
  </header>
</template>

<style scoped>
.name {
  color: inherit;
  text-decoration: none;
}

.name:hover {
  text-decoration: underline;
  text-decoration-color: var(--line-3);
  text-underline-offset: 4px;
}

/* Shown on the visitor's own accounts (Invade account). */
.identity-owned {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding: 3px 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--brand-hi);
  background: var(--brand-a08);
  border-radius: var(--r-sm);
}

/* ~24% opacity, slightly desaturated, faded out with straight masks to the left and below. */
.splash {
  border-top-right-radius: var(--r-md);
  opacity: 0.24;
  filter: saturate(0.75);
  mask-image:
    linear-gradient(to bottom, #000 30%, transparent 100%),
    linear-gradient(to left, #000 45%, transparent 100%);
  mask-composite: intersect;
}
</style>
