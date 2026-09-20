<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import { Eye, RefreshCw, Share2, ArrowLeftRight, Clock3, Sparkles } from 'lucide-vue-next'
import { profileIcon, championSplash, championName } from '../lib/assets.js'
import { timeAgo } from '../lib/format.js'
import type { Rank, Summoner } from '../lib/types.js'
const props = defineProps<{
  summoner: Summoner
  ranks: Rank[]
  viewCount: number | null
  isSyncing: boolean
  syncMessage: string | null
  lastGameMs: number | null
  mainChampion?: number
}>()
defineEmits<{ sync: []; share: [] }>()
const path = computed(
  () => `/${encodeURIComponent(`${props.summoner.gameName}-${props.summoner.tagLine}`)}`
)
</script>
<template>
  <section class="profile-hero">
    <img
      v-if="mainChampion"
      class="hero-art"
      :src="championSplash(mainChampion)"
      :alt="`${championName(mainChampion)} splash art`"
      fetchpriority="high"
    />
    <div class="hero-shade" />
    <div class="hero-topline">
      <span class="hero-eyebrow">THE PLAYER BEHIND THE PLAYS</span
      ><span v-if="mainChampion" class="hero-main"
        ><Sparkles :size="12" /> {{ championName(mainChampion) }} main</span
      >
    </div>
    <div class="hero-profile">
      <div class="hero-avatar">
        <img :src="profileIcon(summoner.profileIconId)" :alt="summoner.gameName" /><span>{{
          summoner.summonerLevel ?? '—'
        }}</span>
      </div>
      <div class="hero-identity">
        <div class="hero-region">{{ summoner.platform }} <span>•</span> SUMMONER PROFILE</div>
        <h1>
          {{ summoner.gameName }}<span>#{{ summoner.tagLine }}</span>
        </h1>
        <p>Your game. A clearer picture.</p>
      </div>
    </div>
    <div class="hero-footer">
      <div class="hero-meta">
        <span v-if="lastGameMs"><Clock3 :size="13" /> Last game {{ timeAgo(lastGameMs) }}</span
        ><span v-if="viewCount !== null"
          ><Eye :size="14" /> {{ viewCount.toLocaleString() }} views</span
        >
      </div>
      <div class="hero-actions">
        <span v-if="syncMessage" class="sync-message" role="status">{{ syncMessage }}</span
        ><Link :href="`${path}/compare`" class="hero-button"
          ><ArrowLeftRight :size="14" /> Compare</Link
        ><button class="hero-button" @click="$emit('share')"><Share2 :size="14" /> Share</button
        ><button class="hero-button hero-update" :disabled="isSyncing" @click="$emit('sync')">
          <RefreshCw :size="14" :class="{ 'animate-spin': isSyncing }" />{{
            isSyncing ? 'Updating…' : 'Update'
          }}
        </button>
      </div>
    </div>
  </section>
</template>
