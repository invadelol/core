<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import Icon from '../../ui/Icon.vue'
import FormStrip from '../../ui/FormStrip.vue'
import { assetUrl, champIcon, championName, championSplash } from '../../../lib/assets.js'
import { isRemake } from '../../../lib/match.js'
import { championSlug } from '../../../lib/champions.js'
import type { ChampionStats, Match } from '../../../lib/types.js'

/**
 * The champion a player plays most, as their stored games play it: their record and KDA on it,
 * the items they finish most, their keystone and spells, their last games on it. `spotlight`
 * puts it before the champion's art; `compact` is the pro page's card.
 */
const props = withDefaults(
  defineProps<{
    matches: Match[]
    puuid: string
    /** Their most played champion of the season, when known. */
    champion?: number | null
    name: string
    /** The stored games' champion stats: the header's record when the main is among them. */
    stats?: ChampionStats[]
    mode?: 'compact' | 'spotlight'
  }>(),
  { champion: null, stats: () => [], mode: 'compact' }
)

/** Starters, trinkets, wards, potions, elixirs: never a build's core. */
const NOT_CORE = new Set([
  1054, 1055, 1056, 1082, 1083, 1101, 1102, 1103, 2003, 2031, 2033, 2055, 2138, 2139, 2140, 3340,
  3363, 3364, 3330, 3865, 3866, 3867, 3868, 3869, 3870, 3871, 3876, 3877,
])
const BOOTS = new Set([1001, 3005, 3006, 3009, 3010, 3013, 3020, 3047, 3111, 3117, 3158, 2422])
const byCount = <T,>(list: T[]) => {
  const n = new Map<string, { v: T; c: number }>()
  for (const v of list) {
    const k = JSON.stringify(v)
    const e = n.get(k) ?? { v, c: 0 }
    e.c++
    n.set(k, e)
  }
  return [...n.values()].sort((a, b) => b.c - a.c)
}

const games = computed(() =>
  props.matches.flatMap((m) => {
    if (m.queueId === 0 || isRemake(m)) return []
    const me = m.participants.find((p) => p.puuid === props.puuid)
    return me ? [{ m, me }] : []
  })
)
const main = computed(() => {
  const on = (id: number) => games.value.filter((g) => g.me.championId === id)
  if (props.champion && on(props.champion).length) return props.champion
  return byCount(games.value.map((g) => g.me.championId))[0]?.v ?? null
})
const build = computed(() => {
  if (!main.value) return null
  const on = games.value.filter((g) => g.me.championId === main.value)
  const wins = on.filter((g) => g.me.win).length
  const k = on.reduce((s, g) => s + g.me.kills, 0)
  const d = on.reduce((s, g) => s + g.me.deaths, 0)
  const a = on.reduce((s, g) => s + g.me.assists, 0)
  const items = byCount(
    on.flatMap((g) => [...new Set(g.me.items.filter((i) => i && !NOT_CORE.has(i)))])
  )
  const boots = items.find((i) => BOOTS.has(i.v))?.v ?? null
  const core = items
    .filter((i) => !BOOTS.has(i.v) && i.c >= Math.max(1, on.length * 0.3))
    .slice(0, 3)
    .map((i) => i.v)
  const keystone = byCount(on.map((g) => g.me.perks.keystone).filter(Boolean))[0]?.v ?? null
  const sub = byCount(on.map((g) => g.me.perks.sub).filter(Boolean))[0]?.v ?? null
  const spells = byCount(on.map((g) => [...g.me.spells].sort((x, y) => x - y)))[0]?.v ?? []
  return {
    games: on.length,
    wins,
    kda: ((k + a) / Math.max(1, d)).toFixed(2),
    avg: on.length
      ? `${(k / on.length).toFixed(1)} / ${(d / on.length).toFixed(1)} / ${(a / on.length).toFixed(1)}`
      : '',
    boots,
    core,
    keystone,
    sub,
    spells,
    form: on
      .slice(0, 10)
      .map((g) => g.me.win)
      .reverse(),
  }
})
/** Their record on it over every stored game, else over the loaded ones. */
const record = computed(() => {
  const s = props.stats.find((c) => c.championId === main.value)
  if (s && s.games >= (build.value?.games ?? 0))
    return { games: s.games, wins: s.wins, kda: s.kda.toFixed(2) }
  return build.value
    ? { games: build.value.games, wins: build.value.wins, kda: build.value.kda }
    : null
})
const slug = computed(() => (main.value ? championSlug(championName(main.value)) : ''))
</script>

<template>
  <!-- On the page ground like the summary beside it: a hairline above, no sheet. -->
  <section v-if="main && build" class="pl-gs pa-main" :class="mode">
    <div class="pl-sec-h">
      <h2 class="h4 ell">
        {{ mode === 'spotlight' ? 'Main champion' : `${name} on ${championName(main)}` }}
      </h2>
      <Link class="more r" :href="`/champions/${slug}`"
        >{{ championName(main) }}<Icon name="chevr" :size="14"
      /></Link>
    </div>
    <Link v-if="mode === 'spotlight'" class="fr pa-art" :href="`/champions/${slug}`"
      ><img :src="championSplash(main)" alt="" loading="lazy" /><span class="pa-cap"
        ><img :src="champIcon(main)" alt="" width="24" height="24" />{{ championName(main) }}</span
      ></Link
    >
    <div class="pa-head">
      <img
        v-if="mode === 'compact'"
        class="pa-ic"
        :src="champIcon(main)"
        alt=""
        width="36"
        height="36"
      />
      <span v-if="record" class="pa-figs">
        <span class="col"
          ><span class="fg-s num"
            >{{ Math.round((record.wins / Math.max(1, record.games)) * 100)
            }}<span class="u">%</span></span
          ><span class="meta num">{{ record.wins }}W {{ record.games - record.wins }}L</span></span
        >
        <span class="col"
          ><span class="fg-s num">{{ record.kda }}</span
          ><span class="meta num"
            >KDA, {{ record.games }} {{ record.games === 1 ? 'game' : 'games' }}</span
          ></span
        >
      </span>
    </div>
    <div v-if="build.core.length || build.boots" class="pa-kv">
      <span class="lab">Core</span>
      <span class="pa-its"
        ><img
          v-for="it in build.core"
          :key="it"
          :src="assetUrl('item', it)"
          alt=""
          loading="lazy" /><img
          v-if="build.boots"
          :src="assetUrl('item', build.boots)"
          alt=""
          loading="lazy"
      /></span>
    </div>
    <div v-if="build.keystone || build.spells.length" class="pa-kv">
      <span class="lab">Runes, spells</span>
      <span class="pa-its"
        ><img v-if="build.keystone" class="r" :src="assetUrl('rune', build.keystone)" alt="" /><img
          v-if="build.sub"
          class="r sm"
          :src="assetUrl('runeStyle', build.sub)"
          alt="" /><img v-for="s in build.spells" :key="s" :src="assetUrl('spell', s)" alt=""
      /></span>
    </div>
    <div class="pa-kv">
      <span class="lab">Last games on it</span>
      <FormStrip :results="build.form" small />
    </div>
  </section>
</template>
