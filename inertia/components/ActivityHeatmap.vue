<script setup lang="ts">
import { computed } from 'vue'
import Card from './ui/Card.vue'
import EmptyState from './ui/EmptyState.vue'
import type { ActivityDay } from '../lib/types.js'

const props = defineProps<{ activity: ActivityDay[] }>()

const WEEKS = 17
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

  // A label on the final column would run off the edge of the card.
  if (columns.length) columns[columns.length - 1].month = null

  return columns
})

const totals = computed(() => {
  const games = props.activity.reduce((sum, day) => sum + Number(day.games), 0)
  const wins = props.activity.reduce((sum, day) => sum + Number(day.wins), 0)
  const activeDays = props.activity.filter((day) => Number(day.games) > 0).length
  return {
    games,
    wins,
    activeDays,
    winrate: games ? Math.round((wins / games) * 100) : 0,
    perActiveDay: activeDays ? (games / activeDays).toFixed(1) : '0',
  }
})

const SHADES = ['#f2f2f5', '#d5d7dd', '#a9adb7', '#6c717d', '#2b2e36']

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
  <Card title="Activity" :note="`last ${WEEKS} weeks`">
    <EmptyState v-if="!activity.length" message="No recorded activity" />

    <div v-else class="space-y-4">
      <div class="grid grid-cols-3 gap-4">
        <div>
          <div class="label">Games</div>
          <div class="num mt-0.5 text-[1.125rem] font-semibold text-ink">{{ totals.games }}</div>
        </div>
        <div>
          <div class="label">Win rate</div>
          <div
            class="num mt-0.5 text-[1.125rem] font-semibold"
            :class="totals.winrate >= 50 ? 'text-pos' : 'text-neg'"
          >
            {{ totals.winrate }}%
          </div>
        </div>
        <div>
          <div class="label">Per active day</div>
          <div class="num mt-0.5 text-[1.125rem] font-semibold text-ink">
            {{ totals.perActiveDay }}
          </div>
        </div>
      </div>

      <div class="scroll-x pb-1">
        <div class="flex min-w-max gap-[3px] pr-5">
          <div class="mr-1 flex flex-col gap-[3px] pt-[14px]">
            <span
              v-for="(label, index) in DAY_LABELS"
              :key="index"
              class="h-[11px] text-[9px] leading-[11px] text-ink-3"
            >
              {{ label }}
            </span>
          </div>

          <div v-for="(column, index) in weeks" :key="index" class="flex flex-col gap-[3px]">
            <span class="h-[11px] text-[9px] leading-[11px] text-ink-3">{{ column.month }}</span>
            <template v-for="(cell, dayIndex) in column.days" :key="dayIndex">
              <span
                v-if="cell"
                class="h-[11px] w-[11px] rounded-[2px]"
                :style="{ background: SHADES[cell.level] }"
                :title="tooltip(cell)"
              />
              <span v-else class="h-[11px] w-[11px]" />
            </template>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-end gap-1.5 text-[0.625rem] text-ink-3">
        <span>Less</span>
        <span
          v-for="shade in SHADES"
          :key="shade"
          class="h-[10px] w-[10px] rounded-[2px]"
          :style="{ background: shade }"
        />
        <span>More</span>
        <span class="ml-2 text-ink-4">peak {{ busiest }}/day</span>
      </div>
    </div>
  </Card>
</template>
