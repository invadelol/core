<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import Icon from '../ui/Icon.vue'
import FormStrip from '../ui/FormStrip.vue'
import { assetUrl, champIcon, championName } from '../../lib/assets.js'
import { isRemake } from '../../lib/match.js'
import { championSlug } from '../../lib/champions.js'
import type { ChampionStats, Match } from '../../lib/types.js'

/**
 * "<Name> on <Champion>": how a player plays the champion they play most, like a pro's page shows
 * it: their record and KDA on it, the finished items and boots they buy most, their keystone and
 * spells, their last games on it. Read from the Summoner's Rift games the profile loaded; the
 * record from every stored game when the season's stats hold more of them.
 */
const props = withDefaults(
  defineProps<{
    matches: Match[]
    puuid: string
    /** Their most played champion of the season, when known. */
    champion?: number | null
    name: string
    /** The stored games' champion stats. */
    stats?: ChampionStats[]
    /** Finished items and boots on the newest patch; without them, a list of starters is left out. */
    items?: { legendary: number[]; boots: number[] } | null
  }>(),
  { champion: null, stats: () => [], items: null }
)

/** Starters, trinkets, wards, potions, elixirs: never a build's core when the patch is unknown. */
const NOT_CORE = new Set([
  1054, 1055, 1056, 1082, 1083, 1101, 1102, 1103, 2003, 2031, 2033, 2055, 2138, 2139, 2140, 3340,
  3363, 3364, 3330, 3865, 3866, 3867, 3868, 3869, 3870, 3871, 3876, 3877,
])
const BOOTS = new Set([1001, 3005, 3006, 3009, 3010, 3013, 3020, 3047, 3111, 3117, 3158, 2422])
const SUMMONERS_RIFT = 11

const legendary = computed(() => new Set(props.items?.legendary ?? []))
const boots = computed(() => (props.items?.boots.length ? new Set(props.items.boots) : BOOTS))
const isBoots = (id: number) => boots.value.has(id)
const isCore = (id: number) =>
  legendary.value.size ? legendary.value.has(id) : !NOT_CORE.has(id) && !isBoots(id)

/** The values of a list by how often they come, most first. */
const byCount = <T,>(list: T[]) => {
  const counts = new Map<string, { v: T; c: number }>()
  for (const v of list) {
    const k = JSON.stringify(v)
    const e = counts.get(k) ?? { v, c: 0 }
    e.c++
    counts.set(k, e)
  }
  return [...counts.values()].sort((a, b) => b.c - a.c)
}

const games = computed(() =>
  props.matches.flatMap((m) => {
    if (m.queueId === 0 || m.mapId !== SUMMONERS_RIFT || isRemake(m)) return []
    const me = m.participants.find((p) => p.puuid === props.puuid)
    return me ? [{ m, me }] : []
  })
)
/** The season's main when the loaded games hold it, else the loaded games' most played. */
const main = computed(() => {
  if (props.champion && games.value.some((g) => g.me.championId === props.champion))
    return props.champion
  return byCount(games.value.map((g) => g.me.championId))[0]?.v ?? null
})
const build = computed(() => {
  if (!main.value) return null
  const on = games.value.filter((g) => g.me.championId === main.value)
  const k = on.reduce((s, g) => s + g.me.kills, 0)
  const d = on.reduce((s, g) => s + g.me.deaths, 0)
  const a = on.reduce((s, g) => s + g.me.assists, 0)
  const bought = byCount(on.flatMap((g) => [...new Set(g.me.items.filter(Boolean))]))
  return {
    games: on.length,
    wins: on.filter((g) => g.me.win).length,
    kda: ((k + a) / Math.max(1, d)).toFixed(2),
    boots: bought.find((i) => isBoots(i.v))?.v ?? null,
    core: bought
      .filter((i) => isCore(i.v) && i.c >= Math.max(1, on.length * 0.3))
      .slice(0, 3)
      .map((i) => i.v),
    keystone: byCount(on.map((g) => g.me.perks.keystone).filter(Boolean))[0]?.v ?? null,
    sub: byCount(on.map((g) => g.me.perks.sub).filter(Boolean))[0]?.v ?? null,
    spells: byCount(on.map((g) => [...g.me.spells].sort((x, y) => x - y)))[0]?.v ?? [],
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
  <section v-if="main && build && record" class="pl-gs pa-main">
    <div class="pl-sec-h">
      <h2 class="h4 ell">{{ name }} on {{ championName(main) }}</h2>
      <Link class="more r" :href="`/champions/${slug}`">Build<Icon name="chevr" :size="14" /></Link>
    </div>
    <div class="pa-head">
      <img class="pa-ic" :src="champIcon(main)" alt="" width="36" height="36" />
      <span class="pa-figs">
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
    <div v-if="build.form.length > 1" class="pa-kv">
      <span class="lab">Last games on it</span>
      <FormStrip :results="build.form" small />
    </div>
  </section>
</template>
