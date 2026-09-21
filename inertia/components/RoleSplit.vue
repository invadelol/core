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
  <section v-if="rows.length">
    <div class="section">
      <h3>Roles</h3>
      <span class="meta">{{ matches.length }} games</span>
    </div>

    <ul class="space-y-2.5">
      <li v-for="row in rows" :key="row.position" class="flex items-center gap-2.5">
        <RoleIcon :role="row.position" :size="15" class="text-ink-3" />
        <span class="w-[46px] shrink-0 text-[11.5px] text-ink-2">{{ row.label }}</span>
        <span class="h-[5px] min-w-0 flex-1 rounded-[2px] bg-sunken">
          <span class="block h-full rounded-[2px] bg-ink" :style="{ width: `${row.share}%` }" />
        </span>
        <span class="num w-[26px] shrink-0 text-right text-[11px] text-ink-3">{{ row.games }}</span>
        <span
          class="num w-[32px] shrink-0 text-right text-[11px] font-medium"
          :class="row.winrate >= 50 ? 'text-win' : 'text-loss'"
        >
          {{ row.winrate }}%
        </span>
      </li>
    </ul>
  </section>
</template>
