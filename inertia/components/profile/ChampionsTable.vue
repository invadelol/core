<script setup lang="ts">
import { computed, ref } from 'vue'
import { RoleIcon } from '@invadelol/ui'
import type { Position } from '@invadelol/ui/logic'
import EmptyState from '../ui/EmptyState.vue'
import Icon from '../ui/Icon.vue'
import Skeleton from '../ui/Skeleton.vue'
import SortHead from '../ui/SortHead.vue'
import { useSort } from '../ui/sort.js'
import { champIcon, championName } from '../../lib/assets.js'
import { compact, hours } from '../../lib/format.js'
import type { ChampionMastery, ChampionStats } from '../../lib/types.js'

/**
 * The Champions tab: the queue and role filters with a champion search, the pool as a lit sheet
 * (each champion's win rate as one violet line), then every champion of the season in one table,
 * sortable by any column. A row opens that champion's games.
 */
const props = defineProps<{
  champions: ChampionStats[]
  mastery: ChampionMastery[]
  busy: boolean
  error: string
  queue: string
  role: string
}>()
defineEmits<{ queue: [string]; role: [string]; matches: [number]; retry: [] }>()

const QUEUES = [
  { value: 'all', label: 'All' },
  { value: 'ranked', label: 'Solo/Duo' },
  { value: 'flex', label: 'Flex' },
  { value: 'normal', label: 'Normals' },
  { value: 'aram', label: 'ARAM' },
]
const ROLES: { value: string; label: string; lane: Position }[] = [
  { value: 'TOP', label: 'Top', lane: 'TOP' },
  { value: 'JUNGLE', label: 'Jungle', lane: 'JUNGLE' },
  { value: 'MIDDLE', label: 'Mid', lane: 'MID' },
  { value: 'BOTTOM', label: 'Bot', lane: 'ADC' },
  { value: 'SUPPORT', label: 'Support', lane: 'SUPPORT' },
]

const query = ref('')
const points = computed(() => new Map(props.mastery.map((m) => [m.championId, m])))
const totals = computed(() => {
  const games = props.champions.reduce((s, c) => s + c.games, 0)
  const wins = props.champions.reduce((s, c) => s + c.wins, 0)
  return { games, rate: games ? Math.round((wins / games) * 100) : 0 }
})
const pct = (c: ChampionStats) => (c.games ? Math.round((c.wins / c.games) * 100) : 0)

/** The pool: the twelve most played, in two columns. */
const pool = computed(() => {
  const list = props.champions.slice(0, 12)
  const half = Math.ceil(list.length / 2)
  return list.length > 4 ? [list.slice(0, half), list.slice(half)] : [list]
})

const found = computed(() => {
  const text = query.value.trim().toLowerCase()
  return text
    ? props.champions.filter((c) => championName(c.championId).toLowerCase().includes(text))
    : props.champions
})
const sort = useSort(
  found,
  {
    name: (c) => championName(c.championId),
    games: (c) => c.games,
    win: (c) => c.winrate,
    kda: (c) => c.kda,
    cs: (c) => c.csMin,
    gold: (c) => c.goldMin,
    damage: (c) => c.damageMin,
    kills: (c) => c.maxKills,
    time: (c) => c.duration,
    mastery: (c) => points.value.get(c.championId)?.championPoints ?? null,
  },
  { key: 'games', first: { name: 'asc' } }
)
</script>

<template>
  <div class="ct">
    <div class="ptb">
      <h2 class="h3">Champions</h2>
      <span v-if="champions.length" class="meta num"
        >{{ champions.length }} {{ champions.length === 1 ? 'champion' : 'champions' }} ·
        {{ totals.games }} games · {{ totals.rate }}% won</span
      >
    </div>
    <div class="ptb ct-f" :class="{ 'mh-busy': busy }">
      <div class="seg" role="group" aria-label="Queue">
        <button
          v-for="q in QUEUES"
          :key="q.value"
          type="button"
          :class="{ on: queue === q.value }"
          :aria-pressed="queue === q.value"
          @click="$emit('queue', q.value)"
        >
          {{ q.label }}
        </button>
      </div>
      <div class="seg mh-roles" role="group" aria-label="Role">
        <button
          type="button"
          :class="{ on: role === 'all' }"
          :aria-pressed="role === 'all'"
          @click="$emit('role', 'all')"
        >
          All
        </button>
        <button
          v-for="r in ROLES"
          :key="r.value"
          type="button"
          :title="r.label"
          :aria-label="r.label"
          :class="{ on: role === r.value }"
          :aria-pressed="role === r.value"
          @click="$emit('role', r.value)"
        >
          <RoleIcon :lane="r.lane" :size="15" />
        </button>
      </div>
      <label class="field ct-find">
        <Icon name="search" />
        <input v-model="query" placeholder="Find a champion" aria-label="Find a champion" />
      </label>
    </div>

    <p v-if="error" class="pf-note" role="alert">
      {{ error }}
      <button type="button" class="btn sm" @click="$emit('retry')">Retry</button>
    </p>

    <div v-if="busy && !champions.length" class="card" style="padding: 16px">
      <Skeleton :rows="8" pic />
    </div>
    <article v-else-if="!champions.length" class="card">
      <EmptyState icon="grid" title="No game in this queue" />
    </article>

    <template v-else>
      <section class="card lit">
        <div class="card-h">
          <h2 class="h3">Champion pool</h2>
          <span class="meta">This season</span>
        </div>
        <div class="cp" :class="{ one: pool.length === 1 }">
          <div v-for="(col, i) in pool" :key="i">
            <button
              v-for="c in col"
              :key="c.championId"
              type="button"
              class="cp-r"
              @click="$emit('matches', c.championId)"
            >
              <img class="pic" :src="champIcon(c.championId)" alt="" width="30" height="30" />
              <span class="ell">{{ championName(c.championId) }}</span>
              <span class="wrl"><i :style="{ width: `${pct(c)}%` }" /></span>
              <span class="r meta num">{{ c.wins }}W {{ c.games - c.wins }}L</span>
              <span class="r num">{{ pct(c) }}%</span>
            </button>
          </div>
        </div>
      </section>

      <section class="card tbl ct-t">
        <div class="tbl-h">
          <SortHead :sorter="sort" col="name" label="Champion" />
          <SortHead :sorter="sort" col="games" label="Games" class="n" />
          <SortHead :sorter="sort" col="win" label="Win rate" class="n" />
          <SortHead :sorter="sort" col="kda" label="KDA" class="n" />
          <SortHead :sorter="sort" col="cs" label="CS/min" class="n hm" />
          <SortHead :sorter="sort" col="gold" label="Gold/min" class="n hm" />
          <SortHead :sorter="sort" col="damage" label="Dmg/min" class="n hm" />
          <SortHead :sorter="sort" col="kills" label="Most kills" class="n hm" />
          <SortHead :sorter="sort" col="time" label="Time played" class="n hm" />
          <SortHead :sorter="sort" col="mastery" label="Mastery" class="n hm" />
        </div>
        <button
          v-for="c in sort.rows"
          :key="c.championId"
          type="button"
          class="tbl-r"
          @click="$emit('matches', c.championId)"
        >
          <span class="who"
            ><img class="pic" :src="champIcon(c.championId)" alt="" width="34" height="34" /><span
              class="h5 ell"
              >{{ championName(c.championId) }}</span
            ></span
          >
          <span class="n"
            ><b>{{ c.games }}</b></span
          >
          <span class="n">
            <span class="wlc">
              <span class="num"
                ><b>{{ pct(c) }}%</b>
                <span class="meta">{{ c.wins }}W {{ c.games - c.wins }}L</span></span
              >
              <span class="wrl"><i :style="{ width: `${pct(c)}%` }" /></span>
            </span>
          </span>
          <span
            class="n"
            :title="`${c.avgKills.toFixed(1)} / ${c.avgDeaths.toFixed(1)} / ${c.avgAssists.toFixed(1)} a game`"
            ><b class="num">{{ c.kda.toFixed(2) }}</b></span
          >
          <span class="n hm">{{ c.csMin.toFixed(1) }}</span>
          <span class="n hm">{{ Math.round(c.goldMin) }}</span>
          <span class="n hm">{{ Math.round(c.damageMin) }}</span>
          <span class="n hm">{{ c.maxKills }}</span>
          <span class="n hm">{{ hours(c.duration) }}</span>
          <span class="n hm meta">{{
            points.get(c.championId)
              ? `${compact(points.get(c.championId)!.championPoints)}, lv ${points.get(c.championId)!.championLevel}`
              : '–'
          }}</span>
        </button>
        <EmptyState
          v-if="!sort.rows.length"
          compact
          icon="search"
          :title="`No champion matches “${query.trim()}”`"
        />
      </section>
    </template>
  </div>
</template>
