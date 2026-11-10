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
  <section v-if="rows.length" class="rd-card rs">
    <div class="rd-head">
      <h3>Roles</h3>
      <span class="num rd-hm"
        >Last {{ rows.reduce((n, row) => n + row.games, 0) }} laned games</span
      >
    </div>

    <ul>
      <li
        v-for="row in rows"
        :key="row.lane"
        class="rl"
        :title="`${row.label}: ${row.games} ${row.games === 1 ? 'game' : 'games'}, ${row.winrate}% won`"
      >
        <RoleIcon :lane="row.lane" :size="16" class="text-ink-3" />
        <span>{{ row.label }}</span>
        <span class="rd-bar"><i :style="{ width: `${row.share}%` }" /></span>
        <span class="num">{{ Math.round(row.share) }}%</span>
        <span class="num wr" :class="{ thin: row.games < 3 }">{{ row.winrate }}% won</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.rs ul {
  margin: 0;
  padding: 6px 0 8px;
  list-style: none;
}
.rl {
  display: grid;
  grid-template-columns: 18px 58px minmax(0, 1fr) 36px 62px;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 16px;
  font-size: 13px;
  color: var(--text-2);
}
.rl > span:nth-child(4),
.rl .wr {
  text-align: right;
  color: var(--text-3);
}
.rl .wr {
  font-size: 12px;
}
.rl .wr.thin {
  color: var(--text-4);
}
</style>
