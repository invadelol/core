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
  <header class="pb-4">
    <div
      class="relative isolate flex min-h-[210px] items-end overflow-hidden rounded-xl bg-sunken px-5 pb-6 pt-20 sm:min-h-[250px] sm:px-7 sm:pb-7"
      :class="mainChampion ? 'text-white' : 'text-ink'"
    >
      <template v-if="mainChampion">
        <img
          :src="championSplash(mainChampion)"
          :alt="`${championName(mainChampion)} champion artwork`"
          class="absolute inset-0 -z-20 h-full w-full object-cover object-[60%_30%]"
        />
        <div class="profile-banner-shade absolute inset-0 -z-10" />
      </template>
      <div class="flex w-full items-end gap-4 sm:gap-5">
        <div class="relative shrink-0">
          <img
            :src="profileIcon(summoner.profileIconId)"
            :alt="summoner.gameName"
            width="76"
            height="76"
            class="h-16 w-16 rounded-xl border-2 border-white/70 shadow-lg sm:h-[76px] sm:w-[76px]"
          />
          <span
            class="num absolute -bottom-2 left-1/2 -translate-x-1/2 rounded border border-line bg-panel px-2 py-px text-[10px] font-semibold text-ink"
          >
            {{ summoner.summonerLevel ?? '—' }}
          </span>
        </div>
        <div class="min-w-0 flex-1 pb-0.5">
          <h1 class="display truncate text-[clamp(25px,3vw,36px)] leading-tight">
            {{ summoner.gameName
            }}<span class="font-normal opacity-65">#{{ summoner.tagLine }}</span>
          </h1>
          <div
            class="num mt-2 flex items-center gap-2 text-[11px] font-medium tracking-wide opacity-85"
          >
            {{ summoner.platform }}
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 pt-4">
      <div class="num flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink-3">
        <span v-if="lastGameMs">Last game {{ timeAgo(lastGameMs) }}</span>
        <span v-if="viewCount !== null" class="flex items-center gap-1.5">
          <Eye :size="12" />{{ viewCount.toLocaleString() }} views
        </span>
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
    </div>
  </header>
</template>

<style scoped>
.profile-banner-shade {
  background:
    linear-gradient(90deg, rgb(5 10 18 / 0.78), rgb(5 10 18 / 0.12) 75%),
    linear-gradient(0deg, rgb(5 10 18 / 0.72), transparent 85%);
}
</style>
