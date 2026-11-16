<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import { positionOf, type Position } from '@invadelol/ui/logic'
import CardHead from '../ui/CardHead.vue'
import Frame from '../ui/Frame.vue'
import ScoreDial from '../ui/ScoreDial.vue'
import { champIcon, championName, profileIcon } from '../../lib/assets.js'
import { isRemake, scoreLobby } from '../../lib/match.js'
import { profilePath } from '../../lib/format.js'
import type { ChampionStats, Match, Teammate } from '../../lib/types.js'

/**
 * The profile's right column under Performance: champions (record, KDA, and the average score of
 * their loaded games on it), roles (share of the loaded games) and who they played with.
 */
const props = defineProps<{
  champions: ChampionStats[]
  matches: Match[]
  teammates: Teammate[]
  puuid: string
  championsHref: string
}>()

const scoreOn = computed(() => {
  const by = new Map<number, number[]>()
  for (const m of props.matches) {
    if (isRemake(m)) continue
    const me = m.participants.find((p) => p.puuid === props.puuid)
    const s = scoreLobby(m)[props.puuid]
    if (!me || !s) continue
    by.set(me.championId, [...(by.get(me.championId) ?? []), s.score])
  }
  return new Map(
    [...by].map(([c, list]) => [c, Math.round(list.reduce((a, b) => a + b, 0) / list.length)])
  )
})
const top = computed(() => props.champions.slice(0, 5))

const ROLE: Record<string, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MID: 'Mid',
  ADC: 'Bot',
  SUPPORT: 'Support',
}
const roles = computed(() => {
  const counts = new Map<Position, number>()
  for (const m of props.matches) {
    const lane = positionOf(m.participants.find((p) => p.puuid === props.puuid)?.position)
    if (lane) counts.set(lane, (counts.get(lane) ?? 0) + 1)
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .filter(([, n]) => n / total >= 0.05)
    .slice(0, 4)
    .map(([lane, n]) => ({ lane, name: ROLE[lane], v: Math.round((n / total) * 100) }))
})
const mates = computed(() => props.teammates.slice(0, 4))
</script>

<template>
  <article v-if="top.length" class="card">
    <CardHead
      title="Champions"
      icon="grid"
      meta="This season"
      :more="{ label: `All ${champions.length}`, href: championsHref }"
    />
    <Link v-for="c in top" :key="c.championId" class="pf-chp" :href="championsHref">
      <Frame :src="champIcon(c.championId)" :width="36" size="xs" />
      <div class="col" style="gap: 2px; min-width: 0">
        <span class="h5 ell">{{ championName(c.championId) }}</span>
        <span class="meta"
          >{{ c.games }} {{ c.games === 1 ? 'game' : 'games' }}, {{ c.kda.toFixed(1) }} KDA</span
        >
      </div>
      <div class="col" style="gap: 6px">
        <span class="meta" style="text-align: right"
          ><b class="t1">{{ Math.round(c.winrate * 100) }}%</b></span
        >
        <div class="split" style="height: 4px">
          <i :style="{ width: `${c.winrate * 100}%` }"></i><b></b>
        </div>
      </div>
      <ScoreDial :value="scoreOn.get(c.championId) ?? null" size="sm" />
    </Link>
  </article>
  <article v-if="roles.length" class="card">
    <CardHead title="Roles" icon="layers" :meta="`Last ${matches.length} games`" />
    <div class="col" style="gap: 12px; padding: 0 20px 20px">
      <div v-for="r in roles" :key="r.lane" class="pf-role">
        <RoleIcon :lane="r.lane" :size="16" />
        <span>{{ r.name }}</span>
        <div class="bar"><i :style="{ width: `${r.v}%` }"></i></div>
        <span class="fg-xs" style="text-align: right">{{ r.v }}%</span>
      </div>
    </div>
  </article>
  <article v-if="mates.length" class="card">
    <CardHead title="Played with" icon="users" meta="Recent games" />
    <Link
      v-for="m in mates"
      :key="m.puuid"
      class="lrow"
      :href="profilePath(m.gameName, m.tagLine)"
      style="min-height: 60px"
    >
      <Frame :src="profileIcon(m.profileIconId)" :width="36" size="xs" />
      <div class="col grow" style="gap: 2px; min-width: 0">
        <span class="h5 ell"
          >{{ m.gameName }} <span class="t3" style="font-weight: 500">#{{ m.tagLine }}</span></span
        >
        <span class="meta">{{ m.games }} games together</span>
      </div>
      <div class="col" style="gap: 6px; width: 92px">
        <span class="meta" style="text-align: right"
          ><b class="wn">{{ m.wins }}W</b> <b class="ls">{{ m.games - m.wins }}L</b></span
        >
        <div class="split" style="height: 4px">
          <i :style="{ width: `${(m.wins / Math.max(1, m.games)) * 100}%` }"></i><b></b>
        </div>
      </div>
    </Link>
  </article>
</template>
