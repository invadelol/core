<script setup lang="ts">
import { computed } from 'vue'
import Card from './ui/Card.vue'
import StatCell from './ui/StatCell.vue'
import EmptyState from './ui/EmptyState.vue'
import { compact, percent } from '../lib/format.js'
import type { GlobalStats, Match } from '../lib/types.js'

const props = defineProps<{
  stats: GlobalStats | null
  /** Recent matches, newest first — used for the form strip. */
  matches: Match[]
  puuid: string
}>()

/** Win/loss for the most recent games, oldest on the left. */
const form = computed(() =>
  props.matches
    .slice(0, 20)
    .map((match) => match.participants.find((p) => p.puuid === props.puuid)?.win ?? null)
    .filter((win): win is boolean => win !== null)
    .reverse()
)

const formRecord = computed(() => {
  const wins = form.value.filter(Boolean).length
  return { wins, losses: form.value.length - wins }
})

const cells = computed(() => {
  const g = props.stats
  if (!g) return []
  return [
    {
      label: 'Win rate',
      value: percent(g.winrate),
      meter: g.winrate * 100,
      tone: g.winrate >= 0.5 ? ('pos' as const) : ('neg' as const),
      hint: `${g.total} games analysed`,
    },
    {
      label: 'KDA',
      value: g.kda.toFixed(2),
      tone: 'ink' as const,
      hint: 'kills + assists / deaths',
    },
    {
      label: 'Kill participation',
      value: percent(g.killParticipation),
      meter: g.killParticipation * 100,
      tone: 'ink' as const,
      hint: 'of the team’s kills',
    },
    {
      label: 'Damage share',
      value: percent(g.damageShare),
      meter: g.damageShare * 100,
      tone: 'ink' as const,
      hint: 'even split is 20%',
    },
    {
      label: 'Gold share',
      value: percent(g.goldShare),
      meter: g.goldShare * 100,
      tone: 'gold' as const,
      hint: 'even split is 20%',
    },
    { label: 'CS', value: g.csMin.toFixed(1), unit: '/min', tone: 'ink' as const },
    { label: 'Gold', value: compact(g.goldPerMinute), unit: '/min', tone: 'gold' as const },
    { label: 'Damage', value: compact(g.damagePerMinute), unit: '/min', tone: 'ink' as const },
    { label: 'Vision', value: g.visionMin.toFixed(2), unit: '/min', tone: 'ink' as const },
  ]
})
</script>

<template>
  <Card title="Performance" :note="stats ? `across ${stats.total} recent games` : undefined">
    <template #actions>
      <div v-if="form.length" class="flex items-center gap-2">
        <span class="num text-[0.6875rem] text-ink-3">
          {{ formRecord.wins }}W {{ formRecord.losses }}L
        </span>
        <div class="hidden gap-[2px] sm:flex" :title="`Last ${form.length} games, oldest first`">
          <span
            v-for="(win, index) in form"
            :key="index"
            class="h-3.5 w-[5px] rounded-[1px]"
            :class="win ? 'bg-win' : 'bg-loss'"
          />
        </div>
      </div>
    </template>

    <EmptyState
      v-if="!stats || stats.total === 0"
      message="No games analysed yet"
      hint="Hit Update to pull this player’s recent matches."
    />

    <div v-else class="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
      <StatCell
        v-for="cell in cells"
        :key="cell.label"
        :label="cell.label"
        :value="cell.value"
        :unit="cell.unit"
        :hint="cell.hint"
        :meter="cell.meter"
        :tone="cell.tone"
      />
    </div>
  </Card>
</template>
