<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Head } from '@inertiajs/vue3'
import AppHeader from '../components/AppHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import ScoutCard, { type ScoutEntry } from '../components/multisearch/ScoutCard.vue'
import { rememberPlayer } from '../lib/recent.js'
import { scout, type Season } from '../lib/scout.js'
import { multisearchPath, type RiotIdentity } from '../lib/multisearch.js'
import type { Match, RanksPayload, Summoner } from '../lib/types.js'

/** `/multisearch/:region?summoners=…`: a lobby scouted side by side, one card per player. */
const props = defineProps<{ players: RiotIdentity[]; region: string | null }>()

/** Enough stored games for a form line, the champions and the last few games. */
const MATCH_COUNT = 30

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
    fetch(`${base}/ranks`, { signal }).then((r) => (r.ok ? (r.json() as Promise<RanksPayload>) : null)),
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
    // A player nobody looked up before has no stored games yet: ask Riot once, in turn.
    if (matches && matches.length === 0) queueSync(key)
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
      await analytics(target, signal)
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
      if (games >= 2) list.push({ gameName: b.summoner!.gameName, tagLine: b.summoner!.tagLine, games })
    }
    out.set(a.key, list.sort((x, y) => y.games - x.games))
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
</script>

<template>
  <Head :title="title" />

  <div class="flex min-h-screen flex-col">
    <AppHeader />

    <main class="page flex-1 pb-16 pt-6 sm:pt-8">
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
    </main>

    <SiteFooter />
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
  align-items: start;
  gap: 12px;
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

@media (max-width: 55.99rem) {
  .grid {
    grid-template-columns: repeat(min(var(--cols), 2), minmax(0, 1fr));
  }
}

@media (max-width: 39.99rem) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
