<script setup lang="ts">
import { computed } from 'vue'
import RoleIcon from './RoleIcon.vue'
import { POSITION_NAMES, POSITION_ORDER } from '../lib/assets.js'
import type { Match } from '../lib/types.js'

const props = defineProps<{ matches: Match[]; puuid: string }>()

/** Where this player actually plays, and how it goes when they do. */
const rows = computed(() => {
  const counts = new Map<string, { games: number; wins: number }>()
  for (const match of props.matches) {
    const me = match.participants.find((p) => p.puuid === props.puuid)
    if (!me?.position) continue
    const entry = counts.get(me.position) ?? { games: 0, wins: 0 }
    entry.games++
    if (me.win) entry.wins++
    counts.set(me.position, entry)
  }
  const total = [...counts.values()].reduce((n, entry) => n + entry.games, 0)
  if (!total) return []
  return POSITION_ORDER.filter((position) => counts.has(position)).map((position) => {
    const entry = counts.get(position)!
    return {
      position,
      label: POSITION_NAMES[position] ?? position,
      games: entry.games,
      share: (entry.games / total) * 100,
      winrate: Math.round((entry.wins / entry.games) * 100),
    }
  })
})
</script>

<template>
  <section v-if="rows.length" class="card">
    <div class="section">
      <h3>Roles</h3>
      <span class="meta num">{{ rows.reduce((n, row) => n + row.games, 0) }} laned games</span>
    </div>

    <ul class="space-y-2.5">
      <li
        v-for="row in rows"
        :key="row.position"
        class="grid grid-cols-[16px_52px_minmax(0,1fr)_52px_36px] items-center gap-2.5"
      >
        <RoleIcon :role="row.position" :size="16" class="text-ink-3" />
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
