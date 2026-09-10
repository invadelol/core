<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { computed, onMounted, ref } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import ProfileHeader from '../components/ProfileHeader.vue'
import PerformanceBand from '../components/PerformanceBand.vue'
import ChampionsPanel from '../components/ChampionsPanel.vue'
import MatchList from '../components/MatchList.vue'
import RankPanel from '../components/RankPanel.vue'
import ActivityHeatmap from '../components/ActivityHeatmap.vue'
import TeammatesPanel from '../components/TeammatesPanel.vue'
import { decodeSlug, parseSlug } from '../lib/format.js'
import type {
  ActivityDay,
  ChampionStats,
  Match,
  RanksPayload,
  StatsPayload,
  Summoner,
  Teammate,
} from '../lib/types.js'

const props = defineProps<{ summoner: string }>()

const PLATFORM = 'EUW1'

/** The route param, decoded exactly once. Encode from this, never from the prop. */
const slug = computed(() => decodeSlug(props.summoner))
const parsed = computed(() => parseSlug(props.summoner))

const profile = ref<Summoner | null>(null)
const stats = ref<StatsPayload | null>(null)
const ranks = ref<RanksPayload | null>(null)
const matches = ref<Match[]>([])
const champions = ref<ChampionStats[]>([])
const activity = ref<ActivityDay[]>([])
const teammates = ref<Teammate[]>([])

const isLoading = ref(true)
const error = ref<string | null>(null)
const isSyncing = ref(false)
const syncMessage = ref<string | null>(null)
const viewCount = ref<number | null>(null)

const lastGameMs = computed(() => matches.value[0]?.gameStartMs ?? null)

async function json<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url)
    return res.ok ? await res.json() : fallback
  } catch {
    return fallback
  }
}

/** Resolves the summoner, syncing from Riot once if we've never seen them. */
async function loadProfile(): Promise<Summoner | null> {
  const url = `/api/summoners/${PLATFORM}/${encodeURIComponent(slug.value)}`
  const res = await fetch(url)
  if (res.ok) return (await res.json()).summoner

  if (res.status !== 404) return null

  const synced = await fetch('/api/summoners/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ summoner: slug.value, platform: PLATFORM }),
  })
  if (!synced.ok) return null

  const retry = await fetch(url)
  return retry.ok ? (await retry.json()).summoner : null
}

/** All analytics for a known puuid, in one round of parallel requests. */
async function loadAnalytics(puuid: string) {
  const base = `/api/summoners/puuid/${puuid}`
  const [s, r, m, c, a, t] = await Promise.all([
    json<StatsPayload | null>(`${base}/stats?count=100`, null),
    json<RanksPayload | null>(`${base}/ranks`, null),
    json<Match[]>(`${base}/matches?count=15`, []),
    json<ChampionStats[]>(`${base}/champions?count=100`, []),
    json<ActivityDay[]>(`${base}/activity`, []),
    json<Teammate[]>(`${base}/friends`, []),
  ])
  stats.value = s
  ranks.value = r
  matches.value = m
  champions.value = c
  activity.value = a
  teammates.value = t
}

onMounted(async () => {
  try {
    profile.value = await loadProfile()
    if (!profile.value) {
      error.value = 'Summoner not found'
      return
    }
    await loadAnalytics(profile.value.puuid)
  } catch {
    error.value = 'Failed to load this profile'
  } finally {
    isLoading.value = false
  }

  // Count the visit once the page has clearly been read, not on every bounce.
  if (!profile.value) return
  setTimeout(async () => {
    const puuid = profile.value?.puuid
    if (!puuid) return
    try {
      const res = await fetch(`/api/summoners/puuid/${puuid}/increment`, { method: 'PUT' })
      if (res.ok) viewCount.value = Number((await res.json()).viewCount)
    } catch {
      /* view tracking is best-effort */
    }
  }, 3000)
})

async function sync() {
  if (!profile.value || isSyncing.value) return
  isSyncing.value = true
  syncMessage.value = null

  try {
    const res = await fetch('/api/summoners/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summoner: `${profile.value.gameName}-${profile.value.tagLine}`,
        platform: profile.value.platform,
      }),
    })

    if (res.ok) {
      const found = (await res.json()).matches?.length ?? 0
      syncMessage.value = found
        ? `${found} new match${found > 1 ? 'es' : ''}`
        : 'Already up to date'
      await loadAnalytics(profile.value.puuid)
    } else {
      syncMessage.value = res.status === 404 ? 'No new matches' : 'Update failed'
    }
  } catch {
    syncMessage.value = 'Update failed'
  } finally {
    isSyncing.value = false
    setTimeout(() => (syncMessage.value = null), 4000)
  }
}
</script>

<template>
  <Head :title="`${parsed.gameName}#${parsed.tagLine}`" />

  <AppHeader :crumbs="[{ label: `${parsed.gameName}#${parsed.tagLine}` }]" />

  <main class="mx-auto max-w-[1180px] px-4 py-6">
    <!-- Loading -->
    <div v-if="isLoading" class="space-y-5">
      <div class="card p-5">
        <div class="flex items-center gap-5">
          <div class="skel h-16 w-16 rounded-xl" />
          <div class="flex-1 space-y-2">
            <div class="skel h-6 w-56" />
            <div class="skel h-3 w-40" />
          </div>
        </div>
      </div>
      <div class="skel h-32 rounded-[10px]" />
      <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div class="skel h-[480px] rounded-[10px]" />
        <div class="skel h-[480px] rounded-[10px]" />
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="card px-6 py-16 text-center">
      <p class="text-[0.9375rem] font-medium text-ink">{{ error }}</p>
      <p class="mx-auto mt-2 max-w-sm text-[0.8125rem] text-ink-2">
        Check the spelling of
        <span class="font-medium text-ink">{{ parsed.gameName }}#{{ parsed.tagLine }}</span
        >, or search for someone else.
      </p>
      <a href="/" class="btn mt-5">Back to search</a>
    </div>

    <!-- Profile -->
    <div v-else-if="profile" class="space-y-5">
      <div class="card p-5">
        <ProfileHeader
          :summoner="profile"
          :ranks="ranks?.current ?? []"
          :view-count="viewCount"
          :is-syncing="isSyncing"
          :sync-message="syncMessage"
          :last-game-ms="lastGameMs"
          @sync="sync"
        />
      </div>

      <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div class="space-y-5">
          <PerformanceBand
            :stats="stats?.global ?? null"
            :matches="matches"
            :puuid="profile.puuid"
          />
          <ChampionsPanel :champions="champions" />
          <MatchList :matches="matches" :puuid="profile.puuid" :summoner-slug="slug" />
        </div>

        <aside class="space-y-5">
          <RankPanel :ranks="ranks" />
          <ActivityHeatmap :activity="activity" />
          <TeammatesPanel :teammates="teammates" />
        </aside>
      </div>
    </div>
  </main>
</template>
