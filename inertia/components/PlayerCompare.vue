<script lang="ts">
/** Players this browser updated lately, by lowercase `Name-TAG`: picked again, they are not. */
const updatedAt = new Map<string, number>()
const UPDATE_AGAIN_MS = 5 * 60_000
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RoleIcon } from '@invadelol/ui'
import {
  positionName,
  positionOf,
  queueName,
  rankFromCore,
  rankLabel,
  rankValue,
  type Position,
} from '@invadelol/ui/logic'
import MatchFilters, { type Filters } from './MatchFilters.vue'
import PlayerLink from './PlayerLink.vue'
import PlayerSearchField from './PlayerSearchField.vue'
import ShowMore from './ShowMore.vue'
import CardHead from './ui/CardHead.vue'
import EmptyState from './ui/EmptyState.vue'
import FormStrip from './ui/FormStrip.vue'
import Frame from './ui/Frame.vue'
import Icon from './ui/Icon.vue'
import RankEmblem from './ui/RankEmblem.vue'
import SectionHead from './ui/SectionHead.vue'
import Skeleton from './ui/Skeleton.vue'
import { champIcon, championName, profileIcon } from '../lib/assets.js'
import { monotone } from '../lib/rd_curve.js'
import { compact, duration, timeAgo } from '../lib/format.js'
import { isRemake } from '../lib/match.js'
import {
  championSplit,
  lineOf,
  roleRows,
  sharedGames,
  type Line,
  type Side,
} from '../lib/compare.js'
import { teammatesFrom } from '../lib/synergy.js'
import type {
  ChampionStats,
  GlobalStats,
  Match,
  Rank,
  RanksPayload,
  Summoner,
} from '../lib/types.js'

const props = defineProps<{
  profile: Summoner
  champions: ChampionStats[]
}>()

const other = ref<Summoner | null>(null)
const busy = ref(false)
const error = ref('')
/** Whose latest games are being fetched, while they are. */
const fetching = ref('')
/** Said when the update failed and the comparison uses the games already stored. */
const note = ref('')
const filters = ref<Filters>({ type: 'all', champion: 0, role: 'all' })

interface Dataset {
  stats: GlobalStats
  matches: Match[]
  champions: ChampionStats[]
}
const datasets = ref<Dataset[]>([])

let lookup: AbortController | undefined
let analytics: AbortController | undefined

const players = computed(() => (other.value ? [props.profile, other.value] : [props.profile]))
const ready = computed(() => Boolean(other.value) && datasets.value.length === 2)

/**
 * Picking a player first fetches their latest games (the profile's Update: the last 15 from
 * Riot), so a profile nobody opened before still has games to compare. The server coalesces
 * updates and holds a player back after a Riot rate limit; this browser also skips players it
 * updated in the last few minutes.
 */
async function pick(entry: { gameName: string; tagLine: string }) {
  lookup?.abort()
  lookup = new AbortController()
  const signal = lookup.signal
  busy.value = true
  error.value = ''
  note.value = ''
  const slug = `${entry.gameName}-${entry.tagLine}`
  const key = slug.toLowerCase()
  try {
    if (key === `${props.profile.gameName}-${props.profile.tagLine}`.toLowerCase())
      throw new Error('Choose a different player.')
    let summoner: Summoner | null = null
    if (Date.now() - (updatedAt.get(key) ?? 0) > UPDATE_AGAIN_MS) {
      fetching.value = entry.gameName
      const res = await fetch('/api/summoners/sync', {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summoner: slug }),
      })
      if (signal.aborted) return
      if (res.ok) {
        summoner = (await res.json()).summoner
        updatedAt.set(key, Date.now())
      } else note.value = 'Their latest games could not be fetched. Comparing the stored ones.'
    }
    if (!summoner) {
      const res = await fetch(`/api/summoners/${encodeURIComponent(slug)}`, { signal })
      if (!res.ok)
        throw new Error(
          res.status === 404
            ? 'Player not found. Check their Riot ID.'
            : 'Riot could not load this player.'
        )
      summoner = (await res.json()).summoner
    }
    if (signal.aborted || !summoner) return
    if (summoner.puuid === props.profile.puuid) throw new Error('Choose a different player.')
    other.value = summoner
    const url = new URL(location.href)
    url.searchParams.set('with', `${entry.gameName}#${entry.tagLine}`)
    history.replaceState(history.state, '', url)
  } catch (e) {
    if (!signal.aborted) {
      error.value = (e as Error).message
      note.value = ''
    }
  } finally {
    if (!signal.aborted) {
      busy.value = false
      fetching.value = ''
    }
  }
}

function clear() {
  other.value = null
  note.value = ''
  datasets.value = []
  const url = new URL(location.href)
  url.searchParams.delete('with')
  history.replaceState(history.state, '', url)
}

async function load() {
  analytics?.abort()
  analytics = new AbortController()
  const signal = analytics.signal
  datasets.value = []
  const query = new URLSearchParams({
    type: filters.value.type,
    role: filters.value.role,
    count: '100',
  })
  if (filters.value.champion) query.set('champion', String(filters.value.champion))
  try {
    const data = await Promise.all(
      players.value.map(async (p) => {
        const base = `/api/summoners/puuid/${p.puuid}`
        const [s, m, c] = await Promise.all([
          fetch(`${base}/stats?${query}`, { signal }),
          fetch(`${base}/matches?${query}&view=summary`, { signal }),
          fetch(`${base}/champions?${query}`, { signal }),
        ])
        if (!s.ok || !m.ok || !c.ok) throw new Error('Comparison data could not be loaded.')
        return {
          stats: (await s.json()).global as GlobalStats,
          matches: (await m.json()) as Match[],
          champions: (await c.json()) as ChampionStats[],
        }
      })
    )
    if (!signal.aborted) datasets.value = data
  } catch (e) {
    if (!signal.aborted) error.value = (e as Error).message
  }
}

watch([players, filters], () => void load(), { immediate: true, deep: true })

/* Restoring `?with=` flips the field into its loading state, so it has to wait
   until after hydration or the first client render no longer matches the HTML
   the server sent. */
onMounted(() => {
  const initial = new URLSearchParams(location.search).get('with')
  const hash = initial?.lastIndexOf('#') ?? -1
  if (initial && hash > 0) {
    void pick({ gameName: initial.slice(0, hash), tagLine: initial.slice(hash + 1) })
  }
})

onBeforeUnmount(() => {
  lookup?.abort()
  analytics?.abort()
})

/* ── Ranks, for the header and the LP chart ───────────────────── */
const ranks = ref<Array<RanksPayload | null>>([])
let rankController: AbortController | undefined
watch(
  players,
  async (list) => {
    rankController?.abort()
    rankController = new AbortController()
    const signal = rankController.signal
    ranks.value = []
    const got = await Promise.all(
      list.map((p) =>
        fetch(`/api/summoners/puuid/${p.puuid}/ranks`, { signal })
          .then((r) => (r.ok ? (r.json() as Promise<RanksPayload>) : null))
          .catch(() => null)
      )
    )
    if (!signal.aborted) ranks.value = got
  },
  { immediate: true }
)
onBeforeUnmount(() => rankController?.abort())

const soloOf = (i: number) =>
  ranks.value[i]?.current?.find((r) => r.queueType === 'RANKED_SOLO_5x5' && r.tier) ?? null

/** Each player's most played lane in the sample. */
function mainRole(i: number): Position | null {
  const counts = new Map<Position, number>()
  for (const m of datasets.value[i]?.matches ?? []) {
    const me = m.participants.find((x) => x.puuid === players.value[i]?.puuid)
    const lane = positionOf(me?.position)
    if (lane) counts.set(lane, (counts.get(lane) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

/** LP won or lost over the last 30 days, both from the same start line. */
const lp = computed(() => {
  const time = (r: Rank) => new Date(r.fetchedAt ?? 0).getTime()
  const series = players.value.map((_, i) => {
    const rows = (ranks.value[i]?.history ?? [])
      .filter((r) => r.queueType === 'RANKED_SOLO_5x5' && r.tier && r.fetchedAt)
      .map((r) => ({ t: time(r), v: rankValue(rankFromCore(r)) }))
      .filter((p): p is { t: number; v: number } => p.v !== null)
      .sort((a, b) => a.t - b.t)
    return rows
  })
  const end = Math.max(0, ...series.flatMap((s) => s.map((p) => p.t)))
  if (!end) return null
  const start = end - 30 * 864e5
  const lines = series.map((rows) => {
    const inside = rows.filter((p) => p.t >= start)
    const before = rows.filter((p) => p.t < start).pop()
    const list = before ? [{ t: start, v: before.v }, ...inside] : inside
    if (list.length < 2) return null
    const base = list[0].v
    return list.map((p) => ({ t: p.t, d: Math.round((p.v - base) * 100) }))
  })
  if (!lines.some(Boolean)) return null
  const all = lines.flatMap((l) => (l ?? []).map((p) => p.d))
  const lo = Math.min(0, ...all) - 10
  const hi = Math.max(0, ...all) + 10
  const W = 400
  const H = 170
  const x = (t: number) => ((t - start) / (end - start)) * W
  const y = (d: number) => 8 + (1 - (d - lo) / (hi - lo)) * (H - 16)
  return {
    paths: lines.map((l) => (l ? monotone(l.map((p) => [x(p.t), y(p.d)] as const)) : '')),
    /** The soft fade under the profile's own line, closed down to the floor. */
    area: lines[0]
      ? `${monotone(lines[0].map((p) => [x(p.t), y(p.d)] as const))} L${x(lines[0][lines[0].length - 1].t)} ${H} L${x(lines[0][0].t)} ${H} Z`
      : '',
    deltas: lines.map((l) => (l ? l[l.length - 1].d : null)),
    zero: y(0),
    from: new Date(start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    mid: new Date(start + (end - start) / 2).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    }),
    W,
    H,
  }
})
const signedLp = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)}`

/** The two match samples, the shape every derivation in lib/compare works on. */
const sides = computed<Side[]>(() =>
  players.value.map((p, index) => ({
    puuid: p.puuid,
    matches: datasets.value[index]?.matches ?? [],
  }))
)

/* ── Metrics ───────────────────────────────────────────────────── */
const METRICS = [
  { key: 'winrate', name: 'Win rate', unit: '%', factor: 100, decimals: 0 },
  { key: 'kda', name: 'KDA', unit: '', factor: 1, decimals: 2 },
  { key: 'killParticipation', name: 'Kill participation', unit: '%', factor: 100, decimals: 0 },
  { key: 'damageShare', name: 'Damage share', unit: '%', factor: 100, decimals: 0 },
  { key: 'goldShare', name: 'Gold share', unit: '%', factor: 100, decimals: 0 },
  { key: 'csMin', name: 'CS per minute', unit: '', factor: 1, decimals: 1 },
  { key: 'goldPerMinute', name: 'Gold per minute', unit: '', factor: 1, decimals: 0 },
  { key: 'damagePerMinute', name: 'Damage per minute', unit: '', factor: 1, decimals: 0 },
  { key: 'visionMin', name: 'Vision per minute', unit: '', factor: 1, decimals: 2 },
] as const

type MetricKey = (typeof METRICS)[number]['key']

function value(index: number, key: MetricKey, factor: number, decimals: number) {
  const g = datasets.value[index]?.stats
  if (!g?.total) return null
  return (g[key] * factor).toFixed(decimals)
}

function leader(key: MetricKey) {
  const a = datasets.value[0]?.stats
  const b = datasets.value[1]?.stats
  if (!a?.total || !b?.total || a[key] === b[key]) return -1
  return a[key] > b[key] ? 0 : 1
}

/**
 * Each bar as a share of the larger of the two, so the player ahead always
 * fills their half and the other one is visibly short of it. A bar split by
 * the sum instead reads as 52/48 on a metric one of them clearly wins.
 */
function weights(key: MetricKey) {
  const a = datasets.value[0]?.stats
  const b = datasets.value[1]?.stats
  if (!a?.total || !b?.total) return [0, 0]
  const top = Math.max(Math.max(0, a[key]), Math.max(0, b[key]))
  if (!top) return [0, 0]
  return [(Math.max(0, a[key]) / top) * 100, (Math.max(0, b[key]) / top) * 100]
}

/** The margin, printed beside whoever holds it. */
function gap(key: MetricKey, factor: number, decimals: number) {
  const a = datasets.value[0]?.stats
  const b = datasets.value[1]?.stats
  if (!a?.total || !b?.total) return null
  const diff = Math.abs(a[key] - b[key]) * factor
  if (diff < Number(`1e-${decimals}`)) return null
  return `+${diff.toFixed(decimals)}`
}

/** Last 20 results per player (remakes are no result), oldest first. */
const form = computed(() =>
  players.value.map((p, index) =>
    (datasets.value[index]?.matches ?? [])
      .filter((m) => !isRemake(m))
      .slice(0, 20)
      .map((m) => m.participants.find((x) => x.puuid === p.puuid)?.win)
      .filter((w): w is boolean => w !== undefined)
      .reverse()
  )
)

const wins = computed(() => {
  let a = 0
  let b = 0
  for (const metric of METRICS) {
    const side = leader(metric.key)
    if (side === 0) a++
    else if (side === 1) b++
  }
  return [a, b]
})

/* ── The games they actually shared ────────────────────────────── */
const shared = computed(() => (ready.value ? sharedGames(sides.value) : []))
const sameTeam = computed(() => shared.value.filter((g) => g.together))
const versus = computed(() => shared.value.filter((g) => !g.together))

const record = computed(() => {
  const played = sameTeam.value.length
  const won = sameTeam.value.filter((g) => Boolean(g.players[0]?.win)).length
  return { played, won, lost: played - won }
})

/** Each side's numbers narrowed to the games they queued together. */
const togetherLines = computed(() =>
  sides.value.map((side) =>
    lineOf(
      sameTeam.value.map((g) => g.match),
      side.puuid
    )
  )
)

/**
 * The same player without the other one, which is the number that turns a
 * duo record into a verdict. `teammatesFrom` already derives it, so both
 * sides here are read off it rather than counted a second time.
 */
const apart = computed(() =>
  sides.value.map((side, index) => {
    const opponent = sides.value[1 - index]
    if (!opponent || !side.matches.length) return null
    const mate = teammatesFrom(side.matches, side.puuid, 1).find((m) => m.puuid === opponent.puuid)
    if (!mate || mate.lift === null) return null
    const games = side.matches.length - mate.games
    if (games < 1) return null
    return { games, winrate: Math.round(mate.soloWinrate), lift: Math.round(mate.lift) }
  })
)

/** The lane partnership those games settled into, when they have one. */
const pairing = computed(() => {
  const side = sides.value[0]
  const opponent = sides.value[1]
  if (!side || !opponent || !sameTeam.value.length) return null
  const mate = teammatesFrom(side.matches, side.puuid, 1).find((m) => m.puuid === opponent.puuid)
  return mate?.pairing?.label ?? null
})

/* ── Role by role ──────────────────────────────────────────────── */
const ROLE_COLUMNS = [
  { key: 'winrate', head: 'Win rate', unit: '%', factor: 100, decimals: 0, dense: false, at: '' },
  { key: 'kda', head: 'KDA', unit: '', factor: 1, decimals: 2, dense: false, at: '' },
  {
    key: 'killParticipation',
    head: 'KP',
    unit: '%',
    factor: 100,
    decimals: 0,
    dense: false,
    at: 'hm',
  },
  {
    key: 'csMin',
    head: 'CS/min',
    unit: '',
    factor: 1,
    decimals: 1,
    dense: false,
    at: 'hm',
  },
  {
    key: 'damagePerMinute',
    head: 'DPM',
    unit: '',
    factor: 1,
    decimals: 0,
    dense: true,
    at: 'hm',
  },
  {
    key: 'goldPerMinute',
    head: 'GPM',
    unit: '',
    factor: 1,
    decimals: 0,
    dense: true,
    at: 'hm',
  },
] as const

const roles = computed(() => (ready.value ? roleRows(sides.value) : []))

function cell(line: Line | null, column: (typeof ROLE_COLUMNS)[number]) {
  if (!line?.games) return '-'
  const raw = line[column.key] * column.factor
  return `${column.dense ? compact(raw) : raw.toFixed(column.decimals)}${column.unit}`
}

/**
 * Full ink for whoever holds a column inside one role, faded for the other.
 * A role only one of them queues has nothing to win, so it stays legible
 * rather than being greyed out as though it had lost.
 */
function roleInk(lines: Array<Line | null>, key: MetricKey, index: number) {
  const [a, b] = lines
  if (!a?.games || !b?.games || a[key] === b[key]) return 't2'
  return (a[key] > b[key] ? 0 : 1) === index ? 't1 b' : 't3'
}

/* ── Champion pools ────────────────────────────────────────────── */
const pools = computed(() =>
  ready.value
    ? championSplit(
        [datasets.value[0]?.champions ?? [], datasets.value[1]?.champions ?? []],
        Number.POSITIVE_INFINITY
      )
    : { both: [], only: [[], []] }
)

const poolsOpen = ref(false)

/** Each side's champions, most played first; a pick both play is highlighted. */
const POOL_ROWS = 6
const sharedIds = computed(() => new Set(pools.value.both.map((row) => row.championId)))
const columns = computed(() =>
  [0, 1].map((i) =>
    [...(datasets.value[i]?.champions ?? [])]
      .sort((a, b) => b.games - a.games)
      .slice(0, poolsOpen.value ? undefined : POOL_ROWS)
  )
)
const poolMore = computed(() =>
  Math.max(datasets.value[0]?.champions.length ?? 0, datasets.value[1]?.champions.length ?? 0)
)
</script>

<template>
  <div class="cm">
    <!-- Who against whom, and every metric on one mirrored axis -->
    <article class="card">
      <CardHead title="Compare" icon="compare" meta="Last 100 games each, same filters" />
      <div v-if="other" class="cm-vs">
        <div v-for="(p, i) in players" :key="p.puuid" class="cm-p" :class="{ r: i === 1 }">
          <Frame :src="profileIcon(p.profileIconId)" :width="64" size="s" />
          <span class="col" style="gap: 6px; min-width: 0">
            <PlayerLink :game-name="p.gameName" :tag-line="p.tagLine" show-tag bold class="h2" />
            <span class="row meta num cm-rk">
              <RankEmblem v-if="soloOf(i)" :tier="soloOf(i)!.tier" :size="20" />
              <span
                ><template v-if="soloOf(i)"
                  ><span class="t2">{{ rankLabel(rankFromCore(soloOf(i)!), false) }}</span
                  >, {{ soloOf(i)!.leaguePoints }} LP</template
                ><template v-else>Unranked</template
                ><template v-if="mainRole(i)"
                  >, {{ positionName(mainRole(i)).toLowerCase() }}</template
                ></span
              >
            </span>
          </span>
        </div>
        <div class="cm-mid">
          <span class="lab">against</span>
          <span v-if="ready" class="fg-s num" title="Metrics ahead"
            >{{ wins[0] }}<span class="t3"> to </span>{{ wins[1] }}</span
          >
        </div>
      </div>
      <div v-else class="cm-vs one">
        <div class="cm-p">
          <Frame :src="profileIcon(profile.profileIconId)" :width="64" size="s" />
          <span class="col" style="gap: 6px; min-width: 0">
            <b class="h2 ell"
              >{{ profile.gameName }} <span class="t3">#{{ profile.tagLine }}</span></b
            >
            <span class="meta">Pick a player to put their last games next to these.</span>
          </span>
        </div>
      </div>

      <div class="cm-pick">
        <PlayerSearchField
          :busy="busy"
          :placeholder="other ? 'Compare with someone else' : 'Search a Riot ID to compare against'"
          @select="pick"
        />
        <button v-if="other" type="button" class="btn" @click="clear">
          <Icon name="x" />Clear
        </button>
      </div>

      <p v-if="error" class="cm-msg ls" role="alert">{{ error }}</p>
      <p v-else-if="note && other" class="cm-msg meta" role="status">{{ note }}</p>

      <MatchFilters v-model="filters" :champions="champions" class="cm-f" />

      <div v-if="fetching" class="cm-wait" aria-busy="true">
        <p class="meta" role="status">Fetching {{ fetching }}’s latest games…</p>
        <Skeleton :rows="6" />
      </div>

      <div v-else-if="other && !ready" class="cm-wait"><Skeleton :rows="9" /></div>

      <div v-else-if="ready" class="cm-ms">
        <div
          v-for="metric in METRICS"
          :key="metric.key"
          class="cm-r"
          :title="
            gap(metric.key, metric.factor, metric.decimals)
              ? `${metric.name}: ${players[leader(metric.key)]?.gameName} ahead by ${gap(metric.key, metric.factor, metric.decimals)}${metric.unit}`
              : metric.name
          "
        >
          <b class="fg-xs num" :class="leader(metric.key) === 1 ? 't3' : ''"
            >{{ value(0, metric.key, metric.factor, metric.decimals) ?? '-' }}{{ metric.unit }}</b
          >
          <span class="cm-c">
            <span class="lab">{{ metric.name }}</span>
            <span class="cm-bars">
              <span class="a"
                ><i
                  :class="{ lo: leader(metric.key) === 1 }"
                  :style="{ width: `${weights(metric.key)[0]}%` }"
              /></span>
              <span class="b"
                ><i
                  :class="{ lo: leader(metric.key) === 0 }"
                  :style="{ width: `${weights(metric.key)[1]}%` }"
              /></span>
            </span>
          </span>
          <b class="fg-xs num" :class="leader(metric.key) === 0 ? 't3' : ''"
            >{{ value(1, metric.key, metric.factor, metric.decimals) ?? '-' }}{{ metric.unit }}</b
          >
        </div>
        <div class="cm-r cm-form">
          <span />
          <span class="cm-c">
            <span class="lab">Last {{ Math.max(form[0].length, form[1].length) }} games</span>
            <span class="cm-bars cm-strips">
              <span class="a"><FormStrip :results="form[0]" small /></span>
              <span class="b"><FormStrip :results="form[1]" small /></span>
            </span>
          </span>
          <span />
        </div>
      </div>
    </article>

    <template v-if="ready">
      <div class="grid2 cm-two">
        <article class="card">
          <CardHead title="LP, last 30 days" icon="chart" />
          <template v-if="lp">
            <div class="row cm-lgd num">
              <span v-for="(p, i) in players" :key="p.puuid"
                ><i :class="i ? 'b' : 'a'" />{{ p.gameName }}
                <b>{{ lp.deltas[i] === null ? 'no data' : signedLp(lp.deltas[i]!) }}</b></span
              >
            </div>
            <div class="chart cm-lp" :style="{ height: `${lp.H}px` }">
              <span class="cm-zero" :style="{ top: `${lp.zero}px` }"><span>Start</span></span>
              <svg
                v-if="lp.area"
                class="fade"
                :viewBox="`0 0 ${lp.W} ${lp.H}`"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path class="area" :d="lp.area" />
              </svg>
              <svg :viewBox="`0 0 ${lp.W} ${lp.H}`" preserveAspectRatio="none" aria-hidden="true">
                <path
                  v-if="lp.paths[1]"
                  class="cm-ln2"
                  :d="lp.paths[1]"
                  vector-effect="non-scaling-stroke"
                />
                <path v-if="lp.paths[0]" class="ln" :d="lp.paths[0]" />
              </svg>
            </div>
            <div class="row meta num cm-x">
              <span>{{ lp.from }}</span
              ><span>{{ lp.mid }}</span
              ><span>Latest</span>
            </div>
          </template>
          <EmptyState
            v-else
            compact
            icon="chart"
            title="No stored rank changes for either player in 30 days"
          />
        </article>

        <article class="card">
          <CardHead
            title="Champion pools"
            icon="grid"
            :meta="`${sharedIds.size} shared ${sharedIds.size === 1 ? 'pick' : 'picks'} in violet`"
          />
          <div class="cm-pools">
            <div v-for="(list, i) in columns" :key="i">
              <p class="lab cm-ph">{{ players[i].gameName }}</p>
              <div
                v-for="c in list"
                :key="c.championId"
                class="cm-pc"
                :class="{ sh: sharedIds.has(c.championId) }"
              >
                <Frame :src="champIcon(c.championId)" :width="32" size="xs" />
                <span class="col grow" style="gap: 2px; min-width: 0">
                  <b class="h5 ell">{{ championName(c.championId) }}</b>
                  <span class="meta num">{{ c.games }} games, {{ c.kda.toFixed(2) }} KDA</span>
                </span>
                <span class="fg-xs num">{{ Math.round(c.winrate * 100) }}%</span>
              </div>
            </div>
          </div>
          <div v-if="poolMore > POOL_ROWS" class="cm-foot">
            <ShowMore v-model="poolsOpen" :total="poolMore" :limit="POOL_ROWS" />
          </div>
        </article>
      </div>

      <!-- The games they shared -->
      <section v-if="shared.length">
        <SectionHead title="Together" icon="users" :meta="pairing" />
        <article class="card">
          <div class="cm-figs">
            <div v-if="record.played">
              <span class="lab">Record</span>
              <span class="fg-l num"
                ><span class="wn">{{ record.won }}</span
                ><span class="t3"> - </span><span class="ls">{{ record.lost }}</span></span
              >
              <span class="meta num"
                >{{ Math.round((record.won / record.played) * 100) }}% won together</span
              >
            </div>
            <div v-if="versus.length">
              <span class="lab">Against each other</span>
              <span class="fg-l num">{{ versus.length }}</span>
              <span class="meta">games on opposite teams</span>
            </div>
            <template v-for="(row, i) in apart" :key="i">
              <div v-if="row">
                <span class="lab ell">{{ players[i].gameName }} apart</span>
                <span class="fg-l num">{{ row.winrate }}%</span>
                <span class="meta num">{{ row.games }} games</span>
              </div>
            </template>
          </div>

          <div class="tbl cm-g" role="table" aria-label="Games together">
            <div class="tbl-h" role="row">
              <span role="columnheader">Game</span>
              <span v-for="p in players" :key="p.puuid" class="n ell" role="columnheader">{{
                p.gameName
              }}</span>
              <span class="n hm" role="columnheader">Length</span>
            </div>

            <template v-if="record.played">
              <div class="tbl-r cm-band" role="row">
                <span class="lab" role="cell">{{ record.played }} games together</span>
                <span v-for="(line, i) in togetherLines" :key="i" class="n" role="cell">
                  <b class="num" :class="roleInk(togetherLines, 'kda', i)">{{
                    line.kda.toFixed(2)
                  }}</b>
                  <span
                    class="meta num cm-kp"
                    :class="roleInk(togetherLines, 'killParticipation', i)"
                    >{{ Math.round(line.killParticipation * 100) }}% KP</span
                  >
                </span>
                <span class="hm" role="cell" />
              </div>
              <div v-for="game in sameTeam" :key="game.match.matchId" class="tbl-r" role="row">
                <span class="row" style="gap: 10px; min-width: 0" role="cell">
                  <b class="cm-wl" :class="game.players[0].win ? 'wn' : 'ls'">{{
                    game.players[0].win ? 'Win' : 'Loss'
                  }}</b>
                  <span class="meta ell"
                    >{{ queueName(game.match.queueId)
                    }}<span class="hm">, {{ timeAgo(game.match.gameStartMs) }}</span></span
                  >
                </span>
                <span v-for="(p, i) in game.players" :key="i" class="n cm-pl" role="cell">
                  <span class="num t2">{{ p.kills }}/{{ p.deaths }}/{{ p.assists }}</span>
                  <RoleIcon
                    v-if="p.position"
                    :lane="positionOf(p.position)"
                    :size="13"
                    class="t3 hm"
                  />
                  <Frame
                    :src="champIcon(p.championId)"
                    :alt="championName(p.championId)"
                    :width="26"
                    size="xs"
                  />
                </span>
                <span class="n meta num hm" role="cell">{{ duration(game.match.duration) }}</span>
              </div>
            </template>

            <template v-if="versus.length">
              <div class="tbl-r cm-band" role="row">
                <span class="lab" role="cell">{{ versus.length }} against each other</span>
                <span v-for="p in players" :key="p.puuid" role="cell" />
                <span class="hm" role="cell" />
              </div>
              <div v-for="game in versus" :key="game.match.matchId" class="tbl-r" role="row">
                <span class="meta ell" role="cell"
                  >{{ queueName(game.match.queueId)
                  }}<span class="hm">, {{ timeAgo(game.match.gameStartMs) }}</span></span
                >
                <span v-for="(p, i) in game.players" :key="i" class="n cm-pl" role="cell">
                  <b class="cm-wl" :class="p.win ? 'wn' : 'ls'">{{ p.win ? 'W' : 'L' }}</b>
                  <span class="num t2">{{ p.kills }}/{{ p.deaths }}/{{ p.assists }}</span>
                  <Frame
                    :src="champIcon(p.championId)"
                    :alt="championName(p.championId)"
                    :width="26"
                    size="xs"
                  />
                </span>
                <span class="n meta num hm" role="cell">{{ duration(game.match.duration) }}</span>
              </div>
            </template>
          </div>
        </article>
      </section>

      <!-- The same metrics, one position at a time -->
      <section v-if="roles.length">
        <SectionHead title="By role" icon="layers" />
        <article class="card">
          <div class="tbl cm-roles" role="table" aria-label="Metrics by role">
            <div class="tbl-h" role="row">
              <span role="columnheader">Player</span>
              <span class="n" role="columnheader">Games</span>
              <span
                v-for="column in ROLE_COLUMNS"
                :key="column.key"
                class="n"
                :class="column.at"
                role="columnheader"
                >{{ column.head }}</span
              >
            </div>
            <template v-for="row in roles" :key="row.role">
              <div class="tbl-r cm-band" role="row">
                <span class="row lab" style="gap: 8px" role="cell">
                  <RoleIcon :lane="positionOf(row.role)" :size="14" />{{ row.label }}
                </span>
              </div>
              <template v-for="(line, i) in row.lines" :key="i">
                <div v-if="line" class="tbl-r" role="row">
                  <span class="cm-who" role="cell">
                    <i :class="i ? 'b' : 'a'" />
                    <PlayerLink :game-name="players[i].gameName" :tag-line="players[i].tagLine" />
                  </span>
                  <span class="n meta num" role="cell">{{ line.games }}</span>
                  <span
                    v-for="column in ROLE_COLUMNS"
                    :key="column.key"
                    class="n num"
                    :class="[column.at, roleInk(row.lines, column.key, i)]"
                    role="cell"
                    >{{ cell(line, column) }}</span
                  >
                </div>
              </template>
            </template>
          </div>
        </article>
      </section>
    </template>
  </div>
</template>

<style scoped>
.cm {
  display: flex;
  flex-direction: column;
  gap: 32px;
}
.cm-vs {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px minmax(0, 1fr);
  align-items: center;
  padding: 8px 20px 20px;
}
.cm-vs .cm-p.r {
  grid-column: 3;
  grid-row: 1;
}
.cm-vs.one {
  grid-template-columns: minmax(0, 1fr);
}
.cm-p {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}
.cm-p .fr {
  box-shadow: 0 0 0 2px var(--v400);
}
.cm-p.r {
  flex-direction: row-reverse;
  text-align: right;
}
.cm-p.r .fr {
  box-shadow: 0 0 0 2px var(--t3);
}
.cm-p.r .col {
  align-items: flex-end;
}
.cm-rk {
  flex-wrap: wrap;
  gap: 6px;
}
.cm-mid {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
}
.cm-pick {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid var(--line);
}
.cm-msg {
  margin: 0;
  padding: 0 20px 14px;
  font-size: 13px;
  font-weight: 600;
}
.cm-f {
  padding: 14px 20px;
  border-top: 1px solid var(--line);
}
.cm-wait {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 20px 20px;
  border-top: 1px solid var(--line);
}
.cm-ms {
  padding: 8px 0 12px;
  border-top: 1px solid var(--line);
}
.cm-r {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr) 90px;
  align-items: center;
  gap: 16px;
  padding: 9px 20px;
}
.cm-r > b {
  text-align: right;
}
.cm-r > b:last-child {
  text-align: left;
}
.cm-c {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.cm-bars {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  width: 100%;
}
.cm-bars > span {
  display: flex;
  height: 6px;
  border-radius: 2px;
  background: var(--s3);
}
.cm-bars > .a {
  justify-content: flex-end;
}
.cm-bars i {
  display: block;
  height: 100%;
  border-radius: 2px;
}
.cm-bars .a i {
  background: var(--v400);
}
.cm-bars .b i {
  background: var(--t3);
}
.cm-bars i.lo {
  opacity: 0.45;
}
.cm-form {
  padding-top: 14px;
}
.cm-strips > span {
  height: auto;
  background: none;
}
.cm-kp {
  margin-left: 8px;
}
.cm-two {
  align-items: start;
}
.cm-lgd {
  flex-wrap: wrap;
  gap: 6px 18px;
  padding: 0 20px 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--t3);
}
.cm-lgd i,
.cm-who i {
  display: inline-block;
  width: 12px;
  height: 3px;
  margin-right: 8px;
  border-radius: 2px;
  vertical-align: middle;
  background: var(--v400);
}
.cm-lgd i.b,
.cm-who i.b {
  background: var(--t3);
}
.cm-lgd b {
  margin-left: 4px;
  color: var(--t1);
}
.cm-lp {
  margin: 8px 20px 0 56px;
}
.cm-ln2 {
  fill: none;
  stroke: var(--t3);
  stroke-width: 1.5;
  stroke-dasharray: 4 3;
}
.cm-zero {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px dashed var(--line-3);
}
.cm-zero span {
  position: absolute;
  right: calc(100% + 10px);
  top: -8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--t3);
}
.cm-x {
  justify-content: space-between;
  padding: 10px 20px 18px 56px;
}
.cm-pools {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 20px;
  padding: 0 20px 8px;
}
.cm-ph {
  margin: 0;
  padding: 4px 0 8px;
}
.cm-pc {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  margin: 0 -8px;
  padding: 0 8px;
  border-top: 1px solid var(--line);
  border-radius: 6px;
}
.cm-pc.sh {
  background: rgb(var(--v-rgb) / 0.1);
  box-shadow: inset 2px 0 0 var(--v400);
}
.cm-foot {
  padding: 8px 20px 16px;
  border-top: 1px solid var(--line);
}
.cm-figs {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 0;
  padding: 18px 0;
}
.cm-figs > div {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 160px;
  padding: 0 20px;
}
.cm-figs > div + div {
  border-left: 1px solid var(--line);
}
.cm-g {
  --cols: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr) 72px;
}
.cm-band {
  background: var(--s2);
}
.cm-wl {
  width: 34px;
  flex: none;
  font-size: 13px;
}
.cm-pl {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
.cm-roles {
  --cols: minmax(0, 1fr) 64px 72px 64px 56px 72px 72px 72px;
}
.cm-who {
  display: flex;
  align-items: center;
  min-width: 0;
  font-size: 13px;
}
@media (max-width: 860px) {
  .cm-vs {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
  .cm-vs .cm-p.r {
    grid-column: 1;
    grid-row: 3;
    flex-direction: row;
    text-align: left;
  }
  .cm-p.r .col {
    align-items: flex-start;
  }
  .cm-mid {
    grid-column: 1;
    grid-row: 2;
    flex-direction: row;
    justify-content: flex-start;
    gap: 10px;
  }
  .cm-r {
    grid-template-columns: 64px minmax(0, 1fr) 64px;
    gap: 10px;
    padding: 8px 16px;
  }
  .cm-two,
  .cm-pools {
    grid-template-columns: minmax(0, 1fr);
  }
  .cm-figs > div {
    min-width: 50%;
  }
  .cm-figs > div:nth-child(odd) {
    border-left: 0;
  }
  .cm-g {
    --cols: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
  }
  .cm-roles {
    --cols: minmax(0, 1fr) 48px 56px 56px;
  }
  .cm-pick {
    flex-wrap: wrap;
  }
  .cm-lp {
    margin-left: 48px;
  }
  .cm-x {
    padding-left: 48px;
  }
}
</style>
