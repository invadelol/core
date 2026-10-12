<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3'
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import {
  ChampionTable,
  Icon,
  LpGraph,
  MatchList,
  PlayedWithPanel,
  PlayerHeader,
  ProfileLayout,
  RolesPanel,
} from '@invadelol/ui'
import {
  playedWithFromCore,
  profileFromCore,
  summaryOf,
  type MatchSummary,
  type Position,
  type QueueFilter,
  type ScoreRow,
} from '@invadelol/ui/logic'
import AppHeader from '../components/AppHeader.vue'
import ProfileNav from '../components/ProfileNav.vue'
import ActivityHeatmap from '../components/ActivityHeatmap.vue'
import GameDetail from '../components/GameDetail.vue'
import MatchFilters, { type Filters } from '../components/MatchFilters.vue'
import ChampionExplorer from '../components/ChampionExplorer.vue'
import MasteryPanel from '../components/MasteryPanel.vue'
import FriendsPanel from '../components/FriendsPanel.vue'
import LiveMatch from '../components/LiveMatch.vue'
import PlayerCompare from '../components/PlayerCompare.vue'
import ShareProfile from '../components/ShareProfile.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { decodeSlug, parseSlug } from '../lib/format.js'
import { detailOf } from '../lib/match.js'
import { rememberPlayer, updateRecent } from '../lib/recent.js'
import type {
  ActivityDay,
  ChampionMastery,
  ChampionStats,
  Match,
  RanksPayload,
  Summoner,
} from '../lib/types.js'

type PanelKey = 'matches' | 'ranks' | 'mastery' | 'activity'

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

/** The route param, decoded exactly once. Encode from this, never from the prop. */
const slug = computed(() => decodeSlug(props.summoner))
const parsed = computed(() => parseSlug(props.summoner))

/** A page of the feed; the first one is the server's preloaded request. */
const PAGE = 15

/** Used only if the page was served without a panel list. */
const FALLBACK_PANELS: ReadonlyArray<{ key: PanelKey; path: string }> = [
  { key: 'matches', path: `matches?count=${PAGE}&view=summary` },
  { key: 'ranks', path: 'ranks' },
  { key: 'mastery', path: 'mastery?count=10' },
  { key: 'activity', path: 'activity' },
]

const profile = shallowRef<Summoner | null>(props.initialProfile ?? null)
const matches = shallowRef<Match[]>([])
const ranks = shallowRef<RanksPayload | null>(null)
const mastery = shallowRef<ChampionMastery[]>([])
const activity = shallowRef<ActivityDay[]>([])
const pending = reactive<Record<PanelKey, boolean>>({
  matches: true,
  ranks: true,
  mastery: true,
  activity: true,
})
const failedPanels = ref<PanelKey[]>([])

/** What went wrong, so the page can say something true about it. */
type LoadFailure = 'not-found' | 'riot-unavailable' | 'error'
const isLoading = ref(!profile.value)
const error = ref<LoadFailure | null>(null)

// ── The feed, in the shared model ────────────────────────────────────────────

/** Custom games (practice tool, lobbies with friends) are not part of anyone's record. */
const played = computed(() => matches.value.filter((m) => m.queueId !== 0))

/** Each stored game is read once, however often the list is recomputed. */
const summaries = new WeakMap<Match, MatchSummary | null>()
function summary(m: Match) {
  if (!summaries.has(m)) summaries.set(m, summaryOf(detailOf(m), profile.value!.puuid, m.matchId))
  return summaries.get(m)!
}
const games = computed(() => played.value.map(summary).filter((g) => g !== null))
const scores = computed(
  () =>
    new Map<number, ScoreRow>(games.value.flatMap((g) => (g.score ? [[g.gameId, g.score]] : [])))
)
/** LP won or lost, for the games the desktop app reported it. */
const lp = computed(
  () =>
    new Map<number, number>(
      played.value.flatMap((m) => {
        const g = summary(m)
        return g && typeof m.lpChange === 'number' ? [[g.gameId, m.lpChange]] : []
      })
    )
)

const view = computed(() =>
  profile.value
    ? profileFromCore({
        summoner: profile.value,
        ranks: ranks.value,
        mastery: mastery.value,
        games: games.value,
      })
    : null
)
const mates = computed(() =>
  profile.value && !pending.matches ? playedWithFromCore(played.value, profile.value.puuid) : null
)
/** The LP line needs two readings of a queue; the site has no "it fills in as you play". */
const lpLine = computed(
  () =>
    !!view.value &&
    ['solo', 'flex'].some((q) => view.value!.lp.filter((p) => p.queue === q).length > 1)
)
const mainChampion = computed(
  () => view.value?.champions[0]?.championId ?? mastery.value[0]?.championId
)

const queue = shallowRef<QueueFilter>('all')
const champion = shallowRef(0)
const role = shallowRef<Position | ''>('')
const order = shallowRef<'recent' | 'champion'>('recent')

const hasMore = ref(false)
const loadingMore = ref(false)

async function loadMore() {
  if (!profile.value || loadingMore.value || !hasMore.value) return
  const signal = controller!.signal
  loadingMore.value = true
  try {
    const query = `count=${PAGE}&view=summary&offset=${matches.value.length}`
    const res = await fetch(`/api/summoners/puuid/${profile.value.puuid}/matches?${query}`, {
      signal,
    })
    if (!res.ok) throw new Error()
    const page = (await res.json()) as Match[]
    if (signal.aborted) return
    const known = new Set(matches.value.map((m) => m.matchId))
    matches.value = [...matches.value, ...page.filter((m) => !known.has(m.matchId))]
    hasMore.value = page.length === PAGE
  } catch {
    if (!signal.aborted) hasMore.value = false
  } finally {
    if (!signal.aborted) loadingMore.value = false
  }
}

/** Win rate, KDA and farm of the loaded games, for the share card. */
const shareStats = computed(() => {
  const list = games.value.filter((g) => !g.remake)
  if (!list.length) return null
  const sum = (f: (g: MatchSummary) => number) => list.reduce((s, g) => s + f(g), 0)
  return {
    winrate: sum((g) => (g.win ? 1 : 0)) / list.length,
    kda:
      (sum((g) => g.kills) + sum((g) => g.assists)) /
      Math.max(
        1,
        sum((g) => g.deaths)
      ),
    csMin: sum((g) => g.cs) / Math.max(1, sum((g) => g.duration) / 60),
  }
})

// ── Other sections: the whole pool over 100 games, every mastery, duos ───────

const championFilters = ref<Filters>({ type: 'all', champion: 0, role: 'all' })
const champions = shallowRef<ChampionStats[]>([])
const championsBusy = ref(false)
const championsError = ref(false)
let championsController: AbortController | undefined

async function loadChampions() {
  if (!profile.value) return
  championsController?.abort()
  championsController = new AbortController()
  const signal = championsController.signal
  championsBusy.value = true
  championsError.value = false
  const { type, role: position } = championFilters.value
  const query = new URLSearchParams({ type, role: position, count: '100' })
  try {
    const res = await fetch(`/api/summoners/puuid/${profile.value.puuid}/champions?${query}`, {
      signal,
    })
    if (!res.ok) throw new Error()
    const data = await res.json()
    if (!signal.aborted) champions.value = data
  } catch {
    if (!signal.aborted) championsError.value = true
  } finally {
    if (!signal.aborted) championsBusy.value = false
  }
}
watch(championFilters, () => void loadChampions(), { deep: true })

/** Champions has two readings of the same pool: recent form, and lifetime. */
const championsView = ref<'stats' | 'mastery'>('stats')
const CHAMPION_VIEWS = [
  { value: 'stats' as const, label: 'Recent form' },
  { value: 'mastery' as const, label: 'Mastery' },
]

/** Whether `mastery` is every champion, or only the top ten the overview needs. */
const masteryComplete = ref(false)
const masteryLoading = ref(false)
const masteryError = ref(false)
let masteryController: AbortController | undefined

async function loadAllMastery() {
  if (!profile.value) return
  masteryController?.abort()
  masteryController = new AbortController()
  const signal = masteryController.signal
  masteryLoading.value = true
  masteryError.value = false
  try {
    const res = await fetch(`/api/summoners/puuid/${profile.value.puuid}/mastery`, { signal })
    if (!res.ok) throw new Error()
    const data = (await res.json()) as ChampionMastery[]
    if (signal.aborted) return
    mastery.value = data.sort((a, b) => b.championPoints - a.championPoints)
    masteryComplete.value = true
  } catch {
    if (!signal.aborted) masteryError.value = true
  } finally {
    if (!signal.aborted) masteryLoading.value = false
  }
}

const friendMatches = shallowRef<Match[]>([])
const friendsLoading = ref(false)
let friendsController: AbortController | undefined

/** Synergy needs roles, which only the match rows carry, so it reads a
 *  wider sample of the player's own games than the feed has loaded. */
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

/** Each section loads what only it reads, the first time it is opened. */
function openSection() {
  if (!profile.value) return
  if (['champions', 'compare'].includes(section.value) && !champions.value.length)
    void loadChampions()
  if (section.value === 'champions' && !masteryComplete.value) void loadAllMastery()
  if (section.value === 'friends') void loadFriendMatches()
}
watch(section, openSection)

/** Picking a champion in Champions sends you to that champion's games. */
function championMatches(id: number) {
  champion.value = id
  router.visit(`/${encodeURIComponent(slug.value)}`, { preserveState: true })
}

// ── Loading ──────────────────────────────────────────────────────────────────

let controller: AbortController | undefined
let viewTimer: ReturnType<typeof setTimeout> | undefined
let messageTimer: ReturnType<typeof setTimeout> | undefined

function failureFor(res: Response): LoadFailure {
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
const targets: Record<PanelKey, { value: unknown }> = { matches, ranks, mastery, activity }

/** Paint each independent panel as soon as its request finishes. */
async function loadPanels(puuid: string, signal: AbortSignal) {
  const base = `/api/summoners/puuid/${puuid}`
  await Promise.all(
    (props.panels ?? FALLBACK_PANELS).map(async ({ key, path }) => {
      try {
        const res = await fetch(`${base}/${path}`, { signal })
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (!signal.aborted) targets[key].value = data
      } catch {
        // Mastery is a bonus (Riot only answers it for players the app never reported).
        if (!signal.aborted && key !== 'mastery') failedPanels.value.push(key)
      } finally {
        if (!signal.aborted) pending[key] = false
      }
    })
  )
  if (!signal.aborted) hasMore.value = matches.value.length >= PAGE
}

const controllers = () => [controller, championsController, masteryController, friendsController]

async function load() {
  for (const c of controllers()) c?.abort()
  clearTimeout(viewTimer)
  clearTimeout(messageTimer)
  controller = new AbortController()
  const { signal } = controller
  profile.value = props.initialProfile ?? null
  isLoading.value = !profile.value
  error.value = null
  failedPanels.value = []
  matches.value = []
  ranks.value = null
  mastery.value = []
  activity.value = []
  champions.value = []
  friendMatches.value = []
  masteryComplete.value = false
  hasMore.value = false
  loadingMore.value = false
  isSyncing.value = false
  syncMessage.value = null
  queue.value = 'all'
  champion.value = 0
  role.value = ''
  order.value = 'recent'
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
    // A visit counts once the page has been read a moment; views order the search.
    viewTimer = setTimeout(() => {
      fetch(`/api/summoners/puuid/${result.puuid}/increment`, { method: 'PUT', signal }).catch(
        () => {}
      )
    }, 3000)
    openSection()
    await loadPanels(result.puuid, signal)
    const solo = view.value?.card.solo
    if (!signal.aborted)
      updateRecent(result, {
        rank: solo ? { tier: solo.tier, division: solo.division, leaguePoints: solo.lp } : null,
      })
  } catch {
    if (!signal.aborted) error.value = 'error'
  } finally {
    if (!signal.aborted) isLoading.value = false
  }
}

onMounted(() => {
  watch(
    () => props.summoner,
    () => void load(),
    { immediate: true }
  )
})

onBeforeUnmount(() => {
  for (const c of controllers()) c?.abort()
  clearTimeout(viewTimer)
  clearTimeout(messageTimer)
})

// ── Update ───────────────────────────────────────────────────────────────────

const isSyncing = ref(false)
const syncMessage = ref<string | null>(null)
const shareOpen = ref(false)

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
      if (result.summoner) profile.value = result.summoner
      syncMessage.value = result.rankRefreshFailed
        ? 'Matches updated; rank refresh unavailable'
        : found
          ? `${found} new match${found > 1 ? 'es' : ''}`
          : 'Already up to date'
      failedPanels.value = []
      await loadPanels(profile.value!.puuid, signal)
      champions.value = []
      friendMatches.value = []
      masteryComplete.value = false
      openSection()
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

  <div class="flex min-h-screen flex-col">
    <AppHeader />

    <main class="page flex-1 pt-6">
      <ProfileLayout v-if="isLoading" loading />

      <div v-else-if="error" class="state">
        <h1 class="text-[20px] font-semibold text-ink">
          {{
            error === 'not-found'
              ? 'Summoner not found'
              : error === 'riot-unavailable'
                ? "Riot's API isn't answering"
                : "Couldn't load this profile"
          }}
        </h1>
        <p class="mt-2 text-[14px] leading-relaxed text-ink-2">
          {{
            error === 'not-found'
              ? `No League profile was found for ${parsed.gameName}#${parsed.tagLine} across the supported regions.`
              : error === 'riot-unavailable'
                ? 'This profile is not stored yet and Riot is rate limiting us. It usually clears in a minute.'
                : 'Something broke on our side while looking this player up.'
          }}
        </p>
        <div class="mt-5 flex gap-2">
          <button type="button" class="iv-btn primary" @click="load">
            <Icon name="refresh" :size="14" />Try again
          </button>
          <a href="/" class="iv-btn">Back to search</a>
        </div>
      </div>

      <!-- The desktop app's profile: who they are and where they stand on top, the sections, then
           the player's tendencies beside their games (every line on the left filters the feed).
           The other sections take the whole width under the header. -->
      <ProfileLayout v-else-if="profile && view">
        <template #header>
          <h1 class="sr-only">{{ profile.gameName }}#{{ profile.tagLine }}</h1>
          <PlayerHeader :profile="view" :games="games" />
          <ProfileNav :slug="slug" :section="section">
            <span v-if="syncMessage" class="text-[12px] text-ink-3" role="status">
              {{ syncMessage }}
            </span>
            <button type="button" class="iv-btn sm" :disabled="isSyncing" @click="sync">
              <Icon name="refresh" :size="13" :class="{ spin: isSyncing }" />
              {{ isSyncing ? 'Updating…' : 'Update' }}
            </button>
            <button type="button" class="iv-btn ghost sm" @click="shareOpen = true">Share</button>
          </ProfileNav>
          <p v-if="failedPanels.length" class="notice" role="alert">
            <span>Some data could not be loaded ({{ failedPanels.join(', ') }}).</span>
            <button type="button" class="iv-btn sm ml-auto" @click="load">Retry</button>
          </p>
        </template>

        <template v-if="section === 'overview'" #side>
          <LpGraph v-if="lpLine" :points="view.lp" :card="view.card" />
          <ChampionTable
            v-model:champion="champion"
            :profile="view"
            :games="games"
            :scores="scores"
          />
          <RolesPanel v-model:role="role" :lanes="view.lanes" />
          <PlayedWithPanel :data="mates" />
          <ActivityHeatmap v-if="!pending.activity" :activity="activity" />
        </template>

        <MatchList
          v-if="section === 'overview'"
          id="matches"
          v-model:queue="queue"
          v-model:champion="champion"
          v-model:role="role"
          v-model:order="order"
          :puuid="profile.puuid"
          :games="games"
          :scores="scores"
          :lp="lp"
          :status="
            pending.matches ? 'loading' : failedPanels.includes('matches') ? 'error' : 'ready'
          "
          error="The match history could not be loaded."
          :more="hasMore"
          :loading-more="loadingMore"
          @more="loadMore"
          @retry="load"
        >
          <template #detail="{ game }">
            <GameDetail
              :match-id="game.matchId!"
              :puuid="profile.puuid"
              :game-name="profile.gameName"
              :tag-line="profile.tagLine"
            />
          </template>
        </MatchList>

        <section v-else-if="section === 'champions'">
          <div class="mb-4 flex flex-wrap items-center gap-3">
            <div class="iv-seg">
              <button
                v-for="option in CHAMPION_VIEWS"
                :key="option.value"
                type="button"
                :class="{ on: championsView === option.value }"
                @click="championsView = option.value"
              >
                {{ option.label }}
              </button>
            </div>
            <MatchFilters
              v-if="championsView === 'stats'"
              v-model="championFilters"
              hide-champion
              :busy="championsBusy"
            />
          </div>
          <p v-if="championsError && championsView === 'stats'" class="notice mb-4" role="alert">
            <span>These results could not be loaded.</span>
            <button type="button" class="iv-btn sm ml-auto" @click="loadChampions">Retry</button>
          </p>
          <ChampionExplorer
            v-if="championsView === 'stats'"
            :champions="champions"
            :busy="championsBusy"
            @matches="championMatches"
          />
          <MasteryPanel
            v-else
            :mastery="mastery"
            :loading="masteryLoading"
            :error="masteryError"
            @retry="loadAllMastery"
          />
        </section>

        <FriendsPanel
          v-else-if="section === 'friends'"
          :matches="friendMatches"
          :puuid="profile.puuid"
          :loading="friendsLoading"
        />

        <LiveMatch v-else-if="section === 'live'" :puuid="profile.puuid" :name="profile.gameName" />

        <PlayerCompare
          v-else-if="section === 'compare'"
          :profile="profile"
          :champions="champions"
        />
      </ProfileLayout>

      <ShareProfile
        v-if="profile && shareOpen"
        :profile="profile"
        :stats="shareStats"
        :champion="mainChampion"
        @close="shareOpen = false"
      />
    </main>

    <SiteFooter v-if="!isLoading" />
  </div>
</template>

<style scoped>
.state {
  max-width: 520px;
  margin: 0 auto;
  padding: 96px 0;
}

.spin {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
