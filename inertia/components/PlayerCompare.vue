<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { ArrowLeftRight, Search } from 'lucide-vue-next'
import MatchFilters, { type Filters } from './MatchFilters.vue'
import StatSparkline from './StatSparkline.vue'
import { championSplash, profileIcon } from '../lib/assets.js'
import type { Summoner, ChampionStats, GlobalStats, Match } from '../lib/types.js'
const props = defineProps<{
  profile: Summoner
  champions: ChampionStats[]
  mainChampion?: number
}>()
const target = ref(''),
  other = ref<Summoner | null>(null),
  busy = ref(false),
  error = ref('')
const filters = ref<Filters>({ type: 'all', champion: 0, role: 'all' })
const datasets = ref<Array<{ stats: GlobalStats; matches: Match[]; champion?: number }>>([])
let lookup: AbortController | undefined, analytics: AbortController | undefined
const players = computed(() => (other.value ? [props.profile, other.value] : [props.profile]))
const metrics = [
  { key: 'winrate', name: 'Win rate', unit: '%', factor: 100 },
  { key: 'kda', name: 'KDA ratio', unit: '', factor: 1 },
  { key: 'csMin', name: 'CS per minute', unit: '', factor: 1 },
  { key: 'damagePerMinute', name: 'Damage per minute', unit: '', factor: 1 },
  { key: 'goldPerMinute', name: 'Gold per minute', unit: '', factor: 1 },
  { key: 'visionMin', name: 'Vision per minute', unit: '', factor: 1 },
] as const
async function compare() {
  const hash = target.value.lastIndexOf('#')
  if (hash < 1 || !target.value.slice(hash + 1).trim()) {
    error.value = 'Enter a Riot ID, for example CrauZmoZ#EUW.'
    return
  }
  lookup?.abort()
  lookup = new AbortController()
  const signal = lookup.signal
  busy.value = true
  error.value = ''
  try {
    const slug = `${target.value.slice(0, hash).trim()}-${target.value.slice(hash + 1).trim()}`
    const res = await fetch(`/api/summoners/${encodeURIComponent(slug)}`, { signal })
    if (!res.ok)
      throw new Error(
        res.status === 404
          ? 'Player not found. Check their Riot ID.'
          : 'Riot could not load this player. Please try again.'
      )
    const data = await res.json()
    if (signal.aborted) return
    if (data.summoner.puuid === props.profile.puuid)
      throw new Error('Choose a different player to compare.')
    other.value = data.summoner
    const url = new URL(location.href)
    url.searchParams.set('with', target.value.trim())
    history.replaceState(history.state, '', url)
  } catch (e) {
    if (!signal.aborted) error.value = (e as Error).message
  } finally {
    if (!signal.aborted) busy.value = false
  }
}
async function load() {
  analytics?.abort()
  analytics = new AbortController()
  const signal = analytics.signal
  error.value = ''
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
        const [s, m] = await Promise.all([
          fetch(`${base}/stats?${query}`, { signal }),
          fetch(`${base}/matches?${query}&view=summary`, { signal }),
        ])
        if (!s.ok || !m.ok) throw new Error('Comparison statistics could not be loaded. Try again.')
        const stats = await s.json()
        const matches = await m.json()
        return { stats: stats.global, matches, champion: stats.champions?.[0]?.championId }
      })
    )
    if (!signal.aborted) datasets.value = data
  } catch (e) {
    if (!signal.aborted) error.value = (e as Error).message
  }
}
watch([players, filters], () => void load(), { immediate: true, deep: true })
if (typeof window !== 'undefined') {
  const initial = new URLSearchParams(location.search).get('with')
  if (initial) {
    target.value = initial
    void compare()
  }
}
onBeforeUnmount(() => {
  lookup?.abort()
  analytics?.abort()
})
function value(index: number, key: (typeof metrics)[number]['key'], factor: number) {
  const g = datasets.value[index]?.stats
  if (!g?.total) return '—'
  return (g[key] * factor).toFixed(key === 'kda' || key === 'csMin' || key === 'visionMin' ? 1 : 0)
}
function values(index: number, key: string) {
  return (datasets.value[index]?.matches ?? [])
    .slice(0, 20)
    .reverse()
    .flatMap((m) => {
      const p = m.participants.find((p) => p.puuid === players.value[index]?.puuid)
      if (!p) return []
      const minutes = Math.max(1, m.duration / 60)
      return [
        key === 'winrate'
          ? Number(p.win) * 100
          : key === 'kda'
            ? (p.kills + p.assists) / Math.max(1, p.deaths)
            : key === 'csMin'
              ? p.cs / minutes
              : key === 'damagePerMinute'
                ? p.totalDamageDealtToChampions / minutes
                : key === 'goldPerMinute'
                  ? p.goldEarned / minutes
                  : p.visionScore / minutes,
      ]
    })
}
</script>
<template>
  <section class="space-y-5">
    <div class="section-intro">
      <div>
        <span class="eyebrow">SIDE BY SIDE</span>
        <h2>Better together. Better informed.</h2>
        <p>Compare recent performance across the same queues, champions, and roles.</p>
      </div>
      <ArrowLeftRight :size="25" class="text-ink-3" />
    </div>
    <form class="compare-search card" @submit.prevent="compare">
      <Search :size="18" /><label class="sr-only" for="compare-player">Player Riot ID</label
      ><input
        id="compare-player"
        v-model="target"
        placeholder="Who’s your match? Enter Name#Tag"
        required
      /><span class="subtle">All regions</span
      ><button class="btn btn-primary" :disabled="busy">
        {{ busy ? 'Finding player…' : 'Compare player' }}
      </button>
    </form>
    <p v-if="error" class="notice-error" role="alert">{{ error }}</p>
    <MatchFilters v-model="filters" :champions="champions" />
    <div class="compare-grid">
      <article v-for="(p, i) in players" :key="p.puuid" class="card compare-player">
        <div
          class="compare-player-hero"
          :style="
            datasets[i]?.champion || (i === 0 && mainChampion)
              ? {
                  backgroundImage: `linear-gradient(0deg,rgba(12,18,30,.93),rgba(12,18,30,.25)),url(${championSplash(datasets[i]?.champion || mainChampion!)})`,
                }
              : {}
          "
        >
          <img :src="profileIcon(p.profileIconId)" alt="" />
          <h3>
            {{ p.gameName }}<span>#{{ p.tagLine }}</span>
          </h3>
          <p>
            {{ p.platform }} · Level {{ p.summonerLevel }} ·
            {{ datasets[i]?.stats.total ?? 0 }} games analysed
          </p>
        </div>
        <div v-for="metric in metrics" :key="metric.key" class="compare-stat">
          <div>
            <span>{{ metric.name }}</span
            ><strong
              >{{ value(i, metric.key, metric.factor)
              }}{{ datasets[i]?.stats.total ? metric.unit : '' }}</strong
            >
          </div>
          <StatSparkline
            :values="values(i, metric.key)"
            :label="`${metric.name}, last 20 games, oldest first`"
          />
        </div>
        <p class="compare-note">
          Trend shows up to 20 recent games · No games? Open this player’s profile and Update.
        </p>
      </article>
      <div v-if="!other" class="card compare-placeholder">
        <ArrowLeftRight :size="32" />
        <h3>A little friendly competition?</h3>
        <p>Search for a teammate or rival above to see how your games compare.</p>
      </div>
    </div>
  </section>
</template>
