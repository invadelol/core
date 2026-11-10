<script lang="ts">
/** Players this browser updated lately, by lowercase `Name-TAG`: picked again, they are not. */
const updatedAt = new Map<string, number>()
const UPDATE_AGAIN_MS = 5 * 60_000
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { RoleIcon } from '@invadelol/ui'
import {
  positionName,
  positionOf,
  queueName,
  rankFromCore,
  rankLabel,
  rankValue,
  tierColor,
  type Position,
} from '@invadelol/ui/logic'
import MatchFilters, { type Filters } from './MatchFilters.vue'
import PlayerLink from './PlayerLink.vue'
import PlayerSearchField from './PlayerSearchField.vue'
import ShowMore from './ShowMore.vue'
import FormStrip from './ui/FormStrip.vue'
import { champIcon, championName, profileIcon } from '../lib/assets.js'
import { monotone } from '../lib/rd_curve.js'
import { compact, duration, timeAgo } from '../lib/format.js'
import { killParticipation, matchMinutes, teamTotals } from '../lib/match.js'
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

/** Last 20 results per player, oldest first. */
const form = computed(() =>
  players.value.map((p, index) =>
    (datasets.value[index]?.matches ?? [])
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
    at: 'hidden xs:table-cell',
  },
  {
    key: 'csMin',
    head: 'CS/min',
    unit: '',
    factor: 1,
    decimals: 1,
    dense: false,
    at: 'hidden sm:table-cell',
  },
  {
    key: 'damagePerMinute',
    head: 'DPM',
    unit: '',
    factor: 1,
    decimals: 0,
    dense: true,
    at: 'hidden md:table-cell',
  },
  {
    key: 'goldPerMinute',
    head: 'GPM',
    unit: '',
    factor: 1,
    decimals: 0,
    dense: true,
    at: 'hidden lg:table-cell',
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
  if (!a?.games || !b?.games || a[key] === b[key]) return 'text-ink-2'
  return (a[key] > b[key] ? 0 : 1) === index ? 'font-semibold text-ink' : 'text-ink-4'
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
  <section class="cmp">
    <!-- Who against whom, and every metric on one mirrored axis -->
    <section class="rd-card">
      <div v-if="other" class="vsh">
        <div v-for="(p, i) in players" :key="p.puuid" class="vp" :class="{ r: i === 1 }">
          <img :src="profileIcon(p.profileIconId)" alt="" width="72" height="72" />
          <span class="min-w-0">
            <PlayerLink
              :game-name="p.gameName"
              :tag-line="p.tagLine"
              show-tag
              bold
              class="vp-name"
            />
            <small class="num"
              ><template v-if="soloOf(i)"
                ><em :style="{ color: tierColor(soloOf(i)!.tier) }">{{
                  rankLabel(rankFromCore(soloOf(i)!), false)
                }}</em
                >, {{ soloOf(i)!.leaguePoints }} LP</template
              ><template v-else>Unranked</template
              ><template v-if="mainRole(i)"
                >, {{ positionName(mainRole(i)).toLowerCase() }}</template
              ></small
            >
          </span>
        </div>
        <div class="vsm">
          against
          <span v-if="ready" class="num" :title="'Metrics ahead'"
            >{{ wins[0] }} to {{ wins[1] }}</span
          >
        </div>
      </div>
      <div v-else class="vsh one">
        <div class="vp">
          <img :src="profileIcon(profile.profileIconId)" alt="" width="72" height="72" />
          <span class="min-w-0">
            <b
              >{{ profile.gameName }} <span>#{{ profile.tagLine }}</span></b
            >
            <small>Pick a player to put their last games next to these.</small>
          </span>
        </div>
      </div>

      <div class="chg">
        <PlayerSearchField
          class="chg-field"
          :busy="busy"
          :placeholder="other ? 'Compare with someone else' : 'Search a Riot ID to compare against'"
          @select="pick"
        />
        <button v-if="other" type="button" class="iv-btn sm" @click="clear">
          <X :size="13" />
          Clear
        </button>
      </div>

      <p v-if="error" class="notice mx-6 mb-4" role="alert">{{ error }}</p>
      <p v-else-if="note && other" class="mx-6 mb-4 text-[12.5px] text-ink-3" role="status">
        {{ note }}
      </p>

      <MatchFilters v-model="filters" :champions="champions" class="cmp-f" />

      <div v-if="fetching" class="px-6 pb-6" aria-busy="true">
        <p class="py-2 text-[13px] text-ink-2" role="status">
          Fetching {{ fetching }}’s latest games…
        </p>
        <div class="iv-skel h-[320px]" />
      </div>

      <div v-else-if="other && !ready" class="px-6 pb-6">
        <div class="iv-skel h-[420px]" />
      </div>

      <div v-else-if="ready" class="mrs">
        <div
          v-for="metric in METRICS"
          :key="metric.key"
          class="mr2"
          :title="
            gap(metric.key, metric.factor, metric.decimals)
              ? `${metric.name}: ${players[leader(metric.key)]?.gameName} ahead by ${gap(metric.key, metric.factor, metric.decimals)}${metric.unit}`
              : metric.name
          "
        >
          <b class="num" :class="{ win: leader(metric.key) !== 1 }"
            >{{ value(0, metric.key, metric.factor, metric.decimals) ?? '-' }}{{ metric.unit }}</b
          >
          <span class="bl2 l"
            ><i
              :class="{ lo: leader(metric.key) === 1 }"
              :style="{ width: `${weights(metric.key)[0]}%` }"
          /></span>
          <span class="lb">{{ metric.name }}</span>
          <span class="bl2 r"
            ><i
              :class="{ lo: leader(metric.key) === 0 }"
              :style="{ width: `${weights(metric.key)[1]}%` }"
          /></span>
          <b class="num" :class="{ win: leader(metric.key) !== 0 }"
            >{{ value(1, metric.key, metric.factor, metric.decimals) ?? '-' }}{{ metric.unit }}</b
          >
        </div>
        <div class="mr2 frm">
          <span />
          <span class="fl"><FormStrip :results="form[0]" /></span>
          <span class="lb">Last {{ Math.max(form[0].length, form[1].length) }} games</span>
          <span><FormStrip :results="form[1]" /></span>
          <span />
        </div>
      </div>
    </section>

    <template v-if="ready">
      <div class="two">
        <section class="rd-card">
          <div class="rd-head">
            <h3>LP, last 30 days</h3>
            <span v-if="lp" class="lgn num">
              <span v-for="(p, i) in players" :key="p.puuid"
                ><i :class="i ? 'b' : 'a'" />{{ p.gameName }}
                {{ lp.deltas[i] === null ? 'no data' : signedLp(lp.deltas[i]!) }}</span
              >
            </span>
          </div>
          <template v-if="lp">
            <div class="lpg">
              <span class="gd" :style="{ top: `${lp.zero}px` }"><span>Start</span></span>
              <svg :viewBox="`0 0 ${lp.W} ${lp.H}`" preserveAspectRatio="none" aria-hidden="true">
                <path
                  v-if="lp.paths[1]"
                  class="b"
                  :d="lp.paths[1]"
                  vector-effect="non-scaling-stroke"
                />
                <path
                  v-if="lp.paths[0]"
                  class="a"
                  :d="lp.paths[0]"
                  vector-effect="non-scaling-stroke"
                />
              </svg>
            </div>
            <div class="lpx num">
              <span>{{ lp.from }}</span
              ><span>{{ lp.mid }}</span
              ><span>Latest</span>
            </div>
          </template>
          <p v-else class="cmp-note">No stored rank changes for either player in 30 days.</p>
        </section>

        <section class="rd-card">
          <div class="rd-head">
            <h3>Champion pools</h3>
            <span class="rd-hm num"
              >{{ sharedIds.size }} shared
              {{ sharedIds.size === 1 ? 'pick' : 'picks' }} highlighted</span
            >
          </div>
          <div class="pl2">
            <div v-for="(list, i) in columns" :key="i">
              <h4>{{ players[i].gameName }}</h4>
              <div
                v-for="c in list"
                :key="c.championId"
                class="prow pp"
                :class="{ sh: sharedIds.has(c.championId) }"
              >
                <img :src="champIcon(c.championId)" alt="" width="32" height="32" loading="lazy" />
                <span class="min-w-0">
                  <b class="truncate">{{ championName(c.championId) }}</b>
                  <small class="num">{{ c.games }} games, {{ c.kda.toFixed(2) }} KDA</small>
                </span>
                <em class="num">{{ Math.round(c.winrate * 100) }}%</em>
              </div>
            </div>
          </div>
          <div v-if="poolMore > POOL_ROWS" class="rd-foot">
            <ShowMore v-model="poolsOpen" :total="poolMore" :limit="POOL_ROWS" />
          </div>
        </section>
      </div>

      <!-- The games they shared -->
      <template v-if="shared.length">
        <div class="cmp-h">
          <h2>
            Together<span v-if="pairing">{{ pairing }}</span>
          </h2>
        </div>

        <div class="rd-card mb-3 flex flex-wrap items-start gap-x-10 gap-y-4 px-5 py-4">
          <div v-if="record.played">
            <div class="label">Record</div>
            <div class="fig mt-1.5 text-[24px]">
              <span class="rd-up">{{ record.won }}</span>
              <span class="text-ink-4">-</span>
              <span class="rd-dn">{{ record.lost }}</span>
              <span class="num ml-1.5 text-[12px] font-semibold text-ink-3">
                {{ Math.round((record.won / record.played) * 100) }}%
              </span>
            </div>
          </div>
          <div v-if="versus.length">
            <div class="label">Against</div>
            <div class="fig mt-1.5 text-[24px] text-ink">{{ versus.length }}</div>
          </div>
          <div v-for="(row, i) in apart" :key="i">
            <template v-if="row">
              <div class="label">{{ players[i].gameName }} apart</div>
              <div class="fig mt-1.5 text-[24px] text-ink">
                {{ row.winrate }}%
                <span class="num ml-1.5 text-[12px] font-semibold text-ink-3"
                  >{{ row.games }} games</span
                >
              </div>
            </template>
          </div>
        </div>

        <div class="rd-card mb-2">
          <div class="scroll-x">
            <table class="dt dt-hover num min-w-[330px]">
              <thead>
                <tr>
                  <th class="!pl-4">Game</th>
                  <th v-for="p in players" :key="p.puuid" class="text-right">
                    <PlayerLink
                      :game-name="p.gameName"
                      :tag-line="p.tagLine"
                      class="!font-semibold"
                    />
                  </th>
                  <th class="hidden !pr-4 text-right sm:table-cell">Length</th>
                </tr>
              </thead>

              <tbody v-if="record.played">
                <tr class="band">
                  <td class="!pl-4">
                    <span class="text-[12px] font-semibold text-ink-2"
                      >{{ record.played }} games together</span
                    >
                  </td>
                  <td v-for="(line, i) in togetherLines" :key="i" class="text-right">
                    <span class="stat text-[14px]" :class="roleInk(togetherLines, 'kda', i)">
                      {{ line.kda.toFixed(2) }}
                    </span>
                    <span
                      class="ml-1.5 text-[11px]"
                      :class="roleInk(togetherLines, 'killParticipation', i)"
                    >
                      {{ Math.round(line.killParticipation * 100) }}% KP
                    </span>
                  </td>
                  <td class="hidden !pr-4 sm:table-cell" />
                </tr>

                <tr v-for="game in sameTeam" :key="game.match.matchId">
                  <td class="!pl-4">
                    <span class="flex items-center gap-2.5">
                      <span
                        class="stat text-[13px]"
                        :class="game.players[0].win ? 'text-win' : 'text-loss'"
                      >
                        {{ game.players[0].win ? 'W' : 'L' }}
                      </span>
                      <span class="min-w-0 truncate text-[12px] text-ink-2">
                        {{ queueName(game.match.queueId) }}
                        <span class="hidden text-ink-3 sm:inline">
                          {{ timeAgo(game.match.gameStartMs) }}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td v-for="(p, i) in game.players" :key="i" class="text-right">
                    <span class="flex items-center justify-end gap-2">
                      <span class="text-[12px] font-medium text-ink-2">
                        {{ p.kills }}/{{ p.deaths }}/{{ p.assists }}
                      </span>
                      <RoleIcon
                        v-if="p.position"
                        :lane="positionOf(p.position)"
                        :size="13"
                        class="text-ink-3"
                      />
                      <img
                        :src="champIcon(p.championId)"
                        :alt="championName(p.championId)"
                        :title="championName(p.championId)"
                        width="26"
                        height="26"
                        loading="lazy"
                        class="thumb h-[26px] w-[26px] rounded-sm"
                      />
                    </span>
                  </td>
                  <td class="hidden !pr-4 text-right text-[12px] text-ink-3 sm:table-cell">
                    {{ duration(game.match.duration) }}
                  </td>
                </tr>
              </tbody>

              <tbody v-if="versus.length">
                <tr class="band">
                  <td class="!pl-4">
                    <span class="text-[12px] font-semibold text-ink-2"
                      >{{ versus.length }} against each other</span
                    >
                  </td>
                  <td :colspan="players.length" />
                  <td class="hidden !pr-4 sm:table-cell" />
                </tr>

                <tr v-for="game in versus" :key="game.match.matchId">
                  <td class="!pl-4">
                    <span class="min-w-0 truncate text-[12px] text-ink-2">
                      {{ queueName(game.match.queueId) }}
                      <span class="hidden text-ink-3 sm:inline">
                        {{ timeAgo(game.match.gameStartMs) }}
                      </span>
                    </span>
                  </td>
                  <td v-for="(p, i) in game.players" :key="i" class="text-right">
                    <span class="flex items-center justify-end gap-2">
                      <span class="stat text-[13px]" :class="p.win ? 'text-win' : 'text-loss'">
                        {{ p.win ? 'W' : 'L' }}
                      </span>
                      <span class="text-[12px] font-medium text-ink-2">
                        {{ p.kills }}/{{ p.deaths }}/{{ p.assists }}
                      </span>
                      <img
                        :src="champIcon(p.championId)"
                        :alt="championName(p.championId)"
                        :title="championName(p.championId)"
                        width="26"
                        height="26"
                        loading="lazy"
                        class="thumb h-[26px] w-[26px] rounded-sm"
                      />
                    </span>
                  </td>
                  <td class="hidden !pr-4 text-right text-[12px] text-ink-3 sm:table-cell">
                    {{ duration(game.match.duration) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>

      <!-- The same metrics, one position at a time -->
      <template v-if="roles.length">
        <div class="cmp-h">
          <h2>By role</h2>
        </div>
        <div class="rd-card mb-2">
          <table class="dt num w-full">
            <thead>
              <tr>
                <th class="!pl-4">Player</th>
                <th class="text-right">Games</th>
                <th
                  v-for="(column, c) in ROLE_COLUMNS"
                  :key="column.key"
                  class="text-right"
                  :class="[column.at, c === ROLE_COLUMNS.length - 1 ? '!pr-4' : '']"
                >
                  {{ column.head }}
                </th>
              </tr>
            </thead>

            <tbody v-for="row in roles" :key="row.role">
              <tr class="band">
                <td class="!pl-4" :colspan="2 + ROLE_COLUMNS.length">
                  <span class="flex items-center gap-2">
                    <RoleIcon :lane="positionOf(row.role)" :size="14" class="text-ink-2" />
                    <span class="text-[12px] font-semibold text-ink-2">{{ row.label }}</span>
                  </span>
                </td>
              </tr>

              <template v-for="(line, i) in row.lines" :key="i">
                <tr v-if="line">
                  <td class="!pl-4">
                    <PlayerLink
                      :game-name="players[i].gameName"
                      :tag-line="players[i].tagLine"
                      class="max-w-[140px] text-[12.5px]"
                    />
                  </td>
                  <td class="text-right text-ink-3">{{ line.games }}</td>
                  <td
                    v-for="(column, c) in ROLE_COLUMNS"
                    :key="column.key"
                    class="text-right"
                    :class="[
                      column.at,
                      roleInk(row.lines, column.key, i),
                      c === ROLE_COLUMNS.length - 1 ? '!pr-4' : '',
                    ]"
                  >
                    {{ cell(line, column) }}
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </template>
    </template>
  </section>
</template>

<style scoped>
.vsh {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px minmax(0, 1fr);
  align-items: center;
  padding: 24px;
}
.vsh .vp:nth-child(2) {
  grid-column: 3;
  grid-row: 1;
}
.vsh .vsm {
  grid-column: 2;
  grid-row: 1;
}
.vsh.one {
  grid-template-columns: minmax(0, 1fr);
}
.vp {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}
.vp.r {
  flex-direction: row-reverse;
  text-align: right;
}
.vp img {
  flex: none;
  width: 72px;
  height: 72px;
  border-radius: 14px;
  box-shadow: 0 0 0 2px var(--rd-violet-hi);
}
.vp.r img {
  box-shadow: 0 0 0 2px #e6e6f0;
}
.vp :deep(.vp-name),
.vp b {
  display: block;
  max-width: 100%;
  font-size: 22px;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--text-1);
}
.vp b span {
  font-size: 15px;
  font-weight: 400;
  color: var(--text-3);
}
.vp small {
  display: block;
  margin-top: 3px;
  font-size: 13px;
  color: var(--text-3);
}
.vp small em {
  font-style: normal;
  font-weight: 650;
}
.vsm {
  display: grid;
  gap: 2px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-3);
}
.vsm span {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-4);
}
.chg {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 24px 14px;
}
.chg-field {
  flex: 1;
  min-width: 0;
}
.cmp-f {
  margin: 0 24px 16px;
}
.mrs {
  box-shadow: inset 0 1px 0 var(--rd-line);
}
.mr2 {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr) 150px minmax(0, 1fr) 76px;
  gap: 14px;
  align-items: center;
  height: 52px;
  padding: 0 24px;
}
.mr2 + .mr2 {
  box-shadow: inset 0 1px 0 var(--rd-line);
}
.mr2 b {
  font-size: 17px;
  font-weight: 650;
  color: var(--text-3);
}
.mr2 b.win {
  color: var(--text-1);
}
.mr2 b:last-child {
  text-align: right;
}
.mr2 .lb {
  font-size: 13px;
  text-align: center;
  color: var(--text-2);
}
.mr2 .fl {
  display: flex;
  justify-content: flex-end;
}
.bl2 {
  display: flex;
  height: 8px;
  overflow: hidden;
  border-radius: 9px;
  background: var(--rd-track);
}
.bl2.l {
  justify-content: flex-end;
}
.bl2 i {
  display: block;
  height: 100%;
  border-radius: 9px;
  background: var(--rd-violet-hi);
}
.bl2.r i {
  background: #e6e6f0;
}
.bl2 i.lo {
  opacity: 0.45;
}
.two {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  margin-top: 16px;
  align-items: start;
}
.lgn {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  font-size: 12px;
  color: var(--text-3);
}
.lgn span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.lgn i {
  width: 14px;
  height: 3px;
  border-radius: 2px;
}
.lgn i.a,
.lpg path.a {
  background: var(--rd-violet-hi);
  stroke: var(--rd-violet-hi);
}
.lgn i.b {
  background: #e6e6f0;
}
.lpg {
  position: relative;
  height: 170px;
  margin: 12px 22px 0;
}
.lpg svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.lpg path {
  fill: none;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.lpg path.a {
  stroke-width: 2.25;
}
.lpg path.b {
  stroke: #e6e6f0;
  stroke-width: 1.75;
  opacity: 0.8;
}
.lpg .gd {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px dashed var(--line-3, rgb(255 255 255 / 0.14));
}
.lpg .gd span {
  position: absolute;
  right: 0;
  top: 4px;
  font-size: 11px;
  color: var(--text-3);
}
.lpx {
  display: flex;
  justify-content: space-between;
  padding: 8px 22px 14px;
  font-size: 11px;
  color: var(--text-3);
}
.pl2 {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}
.pl2 > div + div {
  box-shadow: inset 1px 0 0 var(--rd-line);
}
.pl2 h4 {
  margin: 0;
  padding: 12px 16px 4px;
  overflow: hidden;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text-3);
}
.pl2 .pp {
  grid-template-columns: 32px minmax(0, 1fr) auto;
  height: 48px;
  cursor: default;
}
.pl2 .pp img {
  width: 32px;
  height: 32px;
}
.pl2 .pp:hover {
  background: none;
}
.pl2 .pp.sh {
  background: var(--rd-violet-a);
}
.pl2 .pp em {
  font-size: 13px;
  font-style: normal;
  font-weight: 650;
  color: var(--text-1);
}
.cmp-h {
  margin: 28px 0 12px;
}
.cmp-h h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  color: var(--text-1);
}
.cmp-h h2 span {
  margin-left: 8px;
  font-size: 13px;
  font-weight: 400;
  color: var(--text-3);
}
.cmp-note {
  margin: 0;
  padding: 18px;
  font-size: 13px;
  color: var(--text-3);
}
.cmp :deep(.dt) {
  width: 100%;
}

@media (max-width: 1000px) {
  .two {
    grid-template-columns: minmax(0, 1fr);
  }
  .mr2 {
    grid-template-columns: 56px minmax(0, 1fr) 96px minmax(0, 1fr) 56px;
    gap: 10px;
    padding: 0 14px;
  }
}
@media (max-width: 640px) {
  .vsh {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 14px 12px;
    padding: 18px 16px;
  }
  .vsh .vsm {
    grid-column: 1 / -1;
    grid-row: 2;
  }
  .vsh .vp:nth-child(2) {
    grid-column: 2;
  }
  .vp,
  .vp.r {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .vp.r {
    align-items: flex-end;
  }
  .vp img {
    width: 52px;
    height: 52px;
  }
  .vp :deep(.vp-name),
  .vp b {
    font-size: 16px;
  }
  .chg,
  .cmp-f {
    margin-inline: 16px;
  }
  .mr2 {
    grid-template-columns: 50px minmax(0, 1fr) 74px minmax(0, 1fr) 50px;
    gap: 8px;
    padding: 0 12px;
  }
  .mr2 b {
    font-size: 14px;
  }
  .mr2 .lb {
    font-size: 11px;
  }
  .pl2 {
    grid-template-columns: minmax(0, 1fr);
  }
  .pl2 > div + div {
    box-shadow: inset 0 1px 0 var(--rd-line);
  }
}
</style>
