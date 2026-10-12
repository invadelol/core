<script setup lang="ts">
import { computed } from 'vue'
import { RoleIcon } from '@invadelol/ui'
import { positionName, positionOf, type Position } from '@invadelol/ui/logic'
import type { Match } from '../lib/types.js'

const props = defineProps<{ matches: Match[]; puuid: string }>()

const ORDER: Position[] = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT']

/** Where this player actually plays, and how it goes when they do. */
const rows = computed(() => {
  const counts = new Map<Position, { games: number; wins: number }>()
  for (const match of props.matches) {
    const me = match.participants.find((p) => p.puuid === props.puuid)
    const lane = positionOf(me?.position)
    if (!me || !lane) continue
    const entry = counts.get(lane) ?? { games: 0, wins: 0 }
    entry.games++
    if (me.win) entry.wins++
    counts.set(lane, entry)
  }
  const total = [...counts.values()].reduce((n, entry) => n + entry.games, 0)
  if (!total) return []
  return ORDER.filter((lane) => counts.has(lane)).map((lane) => {
    const entry = counts.get(lane)!
    return {
      lane,
      label: positionName(lane),
      games: entry.games,
      share: (entry.games / total) * 100,
      winrate: Math.round((entry.wins / entry.games) * 100),
    }
  })
})
</script>

<template>
  <section v-if="rows.length" class="iv-panel">
    <div class="section">
      <h3>Roles</h3>
      <span class="meta num">{{ rows.reduce((n, row) => n + row.games, 0) }} laned games</span>
    </div>

    <ul class="space-y-2.5">
      <li
        v-for="row in rows"
        :key="row.lane"
        class="grid grid-cols-[16px_52px_minmax(0,1fr)_52px_36px] items-center gap-2.5"
      >
        <RoleIcon :lane="row.lane" :size="16" class="text-ink-3" />
        <span class="text-[13px] text-ink-2">{{ row.label }}</span>
        <span class="meter">
          <span :style="{ width: `${row.share}%` }" />
        </span>
        <span class="num text-right text-[12px] text-ink-3">
          {{ row.games }} {{ row.games === 1 ? 'game' : 'games' }}
        </span>
        <span
          class="num text-right text-[13px] font-semibold"
          :class="row.games < 3 ? 'text-ink-3' : 'text-ink'"
        >
          {{ row.winrate }}%
        </span>
      </li>
    </ul>
  </section>
</template>
