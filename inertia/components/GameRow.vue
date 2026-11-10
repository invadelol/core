<script setup lang="ts">
import { computed } from 'vue'
import { ChampIcon, PerfDial, useFormat, useInvadeUi, useNames } from '@invadelol/ui'
import {
  queueName,
  queueShort,
  rowTeamRating,
  TEAM_RATINGS,
  teamTip,
  type MatchSummary,
} from '@invadelol/ui/logic'
import type { Match } from '../lib/types.js'

/**
 * One game of a player's feed (Violet line): the champion with its spells and runes, the result,
 * the KDA, farm and the team's rating, the build, both teams with the player ringed, and the
 * Invade score. The whole row opens the game's detail, drawn by the parent right below it.
 */
const props = defineProps<{
  match: Match
  game: MatchSummary
  puuid: string
  open?: boolean
  /** Show the lane opponent instead of the team rating (a champion's own list). */
  versus?: boolean
}>()

defineEmits<{ toggle: [] }>()

const { t } = useInvadeUi()
const { mmss, signedLp, kdaRatio, score100, ordinal } = useFormat()
const { spellIcon, runeIcon, styleIcon, itemIcon, champName, champIcon } = useNames()

const result = computed(() => (props.game.remake ? 'Remake' : props.game.win ? 'Win' : 'Loss'))
const verdict = computed(() => rowTeamRating(props.game, props.game.score))
const tone = (v: NonNullable<typeof verdict.value>) =>
  v.rating === 'great' || v.rating === 'good' ? 'b' : v.rating === 'average' ? '' : 'r'

/** Both teams, the player's own first, five by five. */
const teams = computed(() => {
  const me = props.match.participants.find((p) => p.puuid === props.puuid)
  const ids = [...new Set(props.match.participants.map((p) => p.teamId))]
  if (me) ids.sort((a, b) => (a === me.teamId ? -1 : b === me.teamId ? 1 : 0))
  return ids.flatMap((id) =>
    props.match.participants
      .filter((p) => p.teamId === id)
      .slice(0, 5)
      .map((p) => ({ id: p.championId, me: p.puuid === props.puuid, name: p.gameName }))
  )
})
const fiveByFive = computed(() => teams.value.length === 10)

const items = computed(() => {
  const list = props.game.items.slice(0, 6)
  while (list.length < 6) list.push(0)
  return list
})
const trinket = computed(() => props.game.items[6] ?? 0)
const score = computed(() => (props.game.score ? score100(props.game.score.score) : null))
const place = computed(() => props.game.score?.tag || '')
const opponent = computed(() => props.game.score?.opponent ?? null)
</script>

<template>
  <button
    type="button"
    class="g2"
    :class="[game.remake ? 'rm' : game.win ? 'w' : 'l', { open, nd: score === null }]"
    :aria-expanded="open"
    :aria-label="`${champName(game.championId)}, ${result}, ${game.kills}/${game.deaths}/${game.assists}, ${queueName(game.queueId, t)}`"
    @click="$emit('toggle')"
  >
    <span class="gc">
      <ChampIcon :id="game.championId" :size="48" :level="game.level || null" />
      <span>
        <img
          v-for="(s, i) in game.spells.slice(0, 2)"
          :key="i"
          :src="spellIcon(s)"
          alt=""
          width="22"
          height="22"
        />
      </span>
      <span>
        <img
          v-if="game.keystone"
          class="rn"
          :src="runeIcon(game.keystone)"
          alt=""
          width="22"
          height="22"
        />
        <img
          v-if="game.subStyle"
          class="rn sub"
          :src="styleIcon(game.subStyle)"
          alt=""
          width="22"
          height="22"
        />
      </span>
    </span>

    <span class="gr" :title="queueName(game.queueId, t)">
      <b>{{ result }}</b>
      <span class="num">{{
        typeof match.lpChange === 'number'
          ? `${signedLp(match.lpChange)} LP`
          : queueShort(game.queueId, t)
      }}</span>
      <span class="num">{{ mmss(game.duration) }}</span>
    </span>

    <span class="gk">
      <b class="num"
        >{{ game.kills }}<i>/</i><em class="d">{{ game.deaths }}</em
        ><i>/</i>{{ game.assists }}</b
      >
      <span class="num">{{ kdaRatio(game.kills, game.deaths, game.assists) }} KDA</span>
    </span>

    <span class="gx num">
      <span
        ><b>{{ game.csMin.toFixed(1) }}</b> CS/min</span
      >
      <span v-if="versus && opponent" class="vs">vs {{ champName(opponent) }}</span>
      <span
        v-else-if="verdict"
        class="rd-tag"
        :class="tone(verdict)"
        :title="teamTip(verdict, game.win, t)"
        >{{ TEAM_RATINGS[verdict.rating].label }}</span
      >
    </span>

    <span class="gi">
      <template v-for="(id, i) in items" :key="i">
        <img v-if="id" :src="itemIcon(id)" alt="" width="28" height="28" />
        <span v-else />
      </template>
      <img v-if="trinket" class="tk" :src="itemIcon(trinket)" alt="" width="24" height="24" />
    </span>

    <span v-if="fiveByFive" class="gt">
      <img
        v-for="(p, i) in teams"
        :key="i"
        :class="{ me: p.me }"
        :src="champIcon(p.id)"
        alt=""
        :title="`${champName(p.id)}${p.name ? `, ${p.name}` : ''}`"
        width="18"
        height="18"
        loading="lazy"
      />
    </span>
    <span v-else class="gt" />

    <span v-if="score !== null" class="gd">
      <PerfDial
        :score="score"
        :rank="game.score?.rank"
        :tag="place"
        :title="
          place === 'mvp'
            ? 'MVP'
            : place === 'ace'
              ? 'ACE'
              : game.score?.rank
                ? ordinal(game.score.rank)
                : undefined
        "
      />
    </span>
  </button>
</template>
