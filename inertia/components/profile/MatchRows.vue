<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { MatchRow, useFormat } from '@invadelol/ui'
import { summaryOf, type MatchSummary } from '@invadelol/ui/logic'
import GameDetail from './GameDetail.vue'
import { afterPaint } from '../../lib/after_paint.js'
import { detailOf } from '../../lib/match.js'
import type { Match } from '../../lib/types.js'

/**
 * A profile's games as the shared rows (the desktop app's and the live site's), under the day they
 * were played with that day's record and LP. A row opens in place on the game's detail, with its
 * tabs, its link and the way to the match page.
 */
const props = defineProps<{ matches: Match[]; puuid: string; gameName: string; tagLine: string }>()

const { dayLabel, signedLp } = useFormat()

/** Each stored game is read once, however often the list is recomputed. */
const summaries = new WeakMap<Match, MatchSummary | null>()
function summary(match: Match) {
  if (!summaries.has(match))
    summaries.set(match, summaryOf(detailOf(match), props.puuid, match.matchId))
  return summaries.get(match)!
}

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
    let group = groups.at(-1)
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
/**
 * The game whose detail is drawn. It follows `open` once the tapped row has painted open: the
 * scoreboard is the heaviest thing on the page, and a phone would otherwise hold the tap until it
 * is built.
 */
const shown = shallowRef<string | null>(null)
function toggle(id: string) {
  const next = open.value === id ? null : id
  open.value = next
  if (!next) return void (shown.value = null)
  afterPaint(() => open.value === next && (shown.value = next))
}
/* Another player or another list: nothing stays open. */
watch(
  () => props.puuid,
  () => {
    open.value = null
    shown.value = null
  }
)
</script>

<template>
  <div class="mh-rows">
    <section v-for="day in days" :key="day.label" class="mh-grp">
      <h3 class="mh-day">
        <span class="lab">{{ day.label }}</span>
        <span class="meta num"
          >{{ day.wins }}W {{ day.losses }}L<template v-if="day.lp !== null">
            · {{ signedLp(day.lp) }} LP</template
          ></span
        >
      </h3>
      <ul class="mh-list">
        <li
          v-for="{ match, game } in day.rows"
          :key="match.matchId"
          class="iv-pf-match mh-it"
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
            v-if="shown === match.matchId"
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
