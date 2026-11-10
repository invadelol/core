<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import { positionName, rankLabel, tierColor } from '@invadelol/ui/logic'
import { assetUrl, championName, championSplash, nameOf } from '../lib/assets.js'
import { profilePath } from '../lib/format.js'
import type { LiveGame } from '../lib/types.js'

/**
 * One player of a live lane (Violet line): their champion's art fading in from the outer edge, its
 * name with the spells and keystone, the Riot ID, the rank line, what their stored games say
 * (main, duo, off role, a streak) and their win rate on the champion. A red side card is the
 * mirror of a blue one, so the two champions of a lane face each other.
 */
const props = defineProps<{
  player: LiveGame['participants'][number]
  red: boolean
  self: boolean
  /** The lane this player is seated in, for the off role tag. */
  lane: LiveGame['participants'][number]['position']
  /** Riot IDs of teammates queued with them, for the duo tag. */
  premade: string[]
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
const spell = (spellId: number) => nameOf('spell', spellId) ?? 'Summoner spell'

const season = computed(() => {
  const r = p.value.rank
  if (!r || r.wins == null || r.losses == null || r.wins + r.losses === 0) return null
  return Math.round((r.wins / (r.wins + r.losses)) * 100)
})

/** What their stored games say, only what they actually show. */
const tags = computed(() => {
  const out: Array<{ text: string; tone: string; tip: string }> = []
  const stats = p.value.championStats
  const share = p.value.championShare ?? 0
  if (stats && stats.games >= 5 && share >= 0.25)
    out.push({
      text: 'Main',
      tone: 'v',
      tip: `${Math.round(share * 100)}% of their stored games are on ${champ.value}`,
    })
  if (props.premade.length)
    out.push({ text: 'Duo', tone: '', tip: `Queued with ${props.premade.join(', ')}` })
  if (props.lane && p.value.mainPosition && p.value.mainPosition !== props.lane)
    out.push({
      text: 'Off role',
      tone: '',
      tip: `Usually plays ${positionName(p.value.mainPosition).toLowerCase()}`,
    })
  const streak = p.value.streak ?? 0
  if (Math.abs(streak) >= 3)
    out.push({
      text: streak > 0 ? `${streak} wins in a row` : `${-streak} losses in a row`,
      tone: '',
      tip: 'Their latest stored games',
    })
  if (!stats && p.value.puuid && !p.value.bot)
    out.push({
      text: `First ${champ.value} game`,
      tone: '',
      tip: 'None of their stored games are on it',
    })
  return out.slice(0, 3)
})
</script>

<template>
  <div class="lc" :class="{ rd: red, me: self }">
    <img class="art" :src="championSplash(p.championId)" alt="" loading="lazy" />

    <span class="cz">
      <b>{{ champ }}</b>
      <span class="ld">
        <img
          :src="assetUrl('spell', p.spell1Id)"
          :alt="spell(p.spell1Id)"
          :title="spell(p.spell1Id)"
        />
        <img
          :src="assetUrl('spell', p.spell2Id)"
          :alt="spell(p.spell2Id)"
          :title="spell(p.spell2Id)"
        />
        <img
          v-if="p.perks?.perkIds?.[0]"
          class="rn"
          :src="assetUrl('rune', p.perks.perkIds[0])"
          :alt="nameOf('rune', p.perks.perkIds[0]) ?? 'Keystone'"
          :title="nameOf('rune', p.perks.perkIds[0])"
        />
      </span>
    </span>

    <span class="pz">
      <b>
        <span v-if="p.bot" class="anon">Bot</span>
        <span v-else-if="!id.gameName" class="anon">Hidden player</span>
        <Link v-else-if="id.tagLine" :href="profilePath(id.gameName, id.tagLine)" class="nm"
          >{{ id.gameName }} <span>#{{ id.tagLine }}</span></Link
        >
        <template v-else>{{ id.gameName }}</template>
      </b>
      <span
        class="rk2 num"
        :title="
          p.rankStatus === 'unavailable'
            ? 'Rank could not be refreshed; any rank shown is the last known Solo/Duo rank'
            : undefined
        "
      >
        <template v-if="p.rank"
          ><em :style="{ color: tierColor(p.rank.tier) }">{{
            rankLabel({ tier: p.rank.tier, division: p.rank.division, lp: 0 }, false)
          }}</em
          >, {{ p.rank.leaguePoints }} LP<template v-if="season !== null"
            >, {{ season }}% win rate</template
          ></template
        >
        <template v-else-if="p.puuid && !p.bot">{{
          p.rankStatus === 'unranked' ? 'Unranked' : 'Rank unavailable'
        }}</template>
      </span>
      <span v-if="tags.length" class="tgs">
        <span
          v-for="tag in tags"
          :key="tag.text"
          class="rd-tag"
          :class="tag.tone"
          :title="tag.tip"
          >{{ tag.text }}</span
        >
      </span>
    </span>

    <span class="xz">
      <label>On {{ champ }}</label>
      <template v-if="p.championStats?.games">
        <span class="rd-fig">{{ Math.round(p.championStats.winrate * 100) }}%</span>
        <small class="num"
          >{{ p.championStats.games }} {{ p.championStats.games === 1 ? 'game' : 'games' }}</small
        >
      </template>
      <template v-else>
        <span class="rd-fig rd-flat">-</span>
        <small>no stored games</small>
      </template>
    </span>
  </div>
</template>

<style scoped>
.lc {
  position: relative;
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr) 108px;
  align-items: center;
  gap: 14px;
  min-width: 0;
  height: 118px;
  padding-right: 20px;
  overflow: hidden;
  border-radius: 10px;
  background: var(--rd-card);
  box-shadow: inset 0 0 0 1px var(--rd-line);
}
.lc.rd {
  grid-template-columns: 108px minmax(0, 1fr) 200px;
  padding: 0 0 0 20px;
}
.lc .art {
  position: absolute;
  top: 0;
  left: 0;
  width: 270px;
  height: 100%;
  object-fit: cover;
  object-position: 50% 18%;
  -webkit-mask-image: linear-gradient(90deg, #000 35%, transparent 100%);
  mask-image: linear-gradient(90deg, #000 35%, transparent 100%);
}
.lc.rd .art {
  left: auto;
  right: 0;
  -webkit-mask-image: linear-gradient(270deg, #000 35%, transparent 100%);
  mask-image: linear-gradient(270deg, #000 35%, transparent 100%);
}
.lc::before {
  content: '';
  position: absolute;
  z-index: 2;
  top: 0;
  bottom: 0;
  left: 0;
  width: 3px;
  background: var(--win);
}
.lc.rd::before {
  left: auto;
  right: 0;
  background: var(--loss);
}
.lc::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgb(9 9 16 / 0.55), rgb(9 9 16 / 0) 30%);
  pointer-events: none;
}
.lc.rd::after {
  background: linear-gradient(270deg, rgb(9 9 16 / 0.55), rgb(9 9 16 / 0) 30%);
}
.lc > *:not(.art) {
  position: relative;
  z-index: 1;
}
.lc.me {
  background: linear-gradient(90deg, var(--rd-card) 40%, var(--rd-violet-a));
  box-shadow: inset 0 0 0 1.5px var(--rd-violet);
}
.lc.rd.me {
  background: linear-gradient(270deg, var(--rd-card) 40%, var(--rd-violet-a));
}
.cz {
  align-self: end;
  padding: 0 0 12px 16px;
}
.rd .cz {
  order: 3;
  padding: 0 16px 12px 0;
  text-align: right;
}
.cz b {
  display: block;
  font-size: 17px;
  font-weight: 650;
  color: #fff;
  text-shadow: 0 1px 8px rgb(0 0 0 / 0.9);
}
.ld {
  display: flex;
  gap: 3px;
  margin-top: 6px;
}
.rd .ld {
  justify-content: flex-end;
}
.ld img {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 0.5);
}
.ld img.rn {
  border-radius: 999px;
  background: #07080b;
}
.pz {
  min-width: 0;
}
.rd .pz {
  order: 2;
  text-align: right;
}
.pz > b {
  display: block;
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text-1);
}
.pz .nm {
  color: inherit;
  text-decoration: none;
}
.pz .nm:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}
.pz .nm span,
.pz .anon {
  font-weight: 400;
  color: var(--text-3);
}
.rk2 {
  display: block;
  margin-top: 3px;
  overflow: hidden;
  font-size: 13px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text-3);
}
.rk2 em {
  font-style: normal;
  font-weight: 650;
}
.tgs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}
.rd .tgs {
  justify-content: flex-end;
}
.xz {
  text-align: right;
}
.rd .xz {
  order: 1;
  text-align: left;
}
.xz label {
  display: block;
  overflow: hidden;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text-3);
}
.xz .rd-fig {
  display: block;
  font-size: 26px;
  line-height: 1.15;
}
.xz small {
  display: block;
  font-size: 12px;
  color: var(--text-3);
}

@media (max-width: 1100px) {
  .lc,
  .lc.rd {
    grid-template-columns: 150px minmax(0, 1fr);
    height: auto;
    min-height: 104px;
    padding: 0 14px 0 0;
  }
  .lc.rd .art {
    left: 0;
    right: auto;
    -webkit-mask-image: linear-gradient(90deg, #000 30%, transparent 96%);
    mask-image: linear-gradient(90deg, #000 30%, transparent 96%);
  }
  .lc.rd::after {
    background: linear-gradient(90deg, rgb(9 9 16 / 0.55), rgb(9 9 16 / 0) 30%);
  }
  .lc .xz {
    display: none;
  }
  .rd .cz,
  .rd .pz {
    text-align: left;
  }
  .rd .cz {
    order: -1;
    padding: 0 0 12px 16px;
  }
  .rd .ld,
  .rd .tgs {
    justify-content: flex-start;
  }
  .lc.rd.me {
    background: linear-gradient(90deg, var(--rd-card) 40%, var(--rd-violet-a));
  }
}
@media (max-width: 480px) {
  .lc,
  .lc.rd {
    grid-template-columns: 112px minmax(0, 1fr);
    gap: 10px;
  }
  .lc .art {
    width: 200px;
  }
  .cz b {
    font-size: 15px;
  }
}
</style>
