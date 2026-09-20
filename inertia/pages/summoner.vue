<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { computed, onMounted, onBeforeUnmount, reactive, ref, shallowRef, watch } from 'vue'
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

type PanelKey = 'stats' | 'ranks' | 'matches' | 'champions' | 'activity' | 'teammates'

const props = defineProps<{
  summoner: string
  initialProfile?: Summoner | null
  /**
   * The requests to make, as the server defined them. The same list produced
   * the preload hints in the document head, so what this page asks for is
   * exactly what the browser already started fetching.
   */
  panels?: ReadonlyArray<{ key: PanelKey; path: string }>
}>()

/** The route param, decoded exactly once. Encode from this, never from the prop. */
const slug = computed(() => decodeSlug(props.summoner))
const parsed = computed(() => parseSlug(props.summoner))

const profile = shallowRef<Summoner | null>(props.initialProfile ?? null)
const stats = shallowRef<StatsPayload | null>(null)
const ranks = shallowRef<RanksPayload | null>(null)
const matches = shallowRef<Match[]>([])
const champions = shallowRef<ChampionStats[]>([])
const activity = shallowRef<ActivityDay[]>([])
const teammates = shallowRef<Teammate[]>([])

const isLoading = ref(!profile.value)
const error = ref<LoadFailure | null>(null)
const isSyncing = ref(false)
const syncMessage = ref<string | null>(null)
const viewCount = ref<number | null>(null)

const lastGameMs = computed(() => matches.value[0]?.gameStartMs ?? null)

const pending = reactive<Record<PanelKey, boolean>>({
  stats: true,
  ranks: true,
  matches: true,
  champions: true,
  activity: true,
  teammates: true,
})

/** Used only if the page was served without a panel list. */
const FALLBACK_PANELS: ReadonlyArray<{ key: PanelKey; path: string }> = [
  { key: 'matches', path: 'matches?count=15&view=summary' },
  { key: 'stats', path: 'stats?count=100' },
  { key: 'ranks', path: 'ranks' },
  { key: 'champions', path: 'champions?count=100' },
  { key: 'activity', path: 'activity' },
  { key: 'teammates', path: 'friends' },
]
let analyticsVersion = 0
let controller: AbortController | undefined
let viewTimer: ReturnType<typeof setTimeout> | undefined
let messageTimer: ReturnType<typeof setTimeout> | undefined

/** What went wrong, so the page can say something true about it. */
type LoadFailure = 'not-found' | 'riot-unavailable' | 'error'

async function failureFor(res: Response): Promise<LoadFailure> {
  if (res.status === 404) return 'not-found'
  // 503 is the API telling us Riot rate limited us or rejected our key.
  if (res.status === 503) return 'riot-unavailable'
  return 'error'
}

/** Resolves the Riot ID and detects its platform on the server. */
async function loadProfile(signal: AbortSignal): Promise<Summoner | LoadFailure> {
  const res = await fetch(`/api/summoners/${encodeURIComponent(slug.value)}`, { signal })
  if (res.ok) return (await res.json()).summoner
  return failureFor(res)
}

/** Where each panel's response lands. */
const targets: Record<PanelKey, { value: any }> = {
  matches,
  stats,
  ranks,
  champions,
  activity,
  teammates,
}

/** Paint each independent panel as soon as its request finishes. */
async function loadAnalytics(puuid: string, signal: AbortSignal) {
  const version = ++analyticsVersion
  const base = `/api/summoners/puuid/${puuid}`

  async function panel(key: PanelKey, path: string) {
    const target = targets[key]
    try {
      const response = await fetch(`${base}/${path}`, { signal })
      if (response.ok) {
        const data = await response.json()
        if (!signal.aborted && version === analyticsVersion) target.value = data
      }
    } catch {
      // Preserve existing data if a refresh fails.
    } finally {
      if (!signal.aborted && version === analyticsVersion) pending[key] = false
    }
  }

  await Promise.all((props.panels ?? FALLBACK_PANELS).map(({ key, path }) => panel(key, path)))
}

async function load() {
  controller?.abort()
  clearTimeout(viewTimer)
  clearTimeout(messageTimer)
  controller = new AbortController()
  const { signal } = controller
  profile.value = props.initialProfile ?? null
  isLoading.value = !profile.value
  error.value = null
  isSyncing.value = false
  syncMessage.value = null
  viewCount.value = null
  stats.value = null
  ranks.value = null
  matches.value = []
  champions.value = []
  activity.value = []
  teammates.value = []
  for (const key of Object.keys(pending) as PanelKey[]) pending[key] = true

  try {
    const result = profile.value ?? (await loadProfile(signal))
    if (signal.aborted) return
    if (typeof result === 'string') {
      error.value = result
      return
    }
    profile.value = result
    isLoading.value = false
    // Start the visit timer independently of slow analytics.
    viewTimer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/summoners/puuid/${result.puuid}/increment`, {
          method: 'PUT',
          signal,
        })
        if (response.ok) {
          const data = await response.json()
          if (!signal.aborted) viewCount.value = Number(data.viewCount)
        }
      } catch {
        /* view tracking is best-effort */
      }
    }, 3000)
    await loadAnalytics(result.puuid, signal)
  } catch {
    if (!signal.aborted) error.value = 'error'
  } finally {
    if (!signal.aborted) isLoading.value = false
  }
}

function retry() {
  void load()
}

onMounted(() => {
  watch(
    () => props.summoner,
    () => void load(),
    { immediate: true }
  )
})
onBeforeUnmount(() => {
  controller?.abort()
  clearTimeout(viewTimer)
  clearTimeout(messageTimer)
})

async function sync() {
  if (!profile.value || isSyncing.value) return
  const signal = controller!.signal
  isSyncing.value = true
  syncMessage.value = null

  try {
    const res = await fetch('/api/summoners/sync', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summoner: `${profile.value.gameName}-${profile.value.tagLine}`,
      }),
    })

    if (signal.aborted) return
    if (res.ok) {
      const payload = await res.json()
      const found = payload.matches?.length ?? 0
      if (payload.summoner && !signal.aborted) profile.value = payload.summoner
      if (signal.aborted) return
      syncMessage.value = found
        ? `${found} new match${found > 1 ? 'es' : ''}`
        : 'Already up to date'
      await loadAnalytics(profile.value.puuid, signal)
    } else {
      syncMessage.value = res.status === 404 ? 'No new matches' : 'Update failed'
    }
  } catch {
    if (!signal.aborted) syncMessage.value = 'Update failed'
  } finally {
    if (!signal.aborted) {
      isSyncing.value = false
      messageTimer = setTimeout(() => (syncMessage.value = null), 4000)
    }
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
      <template v-if="error === 'not-found'">
        <p class="text-[0.9375rem] font-medium text-ink">Summoner not found</p>
        <p class="mx-auto mt-2 max-w-sm text-[0.8125rem] text-ink-2">
          No League profile was found for
          <span class="font-medium text-ink">{{ parsed.gameName }}#{{ parsed.tagLine }}</span>
          across the supported regions. Check the spelling, or search for someone else.
        </p>
      </template>

      <template v-else-if="error === 'riot-unavailable'">
        <p class="text-[0.9375rem] font-medium text-ink">Riot's API isn't answering</p>
        <p class="mx-auto mt-2 max-w-sm text-[0.8125rem] text-ink-2">
          This profile isn't stored yet and Riot is rate limiting us or refusing the key, so there's
          nothing to show. It usually clears in a minute.
        </p>
      </template>

      <template v-else>
        <p class="text-[0.9375rem] font-medium text-ink">Couldn't load this profile</p>
        <p class="mx-auto mt-2 max-w-sm text-[0.8125rem] text-ink-2">
          Something broke on our side while looking up
          <span class="font-medium text-ink">{{ parsed.gameName }}#{{ parsed.tagLine }}</span
          >.
        </p>
      </template>

      <div class="mt-5 flex justify-center gap-2">
        <button class="btn" @click="retry">Try again</button>
        <a href="/" class="btn">Back to search</a>
      </div>
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
          <div
            v-if="pending.stats"
            class="skel h-48 rounded-[10px]"
            role="status"
            aria-label="Loading performance"
          />
          <PerformanceBand
            v-else
            :stats="stats?.global ?? null"
            :matches="matches"
            :puuid="profile.puuid"
          />
          <div
            v-if="pending.champions"
            class="skel h-48 rounded-[10px]"
            role="status"
            aria-label="Loading champions"
          />
          <ChampionsPanel v-else :champions="champions" />
          <div
            v-if="pending.matches"
            class="skel h-96 rounded-[10px]"
            role="status"
            aria-label="Loading matches"
          />
          <MatchList v-else :matches="matches" :puuid="profile.puuid" :summoner-slug="slug" />
        </div>

        <aside class="space-y-5">
          <div
            v-if="pending.ranks"
            class="skel h-48 rounded-[10px]"
            role="status"
            aria-label="Loading ranks"
          />
          <RankPanel v-else :ranks="ranks" />
          <div
            v-if="pending.activity"
            class="skel h-48 rounded-[10px]"
            role="status"
            aria-label="Loading activity"
          />
          <ActivityHeatmap v-else :activity="activity" />
          <div
            v-if="pending.teammates"
            class="skel h-48 rounded-[10px]"
            role="status"
            aria-label="Loading teammates"
          />
          <TeammatesPanel v-else :teammates="teammates" />
        </aside>
      </div>
    </div>
  </main>
</template>
