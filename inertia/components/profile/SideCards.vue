<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import { positionOf, type Position } from '@invadelol/ui/logic'
import Icon from '../ui/Icon.vue'
import { champIcon, championName, profileIcon } from '../../lib/assets.js'
import { isRemake } from '../../lib/match.js'
import { profilePath } from '../../lib/format.js'
import type { ChampionStats, Match, Teammate } from '../../lib/types.js'

/**
 * The Overview rail under the rank: the five most played champions with their win rate, the
 * roles of the latest games, and who the player queues with (a win rate only from five games
 * together).
 */
const props = defineProps<{
  champions: ChampionStats[]
  matches: Match[]
  teammates: Teammate[]
  puuid: string
  championsHref: string
  friendsHref: string
}>()

const top = computed(() => props.champions.slice(0, 5))
const pct = (wins: number, games: number) => (games ? Math.round((wins / games) * 100) : 0)

const ROLES: Array<[Position, string]> = [
  ['TOP', 'Top'],
  ['JUNGLE', 'Jungle'],
  ['MID', 'Mid'],
  ['ADC', 'Bot'],
  ['SUPPORT', 'Support'],
]
const roles = computed(() => {
  const counts = new Map<Position, { games: number; wins: number }>()
  for (const m of props.matches) {
    if (m.queueId === 0 || isRemake(m)) continue
    const me = m.participants.find((p) => p.puuid === props.puuid)
    const lane = positionOf(me?.position)
    if (!me || !lane) continue
    const row = counts.get(lane) ?? { games: 0, wins: 0 }
    row.games++
    if (me.win) row.wins++
    counts.set(lane, row)
  }
  const laned = [...counts.values()].reduce((s, r) => s + r.games, 0)
  const most = Math.max(1, ...[...counts.values()].map((r) => r.games))
  return {
    laned,
    rows: ROLES.map(([lane, name]) => {
      const r = counts.get(lane) ?? { games: 0, wins: 0 }
      return { lane, name, ...r, width: (r.games / most) * 100 }
    }).sort((a, b) => b.games - a.games),
  }
})

/** Five games together before a win rate means anything. */
const MIN = 5
const mates = computed(() => props.teammates.slice(0, 3))
</script>

<template>
  <section v-if="top.length" class="card pl-sec">
    <div class="pl-sec-h">
      <h2 class="h4">Champions</h2>
      <Link class="more r" :href="championsHref"
        >All {{ champions.length }}<Icon name="chevr" :size="14"
      /></Link>
    </div>
    <Link v-for="c in top" :key="c.championId" class="pl-cr" :href="championsHref">
      <img class="pic" :src="champIcon(c.championId)" alt="" width="36" height="36" />
      <span class="col" style="gap: 4px; min-width: 0">
        <span class="h5 ell">{{ championName(c.championId) }}</span>
        <span class="meta num"
          >{{ c.games }} {{ c.games === 1 ? 'game' : 'games' }} · {{ c.kda.toFixed(1) }} KDA</span
        >
      </span>
      <span class="v">
        <b class="num">{{ pct(c.wins, c.games) }}%</b>
        <span class="meta num">{{ c.wins }}W {{ c.games - c.wins }}L</span>
      </span>
    </Link>
  </section>

  <section v-if="roles.laned" class="card pl-sec">
    <div class="pl-sec-h">
      <h2 class="h4">Roles</h2>
      <span class="meta num"
        >{{ roles.laned }} laned {{ roles.laned === 1 ? 'game' : 'games' }}</span
      >
    </div>
    <div v-for="r in roles.rows" :key="r.lane" class="pl-ro" :class="{ off: !r.games }">
      <RoleIcon :lane="r.lane" :size="16" />
      <span>{{ r.name }}</span>
      <div class="bar"><i :style="{ width: `${r.width}%` }" /></div>
      <span class="meta num" style="text-align: right"
        >{{ r.games }} {{ r.games === 1 ? 'game' : 'games' }}</span
      >
      <span class="r">{{ r.games ? `${pct(r.wins, r.games)}%` : '–' }}</span>
    </div>
  </section>

  <section v-if="mates.length" class="card pl-sec">
    <div class="pl-sec-h">
      <h2 class="h4">Played with</h2>
      <Link class="more r" :href="friendsHref"
        >All {{ teammates.length }}<Icon name="chevr" :size="14"
      /></Link>
    </div>
    <Link
      v-for="m in mates"
      :key="m.puuid"
      class="pl-cr"
      :href="profilePath(m.gameName, m.tagLine)"
    >
      <img class="pic" :src="profileIcon(m.profileIconId)" alt="" width="36" height="36" />
      <span class="col" style="gap: 4px; min-width: 0">
        <span class="h5 ell"
          >{{ m.gameName }}<span class="t3" style="font-weight: 500"> #{{ m.tagLine }}</span></span
        >
        <span class="meta num">{{ m.games }} games together</span>
      </span>
      <span v-if="m.games >= MIN" class="v">
        <b class="num">{{ pct(m.wins, m.games) }}%</b>
        <span class="meta num">{{ m.wins }}W {{ m.games - m.wins }}L</span>
      </span>
      <span v-else class="v"
        ><span class="meta num">{{ m.wins }}W {{ m.games - m.wins }}L</span></span
      >
    </Link>
  </section>
</template>
