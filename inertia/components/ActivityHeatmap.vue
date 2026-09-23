<script setup lang="ts">
import { computed } from 'vue'
import type { ActivityDay } from '../lib/types.js'

const props = defineProps<{ activity: ActivityDay[] }>()

const WEEKS = 18
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']

interface Cell {
  date: string
  games: number
  wins: number
  level: number
}

function iso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const byDay = computed(() => {
  const map = new Map<string, ActivityDay>()
  for (const day of props.activity) map.set(day.day.slice(0, 10), day)
  return map
})

const busiest = computed(() =>
  props.activity.reduce<number>((max, day) => Math.max(max, Number(day.games)), 0)
)

/** Columns of seven days, ending on today, aligned so each column is a week. */
const weeks = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const start = new Date(today)
  start.setDate(start.getDate() - (WEEKS * 7 - 1))
  start.setDate(start.getDate() - start.getDay())

  const columns: Array<{ month: string | null; days: Array<Cell | null> }> = []
  const cursor = new Date(start)

  for (let week = 0; week < WEEKS + 1; week++) {
    const days: Array<Cell | null> = []
    let month: string | null = null

    for (let weekday = 0; weekday < 7; weekday++) {
      if (cursor > today) {
        days.push(null)
      } else {
        const key = iso(cursor)
        const entry = byDay.value.get(key)
        const games = Number(entry?.games ?? 0)
        days.push({
          date: key,
          games,
          wins: Number(entry?.wins ?? 0),
          level: games === 0 ? 0 : Math.min(4, Math.ceil((games / Math.max(busiest.value, 1)) * 4)),
        })
        // Label the column where a new month begins.
        if (cursor.getDate() <= 7 && weekday === 0) {
          month = cursor.toLocaleDateString('en-US', { month: 'short' })
        }
      }
      cursor.setDate(cursor.getDate() + 1)
    }

    if (days.some(Boolean)) columns.push({ month, days })
  }

  // A label on the final column would run off the edge of the panel.
  if (columns.length) columns[columns.length - 1].month = null

  return columns
})

const totals = computed(() => {
  const games = props.activity.reduce((sum, day) => sum + Number(day.games), 0)
  const wins = props.activity.reduce((sum, day) => sum + Number(day.wins), 0)
  const activeDays = props.activity.filter((day) => Number(day.games) > 0).length
  return {
    games,
    activeDays,
    winrate: games ? Math.round((wins / games) * 100) : 0,
    perActiveDay: activeDays ? (games / activeDays).toFixed(1) : '0',
  }
})

/** Four steps of one neutral, so intensity reads as intensity. */

const SHADES = [
  'var(--color-sunken)',
  'color-mix(in srgb, var(--color-ink) 22%, var(--color-sunken))',
  'color-mix(in srgb, var(--color-ink) 45%, var(--color-sunken))',
  'color-mix(in srgb, var(--color-ink) 70%, var(--color-sunken))',
  'var(--color-ink)',
]

function tooltip(cell: Cell) {
  const date = new Date(`${cell.date}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  if (!cell.games) return `${date}: no games`
  const wr = Math.round((cell.wins / cell.games) * 100)
  return `${date}: ${cell.games} game${cell.games > 1 ? 's' : ''}, ${cell.wins}W (${wr}%)`
}
</script>

<template>
  <section class="card">
    <div class="section">
      <h3>Activity</h3>
      <span class="meta">last {{ WEEKS }} weeks</span>
      <span v-if="activity.length" class="num meta ml-auto">
        {{ totals.games }} games
        <span class="text-ink-4">·</span>
        <span :class="totals.winrate >= 50 ? 'text-win' : 'text-loss'">{{ totals.winrate }}%</span>
      </span>
    </div>

    <p v-if="!activity.length" class="text-[12px] text-ink-3">No recorded activity.</p>

    <div v-else>
      <div class="scroll-x pb-1">
        <div class="flex gap-[3px]">
          <div class="mr-1 flex flex-col gap-[3px] pt-[13px]">
            <span
              v-for="(label, index) in DAY_LABELS"
              :key="index"
              class="h-[10px] text-[9px] leading-[10px] text-ink-4"
            >
              {{ label }}
            </span>
          </div>

          <div v-for="(column, index) in weeks" :key="index" class="flex flex-1 flex-col gap-[3px]">
            <span class="h-[10px] text-[9px] leading-[10px] text-ink-4">{{ column.month }}</span>
            <template v-for="(cell, dayIndex) in column.days" :key="dayIndex">
              <span
                v-if="cell"
                class="h-[10px] w-full rounded-[2px]"
                :style="{ background: SHADES[cell.level] }"
                :title="tooltip(cell)"
              />
              <span v-else class="h-[10px] w-full" />
            </template>
          </div>
        </div>
      </div>

      <div class="mt-2 flex items-center justify-between text-[10.5px] text-ink-3">
        <span class="num">{{ totals.perActiveDay }} games per active day</span>
        <span class="flex items-center gap-1.5">
          <span
            v-for="(shade, index) in SHADES"
            :key="index"
            class="h-[9px] w-[9px] rounded-[2px]"
            :style="{ background: shade }"
          />
        </span>
      </div>
    </div>
  </section>
</template>
