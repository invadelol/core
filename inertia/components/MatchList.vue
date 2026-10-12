<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { MatchRow, useFormat } from '@invadelol/ui'
import { summaryOf, type MatchSummary } from '@invadelol/ui/logic'
import GameDetail from './GameDetail.vue'
import { detailOf } from '../lib/match.js'
import type { Match } from '../lib/types.js'

const props = defineProps<{
  matches: Match[]
  puuid: string
  gameName: string
  tagLine: string
}>()

defineEmits<{ clear: [] }>()

const { dayLabel, signedLp } = useFormat()

/** Each stored game is read once, however often the list is recomputed. */
const summaries = new WeakMap<Match, MatchSummary | null>()
function summary(match: Match) {
  if (!summaries.has(match))
    summaries.set(match, summaryOf(detailOf(match), props.puuid, match.matchId))
  return summaries.get(match)!
}

/** One flat list of the shared rows, grouped by day, each day with its record. */
const days = computed(() => {
  const groups: Array<{
    label: string
    wins: number
    losses: number
    /** Net LP over the day's games whose change is known; null when none is. */
    lp: number | null
    rows: Array<{ match: Match; game: MatchSummary }>
  }> = []
  for (const match of props.matches) {
    const game = summary(match)
    if (!game) continue
    const label = dayLabel(game.creation)
    let group = groups[groups.length - 1]
    if (!group || group.label !== label) {
      group = { label, wins: 0, losses: 0, lp: null, rows: [] }
      groups.push(group)
    }
    group.rows.push({ match, game })
    if (typeof match.lpChange === 'number') group.lp = (group.lp ?? 0) + match.lpChange
    if (!game.remake) game.win ? group.wins++ : group.losses++
  }
  return groups
})

const open = shallowRef<string | null>(null)
const toggle = (id: string) => (open.value = open.value === id ? null : id)
</script>

<template>
  <p v-if="!matches.length" class="flex items-center gap-3 py-6 text-[13px] text-ink-2">
    No games match these filters.
    <button type="button" class="iv-btn sm" @click="$emit('clear')">Clear filters</button>
  </p>

  <div v-else>
    <section v-for="day in days" :key="day.label" class="iv-pf-day">
      <h3 class="iv-mr-day mb-2">
        {{ day.label }}
        <span class="num">
          {{ day.wins }}W {{ day.losses }}L
          <template v-if="day.lp !== null">· {{ signedLp(day.lp) }} LP</template>
        </span>
      </h3>

      <ul class="iv-mr-list">
        <li
          v-for="{ match, game } in day.rows"
          :key="match.matchId"
          class="iv-pf-match"
          :class="{ open: open === match.matchId }"
        >
          <MatchRow
            :game="game"
            :score="game.score"
            :lp="match.lpChange ?? null"
            :open="open === match.matchId"
            :puuid="puuid"
            @toggle="toggle(match.matchId)"
          />
          <GameDetail
            v-if="open === match.matchId"
            :match="match"
            :puuid="puuid"
            :game-name="gameName"
            :tag-line="tagLine"
          />
        </li>
      </ul>
    </section>
  </div>
</template>
