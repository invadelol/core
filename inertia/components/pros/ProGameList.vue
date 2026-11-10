<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { Link } from '@inertiajs/vue3'
import { summaryOf, type MatchSummary } from '@invadelol/ui/logic'
import GameDetail from '../GameDetail.vue'
import GameRow from '../GameRow.vue'
import '../../css/rd-players.css'
import Logo from '../champions/Logo.vue'
import { afterPaint } from '../../lib/after_paint.js'
import { detailOf } from '../../lib/match.js'
import type { Match } from '../../lib/types.js'

/** A stored game and the pro's own side in it (each game may be on another of their accounts). */
export interface ProGameMatch {
  match: Match
  puuid: string
  gameName: string
  tagLine: string
}

/** The other pros of a game, with or against the pro. */
export interface OtherPro {
  pro: {
    slug: string
    name: string
    photo?: string
    role?: string | null
    team?: { id: string; name: string; shortName?: string | null } | null
  }
  champion: number
  ally: boolean
}

/**
 * A pro's recent games, drawn like a profile's: the shared match rows, one height for every game.
 * Tapping a row opens the full game (scoreboard, breakdown, gold, timeline, builds) under it, with
 * the other pros of the game named above it. The rows read the visitor's clock (times, "11 h
 * ago"), so they are drawn once mounted; the server draws placeholders of the same size, so
 * nothing moves when they swap.
 */
const props = defineProps<{
  items: ProGameMatch[]
  filter: 'all' | 'wins' | 'losses'
  /** The other pros of each game, by match id. */
  pros: Record<string, OtherPro[] | undefined>
  championName: (id: number) => string
}>()

/** Each stored game is read once, however often the list is recomputed. */
const summaries = new WeakMap<Match, MatchSummary | null>()
function summary(item: ProGameMatch) {
  if (!summaries.has(item.match))
    summaries.set(item.match, summaryOf(detailOf(item.match), item.puuid, item.match.matchId))
  return summaries.get(item.match)!
}

const mounted = ref(false)
onMounted(() => (mounted.value = true))

const rows = computed(() =>
  props.items.flatMap((item) => {
    const game = summary(item)
    if (!game) return []
    if (props.filter !== 'all' && (game.remake || game.win !== (props.filter === 'wins'))) return []
    return [{ item, game }]
  })
)
/** Before mount: as many placeholders as rows the filter would show (the server's count). */
const placeholders = computed(() =>
  props.filter === 'all' ? props.items.length : Math.min(props.items.length, rows.value.length)
)

const open = shallowRef<string | null>(null)
/** The game whose detail is drawn, once its row has painted open (see MatchList). */
const shown = shallowRef<string | null>(null)
function toggle(id: string) {
  const next = open.value === id ? null : id
  open.value = next
  if (!next) return void (shown.value = null)
  afterPaint(() => open.value === next && (shown.value = next))
}

const sides = (id: string) =>
  [true, false]
    .map((ally) => ({ ally, list: (props.pros[id] ?? []).filter((x) => x.ally === ally) }))
    .filter((s) => s.list.length)
</script>

<template>
  <ul v-if="!mounted" class="rd-games" aria-busy="true">
    <li v-for="n in placeholders" :key="n" class="pg-skel"><span class="nb-skel" /></li>
  </ul>
  <p v-else-if="!rows.length" class="rd-card nb-empty">No game matches this filter.</p>
  <ul v-else class="rd-games">
    <li
      v-for="{ item, game } in rows"
      :key="item.match.matchId"
      :class="{ open: open === item.match.matchId }"
    >
      <GameRow
        :match="item.match"
        :game="game"
        :puuid="item.puuid"
        :open="open === item.match.matchId"
        :pros="pros[item.match.matchId] ?? []"
        kp
        @toggle="toggle(item.match.matchId)"
      />
      <template v-if="shown === item.match.matchId">
        <div class="pg-open">
          <p v-if="sides(item.match.matchId).length" class="pg-pros">
            <span v-for="s in sides(item.match.matchId)" :key="String(s.ally)"
              ><span class="q">{{ s.ally ? 'With' : 'Against' }}</span
              ><span v-for="x in s.list" :key="x.pro.slug" class="it"
                ><Link
                  :href="`/pro/${x.pro.slug}`"
                  :title="`${x.pro.name} on ${championName(x.champion)}`"
                  ><Logo v-if="x.pro.team" :team="x.pro.team" :size="16" />{{ x.pro.name }}</Link
                ></span
              ></span
            >
          </p>
          <GameDetail
            :match="item.match"
            :puuid="item.puuid"
            :game-name="item.gameName"
            :tag-line="item.tagLine"
          />
        </div>
      </template>
    </li>
  </ul>
</template>

<style scoped>
/* A row's placeholder, the row's size: 76px. */
.pg-skel {
  display: block;
}
.pg-skel > span {
  display: block;
  height: 76px;
  border-radius: 8px;
}
.pg-open {
  background: var(--rd-card);
  box-shadow: inset 0 0 0 1px var(--rd-line);
  border-radius: 0 0 8px 8px;
}

/* The other pros of the opened game, one quiet line between the row and its detail. */
.pg-pros {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
  padding: 10px 14px 2px;
  font-size: 12.5px;
  color: var(--text-1);
}
.pg-pros > span {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.pg-pros .it {
  display: inline-flex;
  align-items: center;
}
.pg-pros .it:not(:last-child)::after {
  content: ',';
  color: var(--nb-quiet, var(--text-3));
}
.pg-pros .q {
  margin-right: 2px;
  color: var(--nb-quiet, var(--text-3));
}
.pg-pros a {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-1);
  text-decoration: none;
}
.pg-pros a:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
