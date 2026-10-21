<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { ArrowLeftRight, Check, Copy, RefreshCw, Share2 } from 'lucide-vue-next'
import { Link } from '@inertiajs/vue3'
import { useFormat } from '@invadelol/ui'
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
  /** Set when the account belongs to a professional player. */
  pro?: {
    slug: string
    name: string
    staff: boolean
    role: string | null
    team: { id: string; slug: string; name: string; shortName: string | null } | null
  } | null
}>()

defineEmits<{ sync: []; share: [] }>()

const { ago } = useFormat()
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
  <header class="iv-panel identity relative isolate overflow-hidden">
    <!-- The main champion, faded in from the right: the player's own material, not wallpaper. -->
    <img
      v-if="mainChampion"
      :src="championSplash(mainChampion)"
      :alt="`${championName(mainChampion)} splash art`"
      class="splash pointer-events-none absolute right-0 top-0 -z-10 h-[150px] w-[88%] object-cover object-[60%_18%]"
    />

    <div class="p-5">
      <!-- The avatar and the name lead back to Overview from any section, like the side menu. -->
      <Link :href="path" class="block w-fit" preserve-state preserve-scroll>
        <img
          :src="profileIcon(summoner.profileIconId)"
          :alt="summoner.gameName"
          width="72"
          height="72"
          class="thumb h-[72px] w-[72px] rounded-[8px]"
        />
      </Link>

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

      <Link
        v-if="pro"
        :href="`/pro/${pro.slug}`"
        class="pro-tag mt-2"
        :title="`${pro.name}${pro.team ? `, ${pro.team.name}` : ''}`"
      >
        <span class="pro-word">{{ pro.staff ? 'Staff' : 'Pro' }}</span>
        <span class="truncate"
          >{{ pro.name
          }}<template v-if="pro.team"> · {{ pro.team.shortName || pro.team.name }}</template></span
        >
      </Link>

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
      </div>
      <p v-if="syncMessage" class="mt-2.5 text-[12px] text-ink-2" role="status">
        {{ syncMessage }}
      </p>
    </div>
  </header>
</template>

<style scoped>
.pro-tag {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  max-width: 100%;
  height: 24px;
  padding: 0 9px 0 3px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-1);
  background: var(--btn);
  border-radius: var(--r-sm);
  box-shadow: var(--btn-shadow);
  transition: background-color var(--t-fast);
}

.pro-tag:hover {
  background: var(--btn-hover);
}

.pro-word {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--text-1);
  background: var(--surface-4);
  border-radius: var(--r-xs);
}

.name {
  color: inherit;
  text-decoration: none;
}

.name:hover {
  text-decoration: underline;
  text-decoration-color: var(--line-3);
  text-underline-offset: 4px;
}

/* ~24% opacity, slightly desaturated, faded out with straight masks to the left and below. */
.splash {
  opacity: 0.24;
  filter: saturate(0.75);
  mask-image:
    linear-gradient(to bottom, #000 30%, transparent 100%),
    linear-gradient(to left, #000 45%, transparent 100%);
  mask-composite: intersect;
}
</style>
