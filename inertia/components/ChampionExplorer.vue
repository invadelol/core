<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDown, ArrowUp, ArrowRight, Search } from 'lucide-vue-next'
import ChampionBanner from './ChampionBanner.vue'
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

/**
 * Win rate as colour, one tile per champion, most played first. A single game
 * is not a 100% champion, so the rate is pulled towards even by two phantom
 * games before it drives the wash.
 */
const heat = computed(() =>
  [...props.champions]
    .sort((a, b) => b.games - a.games || b.winrate - a.winrate)
    .map((c) => {
      const shrunk = (c.wins + 1) / (c.games + 2)
      return {
        ...c,
        tone: shrunk >= 0.5 ? 'var(--color-win)' : 'var(--color-loss)',
        wash: Math.round(10 + Math.abs(shrunk - 0.5) * 2 * 62),
      }
    })
)

const rows = computed(() =>
  props.champions
    .filter((c) => championName(c.championId).toLowerCase().includes(query.value.toLowerCase()))
    .sort(
      (a, b) =>
        (Number(a[sort.value]) - Number(b[sort.value])) * direction.value || b.games - a.games
    )
)

const COLUMNS: Array<{ key: keyof ChampionStats; label: string; align?: 'right' }> = [
  { key: 'games', label: 'Played' },
  { key: 'winrate', label: 'Win rate' },
  { key: 'kda', label: 'KDA', align: 'right' },
  { key: 'csMin', label: 'CS/m', align: 'right' },
  { key: 'goldMin', label: 'Gold/m', align: 'right' },
  { key: 'damageMin', label: 'Dmg/m', align: 'right' },
  { key: 'maxKills', label: 'Best', align: 'right' },
  { key: 'duration', label: 'Time', align: 'right' },
]

function order(key: keyof ChampionStats) {
  direction.value = sort.value === key ? (-direction.value as 1 | -1) : -1
  sort.value = key
}
</script>

<template>
  <div>
    <ChampionBanner :champions="champions" class="mb-9" @pick="emit('matches', $event)" />

    <template v-if="heat.length">
      <div class="section">
        <h2>Win rate</h2>
        <span class="meta">by champion</span>
        <span class="ml-auto flex items-center gap-1.5 text-[10px] text-ink-4">
          <i class="h-2.5 w-4 rounded-[2px]" style="background: var(--color-loss)" />
          <i
            class="h-2.5 w-4 rounded-[2px]"
            style="background: color-mix(in srgb, var(--color-ink-3) 30%, transparent)"
          />
          <i class="h-2.5 w-4 rounded-[2px]" style="background: var(--color-win)" />
        </span>
      </div>
      <div class="mb-9 flex flex-wrap gap-1.5">
        <button
          v-for="c in heat"
          :key="c.championId"
          type="button"
          class="relative h-[52px] w-[52px] overflow-hidden rounded-[8px] transition-transform hover:scale-105"
          :title="`${championName(c.championId)} · ${c.games} games · ${c.wins}W ${c.games - c.wins}L · ${c.kda.toFixed(2)} KDA`"
          @click="emit('matches', c.championId)"
        >
          <img
            :src="champIcon(c.championId)"
            :alt="championName(c.championId)"
            loading="lazy"
            class="absolute inset-0 h-full w-full object-cover"
          />
          <span
            class="absolute inset-0"
            :style="{ background: `color-mix(in srgb, ${c.tone} ${c.wash}%, transparent)` }"
          />
          <span
            class="num absolute inset-x-0 bottom-0 py-[1px] text-center text-[9.5px] font-semibold text-white"
            style="background: rgb(0 0 0 / 0.55)"
          >
            {{ Math.round(c.winrate * 100) }}%
          </span>
        </button>
      </div>
    </template>

    <div class="section">
      <h2>Champion pool</h2>
      <span class="meta num">
        {{ champions.length }} champions
        <span class="text-ink-4">·</span>
        {{ totals.games }} games
        <span class="text-ink-4">·</span>
        {{ hours(totals.time) }}
      </span>
      <label class="relative ml-auto w-[170px]">
        <Search
          :size="12"
          class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3"
        />
        <input
          v-model="query"
          class="field !py-1 !pl-7 !text-[12px]"
          aria-label="Search champions"
          placeholder="Find a champion"
        />
      </label>
    </div>

    <!-- Volume against record, before the table gets into detail -->
    <div v-if="chart.length" class="mb-8 grid gap-x-10 gap-y-2 md:grid-cols-2">
      <button
        v-for="c in chart"
        :key="c.championId"
        class="flex items-center gap-2.5 rounded-[6px] px-1.5 py-1 text-left transition-colors hover:bg-raised"
        @click="emit('matches', c.championId)"
      >
        <img
          :src="champIcon(c.championId)"
          :alt="championName(c.championId)"
          loading="lazy"
          class="thumb h-[26px] w-[26px] rounded-[5px]"
        />
        <span class="w-[86px] shrink-0 truncate text-[12px] text-ink">
          {{ championName(c.championId) }}
        </span>
        <span class="min-w-0 flex-1">
          <span
            class="flex h-[7px] overflow-hidden rounded-[2px]"
            :style="{ width: `${c.width}%` }"
          >
            <span :style="{ width: `${c.winShare}%`, background: 'var(--color-win)' }" />
            <span class="flex-1" style="background: var(--color-loss)" />
          </span>
        </span>
        <span class="num w-[74px] shrink-0 text-right text-[11px] text-ink-3">
          {{ c.wins }}W {{ c.games - c.wins }}L
        </span>
      </button>
    </div>

    <div class="frame">
      <div class="scroll-x">
        <table class="dt dt-hover num min-w-[880px]">
          <thead>
            <tr>
              <th class="w-[20%] !pl-3">Champion</th>
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
                    :is="direction === 1 ? ArrowUp : ArrowDown"
                    v-if="sort === col.key"
                    :size="10"
                  />
                </button>
              </th>
              <th class="!pr-3"><span class="sr-only">Matches</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in rows" :key="c.championId">
              <td class="!pl-3">
                <div class="flex items-center gap-2.5">
                  <img
                    :src="champIcon(c.championId)"
                    :alt="championName(c.championId)"
                    width="28"
                    height="28"
                    loading="lazy"
                    class="thumb h-7 w-7 rounded-[6px]"
                  />
                  <span class="truncate font-medium text-ink">
                    {{ championName(c.championId) }}
                  </span>
                </div>
              </td>

              <td>
                <div class="text-ink-2">{{ c.games }}</div>
                <div class="text-[10.5px] text-ink-3">{{ c.wins }}W {{ c.games - c.wins }}L</div>
              </td>

              <td class="w-[96px]">
                <div class="mb-1 font-medium" :class="c.winrate >= 0.5 ? 'text-win' : 'text-loss'">
                  {{ Math.round(c.winrate * 100) }}%
                </div>
                <div
                  class="flex h-[4px] overflow-hidden rounded-[2px]"
                  style="background: var(--color-loss)"
                >
                  <span :style="{ width: `${c.winrate * 100}%`, background: 'var(--color-win)' }" />
                </div>
              </td>

              <td class="text-right">
                <div class="font-medium text-ink">{{ c.kda.toFixed(2) }}</div>
                <div class="text-[10.5px] text-ink-3">
                  {{ c.avgKills.toFixed(1) }}/{{ c.avgDeaths.toFixed(1) }}/{{
                    c.avgAssists.toFixed(1)
                  }}
                </div>
              </td>

              <td class="text-right text-ink-2">{{ c.csMin.toFixed(1) }}</td>
              <td class="text-right text-gold">{{ Math.round(c.goldMin) }}</td>
              <td class="text-right text-ink-2">{{ compact(c.damageMin) }}</td>
              <td class="text-right text-ink-2">{{ c.maxKills || '—' }}</td>
              <td class="text-right text-ink-3">{{ c.duration ? hours(c.duration) : '—' }}</td>

              <td class="!pr-3 text-right">
                <button
                  class="btn btn-sm btn-ghost"
                  :title="`Show ${championName(c.championId)} matches`"
                  @click="emit('matches', c.championId)"
                >
                  Matches
                  <ArrowRight :size="12" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="!rows.length" class="py-12 text-center text-[12.5px] text-ink-3">
        {{ busy ? 'Loading champion statistics' : 'No champions match these filters.' }}
      </p>
    </div>
  </div>
</template>
