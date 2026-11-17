<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RoleIcon } from '@invadelol/ui'
import { positionOf } from '@invadelol/ui/logic'
import DuoDetail from './DuoDetail.vue'
import PlayerLink from './PlayerLink.vue'
import EmptyState from './ui/EmptyState.vue'
import Skeleton from './ui/Skeleton.vue'
import { champIcon, championName, championSplash, profileIcon } from '../lib/assets.js'
import { since } from '../lib/ladders.js'
import { roleLabel, type Partner, type SynergyReport } from '../lib/synergy.js'
import type { Summoner } from '../lib/types.js'

/**
 * The Friends tab, "How you queue": the games alone against the games with friends, split by
 * mate; a card for each regular mate (their best pair of champions together, the record, the
 * synergy, their next pairs); the premade groups and the people seen a few times; then one duo
 * opened in full with the games together. Everything is read by the server from the player's
 * latest stored games (lib/synergy.ts). A win rate or a synergy needs five games together.
 */
const props = defineProps<{
  report: SynergyReport | null
  profile: Summoner
  loading: boolean
  error: boolean
}>()

defineEmits<{ retry: [] }>()

/** Games together before a win rate or a synergy is shown. */
const MIN = 5
/** Games before the queue bar's legend gives a mate's win rate. */
const LEGEND_MIN = 10
const rate = (wins: number, games: number) => (games ? Math.round((wins / games) * 100) : 0)

/** "+4", "−3", "±0". */
function signed(value: number) {
  const rounded = Math.round(value)
  if (!rounded) return '±0'
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)}`
}
/** A synergy worth colouring: enough games and at least two points either way. */
const lean = (p: Partner) =>
  p.confidence === 'low' || Math.abs(p.synergy) < 2 ? 't3' : p.synergy > 0 ? 'wn' : 'ls'

const partners = computed(() => props.report?.partners ?? [])
const friends = computed(() => partners.value.filter((p) => p.tier !== 'occasional'))

/* ── How you queue ───────────────────────────────────────────── */
const queue = computed(() => {
  const r = props.report
  if (!r?.games) return null
  const pool = friends.value.length ? friends.value : partners.value
  const top = pool.slice(0, 3)
  const rest = pool.slice(3)
  const parts = top.map((p, i) => ({
    key: p.puuid,
    partner: p as Partner | null,
    name: p.gameName,
    icon: p.profileIconId,
    games: p.games,
    wins: p.wins,
    alpha: [0.62, 0.42, 0.32][i],
  }))
  if (rest.length) {
    const games = rest.reduce((s, p) => s + p.games, 0)
    parts.push({
      key: 'others',
      partner: null,
      name: 'Others',
      icon: rest[0].profileIconId,
      games,
      wins: rest.reduce((s, p) => s + p.wins, 0),
      alpha: 0.2,
    })
  }
  /* With friends, the report's own split; without, the few games seen with someone. */
  const withGames = friends.value.length
    ? r.friends.games
    : Math.min(
        r.games,
        top.reduce((s, p) => s + p.games, 0)
      )
  const withWins = friends.value.length ? r.friends.wins : top.reduce((s, p) => s + p.wins, 0)
  const alone = { games: r.games - withGames, wins: r.wins - withWins }
  return {
    parts: withGames ? parts : [],
    with: withGames,
    alone,
    share: (n: number) => Math.round((n / r.games) * 100),
    width: Math.max(0, Math.min(100, (withGames / 20) * 100)),
  }
})

/** With friends against alone, once there are enough games with friends to say. */
const versus = computed(() => {
  const r = props.report
  if (!r || r.friends.games < MIN || !friends.value.length) return null
  return {
    with: rate(r.friends.wins, r.friends.games),
    alone: r.alone.games ? rate(r.alone.wins, r.alone.games) : null,
    score: r.friends.score === null ? null : Math.round(r.friends.score),
    aloneScore: r.alone.score === null ? null : Math.round(r.alone.score),
  }
})

/* ── Mates ───────────────────────────────────────────────────── */
const mates = computed(() => partners.value.filter((p) => p.games >= MIN).slice(0, 3))
const shown = computed(() => new Set(mates.value.map((p) => p.puuid)))
const also = computed(() => partners.value.filter((p) => !shown.value.has(p.puuid)))
const allFew = computed(() => also.value.every((p) => p.games < MIN))
const CHIPS = 16
const everyone = ref(false)

function seats(p: Partner) {
  const pair = p.roles[0]
  const theirs = pair?.theirs ?? p.theirRole
  const mine = pair?.mine ?? p.myRole
  if (!theirs) return null
  return {
    lane: positionOf(theirs),
    text: mine ? `${roleLabel(theirs)}, you ${roleLabel(mine).toLowerCase()}` : roleLabel(theirs),
  }
}
const pairName = (pair: { mine: number; theirs: number }) =>
  `${championName(pair.mine)} + ${championName(pair.theirs)}`

/** "Cinder, Northwind". */
const groupName = (group: SynergyReport['groups'][number]) =>
  group.members.length >= 4 ? 'Full five' : group.members.map((m) => m.gameName).join(', ')
const groupKey = (group: { members: Array<{ puuid: string }> }) =>
  group.members.map((m) => m.puuid).join()
const openGroup = ref<string | null>(null)

/* ── The duo opened below ─────────────────────────────────────── */
const selected = ref<string | null>(null)
const duo = computed(() => partners.value.find((p) => p.puuid === selected.value) ?? null)

/** `?with=Name-Tag` keeps the open duo in the address, so it can be shared or reloaded. */
function fromAddress() {
  if (typeof window === 'undefined') return null
  const wanted = new URLSearchParams(window.location.search).get('with')?.toLowerCase()
  if (!wanted) return null
  return (
    partners.value.find((p) => `${p.gameName}-${p.tagLine}`.toLowerCase() === wanted)?.puuid ?? null
  )
}

watch(
  partners,
  (list) => {
    if (list.some((p) => p.puuid === selected.value)) return
    selected.value = fromAddress() ?? mates.value[0]?.puuid ?? null
  },
  { immediate: true }
)
onMounted(() => {
  const linked = fromAddress()
  if (linked) selected.value = linked
})

function pick(partner: Partner, scroll = true) {
  selected.value = partner.puuid
  const url = new URL(window.location.href)
  url.searchParams.set('with', `${partner.gameName}-${partner.tagLine}`)
  window.history.replaceState(window.history.state, '', url)
  if (!scroll) return
  void nextTick(() => {
    const target = document.getElementById('duo')
    if (!target) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' })
  })
}
</script>

<template>
  <div class="fq">
    <!-- Loading: the shape of what is coming -->
    <div v-if="!report && !error" class="fq" aria-busy="true">
      <article class="card" style="padding: 20px 24px"><Skeleton :height="150" /></article>
      <div class="mcards">
        <article v-for="n in 3" :key="n" class="card"><Skeleton :height="300" /></article>
      </div>
    </div>

    <article v-else-if="error && !report" class="card" role="alert">
      <EmptyState icon="users" title="Friends could not be loaded">
        <button type="button" class="btn sm" @click="$emit('retry')">Retry</button>
      </EmptyState>
    </article>

    <!-- Nothing stored yet -->
    <article v-else-if="report && !report.games" class="card">
      <EmptyState
        icon="users"
        title="No games yet"
        line="Once this player's games are stored, the people they play with show up here."
      />
    </article>

    <template v-else-if="report && queue">
      <!-- How you queue -->
      <section class="card lit fq-head" :aria-busy="loading">
        <div class="fq-h">
          <div class="col" style="gap: 4px">
            <h2 class="h3">How you queue</h2>
            <span class="meta num">Last {{ report.games }} games</span>
          </div>
          <div v-if="versus" class="fq-vs">
            <div class="col" style="gap: 4px">
              <span class="lab">Win rate with friends</span>
              <span class="fg-m num"
                >{{ versus.with }}%
                <span v-if="versus.alone !== null" class="meta"
                  >{{ versus.alone }}% alone</span
                ></span
              >
            </div>
            <div v-if="versus.score !== null" class="col" style="gap: 4px">
              <span class="lab">Score with friends</span>
              <span class="fg-m num"
                >{{ versus.score }}
                <span v-if="versus.aloneScore !== null" class="meta"
                  >{{ versus.aloneScore }} alone</span
                ></span
              >
            </div>
          </div>
        </div>
        <div class="qwrap">
          <div class="qalone">
            <span class="lab">Alone</span>
            <span class="fg-l num"
              >{{ queue.alone.games
              }}<span class="u">{{ queue.alone.games === 1 ? 'game' : 'games' }}</span></span
            >
            <span class="meta num"
              ><template v-if="queue.alone.games"
                >{{ rate(queue.alone.wins, queue.alone.games) }}% won · </template
              >{{ queue.share(queue.alone.games) }}% of your games</span
            >
          </div>
          <div class="grow" style="min-width: 0">
            <div class="row" style="gap: 8px">
              <span class="lab">{{ friends.length ? 'With friends' : 'With others' }}</span>
              <span class="meta num"
                >{{ queue.with }} {{ queue.with === 1 ? 'game' : 'games' }} ·
                {{ queue.share(queue.with) }}%</span
              >
            </div>
            <div v-if="queue.parts.length" class="qbox" :style="{ width: `${queue.width}%` }">
              <div class="qbar">
                <component
                  :is="part.partner ? 'button' : 'div'"
                  v-for="part in queue.parts"
                  :key="part.key"
                  :type="part.partner ? 'button' : undefined"
                  class="qm"
                  :class="{ on: part.partner && selected === part.key }"
                  :style="{ 'flex': part.games, '--a': part.alpha }"
                  :title="`${part.name}: ${part.games} games`"
                  @click="part.partner && pick(part.partner)"
                >
                  <img :src="profileIcon(part.icon)" alt="" width="30" height="30" />
                </component>
              </div>
              <div class="qleg">
                <div v-for="part in queue.parts" :key="part.key" :style="{ flex: part.games }">
                  <b>{{ part.name }}</b> {{ part.games
                  }}<template v-if="part.games >= LEGEND_MIN">
                    · {{ rate(part.wins, part.games) }}%</template
                  >
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Regular mates -->
      <div v-if="mates.length" class="mcards" :style="{ '--n': Math.max(2, mates.length) }">
        <button
          v-for="p in mates"
          :key="p.puuid"
          type="button"
          class="card mc"
          :class="{ on: selected === p.puuid }"
          :aria-pressed="selected === p.puuid"
          @click="pick(p)"
        >
          <span class="mc-art" :class="{ one: !p.champions[0] }">
            <template v-if="p.champions[0]">
              <img :src="championSplash(p.champions[0].mine)" alt="" loading="lazy" />
              <img :src="championSplash(p.champions[0].theirs)" alt="" loading="lazy" />
              <span class="pr num"
                >{{ pairName(p.champions[0]) }}, {{ p.champions[0].wins }}W
                {{ p.champions[0].games - p.champions[0].wins }}L</span
              >
            </template>
            <img
              v-else-if="p.theirChampions[0]"
              :src="championSplash(p.theirChampions[0])"
              alt=""
              loading="lazy"
            />
          </span>
          <span class="mc-b">
            <img class="por" :src="profileIcon(p.profileIconId)" alt="" width="52" height="52" />
            <span class="row mc-n">
              <b class="h4 ell">{{ p.gameName }}</b>
              <span class="t3 ell">#{{ p.tagLine }}</span>
              <span class="meta mc-when">{{ since(p.lastMs) }}</span>
            </span>
            <span v-if="seats(p)" class="meta row mc-seat"
              ><RoleIcon :lane="seats(p)!.lane" :size="13" />{{ seats(p)!.text }}</span
            >
            <span class="mc-wr">
              <b class="num">{{ rate(p.wins, p.games) }}%</b>
              <span class="meta num"
                >{{ p.wins }}W {{ p.games - p.wins }}L in {{ p.games }} games</span
              >
              <span
                class="mc-syn num"
                :class="lean(p)"
                :title="`${rate(p.wins, p.games)}% together, ${Math.round(p.baseline * 100)}% without`"
                >{{ signed(p.synergy) }}</span
              >
            </span>
            <span class="wrl mc-line"><i :style="{ width: `${rate(p.wins, p.games)}%` }" /></span>
            <span v-if="p.champions.length > 1" class="mc-pairs">
              <span
                v-for="pair in p.champions.slice(1, 3)"
                :key="`${pair.mine}:${pair.theirs}`"
                class="pair"
              >
                <span class="pp"
                  ><img :src="champIcon(pair.mine)" :alt="championName(pair.mine)" /><img
                    :src="champIcon(pair.theirs)"
                    :alt="championName(pair.theirs)"
                /></span>
                <span class="meta num ell">{{ pair.wins }}W {{ pair.games - pair.wins }}L</span>
                <b class="num">{{ pair.games >= MIN ? `${rate(pair.wins, pair.games)}%` : '' }}</b>
              </span>
            </span>
          </span>
        </button>
      </div>

      <!-- Groups, and the people seen a few times -->
      <div v-if="report.groups.length || also.length" class="fq-two">
        <article v-if="report.groups.length" class="card">
          <div class="card-h">
            <h2 class="h3">Groups</h2>
            <span class="meta">Three or more of you</span>
          </div>
          <div v-for="group in report.groups" :key="groupKey(group)">
            <button
              type="button"
              class="grp"
              :aria-expanded="openGroup === groupKey(group)"
              @click="openGroup = openGroup === groupKey(group) ? null : groupKey(group)"
            >
              <span class="gp">
                <img :src="profileIcon(profile.profileIconId)" alt="" />
                <img
                  v-for="member in group.members.slice(0, 4)"
                  :key="member.puuid"
                  :src="profileIcon(member.profileIconId)"
                  alt=""
                  loading="lazy"
                />
              </span>
              <span class="col" style="gap: 3px; min-width: 0">
                <span class="h5 ell">{{ groupName(group) }}</span>
                <span class="meta num"
                  >{{ group.games }} games · {{ group.wins }}W {{ group.games - group.wins }}L</span
                >
              </span>
              <b class="num">{{ group.games >= MIN ? `${rate(group.wins, group.games)}%` : '' }}</b>
            </button>
            <ul v-if="openGroup === groupKey(group)" class="grp-m">
              <li v-for="member in group.members" :key="member.puuid">
                <img :src="profileIcon(member.profileIconId)" alt="" width="22" height="22" />
                <PlayerLink :game-name="member.gameName" :tag-line="member.tagLine" show-tag />
              </li>
            </ul>
          </div>
        </article>

        <article v-if="also.length" class="card">
          <div class="card-h">
            <h2 class="h3">{{ mates.length ? 'Also with you' : 'Played with' }}</h2>
            <span v-if="allFew" class="meta">Fewer than {{ MIN }} games</span>
          </div>
          <ul class="chips">
            <li v-for="p in everyone ? also : also.slice(0, CHIPS)" :key="p.puuid">
              <button
                type="button"
                class="chip"
                :class="{ on: selected === p.puuid }"
                :aria-pressed="selected === p.puuid"
                @click="pick(p)"
              >
                <img :src="profileIcon(p.profileIconId)" alt="" loading="lazy" />{{ p.gameName
                }}<span class="n num">{{ p.games }}</span>
              </button>
            </li>
            <li v-if="also.length > CHIPS">
              <button type="button" class="chip more" @click="everyone = !everyone">
                {{ everyone ? 'Fewer' : `${also.length - CHIPS} more` }}
              </button>
            </li>
          </ul>
        </article>
      </div>

      <!-- One duo, opened -->
      <DuoDetail v-if="duo" id="duo" :key="duo.puuid" :partner="duo" :profile="profile" />
    </template>
  </div>
</template>

<style scoped>
.fq {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.fq-head {
  padding: 20px 24px 22px;
}
.fq-h {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.fq-vs {
  display: flex;
  gap: 36px;
  margin-left: auto;
}
.fq-vs .meta {
  margin-left: 4px;
  font-size: 13px;
}
.qwrap {
  display: flex;
  align-items: flex-end;
  gap: 36px;
  margin-top: 20px;
}
.qalone {
  display: flex;
  flex-direction: column;
  flex: none;
  gap: 6px;
  width: 230px;
  padding-right: 32px;
  border-right: 1px solid var(--line);
}
.qalone .u {
  margin-left: 6px;
  font-size: 0.55em;
  font-weight: 600;
  color: var(--t2);
}
.qbox {
  min-width: 120px;
}
.qbar {
  display: flex;
  gap: 3px;
  height: 54px;
  margin-top: 10px;
}
.qm {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  padding: 0 10px;
  border-radius: 8px;
  overflow: hidden;
  background: linear-gradient(
    180deg,
    rgb(var(--v-rgb) / calc(var(--a) + 0.08)),
    rgb(var(--v-rgb) / var(--a))
  );
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.16);
}
button.qm {
  cursor: pointer;
  transition: filter 140ms var(--ease);
}
button.qm:hover {
  filter: brightness(1.12);
}
.qm.on {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.16),
    inset 0 0 0 1.5px var(--v300);
}
.qm img {
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  box-shadow: var(--d-portrait, none);
}
.qleg {
  display: flex;
  gap: 3px;
  margin-top: 10px;
  font-size: 12.5px;
  font-weight: 650;
  color: var(--t3);
  font-variant-numeric: tabular-nums;
}
.qleg > div {
  min-width: 44px;
  padding: 0 4px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.qleg b {
  color: var(--t1);
}

/* Mates */
.mcards {
  display: grid;
  grid-template-columns: repeat(var(--n, 3), minmax(0, 1fr));
  gap: 16px;
}
.mc {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  text-align: left;
  color: inherit;
  cursor: pointer;
  transition: transform 160ms var(--ease);
}
.mc:hover {
  transform: translateY(-1px);
}
.mc.on {
  box-shadow:
    var(--d-lit, none),
    var(--d-drop, none),
    0 0 0 1.5px rgb(var(--v-rgb) / 0.7);
}
.mc-art {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  height: 112px;
  background: var(--s2);
}
.mc-art.one {
  grid-template-columns: 1fr;
}
.mc-art img {
  width: 100%;
  height: 112px;
  object-fit: cover;
  object-position: 50% 22%;
}
.mc-art::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgb(11 10 17 / 0.05), rgb(16 14 24 / 0.95));
}
:global([data-theme='light']) .mc-art::after {
  background: linear-gradient(180deg, rgb(255 255 255 / 0), rgb(255 255 255 / 0.96));
}
.mc-art .pr {
  position: absolute;
  right: 14px;
  bottom: 10px;
  z-index: 1;
  max-width: calc(100% - 92px);
  overflow: hidden;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--t2);
}
.mc-b {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 0 18px 18px;
}
.mc-b .por {
  position: relative;
  z-index: 2;
  width: 52px;
  height: 52px;
  margin-top: -26px;
  border-radius: 12px;
  background: var(--s3);
  box-shadow:
    0 0 0 3px var(--s1),
    0 2px 8px rgb(0 0 0 / 0.4);
}
.mc-n {
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  margin-top: 10px;
}
.mc-n .h4 {
  font-size: 16px;
  font-weight: 700;
}
.mc-n .t3 {
  font-weight: 500;
}
.mc-when {
  flex: none;
  margin-left: auto;
}
.mc-seat {
  gap: 6px;
  margin-top: 4px;
}
.mc-seat svg {
  opacity: 0.7;
}
.mc-wr {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 14px;
}
.mc-wr b {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.mc-syn {
  margin-left: auto;
  font-size: 14px;
  font-weight: 750;
}
.mc-line {
  margin-top: 12px;
}
.mc-pairs {
  display: flex;
  flex-direction: column;
  margin-top: 12px;
}
.pair {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) 44px;
  align-items: center;
  gap: 10px;
  height: 40px;
  font-size: 13.5px;
}
.pair + .pair {
  border-top: 1px solid var(--line);
}
.pair .meta {
  text-align: right;
}
.pair b {
  text-align: right;
}
.pp {
  display: flex;
}
.pp img {
  width: 26px;
  height: 26px;
  border-radius: 6px;
}
.pp img + img {
  margin-left: -4px;
  box-shadow: 0 0 0 2px var(--s1);
}

/* Groups and chips */
.fq-two {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  align-items: start;
}
.grp {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 52px;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 56px;
  padding: 6px 20px;
  border-top: 1px solid var(--line);
  text-align: left;
  color: inherit;
  cursor: pointer;
}
.grp:hover {
  background: rgb(var(--v-rgb) / 0.04);
}
.grp > b {
  text-align: right;
}
.gp {
  display: flex;
}
.gp img {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: var(--s3);
}
.gp img + img {
  margin-left: -8px;
  box-shadow: 0 0 0 2px var(--s1);
}
.grp-m {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 0;
  padding: 4px 20px 14px;
  list-style: none;
  font-size: 13px;
}
.grp-m li {
  display: flex;
  align-items: center;
  gap: 8px;
}
.grp-m img {
  border-radius: 5px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0 20px 20px;
  list-style: none;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 10px 0 5px;
  border-radius: 9px;
  background: var(--d-btn, var(--s2));
  box-shadow: var(--d-btn-sh, inset 0 0 0 1px var(--line-2));
  font-size: 13px;
  font-weight: 650;
  color: var(--t1);
  cursor: pointer;
}
.chip:hover {
  background: var(--d-btn-hover, var(--s3));
}
.chip.on {
  box-shadow:
    var(--d-btn-sh, none),
    inset 0 0 0 1.5px var(--v400);
}
.chip.more {
  padding: 0 12px;
  color: var(--t2);
}
.chip img {
  width: 26px;
  height: 26px;
  border-radius: 6px;
}
.chip .n {
  color: var(--t3);
}
@media (max-width: 1100px) {
  .mcards {
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  }
}
@media (max-width: 767px) {
  .fq-head {
    padding: 16px;
  }
  .fq-h {
    flex-direction: column;
  }
  .fq-vs {
    margin-left: 0;
    gap: 24px;
  }
  .qwrap {
    flex-direction: column;
    align-items: stretch;
    gap: 18px;
  }
  .qalone {
    width: auto;
    padding: 0 0 16px;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
  .qbox {
    width: 100% !important;
  }
  .mcards {
    grid-template-columns: minmax(0, 1fr);
  }
  .grp {
    padding: 6px 16px;
  }
  .chips {
    padding: 0 16px 16px;
  }
}
</style>
