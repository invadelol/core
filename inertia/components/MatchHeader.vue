<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import { Icon, ObjectiveIcon, useFormat, type ObjectiveIconName } from '@invadelol/ui'
import { queueName, type MatchDetail } from '@invadelol/ui/logic'
import { champIcon, championName, regionLabel } from '../lib/assets.js'
import { patchName } from '../lib/patch.js'
import type { Match } from '../lib/types.js'

/**
 * The top of a match page (Violet line): the way back to the player and the game's links, then
 * the scoreline: each side with its result, objectives and bans, the kills in the middle with the
 * queue, length and patch. Blue side on the left; each side's name says its result, blue for a
 * win and red for a loss.
 */
const props = defineProps<{
  detail: MatchDetail
  match: Pick<Match, 'matchId' | 'platform' | 'source' | 'verification' | 't1Bans' | 't2Bans'>
  puuid?: string
  /** The player whose profile led here, for the way back. */
  back?: { label: string; href: string } | null
}>()
const { ago, date, mmss } = useFormat()

/** One quiet line for games the desktop app recorded; Riot's own games need none. */
const provenance = computed(() => {
  if (props.match.source !== 'desktop') return ''
  return props.match.verification === 'verified'
    ? 'Recorded by the Invade app, verified by Riot'
    : 'Recorded by the Invade app'
})

const sides = computed(() =>
  [...props.detail.teams]
    .sort((a, b) => a.teamId - b.teamId)
    .map((team) => ({
      ...team,
      side: team.teamId === 100 ? 'Blue side' : team.teamId === 200 ? 'Red side' : 'Team',
      bans: (team.bans?.length
        ? team.bans
        : team.teamId === 100
          ? props.match.t1Bans
          : props.match.t2Bans
      )?.filter((id) => id > 0),
    }))
)

/** What each team took, on Summoner's Rift (the other maps have none of these). */
const OBJECTIVES: Array<{
  id: ObjectiveIconName
  key: 'towers' | 'dragons' | 'barons' | 'heralds'
  label: string
}> = [
  { id: 'tower', key: 'towers', label: 'towers' },
  { id: 'dragon', key: 'dragons', label: 'dragons' },
  { id: 'baron', key: 'barons', label: 'barons' },
]
const rift = computed(() => props.detail.mapId === 11)

const copied = ref<'' | 'link' | 'id'>('')
async function copy(what: 'link' | 'id') {
  try {
    await navigator.clipboard.writeText(what === 'id' ? props.match.matchId : location.href)
    copied.value = what
    setTimeout(() => (copied.value = ''), 1600)
  } catch {
    /* the address bar and the id stay selectable */
  }
}
async function share() {
  const data = { title: document.title, url: location.href }
  if (navigator.share) await navigator.share(data).catch(() => {})
  else void copy('link')
}
</script>

<template>
  <div class="crumbs">
    <nav aria-label="Breadcrumb">
      <template v-if="back">
        <Link :href="back.href">{{ back.label }}</Link>
        <span aria-hidden="true">/</span>
      </template>
      <b
        >{{ queueName(detail.queueId) }},
        <span class="num">{{
          date(detail.creation, { day: 'numeric', month: 'short', year: 'numeric' })
        }}</span></b
      >
    </nav>
    <div class="acts">
      <button type="button" class="iv-btn sm" @click="copy('link')">
        <Icon :name="copied === 'link' ? 'check' : 'copy'" :size="13" />
        {{ copied === 'link' ? 'Copied' : 'Copy link' }}
      </button>
      <button type="button" class="iv-btn sm" @click="share">Share</button>
    </div>
  </div>

  <header class="mh">
    <div
      v-for="(team, i) in sides"
      :key="team.teamId"
      class="ms"
      :class="[i ? 'r' : '', team.win ? 'won' : 'lost']"
    >
      <span>
        <h2>{{ team.side }}</h2>
        <small>{{ detail.remake ? 'Remake' : team.win ? 'Victory' : 'Defeat' }}</small>
        <span v-if="rift" class="ob num">
          <span v-for="o in OBJECTIVES" :key="o.id" :title="`${team[o.key]} ${o.label}`"
            ><ObjectiveIcon :name="o.id" :size="13" /><b>{{ team[o.key] }}</b
            >{{ o.label }}</span
          >
        </span>
        <span v-if="team.bans?.length" class="bans" :aria-label="`${team.side} bans`">
          <img
            v-for="(id, b) in team.bans"
            :key="b"
            :src="champIcon(id)"
            :alt="`Banned: ${championName(id)}`"
            :title="`Banned: ${championName(id)}`"
            width="24"
            height="24"
          />
        </span>
      </span>
    </div>
    <div class="mc2">
      <div class="rd-fig num">{{ sides[0]?.kills ?? 0 }}<i>:</i>{{ sides[1]?.kills ?? 0 }}</div>
      <small class="num"
        >{{ queueName(detail.queueId) }}, {{ mmss(detail.duration) }}, patch
        {{ patchName(detail.version) }}</small
      >
      <small class="num quiet"
        >{{ ago(detail.creation) }}, {{ regionLabel(match.platform)
        }}<template v-if="provenance">, {{ provenance }}</template></small
      >
      <button type="button" class="mid num" title="Copy match id" @click="copy('id')">
        {{ copied === 'id' ? 'Copied' : match.matchId }}
        <Icon name="copy" :size="11" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.crumbs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 48px;
  margin-top: 8px;
}
.crumbs nav {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
  color: var(--text-4);
}
.crumbs nav a {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text-2);
  text-decoration: none;
}
.crumbs nav a:hover {
  color: var(--text-1);
}
.crumbs nav b {
  overflow: hidden;
  font-weight: 500;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text-1);
}
.acts {
  display: flex;
  flex: none;
  gap: 8px;
}
.mh {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 28px;
  padding: 26px 28px;
  margin-top: 12px;
  border-radius: 12px;
  background:
    linear-gradient(90deg, var(--l), var(--rd-card) 38%, var(--rd-card) 62%, var(--r)),
    var(--rd-card);
  box-shadow: inset 0 0 0 1px var(--rd-line);
  --l: transparent;
  --r: transparent;
}
.mh:has(.ms:first-child.won) {
  --l: rgb(var(--win-rgb) / 0.13);
}
.mh:has(.ms:first-child.lost) {
  --l: rgb(var(--loss-rgb) / 0.1);
}
.mh:has(.ms.r.won) {
  --r: rgb(var(--win-rgb) / 0.13);
}
.mh:has(.ms.r.lost) {
  --r: rgb(var(--loss-rgb) / 0.1);
}
.ms {
  display: flex;
  align-items: center;
  gap: 18px;
  min-width: 0;
}
.ms.r {
  grid-column: 3;
  grid-row: 1;
  justify-content: flex-end;
  text-align: right;
}
.ms h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 650;
}
.ms.won h2 {
  color: var(--win);
}
.ms.lost h2 {
  color: var(--loss);
}
.ms small {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-3);
}
.ob {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin-top: 10px;
  font-size: 13px;
  color: var(--text-2);
}
.ob > span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.ob :deep(svg) {
  color: var(--text-3);
}
.ms.r .ob {
  justify-content: flex-end;
}
.ob b {
  margin-right: 1px;
  font-weight: 650;
  color: var(--text-1);
}
.bans {
  display: flex;
  gap: 4px;
  margin-top: 10px;
}
.ms.r .bans {
  justify-content: flex-end;
}
.bans img {
  width: 24px;
  height: 24px;
  border-radius: 5px;
  filter: grayscale(1) brightness(0.65);
}
.mc2 {
  grid-column: 2;
  grid-row: 1;
  display: grid;
  justify-items: center;
  text-align: center;
}
.mc2 .rd-fig {
  font-size: 52px;
  line-height: 1;
  letter-spacing: -0.02em;
}
.mc2 .rd-fig i {
  margin: 0 12px;
  font-style: normal;
  font-weight: 400;
  color: var(--text-4);
}
.mc2 small {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-3);
}
.mc2 small.quiet {
  margin-top: 2px;
  color: var(--text-4);
}
.mc2 .mid {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 4px;
  padding: 2px 4px;
  border: 0;
  font: 400 11px var(--font);
  color: var(--text-4);
  background: none;
  cursor: pointer;
}
.mc2 .mid:hover {
  color: var(--text-2);
}

@media (max-width: 900px) {
  .mh {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 18px 12px;
    padding: 20px 16px;
  }
  .mc2 {
    grid-column: 1 / -1;
    grid-row: 1;
  }
  .ms {
    grid-row: 2;
  }
  .ms.r {
    grid-column: 2;
    grid-row: 2;
  }
  .mc2 .rd-fig {
    font-size: 40px;
  }
  .ms h2 {
    font-size: 18px;
  }
  .ob {
    gap: 4px 10px;
    font-size: 12px;
  }
}
@media (max-width: 520px) {
  .crumbs {
    flex-wrap: wrap;
  }
}
</style>
