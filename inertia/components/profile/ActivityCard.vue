<script setup lang="ts">
import { computed } from 'vue'
import type { ActivityDay } from '../../lib/types.js'

/**
 * The last 18 weeks as a heatmap: a column a week, Sunday on top, each day a square from empty to
 * full violet by the games played that day (the stored games, `/activity`).
 */
const props = defineProps<{ activity: ActivityDay[] }>()

const WEEKS = 18

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const byDay = computed(() => {
  const map = new Map<string, ActivityDay>()
  for (const day of props.activity) map.set(day.day.slice(0, 10), day)
  return map
})

/** The days of the last 18 weeks, column by column (a week each), ending this week. */
const grid = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setDate(start.getDate() - start.getDay() - (WEEKS - 1) * 7)
  const days: Array<{ key: string; games: number; wins: number; future: boolean }> = []
  const months: Array<{ col: number; label: string }> = []
  let games = 0
  let active = 0
  const cursor = new Date(start)
  for (let i = 0; i < WEEKS * 7; i++) {
    const key = iso(cursor)
    const entry = byDay.value.get(key)
    const n = Number(entry?.games ?? 0)
    const future = cursor > today
    if (!future) {
      games += n
      if (n) active++
    }
    days.push({ key, games: future ? 0 : n, wins: Number(entry?.wins ?? 0), future })
    if (cursor.getDate() <= 7 && i % 7 === 0) {
      const col = i / 7
      if (col < WEEKS - 1)
        months.push({ col, label: cursor.toLocaleDateString('en-US', { month: 'short' }) })
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  const busiest = Math.max(1, ...days.map((d) => d.games))
  return {
    cells: days.map((d) => ({
      ...d,
      level: d.games ? Math.min(4, Math.ceil((d.games / busiest) * 4)) : 0,
    })),
    months,
    games,
    perDay: active ? (games / active).toFixed(1) : null,
  }
})

function tip(cell: { key: string; games: number; wins: number }) {
  const date = new Date(`${cell.key}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  if (!cell.games) return `${date}: no games`
  return `${date}: ${cell.games} ${cell.games === 1 ? 'game' : 'games'}, ${cell.wins}W ${cell.games - cell.wins}L`
}
</script>

<template>
  <section class="card pl-sec">
    <div class="pl-sec-h">
      <h2 class="h4">Activity</h2>
      <span class="meta">Last {{ WEEKS }} weeks</span>
      <span class="meta r num">{{ grid.games }} {{ grid.games === 1 ? 'game' : 'games' }}</span>
    </div>
    <div class="pl-heat-m meta" aria-hidden="true">
      <span v-for="m in grid.months" :key="m.col" :style="{ left: `${(m.col / WEEKS) * 100}%` }">{{
        m.label
      }}</span>
    </div>
    <div class="pl-heat" role="img" :aria-label="`${grid.games} games in the last ${WEEKS} weeks`">
      <i
        v-for="cell in grid.cells"
        :key="cell.key"
        :class="[cell.level ? `h${cell.level}` : '', { f: cell.future }]"
        :title="cell.future ? undefined : tip(cell)"
      />
    </div>
    <div class="row meta pl-heat-f">
      <span v-if="grid.perDay">{{ grid.perDay }} games a day when you play</span>
      <span class="row pl-heat-k" aria-hidden="true"
        ><i class="h1" /><i class="h2" /><i class="h3" /><i class="h4"
      /></span>
    </div>
  </section>
</template>
