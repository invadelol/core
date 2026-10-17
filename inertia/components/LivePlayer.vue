<script setup lang="ts">
import { computed } from 'vue'
import { RankCrest } from '@invadelol/ui'
import { rankLabel, tierColor } from '@invadelol/ui/logic'
import PlayerLink from './PlayerLink.vue'
import { assetUrl, champIcon, championName, nameOf } from '../lib/assets.js'
import type { LiveGame } from '../lib/types.js'

/**
 * One player of a live lane: champion, spells and runes, Riot ID, their record on the champion,
 * recent form and rank. `mirrored` lays it out right to left (the enemy half of a lane), so the
 * two champions face each other across the lane's role.
 */
const props = defineProps<{
  player: LiveGame['participants'][number]
  enemy: boolean
  self: boolean
}>()

const p = computed(() => props.player)

/** "Name#Tag" as Riot sends it for a live lobby, split for linking. */
const id = computed(() => {
  const riotId = p.value.riotId ?? ''
  const hash = riotId.indexOf('#')
  return hash < 1
    ? { gameName: riotId, tagLine: '' }
    : { gameName: riotId.slice(0, hash), tagLine: riotId.slice(hash + 1) }
})

const champ = computed(() => championName(p.value.championId))
const record = computed(() => {
  const s = p.value.championStats
  if (!s?.games) return ''
  return `${Math.round(s.winrate * 100)}% in ${s.games} ${s.games === 1 ? 'game' : 'games'}`
})
const form = computed(() => {
  const r = p.value.recent
  return r?.games ? { rate: Math.round((r.wins / r.games) * 100), games: r.games } : null
})
const ranked = computed(() => {
  const r = p.value.rank
  if (!r || r.wins == null || r.losses == null || r.wins + r.losses === 0) return ''
  return `${Math.round((r.wins / (r.wins + r.losses)) * 100)}% · ${r.wins + r.losses} games`
})
const spell = (id: number) => nameOf('spell', id) ?? 'Summoner spell'
</script>

<template>
  <div class="lv-player" :class="{ 'is-enemy': enemy, 'is-self': self }">
    <span class="lv-face portrait" :title="champ">
      <img :src="champIcon(p.championId)" :alt="champ" />
    </span>

    <span class="lv-load">
      <img
        :src="assetUrl('spell', p.spell1Id)"
        :alt="spell(p.spell1Id)"
        :title="spell(p.spell1Id)"
        class="lv-spell thumb"
      />
      <img
        v-if="p.perks?.perkIds?.[0]"
        :src="assetUrl('rune', p.perks.perkIds[0])"
        :alt="nameOf('rune', p.perks.perkIds[0]) ?? 'Keystone'"
        :title="nameOf('rune', p.perks.perkIds[0])"
        class="lv-rune"
      />
      <i v-else />
      <img
        :src="assetUrl('spell', p.spell2Id)"
        :alt="spell(p.spell2Id)"
        :title="spell(p.spell2Id)"
        class="lv-spell thumb"
      />
      <img
        v-if="p.perks?.perkSubStyle"
        :src="assetUrl('runeStyle', p.perks.perkSubStyle)"
        :alt="nameOf('runeStyle', p.perks.perkSubStyle) ?? 'Secondary tree'"
        :title="nameOf('runeStyle', p.perks.perkSubStyle)"
        class="lv-tree"
      />
      <i v-else />
    </span>

    <span class="lv-id">
      <span class="lv-name">
        <i class="lv-side" aria-hidden="true" />
        <span v-if="p.bot" class="lv-anon">Bot</span>
        <span v-else-if="!id.gameName" class="lv-anon">Hidden player</span>
        <PlayerLink v-else v-bind="id" :is-self="self" class="lv-link" />
      </span>
      <span class="lv-sub" :class="{ 'has-record': record }">
        <span class="lv-champ">{{ champ }}</span>
        <template v-if="record"><span class="lv-sep"> · </span>{{ record }}</template>
      </span>
    </span>

    <span class="lv-form" :title="form ? `Won ${form.rate}% of the last ${form.games} games` : ''">
      <template v-if="form">
        <b class="num">{{ form.rate }}%</b>
        <small>last {{ form.games }}</small>
      </template>
    </span>

    <span
      class="lv-rank"
      :title="
        p.rankStatus === 'unavailable'
          ? 'Rank could not be refreshed; any rank shown is the last known Solo/Duo rank'
          : ranked
            ? `Solo/Duo: ${ranked}`
            : 'No Solo/Duo rank'
      "
    >
      <template v-if="p.rank">
        <RankCrest :tier="p.rank.tier" :size="24" />
        <span class="lv-rank-text">
          <b :style="{ color: tierColor(p.rank.tier) }">{{
            rankLabel({ tier: p.rank.tier, division: p.rank.division, lp: 0 }, false)
          }}</b>
          <small class="num">{{ p.rank.leaguePoints }} LP</small>
        </span>
      </template>
      <span v-else-if="p.puuid && !p.bot" class="lv-unranked">{{
        p.rankStatus === 'unranked' ? 'Unranked' : 'Rank unavailable'
      }}</span>
    </span>
  </div>
</template>
