<script setup lang="ts">
import { computed } from 'vue'
import { Eye, RefreshCw } from 'lucide-vue-next'
import { profileIcon, rankCrest, TIER_NAMES, QUEUE_LABELS } from '../lib/ddragon.js'
import { timeAgo } from '../lib/format.js'
import type { Rank, Summoner } from '../lib/types.js'

const props = defineProps<{
  summoner: Summoner
  ranks: Rank[]
  viewCount: number | null
  isSyncing: boolean
  syncMessage: string | null
  lastGameMs: number | null
}>()

defineEmits<{ sync: [] }>()

const soloRank = computed(
  () => props.ranks.find((r) => r.queueType === 'RANKED_SOLO_5x5') ?? props.ranks[0] ?? null
)

function winrate(rank: Rank) {
  const total = rank.wins + rank.losses
  return total ? Math.round((rank.wins / total) * 100) : 0
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-5 gap-y-4">
    <img
      :src="profileIcon(summoner.profileIconId)"
      :alt="summoner.gameName"
      class="thumb h-16 w-16 rounded-xl border border-line"
    />

    <div class="min-w-0 flex-1">
      <h1
        class="flex flex-wrap items-baseline gap-x-2 text-[1.5rem] font-semibold tracking-[-0.02em]"
      >
        <span class="text-ink">{{ summoner.gameName }}</span>
        <span class="text-ink-3 text-[1.125rem] font-normal">#{{ summoner.tagLine }}</span>
      </h1>

      <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-ink-3">
        <span class="num">Level {{ summoner.summonerLevel ?? '—' }}</span>
        <span class="text-ink-4">·</span>
        <span>{{ summoner.platform }}</span>
        <template v-if="lastGameMs">
          <span class="text-ink-4">·</span>
          <span>last game {{ timeAgo(lastGameMs) }}</span>
        </template>
        <template v-if="viewCount !== null">
          <span class="text-ink-4">·</span>
          <span class="inline-flex items-center gap-1 num">
            <Eye class="h-3 w-3" />{{ viewCount.toLocaleString() }}
          </span>
        </template>
      </div>
    </div>

    <!-- Current rank, read at a glance next to the name -->
    <div v-if="soloRank?.tier" class="flex items-center gap-2.5 border-l border-line pl-5">
      <img :src="rankCrest(soloRank.tier)" :alt="soloRank.tier" class="h-9 w-9" />
      <div>
        <div class="text-[0.8125rem] font-semibold text-ink">
          {{ TIER_NAMES[soloRank.tier] || soloRank.tier }} {{ soloRank.division }}
          <span class="num font-normal text-ink-2">· {{ soloRank.leaguePoints }} LP</span>
        </div>
        <div class="num text-[0.6875rem] text-ink-3">
          {{ QUEUE_LABELS[soloRank.queueType] || soloRank.queueType }} · {{ soloRank.wins }}W
          {{ soloRank.losses }}L ·
          <span :class="winrate(soloRank) >= 50 ? 'text-pos' : 'text-neg'">
            {{ winrate(soloRank) }}%
          </span>
        </div>
      </div>
    </div>

    <div class="flex flex-col items-end gap-1">
      <button class="btn" :disabled="isSyncing" @click="$emit('sync')">
        <RefreshCw class="h-3.5 w-3.5" :class="isSyncing && 'animate-spin'" />
        {{ isSyncing ? 'Updating' : 'Update' }}
      </button>
      <span v-if="syncMessage" class="text-[0.6875rem] text-ink-3">{{ syncMessage }}</span>
    </div>
  </div>
</template>
