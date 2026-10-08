<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeftRight, RefreshCw, Share2 } from 'lucide-vue-next'
import { Link } from '@inertiajs/vue3'
import { championName, championSplash, profileIcon, regionLabel } from '../lib/assets.js'
import { plural, profilePath, timeAgo } from '../lib/format.js'
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

const path = computed(() => profilePath(props.summoner.gameName, props.summoner.tagLine))
</script>

<template>
  <!-- The identity panel at the top of the profile rail: who this is, and what you can do. -->
  <header class="card identity relative isolate">
    <!-- The main champion, faded in from the right: the player's own material, not wallpaper. -->
    <img
      v-if="mainChampion"
      :src="championSplash(mainChampion)"
      :alt="`${championName(mainChampion)} splash art`"
      class="splash pointer-events-none absolute right-0 top-0 -z-10 h-[150px] w-[88%] object-cover object-[60%_18%]"
    />

    <div class="p-5">
      <img
        :src="profileIcon(summoner.profileIconId)"
        :alt="summoner.gameName"
        width="72"
        height="72"
        class="thumb h-[72px] w-[72px] rounded-[8px]"
      />

      <h1
        class="mt-4 text-[22px] font-semibold leading-[28px] tracking-[-0.012em] text-ink [overflow-wrap:anywhere]"
        :title="`${summoner.gameName}#${summoner.tagLine}`"
      >
        {{ summoner.gameName
        }}<span class="ml-1 text-[16px] font-medium tracking-normal text-ink-3"
          >#{{ summoner.tagLine }}</span
        >
      </h1>

      <p class="num mt-1 text-[12.5px] leading-5 text-ink-3">
        <span>{{ regionLabel(summoner.platform) }}</span>
        <span v-if="summoner.summonerLevel">
          <span class="mx-1 text-ink-4">·</span>Level {{ summoner.summonerLevel }}
        </span>
        <br v-if="lastGameMs || viewCount" />
        <span v-if="lastGameMs">Last game {{ timeAgo(lastGameMs) }}</span>
        <span v-if="viewCount">
          <span v-if="lastGameMs" class="mx-1 text-ink-4">·</span>{{ plural(viewCount, 'view') }}
        </span>
      </p>

      <div class="mt-4 flex items-center gap-2">
        <button class="btn btn-primary flex-1" :disabled="isSyncing" @click="$emit('sync')">
          <RefreshCw :size="13" :class="{ 'animate-spin': isSyncing }" />
          {{ isSyncing ? 'Updating' : 'Update' }}
        </button>
        <button class="btn" @click="$emit('share')">
          <Share2 :size="13" />
          Share
        </button>
        <Link :href="`${path}/compare`" class="btn !px-0 w-[30px]" title="Compare">
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
/* ~22% opacity, slightly desaturated, faded out with straight masks to the left and below. */
.splash {
  opacity: 0.24;
  filter: saturate(0.75);
  mask-image:
    linear-gradient(to bottom, #000 30%, transparent 100%),
    linear-gradient(to left, #000 45%, transparent 100%);
  mask-composite: intersect;
}
</style>
