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

/**
 * Shade steps by games played that day, the same for every player so two heatmaps compare.
 * Step 0 is a day without games; each other step covers `min` to `max` games (null = no top).
 */
const STEPS: Array<{ min: number; max: number | null }> = [
  { min: 0, max: 0 },
  { min: 1, max: 1 },
  { min: 2, max: 2 },
  { min: 3, max: 4 },
  { min: 5, max: null },
]

function levelOf(games: number) {
  const index = STEPS.findIndex((step) => step.max === null || games <= step.max)
  return index === -1 ? STEPS.length - 1 : index
}

function stepRange(index: number) {
  const step = STEPS[index]
  if (step.max === 0) return 'No games'
  if (step.max === null) return `${step.min}+ games a day`
  if (step.min === step.max) return `${step.min} game${step.min > 1 ? 's' : ''} a day`
  return `${step.min} to ${step.max} games a day`
}

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
          level: levelOf(games),
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

  // Labels overflow their column to the right: one on the final column would run off the panel.
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
    averageLevel: activeDays ? Math.max(1, levelOf(Math.round(games / activeDays))) : -1,
  }
})

function legendTitle(index: number) {
  const range = stepRange(index)
  return index === totals.value.averageLevel ? `${range}, your average per active day` : range
}

/* The player's own activity: the brand violet, from empty to full. */
const SHADES = [
  'var(--surface-3)',
  'rgb(var(--brand-rgb) / 0.3)',
  'rgb(var(--brand-rgb) / 0.5)',
  'rgb(var(--brand-rgb) / 0.75)',
  'var(--brand)',
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
  <section class="iv-panel">
    <div class="section">
      <h3>Activity</h3>
      <span class="meta">Last {{ WEEKS }} weeks</span>
      <span v-if="activity.length" class="num meta ml-auto">
        {{ totals.games }} games, {{ totals.winrate }}%
      </span>
    </div>

    <p v-if="!activity.length" class="text-[13px] text-ink-2">No games recorded yet.</p>

    <div v-else>
      <div class="scroll-x pb-1">
        <div class="flex gap-[3px]">
          <div class="mr-1 flex flex-col gap-[3px] pt-[13px]">
            <span
              v-for="(label, index) in DAY_LABELS"
              :key="index"
              class="h-[10px] text-[10px] leading-[10px] text-ink-4 max-lg:text-[11px]"
            >
              {{ label }}
            </span>
          </div>

          <div
            v-for="(column, index) in weeks"
            :key="index"
            class="flex min-w-[10px] flex-1 flex-col gap-[3px]"
          >
            <!-- The month label overflows to the right instead of widening its column. -->
            <span class="relative h-[10px]">
              <span
                v-if="column.month"
                class="absolute top-0 left-0 whitespace-nowrap text-[10px] leading-[10px] text-ink-4 max-lg:text-[11px]"
              >
                {{ column.month }}
              </span>
            </span>
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

      <div class="mt-2.5 flex items-center justify-between text-[12px] text-ink-3">
        <span class="num">{{ totals.perActiveDay }} games per active day</span>
        <span
          class="flex items-center gap-1.5 text-[11px] text-ink-4"
          role="group"
          aria-label="Games a day, from none to 5 or more"
        >
          <span class="num mr-0.5">0</span>
          <span
            v-for="(shade, index) in SHADES"
            :key="index"
            role="img"
            class="h-[9px] w-[9px] rounded-[2px]"
            :class="{ 'legend-average': index === totals.averageLevel }"
            :style="{ background: shade }"
            :title="legendTitle(index)"
            :aria-label="legendTitle(index)"
          />
          <span class="num ml-0.5">5+ games</span>
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* The step the player's average per active day falls on: a hairline ring, no new colour. */
.legend-average {
  outline: 1px solid var(--line-3);
  outline-offset: 1px;
}
</style>
