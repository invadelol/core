<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowRef,
  watch,
} from 'vue'
import AppHeader from '../components/AppHeader.vue'
import ProfileHeader from '../components/ProfileHeader.vue'
import ProfileNav from '../components/ProfileNav.vue'
import StatBoard from '../components/StatBoard.vue'
import RankStrip from '../components/RankStrip.vue'
import ChampionPool from '../components/ChampionPool.vue'
import RoleSplit from '../components/RoleSplit.vue'
import TeammatesPanel from '../components/TeammatesPanel.vue'
import ActivityHeatmap from '../components/ActivityHeatmap.vue'
import MatchFilters, { type Filters } from '../components/MatchFilters.vue'
import MatchList from '../components/MatchList.vue'
import InfiniteScroll from '../components/InfiniteScroll.vue'
import ChampionExplorer from '../components/ChampionExplorer.vue'
import MasteryPanel from '../components/MasteryPanel.vue'
import FriendsPanel from '../components/FriendsPanel.vue'
import LiveMatch from '../components/LiveMatch.vue'
import PlayerCompare from '../components/PlayerCompare.vue'
import ShareProfile from '../components/ShareProfile.vue'
import Wordmark from '../components/ui/Wordmark.vue'
import { loadChampions } from '../lib/assets.js'
import { decodeSlug, parseSlug } from '../lib/format.js'
import { rememberPlayer } from '../lib/recent.js'
import type {
  ActivityDay,
  GlobalStats,
  ChampionMastery,
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

const section = computed(() => props.section ?? 'overview')

/** The profile's headline window, and the one it is compared with. */
const STATS_WINDOW = 30
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

/** Champions has two readings of the same pool: recent form, and lifetime. */
const championsView = ref<'stats' | 'mastery'>('stats')
const CHAMPION_VIEWS = [
  { value: 'stats' as const, label: 'Recent form' },
  { value: 'mastery' as const, label: 'Mastery' },
]

let filterController: AbortController | undefined
let masteryController: AbortController | undefined

const mainChampion = computed(() => champions.value[0]?.championId ?? mastery.value[0]?.championId)
const displayedMatches = computed(() => filteredMatches.value ?? matches.value)

/** What the current filters actually returned, printed next to them. */
const filterSummary = computed(() => {
  const list = displayedMatches.value
  if (!list.length) return ''
  let wins = 0
  for (const match of list) {
    if (match.participants.find((p) => p.puuid === profile.value?.puuid)?.win) wins++
  }
  return `${list.length} games · ${wins}W ${list.length - wins}L · ${Math.round((wins / list.length) * 100)}%`
})

const performanceMatches = shallowRef<Match[]>([])
let statsController: AbortController | undefined

/**
 * Stats follow the match filters: changing the queue or the role has to change
 * the numbers above the feed, or the two disagree. Both windows are fetched
 * together so the trend is always against a like-for-like sample.
 */
async function loadStats() {
  if (!profile.value) return
  statsController?.abort()
  statsController = new AbortController()
  const signal = statsController.signal
  pending.stats = true
  stats.value = null
  previousStats.value = null
  performanceMatches.value = []

  const query = (offset: number) => {
    const params = new URLSearchParams({ count: String(STATS_WINDOW) })
    if (offset) params.set('offset', String(offset))
    if (filters.value.type !== 'all') params.set('type', filters.value.type)
    if (filters.value.role !== 'all') params.set('role', filters.value.role)
    if (filters.value.champion) params.set('champion', String(filters.value.champion))
    return params
  }

  try {
    const base = `/api/summoners/puuid/${profile.value.puuid}/stats`
    const [current, before, recent] = await Promise.all([
      fetch(`${base}?${query(0)}`, { signal }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${base}?${query(STATS_WINDOW)}`, { signal }).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/summoners/puuid/${profile.value.puuid}/matches?${query(0)}&view=summary`, {
        signal,
      }).then((r) => (r.ok ? r.json() : null)),
    ])
    if (signal.aborted) return
    failedPanels.value = failedPanels.value.filter((key) => key !== 'stats')
    if (!current || !before || !recent) failedPanels.value.push('stats')
    stats.value = current
    performanceMatches.value = recent ?? []
    previousStats.value = before?.global?.total ? before.global : null
  } catch {
    if (!signal.aborted && !failedPanels.value.includes('stats')) failedPanels.value.push('stats')
  } finally {
    if (!signal.aborted) pending.stats = false
  }
}

const friendMatches = shallowRef<Match[]>([])
const friendsLoading = ref(false)
let friendsController: AbortController | undefined

/** Synergy needs roles, which only the match rows carry, so it reads a
 *  wider sample of the player's own games rather than the friends endpoint. */
async function loadFriendMatches() {
  if (!profile.value || friendMatches.value.length) return
  friendsController?.abort()
  friendsController = new AbortController()
  const signal = friendsController.signal
  friendsLoading.value = true
  try {
    const res = await fetch(
      `/api/summoners/puuid/${profile.value.puuid}/matches?count=100&view=summary`,
      { signal }
    )
    if (!res.ok) throw new Error()
    const data = await res.json()
    if (!signal.aborted) friendMatches.value = data
  } catch {
    if (!signal.aborted) friendMatches.value = []
  } finally {
    if (!signal.aborted) friendsLoading.value = false
  }
}

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
  if (!append) void loadStats()
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
      if (!append) filterError.value = 'These results could not be loaded.'
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
  if (section.value === 'champions' && !mastery.value.length) void loadMastery()
  if (section.value === 'friends') void loadFriendMatches()
  if (['overview', 'champions'].includes(section.value)) void applyFilters()
})

/** Picking a champion anywhere sends you to that champion's games. */
function championMatches(id: number) {
  filters.value.champion = id
  if (section.value === 'overview') {
    void nextTick(() => document.getElementById('matches')?.scrollIntoView({ block: 'start' }))
    return
  }
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
const previousStats = shallowRef<GlobalStats | null>(null)
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
  { key: 'stats', path: `stats?count=${STATS_WINDOW}` },
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
    if (key === 'stats') return
    const target = targets[key]
    try {
      const response = await fetch(`${base}/${path}`, { signal })
      if (!response.ok) throw new Error()
      const data = await response.json()
      if (!signal.aborted && version === analyticsVersion) target.value = data
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
  statsController?.abort()
  friendsController?.abort()
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
  friendMatches.value = []
  profile.value = props.initialProfile ?? null
  isLoading.value = !profile.value
  error.value = null
  isSyncing.value = false
  syncMessage.value = null
  viewCount.value = null
  stats.value = null
  previousStats.value = null
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
    rememberPlayer({
      gameName: result.gameName,
      tagLine: result.tagLine,
      profileIconId: result.profileIconId,
    })
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
    void loadStats()
    if (section.value === 'friends') void loadFriendMatches()
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
  statsController?.abort()
  friendsController?.abort()
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
      body: JSON.stringify({ summoner: `${profile.value.gameName}-${profile.value.tagLine}` }),
    })

    if (signal.aborted) return
    if (res.ok) {
      const result = await res.json()
      const found = result.matches?.length ?? 0
      if (result.summoner && !signal.aborted) profile.value = result.summoner
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
      const failure = await res.json().catch(() => null)
      if (signal.aborted) return
      const code = failure?.errors?.[0]?.code
      syncMessage.value =
        code === 'E_RIOT_RATE_LIMITED'
          ? `Riot rate limit reached. Try again in ${failure.retryAfter ?? 60}s`
          : res.status === 404
            ? 'Player not found'
            : res.status === 503
              ? 'Riot is temporarily unavailable. Try again shortly'
              : 'Update failed'
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

  <main class="mx-auto max-w-[1320px] px-5 pb-12 pt-6 2xl:max-w-[1480px]">
    <!-- Loading -->
    <div v-if="isLoading" class="space-y-6">
      <div class="flex items-center gap-5">
        <div class="skel h-[60px] w-[60px] rounded-[12px]" />
        <div class="flex-1 space-y-2.5">
          <div class="skel h-7 w-64" />
          <div class="skel h-3.5 w-48" />
        </div>
      </div>
      <div class="skel h-9" />
      <div class="skel h-[120px]" />
      <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div class="skel h-[560px]" />
        <div class="skel h-[420px]" />
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="py-24 text-center">
      <p class="display text-[26px] text-ink">
        {{
          error === 'not-found'
            ? 'Summoner not found'
            : error === 'riot-unavailable'
              ? "Riot's API isn't answering"
              : "Couldn't load this profile"
        }}
      </p>
      <p class="mx-auto mt-2 max-w-[48ch] text-[12.5px] leading-relaxed text-ink-3">
        {{
          error === 'not-found'
            ? `No League profile was found for ${parsed.gameName}#${parsed.tagLine} across the supported regions.`
            : error === 'riot-unavailable'
              ? 'This profile is not stored yet and Riot is rate limiting us. It usually clears in a minute.'
              : 'Something broke on our side while looking this player up.'
        }}
      </p>
      <div class="mt-5 flex justify-center gap-2">
        <button class="btn btn-sm btn-primary" @click="retry">Try again</button>
        <a href="/" class="btn btn-sm">Back to search</a>
      </div>
    </div>

    <div v-else-if="profile">
      <ProfileHeader
        :summoner="profile"
        :view-count="viewCount"
        :is-syncing="isSyncing"
        :sync-message="syncMessage"
        :last-game-ms="lastGameMs"
        :main-champion="mainChampion"
        @sync="sync"
        @share="shareOpen = true"
      />

      <ProfileNav :slug="slug" :section="section" />

      <p v-if="failedPanels.length" class="notice mt-5" role="alert">
        <span>Some data could not be loaded ({{ failedPanels.join(', ') }}).</span>
        <button class="btn btn-sm ml-auto" @click="retry">Retry</button>
      </p>

      <!-- ── Overview ─────────────────────────────────────────── -->
      <template v-if="section === 'overview'">
        <div v-if="pending.ranks || ranks?.current?.some((rank) => rank.tier)" class="pt-6">
          <div v-if="pending.ranks" class="skel h-[120px]" />
          <RankStrip v-else :ranks="ranks" />
        </div>

        <div class="pt-8">
          <div v-if="pending.stats" class="skel h-[230px]" />
          <StatBoard
            v-else
            :stats="stats?.global ?? null"
            :previous="previousStats"
            :matches="performanceMatches"
            :puuid="profile.puuid"
            :window="STATS_WINDOW"
          />
        </div>

        <div class="grid items-start gap-x-8 gap-y-9 pt-9 lg:grid-cols-[minmax(0,1fr)_304px]">
          <section id="matches" class="min-w-0 scroll-mt-20">
            <div class="section">
              <h2>Match history</h2>
              <span class="meta num">{{ filterSummary }}</span>
            </div>

            <MatchFilters v-model="filters" :champions="champions" :busy="filterBusy" />

            <p v-if="filterError" class="notice mt-4" role="alert">
              <span>{{ filterError }}</span>
              <button class="btn btn-sm ml-auto" @click="applyFilters()">Retry</button>
            </p>

            <div v-if="pending.matches" class="skel mt-4 h-[520px]" />
            <div v-else class="mt-5">
              <MatchList :matches="displayedMatches" :puuid="profile.puuid" :summoner-slug="slug" />
            </div>

            <InfiniteScroll
              v-if="!filterError"
              :has-more="hasMore"
              :loading="pending.matches || filterBusy"
              :error="appendError"
              :empty="!displayedMatches.length"
              @load="applyFilters(true)"
            />
          </section>

          <aside class="grid min-w-0 items-start gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div v-if="pending.champions" class="skel h-[200px]" />
            <ChampionPool
              v-else
              :champions="champions"
              :slug="slug"
              :active="filters.champion"
              :limit="5"
              @pick="championMatches"
            />

            <div v-if="pending.matches" class="skel h-[160px]" />
            <RoleSplit v-else :matches="matches" :puuid="profile.puuid" />

            <div v-if="pending.teammates" class="skel h-[180px]" />
            <TeammatesPanel v-else :teammates="teammates" />

            <div v-if="pending.activity" class="skel h-[160px]" />
            <ActivityHeatmap v-else :activity="activity" />
          </aside>
        </div>
      </template>

      <!-- ── Champions ────────────────────────────────────────── -->
      <div v-else-if="section === 'champions'" class="pt-7">
        <div class="mb-5 flex flex-wrap items-center gap-3">
          <div class="seg">
            <button
              v-for="option in CHAMPION_VIEWS"
              :key="option.value"
              type="button"
              :data-active="championsView === option.value"
              @click="championsView = option.value"
            >
              {{ option.label }}
            </button>
          </div>
          <MatchFilters
            v-if="championsView === 'stats'"
            v-model="filters"
            hide-champion
            :busy="filterBusy"
          />
        </div>

        <p v-if="filterError" class="notice mb-4" role="alert">
          <span>{{ filterError }}</span>
          <button class="btn btn-sm ml-auto" @click="applyFilters()">Retry</button>
        </p>

        <ChampionExplorer
          v-if="championsView === 'stats'"
          :champions="filteredChampions ?? champions"
          :busy="filterBusy || pending.champions"
          @matches="championMatches"
        />
        <MasteryPanel
          v-else
          :mastery="mastery"
          :loading="masteryLoading"
          :error="masteryError"
          @retry="loadMastery"
        />
      </div>

      <!-- ── Friends ──────────────────────────────────────────── -->
      <div v-else-if="section === 'friends'" class="pt-7">
        <FriendsPanel :matches="friendMatches" :puuid="profile.puuid" :loading="friendsLoading" />
      </div>

      <!-- ── Live ─────────────────────────────────────────────── -->
      <div v-else-if="section === 'live'" class="pt-7">
        <LiveMatch :puuid="profile.puuid" :name="profile.gameName" />
      </div>

      <!-- ── Compare ──────────────────────────────────────────── -->
      <div v-else-if="section === 'compare'" class="pt-7">
        <PlayerCompare :profile="profile" :champions="champions" />
      </div>

      <ShareProfile
        v-if="shareOpen"
        :profile="profile"
        :stats="stats?.global ?? null"
        :champion="mainChampion"
        @close="shareOpen = false"
      />

      <footer
        class="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-[10.5px] text-ink-4"
      >
        <Wordmark :size="13" />
        <span>Not endorsed by Riot Games. League of Legends is a trademark of Riot Games.</span>
      </footer>
    </div>
  </main>
</template>
