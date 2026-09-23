<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowLeftRight, X } from 'lucide-vue-next'
import MatchFilters, { type Filters } from './MatchFilters.vue'
import PlayerLink from './PlayerLink.vue'
import PlayerSearchField from './PlayerSearchField.vue'
import RoleIcon from './RoleIcon.vue'
import Sparkline from './ui/Sparkline.vue'
import { champIcon, championName, profileIcon, queueName } from '../lib/assets.js'
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
import type { ChampionStats, GlobalStats, Match, Summoner } from '../lib/types.js'

const props = defineProps<{
  profile: Summoner
  champions: ChampionStats[]
}>()

const other = ref<Summoner | null>(null)
const busy = ref(false)
const error = ref('')
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

async function pick(entry: { gameName: string; tagLine: string }) {
  lookup?.abort()
  lookup = new AbortController()
  const signal = lookup.signal
  busy.value = true
  error.value = ''
  try {
    const slug = `${entry.gameName}-${entry.tagLine}`
    const res = await fetch(`/api/summoners/${encodeURIComponent(slug)}`, { signal })
    if (!res.ok)
      throw new Error(
        res.status === 404
          ? 'Player not found. Check their Riot ID.'
          : 'Riot could not load this player.'
      )
    const data = await res.json()
    if (signal.aborted) return
    if (data.summoner.puuid === props.profile.puuid) throw new Error('Choose a different player.')
    other.value = data.summoner
    const url = new URL(location.href)
    url.searchParams.set('with', `${entry.gameName}#${entry.tagLine}`)
    history.replaceState(history.state, '', url)
  } catch (e) {
    if (!signal.aborted) error.value = (e as Error).message
  } finally {
    if (!signal.aborted) busy.value = false
  }
}

function clear() {
  other.value = null
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

/* ── Per-game series, for the trend beside each metric ─────────── */
function series(index: number, key: MetricKey) {
  return (datasets.value[index]?.matches ?? [])
    .slice(0, 20)
    .reverse()
    .flatMap((m) => {
      const p = m.participants.find((x) => x.puuid === players.value[index]?.puuid)
      if (!p) return []
      const minutes = matchMinutes(m)
      const totals = teamTotals(m)
      const teamDamage = totals[p.teamId]?.damage || 1
      const teamGold = totals[p.teamId]?.gold || 1
      if (key === 'winrate') return [Number(p.win) * 100]
      if (key === 'kda') return [(p.kills + p.assists) / Math.max(1, p.deaths)]
      if (key === 'killParticipation') return [killParticipation(p, totals)]
      if (key === 'damageShare') return [(p.totalDamageDealtToChampions / teamDamage) * 100]
      if (key === 'goldShare') return [(p.goldEarned / teamGold) * 100]
      if (key === 'csMin') return [p.cs / minutes]
      if (key === 'goldPerMinute') return [p.goldEarned / minutes]
      if (key === 'damagePerMinute') return [p.totalDamageDealtToChampions / minutes]
      return [p.visionScore / minutes]
    })
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
  if (!line?.games) return '—'
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
    ? championSplit([datasets.value[0]?.champions ?? [], datasets.value[1]?.champions ?? []])
    : { both: [], only: [[], []] }
)

const overlap = computed(() => pools.value.both.slice(0, 8))

/** Same emphasis rule as the role table, on the pick they share. */
function poolInk(stats: Array<ChampionStats | null>, index: number) {
  const [a, b] = stats
  if (!a || !b || a.winrate === b.winrate) return 'font-medium text-ink-2'
  return (a.winrate > b.winrate ? 0 : 1) === index
    ? 'font-semibold text-ink'
    : 'font-medium text-ink-4'
}
</script>

<template>
  <section>
    <div class="section">
      <h2>Compare</h2>
      <span class="meta">up to 100 games each, on the same filters</span>
    </div>

    <div class="mb-5 flex flex-wrap items-center gap-2">
      <PlayerSearchField
        :busy="busy"
        placeholder="Search a Riot ID to compare against"
        @select="pick"
      />
      <button v-if="other" class="btn" @click="clear">
        <X :size="13" />
        Clear
      </button>
    </div>

    <p v-if="error" class="notice mb-5" role="alert">{{ error }}</p>

    <MatchFilters v-model="filters" :champions="champions" class="mb-6" />

    <div v-if="!other" class="card px-6 py-16 text-center">
      <span
        class="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-[8px] bg-raised text-ink-3"
      >
        <ArrowLeftRight :size="20" />
      </span>
      <p class="display text-[20px] text-ink">Pick someone to compare against</p>
    </div>

    <template v-else-if="ready">
      <!-- Who is being compared, and who is ahead overall -->
      <div
        class="mb-2 grid grid-cols-2 items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
      >
        <div
          v-for="(p, i) in players"
          :key="p.puuid"
          class="card min-w-0 p-3.5 sm:p-4"
          :class="i === 1 ? 'order-2 text-right sm:order-3' : 'order-1'"
        >
          <div class="flex items-center gap-3" :class="i === 1 ? 'flex-row-reverse' : ''">
            <img
              :src="profileIcon(p.profileIconId)"
              alt=""
              width="48"
              height="48"
              class="thumb h-10 w-10 rounded-[8px] sm:h-12 sm:w-12"
            />
            <div class="min-w-0" :class="i === 1 ? 'text-right' : ''">
              <PlayerLink
                :game-name="p.gameName"
                :tag-line="p.tagLine"
                show-tag
                bold
                class="display max-w-full text-[16px] sm:text-[19px]"
              />
              <div class="num mt-1 truncate text-[11px] text-ink-3">
                {{ p.platform }} · level {{ p.summonerLevel }}
              </div>
            </div>
          </div>

          <!-- The headline figures, the better of the two in full ink -->
          <div
            class="mt-4 flex flex-wrap items-end gap-x-5 gap-y-3"
            :class="i === 1 ? 'justify-end' : ''"
          >
            <div>
              <div class="label">Win rate</div>
              <div
                class="stat mt-1.5 text-[24px] sm:text-[30px]"
                :class="leader('winrate') === 1 - i ? 'text-ink-3' : 'text-ink'"
              >
                {{ value(i, 'winrate', 100, 0) ?? '—' }}%
              </div>
            </div>
            <div>
              <div class="label">KDA</div>
              <div
                class="stat mt-1.5 text-[24px] sm:text-[30px]"
                :class="leader('kda') === 1 - i ? 'text-ink-3' : 'text-ink'"
              >
                {{ value(i, 'kda', 1, 2) ?? '—' }}
              </div>
            </div>
            <div>
              <div class="label">Games</div>
              <div class="stat mt-1.5 text-[24px] text-ink-2 sm:text-[30px]">
                {{ datasets[i]?.stats.total ?? 0 }}
              </div>
            </div>
          </div>

          <div class="mt-4 flex gap-[2px]" :class="i === 1 ? 'justify-end' : ''">
            <span
              v-for="(win, index) in form[i]"
              :key="index"
              class="h-[14px] w-[4px] rounded-[1px]"
              :style="{ background: win ? 'var(--color-win)' : 'var(--color-loss)' }"
            />
          </div>
        </div>

        <div
          class="order-3 col-span-2 flex flex-col items-center justify-center py-2 text-center sm:order-2 sm:col-span-1 sm:px-4"
        >
          <div class="stat text-[34px] sm:text-[40px]">
            <span :class="wins[0] >= wins[1] ? 'text-ink' : 'text-ink-3'">{{ wins[0] }}</span>
            <span class="px-1 text-ink-4">–</span>
            <span :class="wins[1] >= wins[0] ? 'text-ink' : 'text-ink-3'">{{ wins[1] }}</span>
          </div>
          <div class="label mt-1.5">metrics won</div>
        </div>
      </div>

      <!-- Every metric on one axis -->
      <div class="card mb-8">
        <table class="dt num w-full">
          <tbody>
            <tr v-for="metric in METRICS" :key="metric.key">
              <td class="w-[24%] !py-3 !pl-4 text-right">
                <div class="flex items-baseline justify-end gap-1.5">
                  <span
                    v-if="leader(metric.key) === 0"
                    class="text-[10.5px] font-semibold text-win"
                  >
                    {{ gap(metric.key, metric.factor, metric.decimals) }}
                  </span>
                  <span
                    class="stat text-[16px] sm:text-[18px]"
                    :class="leader(metric.key) === 0 ? 'text-ink' : 'text-ink-3'"
                  >
                    {{ value(0, metric.key, metric.factor, metric.decimals) ?? '—'
                    }}{{ metric.unit }}
                  </span>
                </div>
                <Sparkline
                  :values="series(0, metric.key)"
                  :label="`${metric.name}, last 20 games`"
                  :width="72"
                  :height="18"
                  class="ml-auto mt-1.5 hidden lg:block"
                  :class="leader(metric.key) === 0 ? 'text-ink-2' : 'text-ink-4'"
                />
              </td>

              <td class="!py-3">
                <div class="label mb-2 text-center">
                  {{ metric.name }}
                </div>
                <div class="flex h-[6px] items-stretch gap-[3px]">
                  <span class="flex flex-1 justify-end overflow-hidden rounded-l-[2px] bg-sunken">
                    <span
                      class="block h-full rounded-l-[2px]"
                      :style="{
                        width: `${weights(metric.key)[0]}%`,
                        background:
                          leader(metric.key) === 0 ? 'var(--color-ink)' : 'var(--color-ink-4)',
                      }"
                    />
                  </span>
                  <span class="flex-1 overflow-hidden rounded-r-[2px] bg-sunken">
                    <span
                      class="block h-full rounded-r-[2px]"
                      :style="{
                        width: `${weights(metric.key)[1]}%`,
                        background:
                          leader(metric.key) === 1 ? 'var(--color-ink)' : 'var(--color-ink-4)',
                      }"
                    />
                  </span>
                </div>
              </td>

              <td class="w-[24%] !py-3 !pr-4">
                <div class="flex items-baseline gap-1.5">
                  <span
                    class="stat text-[16px] sm:text-[18px]"
                    :class="leader(metric.key) === 1 ? 'text-ink' : 'text-ink-3'"
                  >
                    {{ value(1, metric.key, metric.factor, metric.decimals) ?? '—'
                    }}{{ metric.unit }}
                  </span>
                  <span
                    v-if="leader(metric.key) === 1"
                    class="text-[10.5px] font-semibold text-win"
                  >
                    {{ gap(metric.key, metric.factor, metric.decimals) }}
                  </span>
                </div>
                <Sparkline
                  :values="series(1, metric.key)"
                  :label="`${metric.name}, last 20 games`"
                  :width="72"
                  :height="18"
                  class="mt-1.5 hidden lg:block"
                  :class="leader(metric.key) === 1 ? 'text-ink-2' : 'text-ink-4'"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- The games they shared -->
      <template v-if="shared.length">
        <div class="section">
          <h3>Together</h3>
          <span v-if="pairing" class="meta">{{ pairing }}</span>
        </div>

        <div class="card mb-2 flex flex-wrap items-start gap-x-10 gap-y-4 px-4 py-3.5">
          <div v-if="record.played">
            <div class="label">Record</div>
            <div class="stat mt-1.5 text-[26px]">
              <span class="text-win">{{ record.won }}</span>
              <span class="text-ink-4">–</span>
              <span class="text-loss">{{ record.lost }}</span>
              <span class="num ml-1.5 text-[12px] font-semibold text-ink-3">
                {{ Math.round((record.won / record.played) * 100) }}%
              </span>
            </div>
          </div>
          <div v-if="versus.length">
            <div class="label">Against</div>
            <div class="stat mt-1.5 text-[26px] text-ink">{{ versus.length }}</div>
          </div>
          <div v-for="(row, i) in apart" :key="i">
            <template v-if="row">
              <div class="label">{{ players[i].gameName }} apart</div>
              <div class="stat mt-1.5 text-[26px] text-ink">
                {{ row.winrate }}%
                <span class="num ml-1.5 text-[12px] font-semibold text-ink-3"
                  >{{ row.games }} games</span
                >
              </div>
            </template>
          </div>
        </div>

        <div class="card mb-8">
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
                    <span class="label !text-ink-2">{{ record.played }} games together</span>
                  </td>
                  <td v-for="(line, i) in togetherLines" :key="i" class="text-right">
                    <span class="stat text-[14px]" :class="roleInk(togetherLines, 'kda', i)">
                      {{ line.kda.toFixed(2) }}
                    </span>
                    <span
                      class="ml-1.5 text-[10.5px]"
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
                      <span class="min-w-0 truncate text-[11.5px] text-ink-2">
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
                        :role="p.position"
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
                        class="thumb h-[26px] w-[26px] rounded-[7px]"
                      />
                    </span>
                  </td>
                  <td class="hidden !pr-4 text-right text-[11.5px] text-ink-3 sm:table-cell">
                    {{ duration(game.match.duration) }}
                  </td>
                </tr>
              </tbody>

              <tbody v-if="versus.length">
                <tr class="band">
                  <td class="!pl-4">
                    <span class="label !text-ink-2">{{ versus.length }} against each other</span>
                  </td>
                  <td :colspan="players.length" />
                  <td class="hidden !pr-4 sm:table-cell" />
                </tr>

                <tr v-for="game in versus" :key="game.match.matchId">
                  <td class="!pl-4">
                    <span class="min-w-0 truncate text-[11.5px] text-ink-2">
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
                        class="thumb h-[26px] w-[26px] rounded-[7px]"
                      />
                    </span>
                  </td>
                  <td class="hidden !pr-4 text-right text-[11.5px] text-ink-3 sm:table-cell">
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
        <div class="section">
          <h3>By role</h3>
        </div>
        <div class="card mb-8">
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
                    <RoleIcon :role="row.role" :size="14" class="text-ink-2" />
                    <span class="label !text-ink-2">{{ row.label }}</span>
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

      <!-- Champion pools, overlapping and not -->
      <template v-if="overlap.length || pools.only[0].length || pools.only[1].length">
        <div class="section">
          <h3>Champions</h3>
        </div>
        <div class="card">
          <table class="dt num w-full">
            <thead>
              <tr>
                <th class="!pl-4">Champion</th>
                <th v-for="p in players" :key="p.puuid" class="!pr-4 text-right">
                  <PlayerLink
                    :game-name="p.gameName"
                    :tag-line="p.tagLine"
                    class="!font-semibold"
                  />
                </th>
              </tr>
            </thead>

            <tbody v-if="overlap.length">
              <tr class="band">
                <td class="!pl-4" colspan="3">
                  <span class="label !text-ink-2">Both play</span>
                </td>
              </tr>
              <tr v-for="row in overlap" :key="row.championId">
                <td class="!pl-4">
                  <span class="flex items-center gap-2.5">
                    <img
                      :src="champIcon(row.championId)"
                      :alt="championName(row.championId)"
                      width="30"
                      height="30"
                      loading="lazy"
                      class="thumb h-[30px] w-[30px] rounded-[7px]"
                    />
                    <span class="truncate font-semibold text-ink">
                      {{ championName(row.championId) }}
                    </span>
                  </span>
                </td>
                <td v-for="(stat, i) in row.stats" :key="i" class="!pr-4 text-right align-middle">
                  <template v-if="stat">
                    <div class="stat text-[15px]" :class="poolInk(row.stats, i)">
                      {{ Math.round(stat.winrate * 100) }}%
                    </div>
                    <div class="mt-0.5 text-[10.5px] text-ink-3">
                      {{ stat.games }}g · {{ stat.kda.toFixed(2) }}
                    </div>
                  </template>
                  <span v-else class="text-ink-4">—</span>
                </td>
              </tr>
            </tbody>

            <tbody v-for="(list, side) in pools.only" :key="side">
              <template v-if="list.length">
                <tr class="band">
                  <td class="!pl-4" colspan="3">
                    <span class="label !text-ink-2">Only {{ players[side].gameName }}</span>
                  </td>
                </tr>
                <tr v-for="row in list" :key="row.championId">
                  <td class="!pl-4">
                    <span class="flex items-center gap-2.5">
                      <img
                        :src="champIcon(row.championId)"
                        :alt="championName(row.championId)"
                        width="30"
                        height="30"
                        loading="lazy"
                        class="thumb h-[30px] w-[30px] rounded-[7px]"
                      />
                      <span class="truncate font-semibold text-ink">
                        {{ championName(row.championId) }}
                      </span>
                    </span>
                  </td>
                  <td v-for="(stat, i) in row.stats" :key="i" class="!pr-4 text-right align-middle">
                    <template v-if="stat">
                      <div class="stat text-[15px] text-ink">
                        {{ Math.round(stat.winrate * 100) }}%
                      </div>
                      <div class="mt-0.5 text-[10.5px] text-ink-3">
                        {{ stat.games }}g · {{ stat.kda.toFixed(2) }}
                      </div>
                    </template>
                    <span v-else class="text-ink-4">—</span>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </template>
    </template>

    <div v-else class="grid gap-2">
      <div class="grid grid-cols-2 gap-2">
        <div class="skel h-[168px]" />
        <div class="skel h-[168px]" />
      </div>
      <div class="skel h-[420px]" />
    </div>
  </section>
</template>
