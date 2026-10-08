<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import MatchRow from './MatchRow.vue'
import { loadChampions, loadItems, loadRunes } from '../lib/assets.js'
import { dayLabel } from '../lib/format.js'
import { isRemake } from '../lib/match.js'
import type { Match } from '../lib/types.js'

const props = defineProps<{
  matches: Match[]
  puuid: string
  summonerSlug: string
}>()

defineEmits<{ clear: [] }>()

const expanded = ref<string | null>(null)

onMounted(() => {
  loadChampions()
  loadItems()
  loadRunes()
})

/** One flat list, grouped by day, each day with its record. */
const days = computed(() => {
  const groups: Array<{ label: string; wins: number; losses: number; matches: Match[] }> = []
  for (const match of props.matches) {
    const label = dayLabel(match.gameStartMs)
    let group = groups[groups.length - 1]
    if (!group || group.label !== label) {
      group = { label, wins: 0, losses: 0, matches: [] }
      groups.push(group)
    }
    group.matches.push(match)
    const me = match.participants.find((p) => p.puuid === props.puuid)
    if (me && !isRemake(match)) me.win ? group.wins++ : group.losses++
  }
  return groups
})

function toggle(matchId: string) {
  expanded.value = expanded.value === matchId ? null : matchId
}
</script>

<template>
  <p v-if="!matches.length" class="flex items-center gap-3 py-6 text-[13px] text-ink-2">
    No games match these filters.
    <button class="btn btn-sm" @click="$emit('clear')">Clear filters</button>
  </p>

  <div v-else>
    <section v-for="day in days" :key="day.label" class="mt-5 first:mt-0">
      <h3 class="mb-2 flex items-baseline justify-between gap-3 px-0.5 text-[12px] font-semibold">
        <span class="text-ink-2">{{ day.label }}</span>
        <span class="num font-medium text-ink-3">{{ day.wins }}W {{ day.losses }}L</span>
      </h3>

      <div class="grid gap-1">
        <MatchRow
          v-for="match in day.matches"
          :key="match.matchId"
          :match="match"
          :puuid="puuid"
          :summoner-slug="summonerSlug"
          :expanded="expanded === match.matchId"
          @toggle="toggle(match.matchId)"
        />
      </div>
    </section>
  </div>
</template>
