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
  <header class="pb-5">
    <div
      class="relative isolate flex min-h-[220px] items-end overflow-hidden rounded-[12px] border border-line bg-panel px-5 pb-6 pt-20 sm:min-h-[260px] sm:px-8 sm:pb-8"
      :class="mainChampion ? 'text-white' : 'text-ink'"
    >
      <template v-if="mainChampion">
        <img
          :src="championSplash(mainChampion)"
          :alt="`${championName(mainChampion)} champion artwork`"
          class="absolute inset-0 -z-20 h-full w-full object-cover object-[60%_28%]"
        />
        <div class="profile-banner-shade absolute inset-0 -z-10" />
      </template>

      <div class="flex w-full flex-wrap items-end gap-x-6 gap-y-5">
        <div class="flex min-w-0 flex-1 items-end gap-4 sm:gap-5">
          <div class="relative shrink-0">
            <img
              :src="profileIcon(summoner.profileIconId)"
              :alt="summoner.gameName"
              width="84"
              height="84"
              class="h-[68px] w-[68px] rounded-[10px] shadow-lg ring-2 ring-white/15 sm:h-[84px] sm:w-[84px]"
            />
            <span
              class="num absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-[4px] border border-white/15 bg-[#0a0b0e] px-1.5 py-px text-[10.5px] font-semibold text-white"
            >
              {{ summoner.summonerLevel ?? '—' }}
            </span>
          </div>

          <div class="min-w-0 flex-1">
            <div class="mb-2 flex flex-wrap items-center gap-1.5">
              <span class="tag" :class="{ 'banner-tag': mainChampion }">
                {{ summoner.platform }}
              </span>
              <span v-if="mainChampion" class="tag banner-tag">
                {{ championName(mainChampion) }} main
              </span>
            </div>
            <h1 class="display truncate text-[clamp(32px,4.4vw,56px)] leading-[0.9]">
              {{ summoner.gameName
              }}<span class="font-semibold opacity-50 [font-stretch:85%]"
                >#{{ summoner.tagLine }}</span
              >
            </h1>
          </div>
        </div>

        <div class="flex w-full shrink-0 flex-wrap items-center gap-2 lg:w-auto">
          <Link
            :href="`${path}/compare`"
            class="btn btn-sm"
            :class="{ 'banner-btn': mainChampion }"
          >
            <ArrowLeftRight :size="13" />
            Compare
          </Link>
          <button
            class="btn btn-sm"
            :class="{ 'banner-btn': mainChampion }"
            @click="$emit('share')"
          >
            <Share2 :size="13" />
            Share
          </button>
          <button
            class="btn btn-sm btn-primary"
            :class="{ 'banner-primary': mainChampion }"
            :disabled="isSyncing"
            @click="$emit('sync')"
          >
            <RefreshCw :size="13" :class="{ 'animate-spin': isSyncing }" />
            {{ isSyncing ? 'Updating' : 'Update' }}
          </button>
        </div>
      </div>
    </div>

    <div class="num flex flex-wrap items-center gap-x-5 gap-y-1 px-1 pt-3 text-[11.5px] text-ink-3">
      <span v-if="lastGameMs">Last game {{ timeAgo(lastGameMs) }}</span>
      <span v-if="viewCount !== null" class="flex items-center gap-1.5">
        <Eye :size="12" />{{ viewCount.toLocaleString() }} views
      </span>
      <span v-if="syncMessage" class="ml-auto font-medium text-ink" role="status">
        {{ syncMessage }}
      </span>
    </div>
  </header>
</template>

<style scoped>
.profile-banner-shade {
  background:
    linear-gradient(90deg, rgb(6 7 10 / 0.86), rgb(6 7 10 / 0.2) 70%, rgb(6 7 10 / 0.35)),
    linear-gradient(0deg, rgb(6 7 10 / 0.85), transparent 80%);
}

/* Secondary actions sit on the artwork, so they borrow its darkness. */
.banner-btn {
  background: rgb(10 11 14 / 0.45);
  border-color: rgb(255 255 255 / 0.14);
  color: #fff;
  backdrop-filter: blur(8px);
}

.banner-tag {
  background: rgb(255 255 255 / 0.12);
  color: #fff;
  backdrop-filter: blur(6px);
}

/* On artwork the primary action is always the light one, whatever the theme. */
.banner-primary {
  background: #f3f4f6;
  border-color: #f3f4f6;
  color: #0a0b0e;
}

.banner-btn:hover:not(:disabled) {
  background: rgb(10 11 14 / 0.7);
}
</style>
