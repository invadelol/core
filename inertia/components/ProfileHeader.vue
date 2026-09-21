<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeftRight, Eye, RefreshCw, Share2 } from 'lucide-vue-next'
import { Link } from '@inertiajs/vue3'
import { champIcon, championName, profileIcon } from '../lib/assets.js'
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
  <header class="flex flex-wrap items-center gap-x-5 gap-y-3 pb-5">
    <div class="relative shrink-0">
      <img
        :src="profileIcon(summoner.profileIconId)"
        :alt="summoner.gameName"
        width="60"
        height="60"
        class="thumb h-[60px] w-[60px] rounded-[12px]"
      />
      <span
        class="num absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-[4px] border border-line bg-panel px-1.5 py-px text-[10px] font-semibold text-ink"
      >
        {{ summoner.summonerLevel ?? '—' }}
      </span>
    </div>

    <div class="min-w-0 flex-1 basis-[calc(100%-5.5rem)] sm:basis-auto">
      <h1 class="display truncate text-[clamp(24px,3vw,30px)] text-ink">
        {{ summoner.gameName }}<span class="font-normal text-ink-4">#{{ summoner.tagLine }}</span>
      </h1>

      <div class="num mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-3">
        <span class="font-medium text-ink-2">{{ summoner.platform }}</span>
        <span v-if="mainChampion" class="flex items-center gap-1.5">
          <img
            :src="champIcon(mainChampion)"
            :alt="championName(mainChampion)"
            class="thumb h-4 w-4 rounded-[3px]"
          />
          {{ championName(mainChampion) }}
        </span>
        <span v-if="lastGameMs">Last game {{ timeAgo(lastGameMs) }}</span>
        <span v-if="viewCount !== null" class="flex items-center gap-1">
          <Eye :size="11" />{{ viewCount.toLocaleString() }}
        </span>
      </div>
    </div>

    <div class="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
      <span v-if="syncMessage" class="text-[11.5px] text-ink-2" role="status">
        {{ syncMessage }}
      </span>
      <Link :href="`${path}/compare`" class="btn btn-sm">
        <ArrowLeftRight :size="12" />
        Compare
      </Link>
      <button class="btn btn-sm" @click="$emit('share')">
        <Share2 :size="12" />
        Share
      </button>
      <button class="btn btn-sm btn-primary" :disabled="isSyncing" @click="$emit('sync')">
        <RefreshCw :size="12" :class="{ 'animate-spin': isSyncing }" />
        {{ isSyncing ? 'Updating' : 'Update' }}
      </button>
    </div>
  </header>
</template>
