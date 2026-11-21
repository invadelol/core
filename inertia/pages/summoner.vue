<script setup lang="ts">
import { Head, Link, router } from '@inertiajs/vue3'
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
import { PAGE_SIZE, positionOf, type Position } from '@invadelol/ui/logic'
import MasteryPanel from '../components/MasteryPanel.vue'
import FriendsPanel from '../components/FriendsPanel.vue'
import PlayerCompare from '../components/PlayerCompare.vue'
import LensSection from '../components/lens/LensSection.vue'
import SiteLayout from '../components/SiteLayout.vue'
import { RoleIcon } from '@invadelol/ui'
import Icon from '../components/ui/Icon.vue'
import Select from '../components/ui/Select.vue'
import Skeleton from '../components/ui/Skeleton.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import ProfileId from '../components/profile/ProfileId.vue'
import ProfileNav from '../components/profile/ProfileNav.vue'
import RankedCard from '../components/profile/RankedCard.vue'
import ActivityCard from '../components/profile/ActivityCard.vue'
import MatchRows from '../components/profile/MatchRows.vue'
import OlderGames from '../components/profile/OlderGames.vue'
import PerformanceCard from '../components/profile/PerformanceCard.vue'
import SideCards from '../components/profile/SideCards.vue'
import MainBuild from '../components/profile/aside/MainBuild.vue'
import ChampionsTable from '../components/profile/ChampionsTable.vue'
import LiveGame from '../components/profile/LiveGame.vue'
import { champIcon, championName } from '../lib/assets.js'
import type { IconName } from '../lib/icons.js'
import { profilePath } from '../lib/format.js'
import { useStickyColumn } from '../lib/sticky_column.js'
import '../css/profile.css'
import '../css/profile-aside.css'

/** The match list's filters: queue, champion, role (the API's own values). */
interface Filters {
  type: 'all' | 'ranked' | 'flex' | 'normal' | 'aram'
  champion: number
  role: 'all' | 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'SUPPORT'
}
import ShareProfile from '../components/ShareProfile.vue'
import { decodeSlug, parseSlug } from '../lib/format.js'
import { isRemake } from '../lib/match.js'
import { rememberPlayer, updateRecent } from '../lib/recent.js'
import type { SynergyReport } from '../lib/synergy.js'
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
  /** The professional player behind this account, when there is one. */
  pro?: {
    slug: string
    name: string
    staff: boolean
    role: string | null
    team: { id: string; slug: string; name: string; shortName: string | null } | null
  } | null
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
const failedPanels = ref<string[]>([])
const mastery = shallowRef<ChampionMastery[]>([])
/** Whether `mastery` is every champion, or only the top few the overview needs. */
const masteryComplete = ref(false)
const masteryLoading = ref(false)
const masteryError = ref(false)

let filterController: AbortController | undefined
let moreController: AbortController | undefined
let masteryController: AbortController | undefined

/** Where the player plays, most played first, read from the latest games. */
const roles = computed<Position[]>(() => {
  const counts = new Map<Position, number>()
  for (const match of matches.value) {
    const me = match.participants.find((p) => p.puuid === profile.value?.puuid)
    const lane = positionOf(me?.position)
    if (lane) counts.set(lane, (counts.get(lane) ?? 0) + 1)
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  return [...counts.entries()]
    .filter(([, n]) => n >= Math.max(2, total * 0.2))
    .sort((a, b) => b[1] - a[1])
    .map(([lane]) => lane)
})
const mainChampion = computed(() => champions.value[0]?.championId ?? mastery.value[0]?.championId)
const loadedMatches = computed(() => filteredMatches.value ?? matches.value)
/** Custom games (practice tool, lobbies with friends) are not part of anyone's record. */
const displayedMatches = computed(() => loadedMatches.value.filter((m) => m.queueId !== 0))
const hiddenCustoms = computed(() => loadedMatches.value.length - displayedMatches.value.length)

/** What the current filters actually returned, printed next to them. */
const filterSummary = computed(() => {
  const list = displayedMatches.value.filter((m) => !isRemake(m))
  if (!list.length) return ''
  let wins = 0
  for (const match of list) {
    if (match.participants.find((p) => p.puuid === profile.value?.puuid)?.win) wins++
  }
  return `${list.length} games · ${wins}W ${list.length - wins}L · ${Math.round((wins / list.length) * 100)}%`
})

const performanceMatches = shallowRef<Match[]>([])
/** The window before it, for the score's change. */
const previousMatches = shallowRef<Match[]>([])
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
  previousMatches.value = []

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
    const games = `/api/summoners/puuid/${profile.value.puuid}/matches`
    const [current, before, recent, older] = await Promise.all([
      fetch(`${base}?${query(0)}`, { signal }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${base}?${query(STATS_WINDOW)}`, { signal }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${games}?${query(0)}&view=summary`, { signal }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${games}?${query(STATS_WINDOW)}&view=summary`, { signal }).then((r) =>
        r.ok ? r.json() : null
      ),
    ])
    if (signal.aborted) return
    failedPanels.value = failedPanels.value.filter((key) => key !== 'stats')
    if (!current || !before || !recent) failedPanels.value.push('stats')
    stats.value = current
    performanceMatches.value = recent ?? []
    previousMatches.value = older ?? []
    previousStats.value = before?.global?.total ? before.global : null
  } catch {
    if (!signal.aborted && !failedPanels.value.includes('stats')) failedPanels.value.push('stats')
  } finally {
    if (!signal.aborted) pending.stats = false
  }
}

const friendsReport = shallowRef<SynergyReport | null>(null)
const friendsLoading = ref(false)
const friendsError = ref(false)
let friendsController: AbortController | undefined

/** Who the player queues with, read by the server from their latest stored games. */
async function loadFriends(again = false) {
  if (!profile.value || (friendsReport.value && !again)) return
  friendsController?.abort()
  friendsController = new AbortController()
  const signal = friendsController.signal
  friendsLoading.value = true
  friendsError.value = false
  try {
    const res = await fetch(`/api/summoners/puuid/${profile.value.puuid}/synergy`, { signal })
    if (!res.ok) throw new Error()
    const data = (await res.json()) as SynergyReport
    if (!signal.aborted) friendsReport.value = data
  } catch {
    if (!signal.aborted) friendsError.value = true
  } finally {
    if (!signal.aborted) friendsLoading.value = false
  }
}

/**
 * The Mastery panel lists every champion; the rest of the profile only needs
 * the top ones, which the API can answer from a snapshot the Invade app
 * reported instead of asking Riot.
 */
async function loadMastery(complete = section.value === 'mastery') {
  if (!profile.value) return
  masteryController?.abort()
  masteryController = new AbortController()
  const signal = masteryController.signal
  masteryLoading.value = true
  masteryError.value = false
  try {
    const query = complete ? '' : '?count=10'
    const response = await fetch(`/api/summoners/puuid/${profile.value.puuid}/mastery${query}`, {
      signal,
    })
    if (!response.ok) throw new Error()
    const data = await response.json()
    if (!signal.aborted) {
      masteryComplete.value = complete
      mastery.value = data.sort(
        (a: ChampionMastery, b: ChampionMastery) => b.championPoints - a.championPoints
      )
    }
  } catch {
    if (!signal.aborted) masteryError.value = true
  } finally {
    if (!signal.aborted) masteryLoading.value = false
  }
}

/** The match list's query for the current filters. */
function matchQuery() {
  const query = new URLSearchParams({
    type: filters.value.type,
    role: filters.value.role,
    count: String(PAGE_SIZE),
    view: 'summary',
  })
  if (filters.value.champion) query.set('champion', String(filters.value.champion))
  return query
}

async function applyFilters() {
  if (!profile.value) return
  moreController?.abort()
  filterController?.abort()
  filterController = new AbortController()
  const signal = filterController.signal
  filterBusy.value = true
  filterError.value = ''
  void loadStats()
  const isChampions = section.value === 'champions'
  const query = isChampions
    ? new URLSearchParams({ type: filters.value.type, role: filters.value.role, count: '100' })
    : matchQuery()
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
      filteredMatches.value = data
      hasMore.value = data.length === PAGE_SIZE
    }
  } catch {
    if (!signal.aborted) filterError.value = 'These results could not be loaded.'
  } finally {
    if (!signal.aborted) filterBusy.value = false
  }
}

/**
 * The next page of the match history, as its end comes into view (OlderGames asks while it stays
 * in view; stored pages are free). The plain list pages by date, so the API fills it from Riot
 * with games it does not hold yet, under its own budget: a page it held back carries what is
 * stored and `Retry-After`, and the list quietly ends there until a later scroll to the end. A
 * filtered list pages through the stored games.
 */
async function loadMore(): Promise<void | { retryAfterMs: number }> {
  const list = loadedMatches.value
  if (!profile.value || !list.length || filterBusy.value) return
  moreController?.abort()
  moreController = new AbortController()
  const signal = moreController.signal
  const query = matchQuery()
  const { type, role, champion } = filters.value
  if (type === 'all' && role === 'all' && !champion)
    query.set('before', String(Number(list[list.length - 1].gameStartMs)))
  else query.set('offset', String(list.length))
  try {
    const response = await fetch(`/api/summoners/puuid/${profile.value.puuid}/matches?${query}`, {
      signal,
    })
    // A 429 with Retry-After (a limit in front of the API) ends the list as quietly.
    const retryAfter = Number(response.headers.get('retry-after'))
    if (response.status === 429 && retryAfter) return { retryAfterMs: retryAfter * 1000 }
    if (!response.ok) throw new Error()
    const incoming = (await response.json()) as Match[]
    if (signal.aborted) return
    filteredMatches.value = [
      ...new Map([...list, ...incoming].map((match) => [match.matchId, match])).values(),
    ]
    if (retryAfter > 0) return { retryAfterMs: retryAfter * 1000 }
    hasMore.value = incoming.length === PAGE_SIZE
  } catch (error) {
    // A new list (filters, another player) replaced this one: nothing to say.
    if (!signal.aborted) throw error
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
  if (section.value === 'mastery' && !masteryComplete.value) void loadMastery(true)
  if (section.value === 'friends') void loadFriends()
  if (['overview', 'matches', 'champions'].includes(section.value)) void applyFilters()
})

/** Picking a champion anywhere sends you to that champion's games. */
function championMatches(id: number) {
  filters.value.champion = id
  if (section.value === 'overview') {
    void nextTick(() => document.getElementById('matches')?.scrollIntoView({ block: 'start' }))
    return
  }
  router.visit(`/${encodeURIComponent(slug.value)}/matches`, {
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

/** A number, whichever way the database driver returned the bigint. */
const lastGameMs = computed(() => (matches.value[0] ? Number(matches.value[0].gameStartMs) : null))

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

/** The solo queue rank, remembered with the player in this browser's recent list. */
function soloRank(payload: RanksPayload) {
  const solo = payload.current?.find((r) => r.queueType === 'RANKED_SOLO_5x5' && r.tier)
  return solo ? { tier: solo.tier, division: solo.division, leaguePoints: solo.leaguePoints } : null
}

async function load() {
  controller?.abort()
  statsController?.abort()
  friendsController?.abort()
  filterController?.abort()
  moreController?.abort()
  masteryController?.abort()
  clearTimeout(viewTimer)
  clearTimeout(messageTimer)
  controller = new AbortController()
  const { signal } = controller
  failedPanels.value = []
  filters.value = { type: 'all', champion: 0, role: 'all' }
  hasMore.value = false
  filterBusy.value = false
  filterError.value = ''
  filteredMatches.value = null
  filteredChampions.value = null
  mastery.value = []
  masteryComplete.value = false
  friendsReport.value = null
  friendsError.value = false
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
      platform: result.platform,
      level: result.summonerLevel,
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
    if (section.value === 'friends') void loadFriends()
    await loadAnalytics(result.puuid, signal)
    if (!signal.aborted && ranks.value) updateRecent(result, { rank: soloRank(ranks.value) })
    if (
      !signal.aborted &&
      (filters.value.type !== 'all' || filters.value.role !== 'all' || filters.value.champion)
    )
      await applyFilters()
    if (!signal.aborted && !filteredMatches.value) hasMore.value = matches.value.length >= PAGE_SIZE
  } catch {
    if (!signal.aborted) error.value = 'error'
  } finally {
    if (!signal.aborted) isLoading.value = false
  }
}

function retry() {
  void load()
}

/**
 * Where the rail sits beside the games (lg and up) the list loads older games as its end comes
 * into view. Narrower, the rail (rank, champions, roles…) follows the games: there each page waits
 * for a tap, or the rail would never be reached.
 */
const wide = ref(true)
let wideQuery: MediaQueryList | undefined
const onWide = () => (wide.value = Boolean(wideQuery?.matches))

onMounted(() => {
  wideQuery = window.matchMedia('(min-width: 1101px)')
  onWide()
  wideQuery.addEventListener('change', onWide)
  watch(
    () => props.summoner,
    () => void load(),
    { immediate: true }
  )
})

onBeforeUnmount(() => {
  wideQuery?.removeEventListener('change', onWide)
  filterController?.abort()
  moreController?.abort()
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
      if (section.value === 'friends') void loadFriends(true)
      else friendsReport.value = null
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
/* ── The page's own pieces ─────────────────────────────────── */
/** Games the overview lists before "Show older games" (the Matches route lists them all). */
const OVERVIEW_GAMES = 10

/* ── A right column beside the games, behind `?v=a|b|c` (Overview and Matches) ── */
const v = ref<'a' | 'b' | 'c' | null>(null)
onMounted(() => {
  const q = new URLSearchParams(window.location.search).get('v')
  v.value = q === 'a' || q === 'b' || q === 'c' ? q : null
})
const aside = computed(() =>
  v.value && (section.value === 'overview' || section.value === 'matches') ? v.value : null
)
const QUEUES: { value: Filters['type']; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'ranked', label: 'Solo/Duo' },
  { value: 'flex', label: 'Flex' },
  { value: 'normal', label: 'Normals' },
  { value: 'aram', label: 'ARAM' },
]
const ROLE_FILTERS: { value: Filters['role']; label: string; lane: Position }[] = [
  { value: 'TOP', label: 'Top', lane: 'TOP' },
  { value: 'JUNGLE', label: 'Jungle', lane: 'JUNGLE' },
  { value: 'MIDDLE', label: 'Mid', lane: 'MID' },
  { value: 'BOTTOM', label: 'Bot', lane: 'ADC' },
  { value: 'SUPPORT', label: 'Support', lane: 'SUPPORT' },
]
const base = computed(() => profilePath(parsed.value.gameName, parsed.value.tagLine))
const nav = computed(() => [
  { key: 'overview', label: 'Overview', href: base.value, icon: 'grid' as IconName },
  { key: 'live', label: 'Live game', href: `${base.value}/live`, icon: 'live' as IconName },
  {
    key: 'champions',
    label: 'Champions',
    href: `${base.value}/champions`,
    icon: 'swords' as IconName,
    count: champions.value.length || undefined,
  },
  { key: 'mastery', label: 'Mastery', href: `${base.value}/mastery`, icon: 'trophy' as IconName },
  {
    key: 'friends',
    label: 'Friends',
    href: `${base.value}/friends`,
    icon: 'users' as IconName,
    count: teammates.value.length || undefined,
  },
  { key: 'compare', label: 'Compare', href: `${base.value}/compare`, icon: 'compare' as IconName },
])
/** The Matches and Lens routes belong to the Overview: its item stays lit in the nav. */
const inOverview = computed(() => ['overview', 'matches', 'lens'].includes(section.value))
const navActive = computed(() => (inOverview.value ? 'overview' : section.value))
/** The whole left column (rail and summary) stays in view beside the section. */
const side = ref<HTMLElement | null>(null)
useStickyColumn(side)
const championOptions = computed(() => [
  { value: 0, label: 'All champions' },
  ...champions.value.map((c) => ({
    value: c.championId,
    label: championName(c.championId),
    icon: champIcon(c.championId),
    meta: `${c.games}`,
  })),
])
const championFilter = computed({
  get: () => filters.value.champion,
  set: (champion: number) => (filters.value = { ...filters.value, champion }),
})
const filtered = computed(
  () => filters.value.type !== 'all' || filters.value.role !== 'all' || filters.value.champion > 0
)
function clearFilters() {
  filters.value = { type: 'all', champion: 0, role: 'all' }
}
</script>

<template>
  <Head :title="`${parsed.gameName}#${parsed.tagLine}: LoL profile and match history`" />
  <SiteLayout>
    <div class="wrap pg-pf">
      <!-- Loading: the shape of the profile that is coming -->
      <div v-if="isLoading" class="pl" aria-busy="true">
        <div class="pl-side">
          <aside class="pl-rail">
            <div class="card pl-sec"><Skeleton :height="232" /></div>
            <div class="card pl-sec"><Skeleton :rows="5" /></div>
          </aside>
          <aside class="pl-more">
            <div class="pl-gs"><Skeleton :rows="5" pic /></div>
          </aside>
        </div>
        <div class="pl-main">
          <div class="card pf"><Skeleton :height="260" /></div>
          <div class="card" style="padding: 16px"><Skeleton :rows="6" pic /></div>
        </div>
      </div>

      <EmptyState
        v-else-if="error"
        icon="search"
        style="padding-top: 64px"
        :title="
          error === 'not-found'
            ? 'Summoner not found'
            : error === 'riot-unavailable'
              ? 'Riot\'s API is not answering'
              : 'This profile could not be loaded'
        "
        :line="
          error === 'not-found'
            ? `No League profile was found for ${parsed.gameName}#${parsed.tagLine} on any server.`
            : error === 'riot-unavailable'
              ? 'This profile is not stored yet and Riot is limiting requests. It usually clears in a minute.'
              : 'Something broke on our side while looking this player up.'
        "
      >
        <span class="row" style="gap: 8px">
          <button class="btn pri" type="button" @click="retry">Try again</button>
          <a class="btn" href="/">Back to search</a>
        </span>
      </EmptyState>

      <div v-else-if="profile" class="pl" :class="aside ? `pa pa-${aside}` : null">
        <!-- The left column, sticky beside the section (wide screens) -->
        <div ref="side" class="pl-side">
          <!-- The rail: who, where to go, the rank -->
          <aside class="pl-rail">
            <ProfileId
              :summoner="profile"
              :roles="roles"
              :last-game-ms="lastGameMs"
              :view-count="viewCount"
              :is-syncing="isSyncing"
              :sync-message="syncMessage"
              :pro="props.pro ?? null"
              :champion="mainChampion"
              :compare-href="`${base}/compare`"
              @sync="sync"
              @share="shareOpen = true"
            />
            <ProfileNav :items="nav" :active="navActive" />
            <div v-if="pending.ranks" class="card pl-sec"><Skeleton :height="96" /></div>
            <RankedCard v-else :ranks="ranks" :puuid="profile.puuid" />
          </aside>

          <!-- The summary, the same on every section: champions, roles, mates, activity -->
          <aside class="pl-more" aria-label="Summary">
            <div v-if="pending.champions || pending.matches" class="pl-gs">
              <Skeleton :rows="5" pic />
            </div>
            <SideCards
              v-else-if="aside !== 'a'"
              :champions="aside ? [] : champions"
              :matches="matches"
              :teammates="teammates"
              :puuid="profile.puuid"
              :champions-href="`${base}/champions`"
              :friends-href="`${base}/friends`"
            />
            <ActivityCard
              v-if="aside !== 'a' && !pending.activity && activity.length"
              :activity="activity"
            />
          </aside>
        </div>

        <!-- C: the right column from the top, Performance in it, the games first in the middle -->
        <aside v-if="aside === 'c'" class="pl-aside" aria-label="More">
          <template v-if="section === 'overview'">
            <div v-if="pending.stats" class="card pf"><Skeleton :height="260" /></div>
            <PerformanceCard
              v-else
              :matches="performanceMatches"
              :previous="previousMatches"
              :stats="stats?.global ?? null"
              :previous-stats="previousStats"
              :puuid="profile.puuid"
            />
          </template>
          <template v-if="!pending.matches">
            <MainBuild
              v-if="!pending.matches"
              mode="spotlight"
              :matches="matches"
              :puuid="profile.puuid"
              :champion="mainChampion ?? null"
              :stats="champions"
              :name="profile.gameName"
            />
            <SideCards
              v-if="!pending.champions"
              :champions="champions"
              :matches="[]"
              :teammates="[]"
              :puuid="profile.puuid"
              :champions-href="`${base}/champions`"
              :friends-href="`${base}/friends`"
            />
          </template>
        </aside>

        <div class="pl-main">
          <p v-if="failedPanels.length" class="pf-note" role="alert">
            Some data could not be loaded ({{ failedPanels.join(', ') }}).
            <button type="button" class="btn sm" @click="retry">Retry</button>
          </p>

          <!-- ── Overview and Matches ──────────────────────────── -->
          <template v-if="section === 'overview' || section === 'matches'">
            <template v-if="section === 'overview' && aside !== 'c'">
              <div v-if="pending.stats" class="card pf"><Skeleton :height="260" /></div>
              <PerformanceCard
                v-else
                :matches="performanceMatches"
                :previous="previousMatches"
                :stats="stats?.global ?? null"
                :previous-stats="previousStats"
                :puuid="profile.puuid"
              />
            </template>

            <section id="matches" class="mh">
              <div class="mh-h">
                <h2 class="h3">Match history</h2>
                <span class="meta num">{{ filterSummary }}</span>
              </div>
              <div class="mh-h mh-f">
                <div class="seg" role="group" aria-label="Queue">
                  <button
                    v-for="q in QUEUES"
                    :key="q.value"
                    type="button"
                    :class="{ on: filters.type === q.value }"
                    :aria-pressed="filters.type === q.value"
                    @click="filters = { ...filters, type: q.value }"
                  >
                    {{ q.label }}
                  </button>
                </div>
                <div class="seg mh-roles" role="group" aria-label="Role">
                  <button
                    type="button"
                    :class="{ on: filters.role === 'all' }"
                    :aria-pressed="filters.role === 'all'"
                    @click="filters = { ...filters, role: 'all' }"
                  >
                    All
                  </button>
                  <button
                    v-for="r in ROLE_FILTERS"
                    :key="r.value"
                    type="button"
                    :title="r.label"
                    :aria-label="r.label"
                    :class="{ on: filters.role === r.value }"
                    :aria-pressed="filters.role === r.value"
                    @click="filters = { ...filters, role: r.value }"
                  >
                    <RoleIcon :lane="r.lane" :size="15" />
                  </button>
                </div>
                <Select
                  v-model="championFilter"
                  :options="championOptions"
                  searchable
                  search-placeholder="Find a champion"
                  width="15rem"
                  align="right"
                  class="mh-champ"
                />
              </div>
              <p v-if="hiddenCustoms" class="meta">
                {{ hiddenCustoms }} custom {{ hiddenCustoms === 1 ? 'game' : 'games' }} not shown
              </p>
              <p v-if="filterError" class="pf-note" role="alert">
                {{ filterError }}
                <button type="button" class="btn sm" @click="applyFilters()">Retry</button>
              </p>
              <div v-if="pending.matches" class="card" style="padding: 16px">
                <Skeleton :rows="6" pic />
              </div>
              <EmptyState
                v-else-if="!displayedMatches.length"
                icon="list"
                title="No game here"
                :line="filtered ? 'No stored game matches these filters.' : null"
              >
                <button v-if="filtered" class="btn" type="button" @click="clearFilters">
                  Clear the filters
                </button>
              </EmptyState>
              <div v-else :class="{ 'mh-busy': filterBusy }">
                <MatchRows
                  :matches="
                    section === 'overview'
                      ? displayedMatches.slice(0, OVERVIEW_GAMES)
                      : displayedMatches
                  "
                  :puuid="profile.puuid"
                  :game-name="profile.gameName"
                  :tag-line="profile.tagLine"
                />
              </div>
              <Link
                v-if="section === 'overview' && displayedMatches.length"
                class="btn mh-older"
                :href="`${base}/matches`"
                preserve-scroll
                >Show older games<Icon name="chev"
              /></Link>
              <OlderGames
                v-if="section === 'matches' && !pending.matches"
                v-show="!filterError && loadedMatches.length"
                :key="profile.puuid"
                style="margin-top: 4px"
                :more="hasMore"
                :load="loadMore"
                :auto="wide"
              />
            </section>
            <!-- A and B: the right column beside the games, under Performance -->
            <aside v-if="aside === 'a'" class="pl-aside" aria-label="More">
              <SideCards
                v-if="!pending.champions && !pending.matches"
                :champions="champions"
                :matches="matches"
                :teammates="teammates"
                :puuid="profile.puuid"
                :champions-href="`${base}/champions`"
                :friends-href="`${base}/friends`"
              />
              <ActivityCard v-if="!pending.activity && activity.length" :activity="activity" />
            </aside>
            <aside v-if="aside === 'b'" class="pl-aside" aria-label="More">
              <MainBuild
                v-if="!pending.matches"
                :matches="matches"
                :puuid="profile.puuid"
                :champion="mainChampion ?? null"
                :stats="champions"
                :name="profile.gameName"
              />
              <SideCards
                v-if="!pending.champions"
                :champions="champions"
                :matches="[]"
                :teammates="[]"
                :puuid="profile.puuid"
                :champions-href="`${base}/champions`"
                :friends-href="`${base}/friends`"
              />
            </aside>
          </template>

          <!-- ── Live: asks Riot once, when opened ─────────────────── -->
          <LiveGame
            v-else-if="section === 'live'"
            :puuid="profile.puuid"
            :game-name="profile.gameName"
            :platform="profile.platform"
            :last-game-ms="lastGameMs"
          />

          <!-- ── Lens (no item of its own: reached from its old address) ─ -->
          <LensSection v-else-if="section === 'lens'" :puuid="profile.puuid" />

          <!-- ── Champions ──────────────────────────────────────── -->
          <ChampionsTable
            v-else-if="section === 'champions'"
            :champions="filteredChampions ?? champions"
            :busy="filterBusy || pending.champions"
            :error="filterError"
            :queue="filters.type"
            :role="filters.role"
            :mastery="mastery"
            @queue="(type) => (filters = { ...filters, type: type as Filters['type'] })"
            @role="(role) => (filters = { ...filters, role: role as Filters['role'] })"
            @retry="applyFilters()"
            @matches="championMatches"
          />

          <!-- ── Mastery, Friends, Compare ───────────────────────── -->
          <MasteryPanel
            v-else-if="section === 'mastery'"
            :mastery="mastery"
            :loading="masteryLoading"
            :error="masteryError"
            @retry="loadMastery(true)"
          />
          <FriendsPanel
            v-else-if="section === 'friends'"
            :report="friendsReport"
            :profile="profile"
            :loading="friendsLoading"
            :error="friendsError"
            @retry="loadFriends(true)"
          />
          <PlayerCompare
            v-else-if="section === 'compare'"
            :profile="profile"
            :champions="champions"
          />
        </div>
      </div>

      <ShareProfile
        v-if="profile && shareOpen"
        :profile="profile"
        :stats="stats"
        :ranks="ranks"
        :queue="filters.type"
        :champion="mainChampion"
        @close="shareOpen = false"
      />
    </div>
  </SiteLayout>
</template>
