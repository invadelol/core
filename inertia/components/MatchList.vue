<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useFormat } from '@invadelol/ui'
import GameRow from './GameRow.vue'
import { summaryOf, type MatchSummary } from '@invadelol/ui/logic'
import GameDetail from './GameDetail.vue'
import { afterPaint } from '../lib/after_paint.js'
import { detailOf } from '../lib/match.js'
import { selfTag, type SelfTag } from '../lib/self_tags.js'
import type { Match } from '../lib/types.js'

const props = defineProps<{
  matches: Match[]
  puuid: string
  gameName: string
  tagLine: string
  /**
   * Whether the viewer is this player: only then do clearly bad games get a self-deprecating tag.
   * Never on anyone else's profile.
   */
  ownProfile?: boolean
  /** Rows show the lane opponent instead of the team rating. */
  versus?: boolean
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
    rows: Array<{ match: Match; game: MatchSummary; tag: SelfTag | null }>
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
    group.rows.push({ match, game, tag: props.ownProfile ? selfTag(match, props.puuid) : null })
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
</script>

<template>
  <p v-if="!matches.length" class="flex items-center gap-3 py-6 text-[13px] text-ink-2">
    No games match these filters.
    <button type="button" class="iv-btn sm" @click="$emit('clear')">Clear filters</button>
  </p>

  <div v-else>
    <section v-for="day in days" :key="day.label">
      <h3 class="rd-day">
        <b>{{ day.label }}</b>
        <span class="num">
          {{ day.wins }}W {{ day.losses }}L<template v-if="day.lp !== null"
            >, {{ signedLp(day.lp) }} LP</template
          >
        </span>
      </h3>

      <ul class="rd-games">
        <li
          v-for="{ match, game, tag } in day.rows"
          :key="match.matchId"
          :class="{ open: open === match.matchId }"
        >
          <GameRow
            :match="match"
            :game="game"
            :puuid="puuid"
            :open="open === match.matchId"
            :versus="versus"
            @toggle="toggle(match.matchId)"
          />
          <p v-if="tag" class="self-tag">
            <span :title="tag.tip">{{ tag.label }}</span>
          </p>
          <GameDetail
            v-if="shown === match.matchId"
            class="rd-detail"
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

<style scoped>
/* The tag under the row it belongs to: quiet, like the row's own badges. */
.self-tag {
  padding: 4px 0 6px 14px;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--text-3);
}

.self-tag span {
  display: inline-block;
  padding: 1px 7px;
  background: var(--surface-1);
  border-radius: var(--r-xs);
}

.rd-detail {
  background: var(--rd-card);
  box-shadow: inset 0 0 0 1px var(--rd-line);
  border-radius: 0 0 8px 8px;
}
</style>
