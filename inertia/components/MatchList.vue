<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import MatchRow from './MatchRow.vue'
import { loadChampions, loadItems, loadRunes } from '../lib/assets.js'
import { dayLabel } from '../lib/format.js'
import type { Match } from '../lib/types.js'

const props = defineProps<{
  matches: Match[]
  puuid: string
  summonerSlug: string
}>()

const expanded = ref<string | null>(null)

onMounted(() => {
  loadChampions()
  loadItems()
  loadRunes()
})

/** One flat list, banded by day, rather than fifteen separate cards. */
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
    if (me) me.win ? group.wins++ : group.losses++
  }
  return groups
})

function toggle(matchId: string) {
  expanded.value = expanded.value === matchId ? null : matchId
}
</script>

<template>
  <div v-if="!matches.length" class="card py-16 text-center">
    <p class="display text-[17px] text-ink">No matches here</p>
    <p class="mx-auto mt-1.5 max-w-[46ch] text-[12px] leading-relaxed text-ink-3">
      Nothing matches these filters.
    </p>
  </div>

  <div v-else class="space-y-5">
    <section v-for="day in days" :key="day.label">
      <div class="mb-2 flex items-baseline justify-between gap-3 px-1">
        <span class="label !text-ink-2">{{ day.label }}</span>
        <span class="num stat text-[12.5px]">
          <b class="text-win">{{ day.wins }}W</b>
          <b class="ml-1.5 text-loss">{{ day.losses }}L</b>
        </span>
      </div>

      <div class="space-y-1.5">
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
