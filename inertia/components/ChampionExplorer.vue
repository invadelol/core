<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, ChevronDown, ChevronUp, Search } from 'lucide-vue-next'
import { champIcon, championName } from '../lib/assets.js'
import { compact, hours } from '../lib/format.js'
import type { ChampionStats } from '../lib/types.js'

const props = defineProps<{ champions: ChampionStats[]; busy?: boolean }>()
const emit = defineEmits<{ matches: [championId: number] }>()

const query = ref('')
const sort = ref<keyof ChampionStats>('games')
const direction = ref<1 | -1>(-1)

const totals = computed(() => ({
  games: props.champions.reduce((n, c) => n + c.games, 0),
  time: props.champions.reduce((n, c) => n + c.duration, 0),
}))

/**
 * Volume and outcome in one mark: the bar is games, the split is the record.
 * Below a real spread of games every bar is full width and the chart says
 * nothing, so it only appears once there is something to compare.
 */
const chart = computed(() => {
  const list = [...props.champions].sort((a, b) => b.games - a.games).slice(0, 10)
  const most = Math.max(...list.map((c) => c.games), 1)
  if (most < 3) return []
  return list.map((c) => ({
    ...c,
    width: (c.games / most) * 100,
    winShare: c.games ? (c.wins / c.games) * 100 : 0,
  }))
})

const rows = computed(() =>
  props.champions
    .filter((c) => championName(c.championId).toLowerCase().includes(query.value.toLowerCase()))
    .sort(
      (a, b) =>
        (Number(a[sort.value]) - Number(b[sort.value])) * direction.value || b.games - a.games
    )
)

const COLUMNS: Array<{ key: keyof ChampionStats; label: string; align?: 'right' }> = [
  { key: 'games', label: 'Games' },
  { key: 'winrate', label: 'Win rate' },
  { key: 'kda', label: 'KDA', align: 'right' },
  { key: 'csMin', label: 'CS/min', align: 'right' },
  { key: 'goldMin', label: 'Gold/min', align: 'right' },
  { key: 'damageMin', label: 'Damage/min', align: 'right' },
  { key: 'maxKills', label: 'Most kills', align: 'right' },
  { key: 'duration', label: 'Time played', align: 'right' },
]

function order(key: keyof ChampionStats) {
  direction.value = sort.value === key ? (-direction.value as 1 | -1) : -1
  sort.value = key
}
</script>

<template>
  <section class="card">
    <div class="section flex-wrap !items-center">
      <h2>Champion pool</h2>
      <span class="meta num">
        {{ champions.length }} champions <span class="text-ink-4">·</span> {{ totals.games }} games
        <span class="text-ink-4">·</span> {{ hours(totals.time) }} played
      </span>
      <label class="relative ml-auto w-[200px]">
        <Search
          :size="13"
          class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3"
        />
        <input
          v-model="query"
          class="field !h-[30px] !pl-8"
          aria-label="Search champions"
          placeholder="Find a champion"
        />
      </label>
    </div>

    <div class="!p-0">
      <!-- Volume against record, before the table gets into detail -->
      <div v-if="chart.length" class="grid gap-x-10 gap-y-0.5 px-3 pb-3 pt-2 md:grid-cols-2">
        <button
          v-for="c in chart"
          :key="c.championId"
          class="flex h-[36px] items-center gap-2.5 rounded-[5px] px-2 text-left transition-colors hover:bg-raised"
          :title="`Show ${championName(c.championId)} games`"
          @click="emit('matches', c.championId)"
        >
          <span class="portrait h-6 w-6">
            <img :src="champIcon(c.championId)" :alt="championName(c.championId)" loading="lazy" />
          </span>
          <span class="w-[92px] shrink-0 truncate text-[13px] font-medium text-ink">
            {{ championName(c.championId) }}
          </span>
          <span class="min-w-0 flex-1">
            <span
              class="flex h-[6px] gap-px overflow-hidden rounded-[2px]"
              :style="{ width: `${c.width}%` }"
            >
              <span
                :style="{ width: `${c.winShare}%`, background: 'rgb(var(--win-rgb) / 0.85)' }"
              />
              <span class="flex-1" style="background: rgb(var(--loss-rgb) / 0.85)" />
            </span>
          </span>
          <span class="num w-[64px] shrink-0 text-right text-[12px] text-ink-3">
            {{ c.wins }}W {{ c.games - c.wins }}L
          </span>
        </button>
      </div>

      <div class="scroll-x border-t border-line">
        <table class="dt dt-hover num min-w-[880px]">
          <thead>
            <tr>
              <th class="w-[22%] !pl-4">Champion</th>
              <th
                v-for="col in COLUMNS"
                :key="col.key"
                :class="col.align === 'right' ? 'text-right' : ''"
                :aria-sort="
                  sort === col.key ? (direction === 1 ? 'ascending' : 'descending') : 'none'
                "
              >
                <button
                  class="inline-flex items-center gap-1 transition-colors hover:text-ink"
                  :class="[
                    sort === col.key ? 'text-ink' : '',
                    col.align === 'right' ? 'flex-row-reverse' : '',
                  ]"
                  @click="order(col.key)"
                >
                  {{ col.label }}
                  <component
                    :is="direction === 1 ? ChevronUp : ChevronDown"
                    v-if="sort === col.key"
                    :size="12"
                    class="text-ink-3"
                  />
                </button>
              </th>
              <th class="!pr-4"><span class="sr-only">Matches</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in rows" :key="c.championId">
              <td class="!pl-4">
                <div class="flex items-center gap-2.5">
                  <span class="portrait h-8 w-8">
                    <img
                      :src="champIcon(c.championId)"
                      :alt="championName(c.championId)"
                      width="32"
                      height="32"
                      loading="lazy"
                    />
                  </span>
                  <span class="truncate text-[13px] font-semibold text-ink">
                    {{ championName(c.championId) }}
                  </span>
                </div>
              </td>

              <td>
                <span class="text-[13px] font-semibold text-ink">{{ c.games }}</span>
                <span class="ml-1.5 text-[12px] text-ink-3">
                  {{ c.wins }}W {{ c.games - c.wins }}L
                </span>
              </td>

              <td>
                <span
                  class="text-[13px] font-semibold"
                  :class="c.games < 3 ? 'text-ink-3' : 'text-ink'"
                  :title="c.games < 3 ? 'Fewer than three games' : undefined"
                >
                  {{ Math.round(c.winrate * 100) }}%
                </span>
              </td>

              <td class="text-right">
                <div class="text-[13px] font-semibold text-ink">{{ c.kda.toFixed(2) }}</div>
                <div class="text-[11px] text-ink-3">
                  {{ c.avgKills.toFixed(1) }} / {{ c.avgDeaths.toFixed(1) }} /
                  {{ c.avgAssists.toFixed(1) }}
                </div>
              </td>

              <td class="text-right text-ink">{{ c.csMin.toFixed(1) }}</td>
              <td class="text-right text-ink">{{ Math.round(c.goldMin) }}</td>
              <td class="text-right text-ink">{{ compact(c.damageMin) }}</td>
              <td class="text-right text-ink-2">{{ c.maxKills || '—' }}</td>
              <td class="text-right text-ink-3">{{ c.duration ? hours(c.duration) : '—' }}</td>

              <td class="!pr-3 text-right">
                <button
                  class="btn btn-sm btn-ghost"
                  :title="`Show ${championName(c.championId)} games`"
                  @click="emit('matches', c.championId)"
                >
                  Games
                  <ArrowRight :size="12" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="!rows.length" class="px-4 py-6 text-[13px] text-ink-2">
        {{ busy ? 'Loading champion statistics' : 'No champions match these filters.' }}
      </p>
    </div>
  </section>
</template>
