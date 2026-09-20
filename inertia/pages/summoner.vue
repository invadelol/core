<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3'
import {
  computed,
  nextTick,
  onMounted,
  onBeforeUnmount,
  reactive,
  ref,
  shallowRef,
  watch,
} from 'vue'
import AppHeader from '../components/AppHeader.vue'
import ProfileHeader from '../components/ProfileHeader.vue'
import ProfileStats from '../components/ProfileStats.vue'
import PlayerNavigation from '../components/PlayerNavigation.vue'
import MatchFilters, { type Filters } from '../components/MatchFilters.vue'
import ChampionExplorer from '../components/ChampionExplorer.vue'
import PlayerLens from '../components/PlayerLens.vue'
import LiveMatch from '../components/LiveMatch.vue'
import PlayerCompare from '../components/PlayerCompare.vue'
import ShareProfile from '../components/ShareProfile.vue'
import { championName, champIcon, loadChampions } from '../lib/assets.js'
import { ArrowUpRight } from 'lucide-vue-next'
import MatchList from '../components/MatchList.vue'
import InfiniteScroll from '../components/InfiniteScroll.vue'
import RankPanel from '../components/RankPanel.vue'
import ActivityHeatmap from '../components/ActivityHeatmap.vue'
import TeammatesPanel from '../components/TeammatesPanel.vue'
import { decodeSlug, parseSlug } from '../lib/format.js'
import type {
  ChampionMastery,
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
  section?: string
  initialProfile?: Summoner | null
  /**
   * The requests to make, as the server defined them. The same list produced
   * the preload hints in the document head, so what this page asks for is
   * exactly what the browser already started fetching.
   */
  panels?: ReadonlyArray<{ key: PanelKey; path: string }>
}>()

const PLATFORM = 'EUW1'
const section = computed(() => props.section ?? 'overview')
const shareOpen = ref(false)
const filters = ref<Filters>({ type: 'all', champion: 0, role: 'all' })
const filteredMatches = shallowRef<Match[] | null>(null)
const filteredChampions = shallowRef<ChampionStats[] | null>(null)
const filterBusy = ref(false)
const filterError = ref('')
const hasMore = ref(false)
const nextOffset = ref(0)
const appendError = ref(false)
const failedPanels = ref<string[]>([])
const mastery = shallowRef<ChampionMastery[]>([])
const masteryLoading = ref(false)
const masteryError = ref(false)
let filterController: AbortController | undefined
let masteryController: AbortController | undefined
const mainChampion = computed(() => champions.value[0]?.championId ?? mastery.value[0]?.championId)
const displayedMatches = computed(() => filteredMatches.value ?? matches.value)
async function loadMastery() {
  if (!profile.value) return
  masteryController?.abort()
  masteryController = new AbortController()
  const signal = masteryController.signal
  masteryLoading.value = true
  masteryError.value = false
  try {
    const response = await fetch(`/api/summoners/puuid/${profile.value.puuid}/mastery`, { signal })
    if (!response.ok) throw new Error()
    const data = await response.json()
    if (!signal.aborted)
      mastery.value = data.sort(
        (a: ChampionMastery, b: ChampionMastery) => b.championPoints - a.championPoints
      )
  } catch {
    if (!signal.aborted) masteryError.value = true
  } finally {
    if (!signal.aborted) masteryLoading.value = false
  }
}
async function applyFilters(append = false) {
  if (!profile.value) return
  if (
    append &&
    (filterBusy.value || pending.matches || !hasMore.value || section.value !== 'overview')
  )
    return
  filterController?.abort()
  filterController = new AbortController()
  const signal = filterController.signal
  filterBusy.value = true
  appendError.value = false
  filterError.value = ''
  const isChampions = section.value === 'champions'
  const query = new URLSearchParams({
    type: filters.value.type,
    role: filters.value.role,
    count: isChampions ? '100' : '15',
  })
  if (!isChampions) {
    query.set('view', 'summary')
    if (filters.value.champion) query.set('champion', String(filters.value.champion))
    if (append) query.set('offset', String(nextOffset.value))
  }
  try {
    const response = await fetch(
      `/api/summoners/puuid/${profile.value.puuid}/${isChampions ? 'champions' : 'matches'}?${query}`,
      { signal }
    )
    if (!response.ok) throw new Error()
    const data = await response.json()
    if (signal.aborted) return
    if (isChampions) filteredChampions.value = data
    else {
      const incoming = data as Match[]
      const existing = append ? displayedMatches.value : []
      filteredMatches.value = [
        ...new Map([...existing, ...incoming].map((match) => [match.matchId, match])).values(),
      ]
      nextOffset.value = (append ? nextOffset.value : 0) + incoming.length
      hasMore.value = data.length === 15
    }
  } catch {
    if (!signal.aborted) {
      appendError.value = append
      if (!append) filterError.value = 'These results could not be loaded. Please try again.'
    }
  } finally {
    if (!signal.aborted) filterBusy.value = false
  }
}
watch(
  filters,
  () => {
    if (!pending.matches) void applyFilters()
  },
  { deep: true }
)
watch(section, () => {
  if (section.value === 'lens' && !mastery.value.length) void loadMastery()
  if (['overview', 'champions'].includes(section.value)) void applyFilters()
})
function championMatches(id: number) {
  filters.value.champion = id
  router.visit(`/${encodeURIComponent(slug.value)}#matches`, {
    preserveState: true,
    preserveScroll: true,
    onSuccess: () => {
      void nextTick(() => document.getElementById('matches')?.scrollIntoView({ block: 'start' }))
    },
  })
}

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

/** Resolves the summoner, syncing from Riot once if we've never seen them. */
async function loadProfile(signal: AbortSignal): Promise<Summoner | LoadFailure> {
  const url = `/api/summoners/${PLATFORM}/${encodeURIComponent(slug.value)}`
  const res = await fetch(url, { signal })
  if (res.ok) return (await res.json()).summoner

  if (res.status !== 404) return failureFor(res)

  const synced = await fetch('/api/summoners/sync', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ summoner: slug.value, platform: PLATFORM }),
  })
  // A 404 from sync means Riot has no such account, which is a real miss.
  if (!synced.ok && synced.status !== 404) return failureFor(synced)

  const retry = await fetch(url, { signal })
  if (retry.ok) return (await retry.json()).summoner
  return failureFor(retry)
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
      if (!response.ok) throw new Error()
      if (response.ok) {
        const data = await response.json()
        if (!signal.aborted && version === analyticsVersion) target.value = data
      }
    } catch {
      if (!signal.aborted && version === analyticsVersion) failedPanels.value.push(key)
    } finally {
      if (!signal.aborted && version === analyticsVersion) pending[key] = false
    }
  }

  await Promise.all((props.panels ?? FALLBACK_PANELS).map(({ key, path }) => panel(key, path)))
}

async function load() {
  controller?.abort()
  filterController?.abort()
  masteryController?.abort()
  clearTimeout(viewTimer)
  clearTimeout(messageTimer)
  controller = new AbortController()
  const { signal } = controller
  failedPanels.value = []
  filters.value = { type: 'all', champion: 0, role: 'all' }
  hasMore.value = false
  nextOffset.value = 0
  appendError.value = false
  filterBusy.value = false
  filterError.value = ''
  filteredMatches.value = null
  filteredChampions.value = null
  mastery.value = []
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
    void loadMastery()
    await loadAnalytics(result.puuid, signal)
    if (
      !signal.aborted &&
      (filters.value.type !== 'all' || filters.value.role !== 'all' || filters.value.champion)
    )
      await applyFilters()
    if (!signal.aborted && !filteredMatches.value) {
      nextOffset.value = matches.value.length
      hasMore.value = matches.value.length >= 15
    }
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
  void loadChampions()
  watch(
    () => props.summoner,
    () => void load(),
    { immediate: true }
  )
})
onBeforeUnmount(() => {
  filterController?.abort()
  masteryController?.abort()
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
        platform: profile.value.platform,
      }),
    })

    if (signal.aborted) return
    if (res.ok) {
      const result = await res.json()
      const found = result.matches?.length ?? 0
      if (result.summoner) profile.value = result.summoner
      if (signal.aborted) return
      syncMessage.value = found
        ? `${found} new match${found > 1 ? 'es' : ''}`
        : 'Already up to date'
      failedPanels.value = []
      if (result.rankRefreshFailed) syncMessage.value = 'Matches updated; rank refresh unavailable'
      await loadAnalytics(profile.value!.puuid, signal)
      await applyFilters()
      void loadMastery()
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

  <main class="mx-auto max-w-[1320px] px-4 py-6">
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
          Riot has no account called
          <span class="font-medium text-ink">{{ parsed.gameName }}#{{ parsed.tagLine }}</span> on
          {{ PLATFORM }}. Check the spelling, or search for someone else.
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

    <div v-else-if="profile" class="profile-shell">
      <ProfileHeader
        :summoner="profile"
        :ranks="ranks?.current ?? []"
        :view-count="viewCount"
        :is-syncing="isSyncing"
        :sync-message="syncMessage"
        :last-game-ms="lastGameMs"
        :main-champion="mainChampion"
        @sync="sync"
        @share="shareOpen = true"
      />
      <PlayerNavigation :slug="slug" :section="section" />
      <div v-if="failedPanels.length" class="notice-error" role="alert">
        Some data could not be loaded ({{ failedPanels.join(', ') }}).
        <button class="underline" @click="retry">Retry</button>
      </div>
      <div v-if="section === 'overview'" class="overview-grid">
        <aside class="profile-sidebar">
          <div v-if="pending.ranks" class="skel h-48" role="status" aria-label="Loading ranks" />
          <RankPanel v-else :ranks="ranks" />
          <section class="card compact-champions">
            <div class="card-head">
              <h2 class="card-title">Comfort picks</h2>
              <a
                :href="`/${encodeURIComponent(slug)}/champions`"
                aria-label="All champion statistics"
                ><ArrowUpRight :size="16"
              /></a>
            </div>
            <div v-if="pending.champions" class="skel h-40" />
            <template v-else
              ><button
                v-for="c in champions.slice(0, 4)"
                :key="c.championId"
                @click="championMatches(c.championId)"
              >
                <img :src="champIcon(c.championId)" :alt="championName(c.championId)" /><span
                  ><strong>{{ championName(c.championId) }}</strong
                  ><small>{{ c.games }} games · {{ c.csMin.toFixed(1) }} CS/min</small></span
                ><span class="text-right"
                  ><strong :class="c.winrate >= 0.5 ? 'text-pos' : 'text-neg'"
                    >{{ Math.round(c.winrate * 100) }}%</strong
                  ><small>{{ c.kda.toFixed(2) }} KDA</small></span
                >
              </button>
              <p v-if="!champions.length" class="empty-panel">
                Play a few games to find your comfort picks.
              </p></template
            >
          </section>
          <div
            v-if="pending.teammates"
            class="skel h-40"
            role="status"
            aria-label="Loading teammates"
          />
          <TeammatesPanel v-else :teammates="teammates" />
          <div
            v-if="pending.activity"
            class="skel h-40"
            role="status"
            aria-label="Loading activity"
          />
          <ActivityHeatmap v-else :activity="activity" />
        </aside>
        <div class="profile-feed">
          <div
            v-if="pending.stats"
            class="skel h-48"
            role="status"
            aria-label="Loading performance"
          />
          <ProfileStats
            v-else
            :stats="stats?.global ?? null"
            :matches="matches"
            :puuid="profile.puuid"
          />
          <div id="matches" class="section-intro feed-heading">
            <div>
              <h2>Match history</h2>
              <p>Every game, all in one place.</p>
            </div>
            <span class="subtle">{{ displayedMatches.length }} matches</span>
          </div>
          <MatchFilters v-model="filters" :champions="champions" :busy="filterBusy" />
          <p v-if="filterError" class="notice-error" role="alert">
            {{ filterError }} <button @click="applyFilters()">Retry</button>
          </p>
          <div
            v-if="pending.matches"
            class="skel h-96"
            role="status"
            aria-label="Loading matches"
          />
          <MatchList
            v-else
            :matches="displayedMatches"
            :puuid="profile.puuid"
            :summoner-slug="slug"
          />
          <InfiniteScroll
            v-if="!filterError"
            :has-more="hasMore"
            :loading="pending.matches || filterBusy"
            :error="appendError"
            :empty="!displayedMatches.length"
            @load="applyFilters(true)"
          />
        </div>
      </div>
      <div v-else-if="section === 'champions'" class="space-y-5">
        <MatchFilters v-model="filters" :hide-champion="true" :busy="filterBusy" />
        <p v-if="filterError" class="notice-error" role="alert">
          {{ filterError }} <button @click="applyFilters()">Retry</button>
        </p>
        <ChampionExplorer
          :champions="filteredChampions ?? champions"
          :busy="filterBusy || pending.champions"
          @matches="championMatches"
        />
      </div>
      <PlayerLens
        v-else-if="section === 'lens'"
        :mastery="mastery"
        :loading="masteryLoading"
        :error="masteryError"
        :stats="stats?.global ?? null"
        :matches="matches"
        :puuid="profile.puuid"
        @retry="loadMastery"
      />
      <LiveMatch v-else-if="section === 'live'" :puuid="profile.puuid" :name="profile.gameName" />
      <PlayerCompare
        v-else-if="section === 'compare'"
        :profile="profile"
        :champions="champions"
        :main-champion="mainChampion"
      />
      <ShareProfile
        v-if="shareOpen"
        :profile="profile"
        :stats="stats?.global ?? null"
        :champion="mainChampion"
        @close="shareOpen = false"
      />
      <footer class="profile-footer">
        <span>invade.lol <span>— Your game, understood.</span></span
        ><span>Not endorsed by Riot Games. League of Legends is a trademark of Riot Games.</span>
      </footer>
    </div>
  </main>
</template>
