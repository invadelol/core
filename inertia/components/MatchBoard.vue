<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { Link } from '@inertiajs/vue3'
import { ChampIcon, PerfDial, PlayerDetail, RoleIcon, useFormat, useNames } from '@invadelol/ui'
import type { MatchDetail, PlayerView } from '@invadelol/ui/logic'
import { profilePath } from '../lib/format.js'

/**
 * The match page's scoreboard (Violet line): one sheet per team, the viewed player's first, each
 * player on a row with their pick, KDA, damage to champions on a bar against the game's best,
 * gold, farm, vision, items and Invade score (MVP and ACE marked). A row opens that player's
 * detail right below it.
 */
const props = defineProps<{ detail: MatchDetail; puuid: string }>()

const { compact, kdaRatio, score100 } = useFormat()
const { spellIcon, runeIcon, styleIcon, itemIcon, champName, itemName } = useNames()

const me = computed(() => props.detail.players.find((p) => p.puuid === props.puuid))
const most = computed(() => Math.max(1, ...props.detail.players.map((p) => p.damage)))

const teams = computed(() =>
  [...props.detail.teams]
    .sort((a, b) =>
      a.teamId === me.value?.teamId ? -1 : b.teamId === me.value?.teamId ? 1 : a.teamId - b.teamId
    )
    .map((team) => ({
      team,
      label: `${team.teamId === 100 ? 'Blue side' : team.teamId === 200 ? 'Red side' : 'Team'}, ${
        props.detail.remake ? 'remake' : team.win ? 'victory' : 'defeat'
      }`,
      players: props.detail.players.filter((p) => p.teamId === team.teamId),
    }))
)

const open = shallowRef<string | null>(null)
const toggle = (p: PlayerView) => (open.value = open.value === p.puuid ? null : p.puuid)

const items = (p: PlayerView) => {
  const list = p.items.slice(0, 6)
  while (list.length < 6) list.push(0)
  return list
}
const place = (p: PlayerView): '' | 'mvp' | 'ace' =>
  p.badges.includes('mvp') ? 'mvp' : p.badges.includes('ace') ? 'ace' : ''
</script>

<template>
  <div class="mb">
    <template v-for="t in teams" :key="t.team.teamId">
      <div class="th">
        <h3 :class="t.team.win ? 'rd-up' : 'rd-dn'">{{ t.label }}</h3>
        <span class="num"
          >{{ compact(t.team.gold) }} gold, {{ t.team.damage.toLocaleString('en-US') }} damage</span
        >
      </div>
      <section class="rd-card tbw">
        <div class="tbl">
          <div class="sb h" aria-hidden="true">
            <span /><span>Pick</span><span>Player</span><span>KDA</span><span>Damage</span
            ><span class="r">Gold</span><span class="r">CS</span><span class="r">Vision</span
            ><span>Items</span><span>Score</span>
          </div>
          <template v-for="p in t.players" :key="p.puuid">
            <button
              type="button"
              class="sb"
              :class="{ me: p.puuid === puuid, open: open === p.puuid }"
              :aria-expanded="open === p.puuid"
              :aria-label="`${p.gameName || champName(p.championId)}, open their game`"
              @click="toggle(p)"
            >
              <RoleIcon v-if="p.position" :lane="p.position" :size="16" class="ri" />
              <span v-else />
              <span class="gc">
                <ChampIcon :id="p.championId" :size="40" :level="p.level" />
                <span
                  ><img v-for="(s, i) in p.spells.slice(0, 2)" :key="i" :src="spellIcon(s)" alt=""
                /></span>
                <span>
                  <img v-if="p.perks[0]" class="rn" :src="runeIcon(p.perks[0])" alt="" />
                  <img v-if="p.styles[1]" class="rn sub" :src="styleIcon(p.styles[1])" alt="" />
                </span>
              </span>
              <span class="pn">
                <b>{{ p.gameName || champName(p.championId) }}</b>
                <small v-if="p.tagLine" class="num">#{{ p.tagLine }}</small>
              </span>
              <span class="gk">
                <b class="num"
                  >{{ p.kills }}<i>/</i><em>{{ p.deaths }}</em
                  ><i>/</i>{{ p.assists }}</b
                >
                <span class="num">{{ kdaRatio(p.kills, p.deaths, p.assists) }} KDA</span>
              </span>
              <span class="dm">
                <b class="num">{{ p.damage.toLocaleString('en-US') }}</b>
                <span class="rd-bar quiet"
                  ><i :style="{ width: `${(p.damage / most) * 100}%` }"
                /></span>
              </span>
              <span class="r num">{{ compact(p.gold) }}</span>
              <span class="r num">{{ p.cs }}</span>
              <span class="r num">{{ p.vision }}</span>
              <span class="gi">
                <template v-for="(id, i) in items(p)" :key="i">
                  <img v-if="id" :src="itemIcon(id)" :alt="itemName(id)" :title="itemName(id)" />
                  <span v-else />
                </template>
                <img v-if="p.items[6]" class="tk" :src="itemIcon(p.items[6])" alt="" />
              </span>
              <span class="dz">
                <PerfDial
                  v-if="p.score !== null"
                  size="sm"
                  :score="score100(p.score)"
                  :rank="p.rank"
                  :tag="place(p)"
                />
                <span v-if="place(p)" class="rd-tag g">{{
                  place(p) === 'mvp' ? 'MVP' : 'ACE'
                }}</span>
              </span>
            </button>
            <div v-if="open === p.puuid" class="pd iv-md">
              <div class="pd-top">
                <Link
                  v-if="p.gameName && p.tagLine"
                  :href="profilePath(p.gameName, p.tagLine)"
                  class="rd-more"
                  >{{ p.gameName }}'s profile</Link
                >
              </div>
              <PlayerDetail :detail="detail" :player="p" :me="me" />
            </div>
          </template>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.th {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 22px 2px 8px;
}
.th h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 650;
}
.th span {
  font-size: 12px;
  color: var(--text-3);
}
.tbw {
  overflow-x: auto;
  container-type: inline-size;
}
.tbl {
  min-width: 1080px;
}
.sb {
  display: grid;
  grid-template-columns:
    18px 104px minmax(120px, 1.1fr) 96px minmax(120px, 1fr) 56px 48px 48px
    232px 48px;
  gap: 14px;
  align-items: center;
  width: 100%;
  height: 60px;
  padding: 0 16px;
  border: 0;
  font: inherit;
  font-size: 13px;
  text-align: left;
  color: var(--text-1);
  background: none;
}
button.sb {
  cursor: pointer;
}
button.sb:hover {
  background: var(--surface-1);
}
.sb + .sb,
.pd + .sb {
  box-shadow: inset 0 1px 0 var(--rd-line);
}
.sb.h {
  height: 36px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
  box-shadow: inset 0 -1px 0 var(--rd-line);
}
.sb.me {
  background: var(--rd-violet-a);
  box-shadow:
    inset 2px 0 0 var(--rd-violet),
    inset 0 1px 0 var(--rd-line);
}
.sb:focus-visible {
  outline: 2px solid var(--rd-violet);
  outline-offset: -2px;
}
.sb .r {
  text-align: right;
}
.sb > span {
  min-width: 0;
}
.ri {
  color: var(--text-3);
}
.gc {
  display: flex;
  align-items: center;
  gap: 4px;
}
.gc :deep(.iv-champ) {
  border-radius: 8px;
}
.gc > span:not(.iv-champ) {
  display: grid;
  gap: 3px;
}
.gc > span:not(.iv-champ) img {
  width: 18px;
  height: 18px;
  border-radius: 4px;
}
.gc img.rn {
  border-radius: 999px;
  background: #07080b;
}
.gc img.sub {
  padding: 2px;
}
.pn b {
  display: block;
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.pn small {
  font-size: 12px;
  color: var(--text-3);
}
.gk {
  display: grid;
  font-size: 12px;
  color: var(--text-3);
}
.gk b {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
}
.gk b i {
  margin: 0 3px;
  font-style: normal;
  font-weight: 400;
  color: var(--text-4);
}
.gk b em {
  font-style: normal;
  color: var(--loss);
}
.dm b {
  font-size: 13px;
  font-weight: 650;
}
.dm .rd-bar {
  margin-top: 5px;
}
.gi {
  display: flex;
  align-items: center;
  gap: 3px;
}
.gi img,
.gi > span {
  flex: none;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.08);
}
.gi > span {
  background: var(--inset);
}
.gi img.tk {
  width: 22px;
  height: 22px;
  margin-left: 5px;
  border-radius: 999px;
}
.dz {
  position: relative;
  display: flex;
  justify-content: center;
}
.dz .rd-tag {
  position: absolute;
  left: 50%;
  bottom: -9px;
  height: 15px;
  padding: 0 5px;
  font-size: 9px;
  transform: translateX(-50%);
}
.pd {
  position: sticky;
  left: 0;
  max-width: 100cqw;
  padding: 4px 16px 16px;
  background: var(--surface-1);
  box-shadow: inset 0 1px 0 var(--rd-line);
}
.pd-top {
  display: flex;
  justify-content: flex-end;
  padding: 8px 0 4px;
}
</style>
