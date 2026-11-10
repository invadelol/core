<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { X } from 'lucide-vue-next'
import { rankFromCore, rankLabel, rankValue, tierColor, TIERS } from '@invadelol/ui/logic'
import AppHeader from '../components/AppHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import ScoutCard, { type ScoutEntry } from '../components/multisearch/ScoutCard.vue'
import { rememberPlayer } from '../lib/recent.js'
import { scout, type Season } from '../lib/scout.js'
import {
  MAX_PLAYERS,
  multisearchPath,
  parseRiotIds,
  type RiotIdentity,
} from '../lib/multisearch.js'
import { profileIcon } from '../lib/assets.js'
import '../css/rd-discover.css'
import type { Match, RanksPayload, Summoner } from '../lib/types.js'

/**
 * `/multisearch/:region?summoners=…`: a lobby scouted side by side, one card per player, over a
 * field to paste the champ select chat into and a few figures of the whole lobby.
 */
const props = defineProps<{ players: RiotIdentity[]; region: string | null }>()

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
  writeAddress(entries.value.map((e) => e.identity))
}

function refresh(entry: ScoutEntry) {
  if (!controller || entry.syncing) return
  queueSync(entry.key)
}

/**
 * Who of the lobby already played together, read from each player's stored games: a premade
 * shows up as two cards naming each other.
 */
const mates = computed(() => {
  const out = new Map<string, Array<{ gameName: string; tagLine: string; games: number }>>()
  const ready = entries.value.filter((e) => e.scout && e.summoner)
  for (const a of ready) {
    const list: Array<{ gameName: string; tagLine: string; games: number }> = []
    for (const b of ready) {
      if (a === b) continue
      let games = 0
      for (const id of a.scout!.matchIds) if (b.scout!.matchIds.has(id)) games++
      if (games >= 2)
        list.push({ gameName: b.summoner!.gameName, tagLine: b.summoner!.tagLine, games })
    }
    out.set(
      a.key,
      list.sort((x, y) => y.games - x.games)
    )
  }
  return out
})

onMounted(() => {
  show(props.players)
})

/** A new search from the header lands on this page again, with other players. */
watch(
  () => props.players,
  (players) => show(players)
)

onBeforeUnmount(() => controller?.abort())

const title = computed(() => {
  const names = (entries.value.length ? entries.value.map((e) => e.identity) : props.players).map(
    (p) => p.gameName
  )
  return names.length ? names.join(', ') : 'Scout a lobby'
})

/** Past five players the columns get too narrow: each player becomes a wide row. */
const rows = computed(() => entries.value.length > 5)

const columns = computed(() => Math.min(Math.max(entries.value.length, 1), 5))

/* ── The field: the lobby's Riot IDs as chips, more pasted or typed after them ── */
const draft = ref('')
const drafted = computed(() => parseRiotIds(draft.value))
const total = computed(() =>
  Math.min(MAX_PLAYERS, entries.value.length + drafted.value.filter((p) => !has(p)).length)
)
const has = (p: RiotIdentity) => entries.value.some((e) => e.key === keyOf(p))

/** Adds what the field holds to the lobby, and the address follows. */
function search() {
  const added = drafted.value.filter((p) => !has(p))
  draft.value = ''
  if (!added.length) return
  const players = [...entries.value.map((e) => e.identity), ...added].slice(0, MAX_PLAYERS)
  show(players)
  writeAddress(players)
}

/** A paste is a lobby: it is searched as soon as it lands in the field. */
function onPaste() {
  setTimeout(search, 0)
}

/** A backspace in an empty field takes the last player out. */
function onBack() {
  if (draft.value || !entries.value.length) return
  remove(entries.value[entries.value.length - 1])
}

/** The region of the lookups: a new address, so the cards load again on it. */
const REGION_TABS = ['euw', 'eune', 'na', 'kr'] as const
const regionTabs = computed(() =>
  props.region && !(REGION_TABS as readonly string[]).includes(props.region)
    ? [...REGION_TABS, props.region]
    : [...REGION_TABS]
)
function pickRegion(next: string | null) {
  if (next === props.region) return
  router.visit(
    multisearchPath(
      entries.value.map((e) => e.identity),
      next
    )
  )
}

/* ── The lobby at a glance ───────────────────────────────────────── */
const soloOf = (e: ScoutEntry) =>
  e.ranks?.current?.find((r) => r.queueType === 'RANKED_SOLO_5x5' && r.tier) ?? null
const DIVISIONS = ['IV', 'III', 'II', 'I']
const lobby = computed(() => {
  const ready = entries.value.filter((e) => e.status === 'ready')
  if (ready.length < 2) return null
  const ranked = ready.flatMap((e) => {
    const r = soloOf(e)
    const core = r ? rankFromCore(r) : null
    const value = core ? rankValue(core) : null
    return r && core && value !== null ? [{ e, r, core, value }] : []
  })
  let average: { label: string; color: string } | null = null
  let range = ''
  if (ranked.length) {
    const mean = ranked.reduce((n, x) => n + x.value, 0) / ranked.length
    const sorted = [...ranked].sort((a, b) => a.value - b.value)
    if (mean >= 28) average = { label: 'Master and above', color: tierColor('MASTER') }
    else {
      const v = Math.floor(mean)
      const tier = TIERS[Math.floor(v / 4)]
      average = {
        label: `${tier.charAt(0)}${tier.slice(1).toLowerCase()} ${DIVISIONS[v % 4]}`,
        color: tierColor(tier),
      }
    }
    const lo = rankLabel(sorted[0].core, false)
    const hi = rankLabel(sorted[sorted.length - 1].core, false)
    range = lo === hi ? `all ${lo}` : `from ${lo} to ${hi}`
  }
  const records = ranked.filter((x) => x.r.losses !== null && x.r.losses !== undefined)
  const wins = records.reduce((n, x) => n + x.r.wins, 0)
  const losses = records.reduce((n, x) => n + (x.r.losses ?? 0), 0)
  const mains = ready.filter((e) => {
    const list = e.season?.champions ?? []
    const all = list.reduce((n, c) => n + c.games, 0)
    return list.slice(0, 2).some((c) => c.games >= 10 && c.games / all >= 0.2)
  }).length
  const pairs: string[] = []
  for (const e of ready) {
    for (const m of mates.value.get(e.key) ?? []) {
      const other = `${m.gameName}#${m.tagLine}`.toLowerCase()
      if (other > e.key)
        pairs.push(`${e.summoner?.gameName ?? e.identity.gameName} and ${m.gameName}`)
    }
  }
  return {
    count: ready.length,
    average,
    range,
    rate: wins + losses ? Math.round((wins / (wins + losses)) * 100) : null,
    wins,
    losses,
    mains,
    pairs,
  }
})
</script>

<template>
  <Head :title="title" />

  <div class="flex min-h-screen flex-col">
    <AppHeader />

    <main id="main" class="page ms flex-1">
      <div class="rd-ph">
        <div>
          <h1>Multisearch</h1>
          <p>Paste your champ select chat and read the whole lobby before the game starts</p>
        </div>
        <div class="rd-seg" role="group" aria-label="Region">
          <button
            type="button"
            :class="{ on: !region }"
            :aria-pressed="!region"
            title="Each player's region is found for them"
            @click="pickRegion(null)"
          >
            Any
          </button>
          <button
            v-for="r in regionTabs"
            :key="r"
            type="button"
            :class="{ on: region === r }"
            :aria-pressed="region === r"
            @click="pickRegion(r)"
          >
            {{ r.toUpperCase() }}
          </button>
        </div>
      </div>

      <form class="ms-inp dv-bigfield" role="search" @submit.prevent="search">
        <span v-for="e in entries" :key="e.key" class="ms-chp">
          <img
            v-if="e.summoner"
            :src="profileIcon(e.summoner.profileIconId)"
            alt=""
            width="26"
            height="26"
          />
          <span v-else class="ph" aria-hidden="true" />
          {{ e.identity.gameName }} <span class="t">#{{ e.identity.tagLine }}</span>
          <button type="button" :aria-label="`Remove ${e.identity.gameName}`" @click="remove(e)">
            <X :size="12" aria-hidden="true" />
          </button>
        </span>
        <label class="dv-sr" for="ms-add">Riot IDs</label>
        <input
          id="ms-add"
          v-model="draft"
          type="text"
          spellcheck="false"
          autocomplete="off"
          :placeholder="
            entries.length ? 'Add a Riot ID' : 'Paste the lobby chat, or Riot IDs like Name#TAG'
          "
          @keydown.backspace="onBack"
          @paste="onPaste"
        />
        <button type="submit" class="iv-btn primary" :disabled="!drafted.length">
          Search {{ total }} {{ total === 1 ? 'player' : 'players' }}
        </button>
      </form>

      <section v-if="lobby" class="rd-card ms-lob" aria-label="The lobby">
        <div class="st">
          <span class="lbl">Average rank</span>
          <b class="rd-fig" :style="lobby.average ? { color: lobby.average.color } : undefined">{{
            lobby.average?.label ?? 'Unranked'
          }}</b>
          <small>{{ lobby.range || 'No Solo/Duo rank' }}</small>
        </div>
        <div class="st">
          <span class="lbl">Season win rate</span>
          <b class="rd-fig num">{{ lobby.rate === null ? '-' : `${lobby.rate}%` }}</b>
          <small class="num">{{ lobby.wins }}W {{ lobby.losses }}L together</small>
        </div>
        <div class="st">
          <span class="lbl">On a main</span>
          <b class="rd-fig rd-vio num">{{ lobby.mains }} of {{ lobby.count }}</b>
          <small>a fifth of their games on one champion</small>
        </div>
        <div class="st">
          <span class="lbl">Premade</span>
          <b class="rd-fig num">{{
            lobby.pairs.length
              ? `${lobby.pairs.length} ${lobby.pairs.length === 1 ? 'pair' : 'pairs'}`
              : 'None seen'
          }}</b>
          <small>{{ lobby.pairs.join(', ') || 'No two of them in the same games' }}</small>
        </div>
      </section>

      <section
        v-if="entries.length"
        class="grid"
        :class="{ rows }"
        :style="{ '--cols': columns }"
        aria-label="Players"
      >
        <ScoutCard
          v-for="entry in entries"
          :key="entry.key"
          :entry="entry"
          :mates="mates.get(entry.key) ?? []"
          :layout="rows ? 'row' : 'card'"
          @refresh="refresh(entry)"
          @remove="remove(entry)"
        />
      </section>
      <p v-else class="rd-card dv-empty ms-empty">
        Paste the champ select chat above: every "joined the lobby" line becomes a player.
      </p>
    </main>

    <SiteFooter />
  </div>
</template>

<style scoped>
.ms {
  padding-bottom: 16px;
}

.ms-inp {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
}

.ms-inp input {
  flex: 1 1 200px;
  min-width: 0;
  height: 34px;
  font: 400 14px var(--font);
  color: var(--text-1);
  background: none;
  border: 0;
  outline: 0;
}

.ms-inp input::placeholder {
  color: var(--text-3);
}

.ms-inp:focus-within {
  box-shadow:
    inset 0 0 0 1px var(--rd-violet),
    0 0 0 4px rgb(123 109 255 / 0.18);
}

.ms-chp {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 4px 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  background: var(--rd-card-2);
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px var(--rd-line);
}

.ms-chp img,
.ms-chp .ph {
  width: 26px;
  height: 26px;
  border-radius: 6px;
}

.ms-chp .ph {
  background: var(--surface-2);
}

.ms-chp .t {
  font-weight: 400;
  color: var(--text-3);
}

.ms-chp button {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  color: var(--text-3);
  border-radius: 5px;
}

.ms-chp button:hover {
  color: var(--text-1);
  background: var(--surface-2);
}

.ms-chp button:focus-visible {
  box-shadow: var(--focus);
}

.ms-lob {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 16px 0;
}

.ms-lob .st {
  min-width: 0;
  padding: 14px 18px;
}

.ms-lob .st + .st {
  box-shadow: inset 1px 0 0 var(--rd-line);
}

.ms-lob .lbl {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}

.ms-lob .rd-fig {
  display: block;
  font-size: 24px;
  line-height: 1.2;
  white-space: nowrap;
}

.ms-lob small {
  display: block;
  overflow: hidden;
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text-3);
}

.ms-empty {
  margin-top: 16px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
  align-items: start;
  gap: 12px;
  margin-top: 16px;
}

@media (min-width: 64rem) {
  .grid.rows {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }
}

@media (max-width: 79.99rem) {
  .grid {
    grid-template-columns: repeat(min(var(--cols), 3), minmax(0, 1fr));
  }
}

@media (max-width: 68.75rem) {
  .ms-lob {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ms-lob .st:nth-child(3) {
    box-shadow: inset 0 1px 0 var(--rd-line);
  }

  .ms-lob .st:nth-child(4) {
    box-shadow:
      inset 1px 0 0 var(--rd-line),
      inset 0 1px 0 var(--rd-line);
  }
}

@media (max-width: 55.99rem) {
  .grid {
    grid-template-columns: repeat(min(var(--cols), 2), minmax(0, 1fr));
  }
}

@media (max-width: 39.99rem) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .ms-inp .iv-btn {
    width: 100%;
  }
}
</style>
