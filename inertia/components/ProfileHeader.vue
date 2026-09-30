<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeftRight, Eye, RefreshCw, Share2 } from 'lucide-vue-next'
import { Link } from '@inertiajs/vue3'
import { championName, championSplash, profileIcon } from '../lib/assets.js'
import { profilePath, timeAgo } from '../lib/format.js'
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
  <!-- The identity plate at the top of the profile rail: who this is, and what you can do. -->
  <header class="card facet isolate !overflow-visible">
    <img
      v-if="mainChampion"
      :src="championSplash(mainChampion)"
      :alt="`${championName(mainChampion)} champion artwork`"
      class="profile-splash absolute inset-x-0 top-0 -z-10 h-[132px] w-full rounded-t-[5px] object-cover object-[60%_22%]"
    />

    <div class="px-5 pb-5" :class="mainChampion ? 'pt-[72px]' : 'pt-5'">
      <div class="relative inline-block">
        <img
          :src="profileIcon(summoner.profileIconId)"
          :alt="summoner.gameName"
          width="76"
          height="76"
          class="avatar h-[76px] w-[76px]"
        />
        <span
          class="num absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-[2px] border border-line-2 bg-bg px-1.5 py-px text-[10.5px] font-semibold text-ink-2 [font-stretch:80%]"
        >
          {{ summoner.summonerLevel ?? '—' }}
        </span>
      </div>

      <h1
        class="display mt-4 text-[36px] leading-[1.08] text-ink [overflow-wrap:anywhere]"
        :title="`${summoner.gameName}#${summoner.tagLine}`"
      >
        {{ summoner.gameName
        }}<span class="ml-0.5 text-[22px] font-semibold text-ink-3">#{{ summoner.tagLine }}</span>
      </h1>

      <div class="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span class="tag">{{ summoner.platform }}</span>
        <span v-if="mainChampion" class="tag">{{ championName(mainChampion) }} main</span>
      </div>

      <div class="num mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink-3">
        <span v-if="lastGameMs">Last game {{ timeAgo(lastGameMs) }}</span>
        <span v-if="viewCount !== null" class="flex items-center gap-1.5">
          <Eye :size="12" />{{ viewCount.toLocaleString() }} views
        </span>
      </div>

      <div class="mt-4 flex items-center gap-2">
        <button class="btn btn-primary flex-1" :disabled="isSyncing" @click="$emit('sync')">
          <RefreshCw :size="13" :class="{ 'animate-spin': isSyncing }" />
          {{ isSyncing ? 'Updating' : 'Update' }}
        </button>
        <button class="btn" title="Share" @click="$emit('share')">
          <Share2 :size="13" />
          Share
        </button>
        <Link :href="`${path}/compare`" class="btn" title="Compare">
          <ArrowLeftRight :size="13" />
          <span class="sr-only">Compare</span>
        </Link>
      </div>
      <p v-if="syncMessage" class="mt-2.5 text-[11.5px] font-medium text-ink-2" role="status">
        {{ syncMessage }}
      </p>
    </div>
  </header>
</template>

<style scoped>
/* The main champion, desaturated and faded into the plate: evidence, not wallpaper. */
.profile-splash {
  opacity: 0.55;
  filter: saturate(0.65);
  mask-image: linear-gradient(180deg, #000 35%, transparent);
}

/* The player's portrait carries the chamfer and a violet ring: this is who the page is about. */
.avatar {
  border-radius: var(--radius-sm);
  background: var(--color-sunken);
  box-shadow:
    0 0 0 2px var(--color-panel),
    0 0 0 3px var(--color-brand);
  clip-path: polygon(
    -4px -4px,
    calc(100% - 12px) -4px,
    calc(100% + 4px) 12px,
    calc(100% + 4px) calc(100% + 4px),
    -4px calc(100% + 4px)
  );
}
</style>
