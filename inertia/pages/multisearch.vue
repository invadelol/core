<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import { rankFromCore, rankLabel } from '@invadelol/ui/logic'
import SiteLayout from '../components/SiteLayout.vue'
import Masthead from '../components/ui/Masthead.vue'
import Icon from '../components/ui/Icon.vue'
import Frame from '../components/ui/Frame.vue'
import Select from '../components/ui/Select.vue'
import ScoreDial from '../components/ui/ScoreDial.vue'
import RankEmblem from '../components/ui/RankEmblem.vue'
import FormStrip from '../components/ui/FormStrip.vue'
import Skeleton from '../components/ui/Skeleton.vue'
import CardHead from '../components/ui/CardHead.vue'
import LobbyField from '../components/multisearch/LobbyField.vue'
import { isRemake, scoreLobby } from '../lib/match.js'
import { rememberPlayer } from '../lib/recent.js'
import { lastLobbies, lobbyTime, rememberLobby, type Lobby } from '../lib/lobbies.js'
import { scout } from '../lib/scout.js'
import {
  MAX_PLAYERS,
  MULTISEARCH_REGIONS,
  multisearchPath,
  type RiotIdentity,
} from '../lib/multisearch.js'
import { champIcon, championName, profileIcon } from '../lib/assets.js'
import { profilePath } from '../lib/format.js'
import { regionFlag } from '../lib/flags.js'
import type { Scout, Season } from '../lib/scout.js'
import '../css/multisearch.css'
import type { Match, RanksPayload, Summoner } from '../lib/types.js'

export interface ScoutEntry {
  key: string
  identity: RiotIdentity
  status: 'loading' | 'ready' | 'not-found' | 'riot-unavailable' | 'error'
  /** Asking Riot for the player's newest games. */
  syncing: boolean
  summoner: Summoner | null
  ranks: RanksPayload | null
  /** Champions and positions over the season. */
  season: Season | null
  /** The latest games. */
  scout: Scout | null
  /** The average Invade score of the latest games. */
  score: number | null
  /** A short line after an update ("Riot rate limit reached…"). */
  note: string | null
}

/**
 * `/multisearch/:region?summoners=…`: a lobby scouted side by side, one card per player, over a
 * field to paste the champ select chat into and a few figures of the whole lobby.
 */
const props = defineProps<{
  players: RiotIdentity[]
  region: string | null
  description?: string
}>()

/** Enough stored games for a form line, the champions and the last few games. */
const MATCH_COUNT = 30

/** Fewer stored games than this and Riot is asked first: one update, then older games. */
const MIN_GAMES = 20

/** A region from the address (`/multisearch/euw`, as op.gg links have it); otherwise found per player. */
const region = props.region ?? 'auto'
const entries = ref<ScoutEntry[]>([])

let controller: AbortController | undefined

const keyOf = (p: RiotIdentity) => `${p.gameName}#${p.tagLine}`.toLowerCase()
const slugOf = (p: RiotIdentity) => encodeURIComponent(`${p.gameName}-${p.tagLine}`)

function blank(identity: RiotIdentity): ScoutEntry {
  return {
    key: keyOf(identity),
    identity,
    status: 'loading',
    syncing: false,
    summoner: null,
    ranks: null,
    season: null,
    scout: null,
    score: null,
    note: null,
  }
}

async function failureOf(res: Response): Promise<ScoutEntry['status']> {
  if (res.status === 404 || res.status === 422) return 'not-found'
  if (res.status === 503 || res.status === 429) return 'riot-unavailable'
  return 'error'
}

/** Where the entry for `key` is now: the list can change while a player loads. */
function find(key: string) {
  return entries.value.find((e) => e.key === key)
}

/** The player's rank and stored games, read side by side. */
async function analytics(entry: ScoutEntry, signal: AbortSignal) {
  const puuid = entry.summoner!.puuid
  const base = `/api/summoners/puuid/${puuid}`
  const [ranks, season, matches] = await Promise.all([
    fetch(`${base}/ranks`, { signal }).then((r) =>
      r.ok ? (r.json() as Promise<RanksPayload>) : null
    ),
    fetch(`${base}/season`, { signal }).then((r) => (r.ok ? (r.json() as Promise<Season>) : null)),
    fetch(`${base}/matches?count=${MATCH_COUNT}&view=summary`, { signal }).then((r) =>
      r.ok ? (r.json() as Promise<Match[]>) : null
    ),
  ])
  if (signal.aborted) return null
  const target = find(entry.key)
  if (!target) return null
  target.ranks = ranks
  target.season = season
  target.scout = matches ? scout(matches, puuid) : null
  target.score = matches ? averageScore(matches, puuid) : null
  return matches
}

async function load(identity: RiotIdentity, signal: AbortSignal) {
  const key = keyOf(identity)
  try {
    const platform = region === 'auto' ? '' : `${region}/`
    const res = await fetch(`/api/summoners/${platform}${slugOf(identity)}`, { signal })
    if (signal.aborted) return
    const entry = find(key)
    if (!entry) return
    if (!res.ok) {
      entry.status = await failureOf(res)
      return
    }
    const summoner = (await res.json()).summoner as Summoner
    entry.summoner = summoner
    const matches = await analytics(entry, signal)
    if (signal.aborted) return
    const ready = find(key)
    if (!ready) return
    ready.status = 'ready'
    rememberPlayer({
      gameName: summoner.gameName,
      tagLine: summoner.tagLine,
      profileIconId: summoner.profileIconId,
      platform: summoner.platform,
      level: summoner.summonerLevel,
    })
    // Too few stored games to read a player by (none at all for one nobody looked up): ask Riot
    // once, in turn.
    if (matches && matches.length < MIN_GAMES) queueSync(key)
  } catch {
    if (signal.aborted) return
    const entry = find(key)
    if (entry) entry.status = 'error'
  }
}

/**
 * Updates go one at a time: a lobby of new players would otherwise spend Riot's budget in one
 * burst, and the later ones would only come back rate limited.
 */
const syncQueue: string[] = []
let syncing = false

function queueSync(key: string) {
  if (!syncQueue.includes(key)) syncQueue.push(key)
  const entry = find(key)
  if (entry) entry.syncing = true
  void drain()
}

async function drain() {
  if (syncing) return
  syncing = true
  try {
    while (syncQueue.length) {
      const key = syncQueue.shift()!
      const signal = controller?.signal
      const entry = find(key)
      if (!entry?.summoner || !signal || signal.aborted) continue
      await sync(entry, signal)
    }
  } finally {
    syncing = false
  }
}

async function sync(entry: ScoutEntry, signal: AbortSignal) {
  entry.syncing = true
  entry.note = null
  try {
    const res = await fetch('/api/summoners/sync', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summoner: `${entry.summoner!.gameName}-${entry.summoner!.tagLine}`,
        platform: entry.summoner!.platform,
      }),
    })
    if (signal.aborted) return
    const target = find(entry.key)
    if (!target) return
    if (res.ok) {
      const result = await res.json()
      if (result.summoner) target.summoner = result.summoner
      const matches = await analytics(target, signal)
      if (matches?.length && matches.length < MIN_GAMES) await older(target, matches, signal)
    } else {
      const failure = await res.json().catch(() => null)
      const code = failure?.errors?.[0]?.code
      target.note =
        code === 'E_RIOT_RATE_LIMITED'
          ? `Riot rate limit reached. Try again in ${failure.retryAfter ?? 60}s`
          : res.status === 503
            ? 'Riot is not answering right now'
            : 'Update failed'
    }
  } catch {
    const target = find(entry.key)
    if (target && !signal.aborted) target.note = 'Update failed'
  } finally {
    const target = find(entry.key)
    if (target && !signal.aborted) target.syncing = false
  }
}

/**
 * An update only brings the latest games: the rest up to `MIN_GAMES` come from before the oldest
 * one, as the profile's list pages back. The server paces it; a held page just ends here.
 */
async function older(entry: ScoutEntry, matches: Match[], signal: AbortSignal) {
  const base = `/api/summoners/puuid/${entry.summoner!.puuid}`
  const before = Number(matches[matches.length - 1].gameStartMs)
  const count = MIN_GAMES - matches.length
  const res = await fetch(`${base}/matches?count=${count}&before=${before}&view=summary`, {
    signal,
  })
  if (signal.aborted || !res.ok) return
  const page = (await res.json()) as Match[]
  const target = find(entry.key)
  if (page.length && target) await analytics(target, signal)
}

/** Draws the cards for `players`, keeping the ones already loaded. */
function show(players: RiotIdentity[]) {
  unsaved = players.length > 0
  controller?.abort()
  controller = new AbortController()
  syncQueue.length = 0
  const { signal } = controller
  const kept = new Map(entries.value.filter((e) => e.status === 'ready').map((e) => [e.key, e]))
  entries.value = players.map((p) => {
    const old = kept.get(keyOf(p))
    return old ? { ...old, syncing: false } : blank(p)
  })
  for (const entry of entries.value) {
    if (entry.status === 'loading') void load(entry.identity, signal)
  }
}

/** The address follows the search, so a scouted lobby can be shared as a link. */
function writeAddress(players: RiotIdentity[]) {
  const path = multisearchPath(players, region === 'auto' ? null : region)
  window.history.replaceState(window.history.state, '', path)
}

function remove(entry: ScoutEntry) {
  entries.value = entries.value.filter((e) => e !== entry)
  chips.value = chips.value.filter((c) => keyOf(c) !== entry.key)
  writeAddress(entries.value.map((e) => e.identity))
}
/** A chip taken out of the field takes its card with it. */
function dropped(player: RiotIdentity) {
  const entry = find(keyOf(player))
  if (!entry) return
  entries.value = entries.value.filter((e) => e !== entry)
  writeAddress(entries.value.map((e) => e.identity))
}

function pickRegion(next: string | null) {
  if (next === props.region) return
  router.visit(
    multisearchPath(
      entries.value.map((e) => e.identity),
      next
    )
  )
}

/* ── The board's cards ─────────────────────────────────────────── */

/** The average Invade score of the latest games (remakes and away games have none). */
function averageScore(matches: Match[], puuid: string) {
  const scores = matches
    .filter((m) => !isRemake(m))
    .slice(0, 20)
    .map((m) => scoreLobby(m)[puuid]?.score)
    .filter((v): v is number => typeof v === 'number')
  return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
}

const soloOf = (e: ScoutEntry) =>
  e.ranks?.current?.find((r) => r.queueType === 'RANKED_SOLO_5x5' && r.tier) ?? null
const rankName = (e: ScoutEntry) => {
  const r = soloOf(e)
  return r ? rankLabel(rankFromCore(r), false) : 'Unranked'
}
/** Their season: the Solo/Duo record when known, else their stored games of the season. */
function seasonOf(e: ScoutEntry) {
  const r = soloOf(e)
  if (r && r.losses !== null && r.losses !== undefined && r.wins + r.losses > 0)
    return { games: r.wins + r.losses, rate: Math.round((r.wins / (r.wins + r.losses)) * 100) }
  const list = e.season?.champions ?? []
  const games = list.reduce((n, c) => n + c.games, 0)
  const wins = list.reduce((n, c) => n + c.wins, 0)
  return games ? { games, rate: Math.round((wins / games) * 100) } : null
}
const LANE_WORD: Record<string, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MID: 'Mid',
  ADC: 'Bot',
  SUPPORT: 'Support',
}
const mainRole = (e: ScoutEntry) => e.scout?.roles?.[0]?.lane ?? null
const championsOf = (e: ScoutEntry) => (e.season?.champions ?? []).slice(0, 3)

/** Who of the lobby already played together, from each player's stored games. */
const mates = computed(() => {
  const out = new Map<string, Array<{ gameName: string; games: number }>>()
  const ready = entries.value.filter((e) => e.scout && e.summoner)
  for (const a of ready) {
    const list: Array<{ gameName: string; games: number }> = []
    for (const b of ready) {
      if (a === b) continue
      let games = 0
      for (const id of a.scout!.matchIds) if (b.scout!.matchIds.has(id)) games++
      if (games >= 2) list.push({ gameName: b.summoner!.gameName, games })
    }
    out.set(
      a.key,
      list.sort((x, y) => y.games - x.games)
    )
  }
  return out
})
/** The facts worth a tag: a premade, a streak, a main. */
function tagsOf(e: ScoutEntry) {
  const out: { text: string; violet?: boolean }[] = []
  const duo = mates.value.get(e.key) ?? []
  if (duo.length)
    out.push({
      text: `${duo.length === 1 ? 'Duo' : 'Premade'} with ${duo.map((d) => d.gameName).join(', ')}`,
      violet: true,
    })
  const streak = e.scout?.streak ?? 0
  if (streak >= 3) out.push({ text: `Hot streak, ${streak} wins` })
  if (streak <= -3) out.push({ text: `${-streak} losses in a row` })
  const list = e.season?.champions ?? []
  const all = list.reduce((n, c) => n + c.games, 0)
  const top = list[0]
  if (top && top.games >= 10 && top.games / all >= 0.4)
    out.push({ text: `Main on ${championName(top.championId)}` })
  return out.slice(0, 2)
}

/* ── The search: the lobby as chips, a region, Scout ─────────────── */
const chips = ref<RiotIdentity[]>([...props.players])
function scoutLobby() {
  const players = chips.value.slice(0, MAX_PLAYERS)
  if (!players.length) return
  show(players)
  writeAddress(players)
}
/** What the cards learnt of each chip: its icon, its rank, or that it was not found. */
const known = computed(() =>
  Object.fromEntries(
    entries.value.map((e) => [
      e.key,
      {
        icon: e.summoner?.profileIconId ?? null,
        tier: soloOf(e)?.tier ?? null,
        missing: e.status === 'not-found',
      },
    ])
  )
)

/* ── Your last lobbies (this device only, lib/lobbies.ts) ─────────── */
const lobbies = ref<Lobby[]>([])
/** Set when a lobby is scouted: it is remembered once its cards have all answered. */
let unsaved = false
watch(
  entries,
  (list) => {
    if (!unsaved || !list.length || list.some((e) => e.status === 'loading')) return
    unsaved = false
    rememberLobby(
      list.map((e) => ({
        gameName: e.summoner?.gameName ?? e.identity.gameName,
        tagLine: e.summoner?.tagLine ?? e.identity.tagLine,
        icon: e.summoner?.profileIconId ?? null,
        champion: e.season?.champions?.[0]?.championId ?? null,
      })),
      props.region
    )
    lobbies.value = lastLobbies()
  },
  { deep: true }
)
/** Every name of the lobby: the card runs the page's width, a narrow screen cuts the line. */
const lobbyNames = (l: Lobby) => l.players.map((p) => p.gameName).join(', ')
const regionValue = ref(props.region ?? 'auto')
const regionOptions = [
  { value: 'auto', label: 'Any server', icon: regionFlag(null) },
  ...(MULTISEARCH_REGIONS as readonly string[]).map((r) => ({
    value: r,
    label: r.toUpperCase(),
    icon: regionFlag(r),
  })),
]
watch(regionValue, (next) => pickRegion(next === 'auto' ? null : next))

onMounted(() => {
  lobbies.value = lastLobbies()
  show(props.players)
})
/** A new search from the header (or a last lobby) lands on this page again, with other players. */
watch(
  () => props.players,
  (players) => {
    chips.value = [...players]
    show(players)
  }
)
onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <Head title="Multisearch">
    <meta
      name="description"
      :content="
        description ??
        'Scout a whole League of Legends lobby at once: rank, recent games, main role and champions of every player side by side.'
      "
    />
  </Head>
  <SiteLayout section="tools">
    <div class="wrap pg-ms">
      <Masthead
        title="Multisearch"
        :crumbs="[{ label: 'Tools' }, { label: 'Multisearch' }]"
        meta="Paste the names from champion select or the lobby chat, up to five a team"
      />
      <form class="ms-find" @submit.prevent="scoutLobby">
        <LobbyField
          v-model="chips"
          :region="regionValue"
          :known="known"
          @pasted="scoutLobby"
          @submit="scoutLobby"
          @resolved="scoutLobby"
          @removed="dropped"
        >
          <Select v-model="regionValue" :options="regionOptions" width="10rem" align="right" />
          <button class="btn pri ms-go" type="submit"><Icon name="search" />Scout</button>
        </LobbyField>
      </form>

      <section v-if="entries.length || lobbies.length" class="sec" style="padding-top: 24px">
        <div v-if="entries.length" class="msg" :class="{ many: entries.length > 5 }">
          <div v-for="e in entries" :key="e.key" class="card msc">
            <button
              v-if="e.status === 'ready'"
              class="ms-x"
              type="button"
              :aria-label="`Remove ${e.identity.gameName}`"
              title="Remove"
              @click="remove(e)"
            >
              <Icon name="x" :size="14" />
            </button>
            <template v-if="e.status === 'loading'">
              <div class="top2"><Skeleton :height="120" /></div>
              <div class="sec3"><Skeleton :rows="4" /></div>
            </template>
            <template v-else-if="e.status !== 'ready'">
              <div class="top2">
                <div class="h3">{{ e.identity.gameName }}</div>
                <p class="meta" style="margin-top: 8px">
                  {{
                    e.status === 'not-found'
                      ? 'Not found on this server'
                      : e.status === 'riot-unavailable'
                        ? 'Riot is not answering right now'
                        : 'Could not be loaded'
                  }}
                </p>
              </div>
              <div class="sec3 row" style="justify-content: center; border-bottom: 0">
                <button class="btn sm" type="button" @click="remove(e)">Remove</button>
              </div>
            </template>
            <template v-else-if="e.summoner">
              <div class="top2">
                <Link :href="profilePath(e.summoner.gameName, e.summoner.tagLine)">
                  <img class="ic3" :src="profileIcon(e.summoner.profileIconId)" alt="" />
                  <div class="h3 ell" style="margin-top: 10px">{{ e.summoner.gameName }}</div>
                </Link>
                <div class="rk7">
                  <RankEmblem :tier="soloOf(e)?.tier" :size="28" />
                  <span class="col" style="text-align: left">
                    <span class="h5">{{ rankName(e) }}</span>
                    <span v-if="soloOf(e)" class="meta">{{ soloOf(e)!.leaguePoints }} LP</span>
                  </span>
                </div>
              </div>
              <div class="sec3 row" style="justify-content: space-between">
                <span v-if="seasonOf(e)" class="col">
                  <span class="fg-xs">{{ seasonOf(e)!.rate }}<span class="u">%</span></span>
                  <span class="meta">{{ seasonOf(e)!.games }} games</span>
                </span>
                <span v-else class="meta">No ranked game this season</span>
                <ScoreDial :value="e.score" />
              </div>
              <div class="sec3">
                <span class="lab">Main role</span>
                <div class="row" style="gap: 7px; margin-top: 6px">
                  <template v-if="mainRole(e)"
                    ><RoleIcon :lane="mainRole(e)!" :size="16" /><span class="h5">{{
                      LANE_WORD[mainRole(e)!]
                    }}</span></template
                  >
                  <span v-else class="meta">None yet</span>
                </div>
              </div>
              <div class="sec3">
                <span class="lab">Champions</span>
                <div v-for="c in championsOf(e)" :key="c.championId" class="chr">
                  <Frame :src="champIcon(c.championId)" size="xs" />
                  <span class="ell">{{ championName(c.championId) }}</span>
                  <span class="w2"
                    >{{ Math.round((c.wins / Math.max(1, c.games)) * 100) }}%<br />{{
                      c.games
                    }}
                    games</span
                  >
                </div>
                <p v-if="!championsOf(e).length" class="meta" style="margin-top: 6px">
                  No stored game this season
                </p>
              </div>
              <div v-if="e.scout?.results.length" class="sec3">
                <span class="lab">Last {{ Math.min(10, e.scout.results.length) }}</span>
                <div style="margin-top: 8px">
                  <FormStrip :results="[...e.scout.results.slice(0, 10)].reverse()" />
                </div>
              </div>
              <div class="sec3 row" style="gap: 6px; flex-wrap: wrap; border-bottom: 0">
                <span
                  v-for="t in tagsOf(e)"
                  :key="t.text"
                  class="tagx ms-tag"
                  :class="{ vi: t.violet }"
                  >{{ t.text }}</span
                >
                <span v-if="e.syncing" class="meta">Updating</span>
                <span v-else-if="e.note" class="meta">{{ e.note }}</span>
              </div>
            </template>
          </div>
        </div>
        <article v-else-if="lobbies.length" class="card">
          <CardHead title="Your last lobbies" icon="clock" meta="On this device" />
          <Link
            v-for="l in lobbies"
            :key="l.at"
            class="ms-lb"
            :href="multisearchPath(l.players, l.region)"
          >
            <span class="ms-stk"
              ><img
                v-for="pl in l.players.slice(0, 5)"
                :key="`${pl.gameName}#${pl.tagLine}`"
                :src="profileIcon(pl.icon ?? null)"
                alt=""
            /></span>
            <span class="col" style="gap: 2px; min-width: 0; flex: 1">
              <span class="h5">{{ lobbyTime(l.at) }}</span>
              <span class="meta ell">{{ lobbyNames(l) }}</span>
            </span>
            <span class="row ms-lc">
              <template v-for="pl in l.players" :key="`c-${pl.gameName}#${pl.tagLine}`"
                ><Frame
                  v-if="pl.champion"
                  :src="champIcon(pl.champion)"
                  :width="26"
                  size="xs"
                  :alt="championName(pl.champion)"
              /></template>
            </span>
            <Icon name="chevr" :size="16" class="t4" />
          </Link>
        </article>
      </section>
    </div>
  </SiteLayout>
</template>
