<script setup lang="ts">
import { computed } from 'vue'
import Frame from '../ui/Frame.vue'
import CardHead from '../ui/CardHead.vue'
import EmptyState from '../ui/EmptyState.vue'
import SortHead from '../ui/SortHead.vue'
import { useSort } from '../ui/sort.js'
import { champIcon, championName } from '../../lib/assets.js'
import type { ChampionMastery, ChampionStats } from '../../lib/types.js'

/** The Champions tab: every champion of the season in one table, most played first. */
const props = defineProps<{
  champions: ChampionStats[]
  mastery: ChampionMastery[]
  busy: boolean
  queue: string
}>()
defineEmits<{ queue: [string]; matches: [number] }>()
const QUEUES = [
  { value: 'all', label: 'All' },
  { value: 'solo', label: 'Solo/Duo' },
  { value: 'flex', label: 'Flex' },
  { value: 'normal', label: 'Normal' },
]
const points = computed(() => new Map(props.mastery.map((m) => [m.championId, m])))
const short = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n)
const total = computed(() => props.champions.reduce((s, c) => s + c.games, 0))
const sort = useSort(
  () => props.champions,
  {
    name: (c) => championName(c.championId),
    games: (c) => c.games,
    win: (c) => c.winrate,
    kda: (c) => c.kda,
    cs: (c) => c.csMin,
    gold: (c) => c.goldMin,
    damage: (c) => c.damageMin,
    mastery: (c) => points.value.get(c.championId)?.championPoints ?? null,
  },
  { key: 'games', first: { name: 'asc' } }
)
</script>

<template>
  <section
    class="card tbl pf-ct"
    style="--cols: minmax(0, 1fr) 70px 150px 120px 80px 80px 90px 110px"
  >
    <CardHead title="Champions" icon="grid" :meta="`${champions.length} champions, ${total} games`">
      <span class="seg">
        <button
          v-for="q in QUEUES"
          :key="q.value"
          type="button"
          :class="{ on: queue === q.value }"
          @click="$emit('queue', q.value)"
        >
          {{ q.label }}
        </button>
      </span>
    </CardHead>
    <div class="tbl-h">
      <SortHead :sorter="sort" col="name" label="Champion" />
      <SortHead :sorter="sort" col="games" label="Games" class="n" />
      <SortHead :sorter="sort" col="win" label="Win rate" />
      <SortHead :sorter="sort" col="kda" label="KDA" class="n" />
      <SortHead :sorter="sort" col="cs" label="CS/min" class="n hm" />
      <SortHead :sorter="sort" col="gold" label="Gold/min" class="n hm" />
      <SortHead :sorter="sort" col="damage" label="Damage/min" class="n hm" />
      <SortHead :sorter="sort" col="mastery" label="Mastery" class="n hm" />
    </div>
    <EmptyState
      v-if="!champions.length && !busy"
      compact
      icon="grid"
      title="No game in this queue"
    />
    <button
      v-for="c in sort.rows"
      :key="c.championId"
      type="button"
      class="tbl-r"
      style="text-align: left; width: 100%"
      @click="$emit('matches', c.championId)"
    >
      <span class="who"
        ><Frame :src="champIcon(c.championId)" :width="32" size="xs" /><span class="h5 ell">{{
          championName(c.championId)
        }}</span></span
      >
      <span class="n">{{ c.games }}</span>
      <span class="col" style="gap: 5px">
        <span class="h5 num"
          >{{ Math.round(c.winrate * 100) }}%
          <span class="meta">{{ c.wins }}W {{ c.games - c.wins }}L</span></span
        >
        <span class="split" style="height: 4px"
          ><i :style="{ width: `${c.winrate * 100}%` }"></i><b></b
        ></span>
      </span>
      <span class="n col" style="gap: 1px; align-items: flex-end">
        <span class="h5 num">{{ c.kda.toFixed(2) }}</span>
        <span class="meta"
          >{{ c.avgKills.toFixed(1) }} / {{ c.avgDeaths.toFixed(1) }} /
          {{ c.avgAssists.toFixed(1) }}</span
        >
      </span>
      <span class="n hm">{{ c.csMin.toFixed(1) }}</span>
      <span class="n hm">{{ Math.round(c.goldMin) }}</span>
      <span class="n hm">{{ Math.round(c.damageMin) }}</span>
      <span class="n hm meta">{{
        points.get(c.championId)
          ? `${short(points.get(c.championId)!.championPoints)}, level ${points.get(c.championId)!.championLevel}`
          : '–'
      }}</span>
    </button>
  </section>
</template>
