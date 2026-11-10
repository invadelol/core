<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { ArrowRight, Search } from 'lucide-vue-next'
import { ChampIcon, RoleIcon, useFormat, useNames } from '@invadelol/ui'
import {
  positionName,
  positionOf,
  summaryOf,
  type MatchSummary,
  type Position,
} from '@invadelol/ui/logic'
import MatchList from './MatchList.vue'
import VioletLine from './ui/VioletLine.vue'
import WinLoss from './ui/WinLoss.vue'
import { championName, championSplash } from '../lib/assets.js'
import { hours } from '../lib/format.js'
import { detailOf, matchMinutes } from '../lib/match.js'
import { patchName } from '../lib/patch.js'
import type { ChampionMastery, ChampionStats, Match, Rank, Summoner } from '../lib/types.js'

/**
 * The Champions tab (Violet line): the player's champions on the left; on the right the chosen
 * one's own page: its art with the key figures, the player against other players of it at their
 * rank, how they build it, their Invade score game by game, their lane opponents and their latest
 * games on it. The choice is kept in the address (`?champion=`).
 */
const props = defineProps<{
  champions: ChampionStats[]
  busy?: boolean
  profile: Summoner
  queue: string
  /** The solo queue rank: the comparison is against players of this tier. */
  rank: Rank | null
  mastery: ChampionMastery[]
}>()

const emit = defineEmits<{ queue: [value: string]; matches: [championId: number] }>()

const { score100, kdaRatio } = useFormat()
const { itemIcon, runeIcon, styleIcon, spellIcon, itemName, runeName, spellName } = useNames()

const QUEUES = [
  ['all', 'All'],
  ['ranked', 'Solo'],
  ['flex', 'Flex'],
] as const
const SORTS = [
  ['games', 'Games'],
  ['winrate', 'Win rate'],
  ['kda', 'KDA'],
] as const

const query = ref('')
const sort = ref<'games' | 'winrate' | 'kda'>('games')
const LIST = 10
const open = ref(false)

const sorted = computed(() =>
  [...props.champions]
    .filter((c) => championName(c.championId).toLowerCase().includes(query.value.toLowerCase()))
    .sort((a, b) => Number(b[sort.value]) - Number(a[sort.value]) || b.games - a.games)
)
const rows = computed(() =>
  open.value || query.value ? sorted.value : sorted.value.slice(0, LIST)
)
const totals = computed(() => ({
  games: props.champions.reduce((n, c) => n + c.games, 0),
  time: props.champions.reduce((n, c) => n + c.duration, 0),
}))
const mostPlayed = computed(
  () => [...props.champions].sort((a, b) => b.games - a.games)[0]?.championId ?? 0
)

/* ── The chosen champion, kept in the address ─────────────────────── */
const picked = ref(0)
const selected = computed(
  () =>
    props.champions.find((c) => c.championId === picked.value) ??
    props.champions.find((c) => c.championId === mostPlayed.value) ??
    null
)
const id = computed(() => selected.value?.championId ?? 0)
const name = computed(() => championName(id.value))

function pick(championId: number) {
  picked.value = championId
  const url = new URL(location.href)
  url.searchParams.set('champion', String(championId))
  history.replaceState(history.state, '', url)
}

onMounted(() => {
  const fromUrl = Number(new URLSearchParams(location.search).get('champion'))
  if (fromUrl) picked.value = fromUrl
})

/* ── Its games, its build and the rank's averages ─────────────────── */
const games = shallowRef<Match[]>([])
const build = shallowRef<Build | null>(null)
const average = shallowRef<Averages | null>(null)
const loading = ref(false)
const failed = ref(false)
let controller: AbortController | undefined

interface Build {
  games: number
  boots: number | null
  core: number[]
  coreGames: number
  keystone: number | null
  secondaryStyle: number | null
  spells: [number, number] | null
  max: string[]
}
interface Averages {
  patch: string
  bracket: string
  win: number | null
  kills: number
  deaths: number
  assists: number
  kda: number
  csPerMin: number
  gold: number
  damage: number
  vision: number
  length: number
}

/** The tier bracket the stats API reads, from the player's solo rank. */
const bracket = computed(() => {
  const tier = props.rank?.tier?.toLowerCase() ?? ''
  if (['iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond'].includes(tier))
    return tier
  if (['master', 'grandmaster', 'challenger'].includes(tier)) return 'master_plus'
  return 'all'
})
const bracketLabel = computed(() =>
  bracket.value === 'all'
    ? 'All ranks'
    : bracket.value === 'master_plus'
      ? 'Master and above'
      : bracket.value[0].toUpperCase() + bracket.value.slice(1)
)

const ROLE_PATH: Record<Position, string> = {
  TOP: 'top',
  JUNGLE: 'jungle',
  MID: 'mid',
  ADC: 'adc',
  SUPPORT: 'support',
}

async function load() {
  controller?.abort()
  games.value = []
  build.value = null
  average.value = null
  failed.value = false
  if (!id.value) return
  controller = new AbortController()
  const { signal } = controller
  loading.value = true
  const base = `/api/summoners/puuid/${props.profile.puuid}`
  const params = new URLSearchParams({ champion: String(id.value), count: '40', view: 'summary' })
  if (props.queue !== 'all') params.set('type', props.queue)
  try {
    const [list, built] = await Promise.all([
      fetch(`${base}/matches?${params}`, { signal }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${base}/builds/${id.value}`, { signal })
        .then((r) => (r.ok ? r.text() : ''))
        .then((t) => (t ? JSON.parse(t) : null))
        .catch(() => null),
    ])
    if (signal.aborted) return
    if (!list) failed.value = true
    games.value = ((list ?? []) as Match[]).filter((m) => m.queueId !== 0)
    build.value = built
    loading.value = false
    /* The rank's averages on the champion in the lane they play it in, when it has one. */
    const lane = role.value
    if (lane) {
      const res = await fetch(
        `/api/statistics/${id.value}/${ROLE_PATH[lane]}?bracket=${bracket.value}`,
        { signal }
      ).catch(() => null)
      const data = res?.ok ? await res.json() : null
      if (signal.aborted || !data?.averages?.games) return
      average.value = {
        ...data.averages,
        win: data.stat?.win ?? null,
        patch: data.patch,
        bracket: data.bracket,
      }
    }
  } catch {
    if (!signal.aborted) failed.value = true
  } finally {
    if (!signal.aborted) loading.value = false
  }
}

watch([id, () => props.queue, () => props.profile.puuid], () => void load(), { immediate: true })
onBeforeUnmount(() => controller?.abort())

/* ── Figures read from its games ─────────────────────────────────── */
const summaries = computed(() =>
  games.value
    .map((match) => ({
      match,
      game: summaryOf(detailOf(match), props.profile.puuid, match.matchId),
    }))
    .filter((r): r is { match: Match; game: MatchSummary } => Boolean(r.game))
)
const played = computed(() => summaries.value.filter((r) => !r.game.remake))

/** The lane they play it in most. */
const role = computed<Position | null>(() => {
  const counts = new Map<Position, number>()
  for (const { match } of played.value) {
    const me = match.participants.find((p) => p.puuid === props.profile.puuid)
    const lane = positionOf(me?.position)
    if (lane) counts.set(lane, (counts.get(lane) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
})

const scores = computed(() =>
  played.value
    .filter((r) => r.game.score)
    .map((r) => ({ score: score100(r.game.score!.score), win: r.game.win }))
    .reverse()
)
const scoreAvg = computed(() =>
  scores.value.length
    ? Math.round(scores.value.reduce((n, s) => n + s.score, 0) / scores.value.length)
    : null
)
const scoreLine = computed(() => scores.value.slice(-20))

const lp = computed(() => {
  const known = played.value.filter((r) => typeof r.match.lpChange === 'number')
  return known.length ? known.reduce((n, r) => n + (r.match.lpChange as number), 0) : null
})

const visionMin = computed(() => {
  const list = played.value
    .map(({ match }) => {
      const me = match.participants.find((p) => p.puuid === props.profile.puuid)
      return me ? (me.visionScore || 0) / matchMinutes(match) : null
    })
    .filter((v): v is number => v !== null)
  return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null
})

/** Wins in their latest games on it, when that is worth a word. */
const streak = computed(() => {
  const last = played.value.slice(0, 6)
  const wins = last.filter((r) => r.game.win).length
  return last.length >= 4 && wins >= last.length - 1
    ? `${wins} wins in the last ${last.length}`
    : ''
})

const masteryOf = computed(() => props.mastery.find((m) => m.championId === id.value) ?? null)

/** Lane opponents: who they met in their lane on it, most met first. */
const opponents = computed(() => {
  const by = new Map<number, { games: number; wins: number; k: number; d: number; a: number }>()
  for (const { game } of played.value) {
    const opp = game.score?.opponent
    if (!opp) continue
    const e = by.get(opp) ?? { games: 0, wins: 0, k: 0, d: 0, a: 0 }
    e.games++
    if (game.win) e.wins++
    e.k += game.kills
    e.d += game.deaths
    e.a += game.assists
    by.set(opp, e)
  }
  return [...by.entries()]
    .sort((a, b) => b[1].games - a[1].games || b[1].wins - a[1].wins)
    .slice(0, 5)
    .map(([champion, e]) => ({ champion, ...e }))
})

/* ── Against the players of their rank ───────────────────────────── */
const comparison = computed(() => {
  const me = selected.value
  const avg = average.value
  if (!me || !avg || me.games < 1) return []
  const minutes = avg.length / 60 || 1
  const rows: Array<{
    label: string
    mine: number
    theirs: number
    digits: number
    percent?: boolean
    lower?: boolean
  }> = []
  if (avg.win !== null)
    rows.push({
      label: 'Win rate',
      mine: me.winrate * 100,
      theirs: avg.win * 100,
      digits: 0,
      percent: true,
    })
  rows.push({ label: 'KDA', mine: me.kda, theirs: avg.kda, digits: 2 })
  rows.push({ label: 'Kills', mine: me.avgKills, theirs: avg.kills, digits: 1 })
  rows.push({ label: 'Deaths', mine: me.avgDeaths, theirs: avg.deaths, digits: 1, lower: true })
  rows.push({ label: 'CS/min', mine: me.csMin, theirs: avg.csPerMin, digits: 1 })
  rows.push({ label: 'Damage/min', mine: me.damageMin, theirs: avg.damage / minutes, digits: 0 })
  rows.push({ label: 'Gold/min', mine: me.goldMin, theirs: avg.gold / minutes, digits: 0 })
  if (visionMin.value !== null)
    rows.push({
      label: 'Vision/min',
      mine: visionMin.value,
      theirs: avg.vision / minutes,
      digits: 2,
    })
  return rows.map((r) => {
    const top = Math.max(r.mine, r.theirs) * 1.25 || 1
    const d = r.mine - r.theirs
    const better = r.lower ? d < 0 : d > 0
    const notable = Math.abs(d) >= Math.abs(r.theirs) * 0.05
    const f = (v: number) =>
      r.percent
        ? `${Math.round(v)}%`
        : r.digits
          ? v.toFixed(r.digits)
          : Math.round(v).toLocaleString('en-US')
    return {
      label: r.label,
      value: f(r.mine),
      width: `${Math.min(100, (r.mine / top) * 100)}%`,
      at: `${Math.min(100, (r.theirs / top) * 100)}%`,
      avg: f(r.theirs),
      gap:
        Math.abs(d) < 0.5 / 10 ** r.digits
          ? '0'
          : `${d > 0 ? '+' : '−'}${r.percent ? Math.round(Math.abs(d)) : r.digits ? Math.abs(d).toFixed(r.digits) : Math.round(Math.abs(d))}`,
      tone: notable ? (better ? 'rd-up' : 'rd-dn') : 'rd-flat',
    }
  })
})

const csGap = computed(() => {
  const me = selected.value
  const avg = average.value
  if (!me || !avg) return null
  const d = me.csMin - avg.csPerMin
  return {
    d,
    text: `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} on ${bracketLabel.value} ${name.value}s`,
  }
})

const latest = computed(() => games.value.slice(0, 5))
</script>

<template>
  <p v-if="!busy && !champions.length" class="py-6 text-[13px] text-ink-2">
    No champion games in this window.
  </p>

  <div v-else class="pc" :aria-busy="busy">
    <!-- The champions -->
    <section class="rd-card pc-list">
      <div class="clf">
        <div class="rd-seg" role="group" aria-label="Queue">
          <button
            v-for="[value, label] in QUEUES"
            :key="value"
            type="button"
            :class="{ on: queue === value }"
            :aria-pressed="queue === value"
            @click="emit('queue', value)"
          >
            {{ label }}
          </button>
        </div>
        <label class="pc-sort">
          <span class="sr-only">Sort by</span>
          <select v-model="sort">
            <option v-for="[value, label] in SORTS" :key="value" :value="value">{{ label }}</option>
          </select>
        </label>
      </div>
      <label class="pc-search">
        <Search :size="13" aria-hidden="true" />
        <input
          v-model="query"
          type="search"
          placeholder="Find a champion"
          aria-label="Find a champion"
        />
      </label>
      <p class="pc-total num">
        {{ champions.length }} champions, {{ totals.games }} games, {{ hours(totals.time) }} played
      </p>

      <ul class="rd-plist" :class="{ 'opacity-60': busy }">
        <li v-for="c in rows" :key="c.championId">
          <button
            type="button"
            class="cl"
            :class="{ on: c.championId === id }"
            :aria-pressed="c.championId === id"
            @click="pick(c.championId)"
          >
            <ChampIcon :id="c.championId" :size="40" />
            <span class="min-w-0">
              <b class="truncate">{{ championName(c.championId) }}</b>
              <small class="num"
                >{{ c.games }} {{ c.games === 1 ? 'game' : 'games' }},
                {{ c.kda.toFixed(2) }} KDA</small
              >
            </span>
            <WinLoss :wins="c.wins" :losses="c.games - c.wins" />
          </button>
        </li>
      </ul>
      <p v-if="!rows.length" class="px-4 py-4 text-[13px] text-ink-3">No champion by that name.</p>
      <div v-if="!query && sorted.length > LIST" class="rd-foot">
        <button type="button" class="iv-btn w-full" :aria-expanded="open" @click="open = !open">
          {{ open ? 'Show fewer' : `Show all ${sorted.length}` }}
        </button>
      </div>
    </section>

    <!-- The chosen champion -->
    <div v-if="selected" class="min-w-0">
      <section class="hero">
        <img class="bg" :src="championSplash(selected.championId)" alt="" />
        <div class="hero-t">
          <h2>{{ name }}</h2>
          <p>
            <template v-if="role"
              ><RoleIcon :lane="role" :size="15" />{{ positionName(role) }}</template
            >
            <span v-if="selected.championId === mostPlayed" class="rd-tag v">Most played</span>
            <span v-if="masteryOf" class="rd-tag">Mastery level {{ masteryOf.championLevel }}</span>
            <span v-if="streak" class="rd-tag b">{{ streak }}</span>
          </p>
        </div>
        <div class="hk">
          <div class="st">
            <label>Win rate</label>
            <div class="rd-fig">{{ Math.round(selected.winrate * 100) }}%</div>
            <small class="num">{{ selected.wins }}W {{ selected.games - selected.wins }}L</small>
          </div>
          <div class="st">
            <label>KDA</label>
            <div class="rd-fig">{{ selected.kda.toFixed(2) }}</div>
            <small class="num"
              >{{ selected.avgKills.toFixed(1) }} / {{ selected.avgDeaths.toFixed(1) }} /
              {{ selected.avgAssists.toFixed(1) }}</small
            >
          </div>
          <div class="st">
            <label>CS per minute</label>
            <div class="rd-fig">{{ selected.csMin.toFixed(1) }}</div>
            <small
              v-if="csGap"
              class="num"
              :class="Math.abs(csGap.d) < 0.3 ? '' : csGap.d > 0 ? 'rd-up' : 'rd-dn'"
              >{{ csGap.text }}</small
            >
            <small v-else class="num">{{ Math.round(selected.goldMin) }} gold/min</small>
          </div>
          <div class="st">
            <label>Invade score</label>
            <div class="rd-fig rd-vio">{{ scoreAvg ?? '-' }}</div>
            <small v-if="scores.length" class="num"
              >best game {{ Math.max(...scores.map((s) => s.score)) }}</small
            >
          </div>
          <div v-if="lp !== null" class="st">
            <label>LP on {{ name }}</label>
            <div class="rd-fig" :class="lp > 0 ? 'rd-up' : lp < 0 ? 'rd-dn' : ''">
              {{ lp > 0 ? '+' : lp < 0 ? '−' : '' }}{{ Math.abs(lp) }}
            </div>
            <small>in these games</small>
          </div>
          <div v-else class="st">
            <label>Damage/min</label>
            <div class="rd-fig">{{ Math.round(selected.damageMin).toLocaleString('en-US') }}</div>
            <small class="num">most kills {{ selected.maxKills }}</small>
          </div>
        </div>
      </section>

      <p v-if="failed" class="notice mt-4" role="alert">
        <span>Some of {{ name }}'s games could not be loaded.</span>
        <button type="button" class="iv-btn sm ml-auto" @click="load()">Retry</button>
      </p>

      <div class="two">
        <section class="rd-card">
          <div class="rd-head">
            <h3>
              Against other {{ name }} players<span v-if="average" class="rd-meta"
                >{{ bracketLabel }}, patch {{ patchName(average.patch) }}</span
              >
            </h3>
          </div>
          <template v-if="comparison.length">
            <div class="cmph">
              <span>{{ profile.gameName }}</span
              ><span>{{ bracketLabel }} average</span>
            </div>
            <div
              v-for="c in comparison"
              :key="c.label"
              class="cmpr"
              :title="`${c.label}: ${c.value}, ${bracketLabel} average ${c.avg}`"
            >
              <span>{{ c.label }}</span>
              <b class="num">{{ c.value }}</b>
              <span class="trk"
                ><i :style="{ width: c.width }" /><u :style="{ left: c.at }"
              /></span>
              <em class="num" :class="c.tone">{{ c.gap }}</em>
            </div>
          </template>
          <p v-else-if="loading" class="pc-note">Reading the averages…</p>
          <p v-else class="pc-note">
            Not enough {{ bracketLabel === 'All ranks' ? '' : bracketLabel + ' ' }}games on {{ name
            }}{{ role ? ` ${positionName(role).toLowerCase()}` : '' }} stored to compare.
          </p>
        </section>

        <section class="rd-card">
          <div class="rd-head">
            <h3>How {{ profile.gameName }} builds {{ name }}</h3>
            <span v-if="build?.coreGames" class="num rd-hm"
              >{{ build.coreGames }} of {{ build.games }} games</span
            >
          </div>
          <div v-if="build && (build.core.length || build.keystone)" class="bld">
            <div v-if="build.core.length" class="bl">
              <span class="l">Core</span>
              <img
                v-for="item in build.core"
                :key="item"
                :src="itemIcon(item)"
                :alt="itemName(item)"
                :title="itemName(item)"
              />
            </div>
            <div v-if="build.boots" class="bl">
              <span class="l">Boots</span>
              <img
                :src="itemIcon(build.boots)"
                :alt="itemName(build.boots)"
                :title="itemName(build.boots)"
              />
            </div>
            <div v-if="build.keystone" class="bl">
              <span class="l">Runes</span>
              <img
                class="rd"
                :src="runeIcon(build.keystone)"
                :alt="runeName(build.keystone)"
                :title="runeName(build.keystone)"
              />
              <img
                v-if="build.secondaryStyle"
                class="rd sub"
                :src="styleIcon(build.secondaryStyle)"
                alt=""
              />
              <template v-if="build.spells">
                <span class="w-1" />
                <img
                  v-for="s in build.spells"
                  :key="s"
                  :src="spellIcon(s)"
                  :alt="spellName(s)"
                  :title="spellName(s)"
                />
              </template>
            </div>
            <div v-if="build.max.length" class="bl">
              <span class="l">Skills</span>
              <template v-for="(k, i) in build.max" :key="k">
                <ArrowRight v-if="i" :size="14" aria-hidden="true" />
                <span class="key">{{ k }}</span>
              </template>
            </div>
          </div>
          <p v-else-if="loading" class="pc-note">Reading their builds…</p>
          <p v-else class="pc-note">No Summoner's Rift games on {{ name }} stored yet.</p>
        </section>
      </div>

      <div class="two">
        <section class="rd-card">
          <div class="rd-head">
            <h3>
              Invade score, game by game<span class="rd-meta num"
                >Last {{ scoreLine.length }} on {{ name }}</span
              >
            </h3>
            <span class="pc-legend"
              ><span class="rd-tag b">Win</span><span class="rd-tag r">Loss</span></span
            >
          </div>
          <div v-if="scoreLine.length > 1" class="sc">
            <VioletLine
              :values="scoreLine.map((s) => s.score)"
              :min="0"
              :max="100"
              :height="130"
              :pad="10"
              :guides="scoreAvg !== null ? [{ value: scoreAvg, below: `Average ${scoreAvg}` }] : []"
              :dots="scoreLine.map((s) => (s.win ? 'w' : 'l'))"
            />
            <div class="scx num">
              <span>{{ scoreLine.length }} games ago</span><span>Latest</span>
            </div>
          </div>
          <p v-else class="pc-note">
            {{ loading ? 'Reading their games…' : 'Not enough scored games on it yet.' }}
          </p>
        </section>

        <section class="rd-card">
          <div class="rd-head">
            <h3>Lane opponents</h3>
            <span class="rd-hm">On {{ name }}, these games</span>
          </div>
          <ul v-if="opponents.length" class="rd-plist">
            <li v-for="o in opponents" :key="o.champion" class="mu">
              <ChampIcon :id="o.champion" :size="34" />
              <span class="min-w-0">
                <b class="truncate">{{ championName(o.champion) }}</b>
                <small class="num">{{ kdaRatio(o.k, o.d, o.a) }} KDA against them</small>
              </span>
              <WinLoss :wins="o.wins" :losses="o.games - o.wins" />
            </li>
          </ul>
          <p v-else class="pc-note">
            {{ loading ? 'Reading their games…' : 'No lane opponents read yet.' }}
          </p>
        </section>
      </div>

      <div class="fil">
        <h2>Latest games on {{ name }}</h2>
        <button type="button" class="rd-more" @click="emit('matches', id)">
          All {{ selected.games }}<ArrowRight :size="14" aria-hidden="true" />
        </button>
      </div>
      <MatchList
        v-if="latest.length"
        :matches="latest"
        :puuid="profile.puuid"
        :game-name="profile.gameName"
        :tag-line="profile.tagLine"
        versus
        @clear="emit('queue', 'all')"
      />
      <p v-else class="pc-note">{{ loading ? 'Reading their games…' : 'No games to show.' }}</p>
    </div>
  </div>
</template>

<style scoped>
.pc {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.pc-list {
  position: sticky;
  top: 76px;
}
.clf {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px 8px;
}
.clf .rd-seg > button {
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
}
.pc-sort {
  margin-left: auto;
}
.pc-sort select {
  height: 32px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  font: 500 12px var(--font);
  color: var(--text-1);
  background: var(--btn);
  box-shadow: var(--btn-shadow);
}
.pc-search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  margin: 0 14px;
  padding: 0 10px;
  border-radius: 6px;
  color: var(--text-3);
  background: var(--inset);
  box-shadow: var(--inset-shadow);
}
.pc-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  font: 400 13px var(--font);
  color: var(--text-1);
  background: none;
}
.pc-search:focus-within {
  box-shadow: 0 0 0 2px var(--rd-violet);
}
.pc-total {
  margin: 0;
  padding: 10px 14px 10px;
  font-size: 12px;
  color: var(--text-3);
  box-shadow: inset 0 -1px 0 var(--rd-line);
}
.cl {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 96px;
  gap: 12px;
  align-items: center;
  width: 100%;
  height: 62px;
  padding: 0 14px;
  border: 0;
  font: inherit;
  text-align: left;
  color: inherit;
  background: none;
  cursor: pointer;
}
.cl:hover {
  background: var(--surface-1);
}
.cl.on {
  background: var(--rd-violet-a);
  box-shadow: inset 2px 0 0 var(--rd-violet);
}
.cl:focus-visible {
  outline: 2px solid var(--rd-violet);
  outline-offset: -2px;
}
.cl :deep(.iv-champ) {
  border-radius: 9px;
}
.cl > span > b {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}
.cl > span > small {
  display: block;
  font-size: 12px;
  color: var(--text-3);
}

.hero {
  position: relative;
  overflow: hidden;
  border-radius: 10px;
  background: var(--rd-card);
  box-shadow: inset 0 0 0 1px var(--rd-line);
}
.hero img.bg {
  position: absolute;
  right: 0;
  top: 0;
  width: 62%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 20%;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 55%);
  mask-image: linear-gradient(90deg, transparent, #000 55%);
}
.hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, var(--rd-card) 36%, transparent 78%),
    linear-gradient(180deg, transparent 55%, var(--rd-shade));
  pointer-events: none;
}
.hero > *:not(.bg) {
  position: relative;
  z-index: 1;
}
.hero-t {
  padding: 22px 24px 18px;
}
.hero-t h2 {
  margin: 0;
  font-size: 34px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1;
  color: var(--text-1);
}
.hero-t p {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--text-2);
}
.hk {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  background: var(--rd-shade);
  box-shadow: inset 0 1px 0 var(--rd-line);
}
.hk .st {
  min-width: 0;
  padding: 14px 20px;
}
.hk .st + .st {
  box-shadow: inset 1px 0 0 var(--rd-line);
}
.hk label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}
.hk .rd-fig {
  font-size: 26px;
  line-height: 1.15;
  white-space: nowrap;
}
.hk small {
  display: block;
  overflow: hidden;
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text-3);
}
.hk small.rd-up {
  color: var(--win);
}
.hk small.rd-dn {
  color: var(--loss);
}
.two {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 16px;
  margin-top: 16px;
}
.cmph {
  display: flex;
  justify-content: space-between;
  padding: 10px 18px 2px;
  font-size: 11px;
  color: var(--text-3);
}
.cmph span:last-child {
  display: flex;
  align-items: center;
  gap: 6px;
}
.cmph span:last-child::before {
  content: '';
  width: 2px;
  height: 10px;
  border-radius: 2px;
  background: var(--text-1);
}
.cmpr {
  display: grid;
  grid-template-columns: 96px 56px minmax(0, 1fr) 56px;
  gap: 12px;
  align-items: center;
  height: 44px;
  padding: 0 18px;
  font-size: 13px;
}
.cmpr + .cmpr {
  box-shadow: inset 0 1px 0 var(--rd-line);
}
.cmpr > span:first-child {
  color: var(--text-2);
}
.cmpr b {
  font-size: 14px;
  font-weight: 650;
  text-align: right;
  color: var(--text-1);
}
.cmpr em {
  font-size: 12px;
  font-style: normal;
  font-weight: 600;
  text-align: right;
}
.trk {
  position: relative;
  height: 6px;
  border-radius: 9px;
  background: var(--rd-track);
}
.trk i {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  border-radius: 9px;
  background: var(--rd-violet-hi);
}
.trk u {
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 2px;
  margin-left: -1px;
  border-radius: 2px;
  background: var(--text-1);
}
.bld {
  display: grid;
  gap: 14px;
  padding: 16px 18px;
}
.bl {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-3);
}
.bl .l {
  width: 56px;
}
.bl img {
  width: 34px;
  height: 34px;
  border-radius: 7px;
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.08);
}
.bl img.rd {
  border-radius: 999px;
  background: #07080b;
}
.bl img.sub {
  padding: 7px;
}
.key {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  background: var(--rd-violet);
}
.sc {
  padding: 18px 18px 16px;
}
.scx {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-3);
}
.pc-legend {
  display: flex;
  gap: 6px;
}
.mu {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 104px;
  gap: 12px;
  align-items: center;
  height: 50px;
  padding: 0 18px;
}
.mu :deep(.iv-champ) {
  border-radius: 8px;
}
.mu > span > b {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}
.mu > span > small {
  font-size: 12px;
  color: var(--text-3);
}
.pc-note {
  margin: 0;
  padding: 18px;
  font-size: 13px;
  color: var(--text-3);
}
.fil {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 24px 0 4px;
}
.fil h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  color: var(--text-1);
}
.fil .rd-more {
  border: 0;
  background: none;
  cursor: pointer;
}

@media (max-width: 1100px) {
  .pc,
  .two {
    grid-template-columns: minmax(0, 1fr);
  }
  .pc-list {
    position: static;
  }
  .hk {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .hk .st:nth-child(odd) {
    box-shadow: none;
  }
  .hk .st:nth-child(n + 3) {
    border-top: 1px solid var(--rd-line);
  }
}
@media (max-width: 520px) {
  .hero-t h2 {
    font-size: 28px;
  }
  .hero img.bg {
    width: 100%;
    opacity: 0.5;
  }
  .cmpr {
    grid-template-columns: 78px 48px minmax(0, 1fr) 44px;
    gap: 8px;
    padding: 0 14px;
  }
}
</style>
