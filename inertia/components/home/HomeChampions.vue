<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { ChampIcon, RoleIcon } from '@invadelol/ui'
import { positionName, positionOf } from '@invadelol/ui/logic'
import { championName } from '../../lib/assets.js'
import type { ChampionRow, HomeChampions } from '../../lib/home.js'

/**
 * Champions on the patch in Solo/Duo: win, pick and ban rates, and the win rate's change since
 * the patch before. Only champions past the server's gate are listed; ten first, all on demand.
 */
const props = defineProps<{ champions: HomeChampions }>()

const SORTS = [
  { key: 'winRate', label: 'Win rate' },
  { key: 'pickRate', label: 'Pick rate' },
  { key: 'banRate', label: 'Ban rate' },
] as const
type SortKey = (typeof SORTS)[number]['key']

const sort = shallowRef<SortKey>('winRate')
const all = shallowRef(false)
const SHOWN = 10

const sorted = computed(() =>
  [...props.champions.rows].sort((a, b) => b[sort.value] - a[sort.value] || b.games - a.games)
)
const rows = computed(() => (all.value ? sorted.value : sorted.value.slice(0, SHOWN)))

const rate = (x: number) => `${(x * 100).toFixed(1)}%`
function change(row: ChampionRow) {
  if (row.previousWinRate === null) return '–'
  const d = (row.winRate - row.previousWinRate) * 100
  if (Math.abs(d) < 0.05) return '0.0'
  return `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}`
}
const full = (n: number) => n.toLocaleString('en-US')
</script>

<template>
  <section aria-labelledby="champions-title">
    <div class="section flex-wrap">
      <h2 id="champions-title">Champions</h2>
      <span class="meta num">
        Patch {{ champions.patch }} · Solo/Duo · {{ full(champions.games) }} games
      </span>
      <div class="iv-seg sm ml-auto" role="group" aria-label="Sort champions by">
        <button
          v-for="s in SORTS"
          :key="s.key"
          type="button"
          :class="{ on: sort === s.key }"
          :aria-pressed="sort === s.key"
          @click="sort = s.key"
        >
          {{ s.label }}
        </button>
      </div>
    </div>

    <div class="iv-panel home-sheet overflow-hidden">
      <table class="dt dt-hover champs">
        <thead>
          <tr>
            <th class="rank" aria-label="Place"></th>
            <th>Champion</th>
            <th class="r" :class="{ on: sort === 'winRate' }">Win</th>
            <th
              v-if="champions.previousPatch"
              class="r delta"
              :title="`Win rate change since patch ${champions.previousPatch}`"
            >
              vs {{ champions.previousPatch }}
            </th>
            <th class="r" :class="{ on: sort === 'pickRate' }">Pick</th>
            <th class="r" :class="{ on: sort === 'banRate' }">Ban</th>
            <th class="r games">Games</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in rows" :key="row.championId">
            <td class="rank num text-ink-4">{{ i + 1 }}</td>
            <td>
              <span class="flex min-w-0 items-center gap-2.5">
                <ChampIcon :id="row.championId" :size="28" />
                <span class="truncate font-semibold text-ink">{{
                  championName(row.championId)
                }}</span>
                <span
                  v-if="positionOf(row.position)"
                  class="role shrink-0 text-ink-3"
                  :title="positionName(positionOf(row.position))"
                >
                  <RoleIcon :lane="positionOf(row.position)" :size="16" />
                </span>
              </span>
            </td>
            <td class="r num font-semibold text-ink" :class="{ on: sort === 'winRate' }">
              {{ rate(row.winRate) }}
            </td>
            <td v-if="champions.previousPatch" class="r delta num text-ink-3">
              {{ change(row) }}
            </td>
            <td class="r num text-ink-2" :class="{ on: sort === 'pickRate' }">
              {{ rate(row.pickRate) }}
            </td>
            <td class="r num text-ink-2" :class="{ on: sort === 'banRate' }">
              {{ rate(row.banRate) }}
            </td>
            <td class="r games num text-ink-3">{{ full(row.games) }}</td>
          </tr>
        </tbody>
      </table>

      <button
        v-if="champions.rows.length > SHOWN"
        type="button"
        class="more"
        :aria-expanded="all"
        @click="all = !all"
      >
        {{ all ? 'Top 10' : `All ${champions.rows.length}` }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.champs {
  table-layout: fixed;
}

.champs thead th {
  position: static;
  background: transparent;
}

.champs th.on {
  color: var(--text-1);
}

/* The column the table is sorted by carries a faint wash of the light, like a selected key. */
.champs .on {
  background: rgb(var(--brand-rgb) / var(--home-light));
}

.champs .r {
  text-align: right;
}

.champs .rank {
  width: 36px;
  padding-right: 0;
  text-align: right;
  font-size: 12px;
}

.champs th:nth-child(n + 3) {
  width: 64px;
}

.champs .delta {
  width: 76px;
}

.champs .games {
  width: 72px;
}

.champs td {
  height: 44px;
}

.champs :is(.delta, .games) {
  display: none;
}

.role {
  display: none;
}

@media (min-width: 40rem) {
  .champs :is(.delta, .games) {
    display: table-cell;
  }

  .role {
    display: inline-flex;
  }

  .champs th:nth-child(n + 3) {
    width: 76px;
  }

  .champs .delta {
    width: 84px;
  }
}

.more {
  display: block;
  width: 100%;
  height: 40px;
  text-align: center;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-3);
  border-top: 1px solid var(--line);
  transition:
    color var(--t-fast) var(--ease),
    background-color var(--t-fast) var(--ease);
}

.more:hover {
  color: var(--text-1);
  background: var(--surface-2);
}

@media (pointer: coarse) {
  .more {
    height: 44px;
  }
}
</style>
