<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDown, ArrowUpDown, Search, Trophy, ArrowRight } from 'lucide-vue-next'
import { championName, champIcon, championSplash } from '../lib/assets.js'
import { compact } from '../lib/format.js'
import type { ChampionStats } from '../lib/types.js'
const props = defineProps<{ champions: ChampionStats[]; busy?: boolean }>()
const emit = defineEmits<{ matches: [championId: number] }>()
const query = ref('')
const sort = ref<keyof ChampionStats>('games')
const direction = ref(-1)
const open = ref<number | null>(null)
const top = computed(() => [...props.champions].sort((a, b) => b.games - a.games).slice(0, 3))
const rows = computed(() =>
  props.champions
    .filter((c) => championName(c.championId).toLowerCase().includes(query.value.toLowerCase()))
    .sort(
      (a, b) =>
        (Number(a[sort.value]) - Number(b[sort.value])) * direction.value || b.games - a.games
    )
)
const columns: { key: keyof ChampionStats; label: string }[] = [
  { key: 'games', label: 'Played' },
  { key: 'kda', label: 'KDA' },
  { key: 'csMin', label: 'CS / min' },
  { key: 'goldMin', label: 'Gold / min' },
  { key: 'maxKills', label: 'Best kills' },
  { key: 'winrate', label: 'Win rate' },
  { key: 'duration', label: 'Time played' },
]
function order(key: keyof ChampionStats) {
  direction.value = sort.value === key ? -direction.value : -1
  sort.value = key
}
</script>
<template>
  <section class="space-y-5">
    <div class="section-intro">
      <div>
        <span class="eyebrow">KNOW YOUR CHAMPION POOL</span>
        <h2>Champions</h2>
        <p>Find your comfort picks. Discover your next main.</p>
      </div>
      <span class="subtle"
        >{{ champions.length }} champions ·
        {{ champions.reduce((n, c) => n + c.games, 0) }} games</span
      >
    </div>
    <div v-if="top.length" class="champion-spotlights">
      <button
        v-for="(c, i) in top"
        :key="c.championId"
        class="champion-spotlight"
        @click="open = c.championId"
      >
        <img :src="championSplash(c.championId)" :alt="championName(c.championId)" />
        <div class="spotlight-shade" />
        <div class="spotlight-content">
          <span class="spotlight-label"
            ><Trophy v-if="i === 0" :size="13" />{{
              i === 0 ? 'SIGNATURE PICK' : `MOST PLAYED · 0${i + 1}`
            }}</span
          >
          <h3>{{ championName(c.championId) }}</h3>
          <p>{{ c.games }} games <span>·</span> {{ Math.round(c.winrate * 100) }}% win rate</p>
          <div class="spotlight-foot">
            <strong>{{ c.kda.toFixed(2) }} <small>KDA</small></strong
            ><ArrowRight :size="17" />
          </div>
        </div>
      </button>
    </div>
    <div class="card overflow-hidden">
      <div class="card-head">
        <h3 class="card-title">Champion breakdown</h3>
        <label class="table-search"
          ><Search :size="14" /><input
            v-model="query"
            aria-label="Search champions"
            placeholder="Find a champion…"
        /></label>
      </div>
      <div class="overflow-x-auto">
        <table class="champion-table">
          <thead>
            <tr>
              <th>Champion</th>
              <th
                v-for="col in columns"
                :key="col.key"
                :aria-sort="
                  sort === col.key ? (direction === 1 ? 'ascending' : 'descending') : 'none'
                "
              >
                <button @click="order(col.key)">{{ col.label }}<ArrowUpDown :size="11" /></button>
              </th>
              <th><span class="sr-only">Details</span></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="c in rows" :key="c.championId"
              ><tr :class="{ 'selected-row': open === c.championId }">
                <td>
                  <button
                    class="champion-cell"
                    @click="open = open === c.championId ? null : c.championId"
                  >
                    <img
                      :src="champIcon(c.championId)"
                      :alt="championName(c.championId)"
                    /><strong>{{ championName(c.championId) }}</strong>
                  </button>
                </td>
                <td>
                  {{ c.games }}<small>{{ c.wins }}W · {{ c.games - c.wins }}L</small>
                </td>
                <td>
                  <strong>{{ c.kda.toFixed(2) }}</strong
                  ><small
                    >{{ c.avgKills.toFixed(1) }}/{{ c.avgDeaths.toFixed(1) }}/{{
                      c.avgAssists.toFixed(1)
                    }}</small
                  >
                </td>
                <td>{{ c.csMin.toFixed(1) }}</td>
                <td>{{ Math.round(c.goldMin) }}</td>
                <td>{{ c.maxKills ?? '—' }}</td>
                <td>
                  <div class="winrate-cell">
                    <strong :class="c.winrate >= 0.5 ? 'text-pos' : 'text-neg'"
                      >{{ Math.round(c.winrate * 100) }}%</strong
                    >
                    <div class="winrate-track">
                      <span :style="{ width: `${c.winrate * 100}%` }" />
                    </div>
                  </div>
                </td>
                <td>{{ c.duration ? `${(c.duration / 3600).toFixed(1)}h` : '—' }}</td>
                <td>
                  <button
                    class="icon-button"
                    :aria-label="`${championName(c.championId)} details`"
                    :aria-expanded="open === c.championId"
                    @click="open = open === c.championId ? null : c.championId"
                  >
                    <ChevronDown :size="16" :class="{ 'rotate-180': open === c.championId }" />
                  </button>
                </td>
              </tr>
              <tr v-if="open === c.championId">
                <td colspan="9" class="champion-detail">
                  <div>
                    <span
                      ><strong>{{ compact(c.damageMin) }}</strong> damage per minute</span
                    ><span
                      ><strong>{{ c.csMin.toFixed(1) }}</strong> CS per minute</span
                    ><span
                      ><strong>{{ Math.round(c.goldMin) }}</strong> gold per minute</span
                    ><button class="btn ml-auto" @click="emit('matches', c.championId)">
                      View matches <ArrowRight :size="14" />
                    </button>
                  </div>
                </td></tr
            ></template>
          </tbody>
        </table>
      </div>
      <div v-if="!rows.length" class="empty-panel">
        {{ busy ? 'Loading champion statistics…' : 'No champions match these filters.' }}
      </div>
    </div>
  </section>
</template>
