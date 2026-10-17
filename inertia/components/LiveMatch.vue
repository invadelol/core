<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Radio, RefreshCw, CloudOff } from 'lucide-vue-next'
import { RankCrest, RoleIcon } from '@invadelol/ui'
import { positionName, queueName, rankLabel, rankValue, TIERS } from '@invadelol/ui/logic'
import LivePlayer from './LivePlayer.vue'
import { champIcon, championName } from '../lib/assets.js'
import { duration, UI_LOCALE } from '../lib/format.js'
import type { LiveGame } from '../lib/types.js'

const props = defineProps<{ puuid: string; name: string }>()

const game = ref<LiveGame | null>(null)
const loading = ref(true)
const error = ref('')
/** A background refresh failed while a game is on screen: the game stays, a quiet note says so. */
const stale = ref(false)
const checkedAt = ref('')
const now = ref(Date.now())

let controller: AbortController | undefined
let clock: ReturnType<typeof setInterval> | undefined
let poll: ReturnType<typeof setTimeout> | undefined

async function refresh(background = false, force = false) {
  clearTimeout(poll)
  controller?.abort()
  controller = new AbortController()
  const signal = controller.signal
  if (!background) {
    loading.value = true
    error.value = ''
  }
  try {
    const response = await fetch(
      `/api/summoners/puuid/${props.puuid}/live${force ? '?refresh=1' : ''}`,
      {
        signal,
        cache: 'no-store',
      }
    )
    if (!response.ok)
      throw new Error(response.status === 503 || response.status === 429 ? 'riot' : 'check')
    const data = await response.json()
    if (signal.aborted) return
    error.value = ''
    stale.value = false
    game.value = data.game
    checkedAt.value = new Date().toLocaleTimeString(UI_LOCALE, {
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch (e) {
    if (signal.aborted) return
    if (game.value) stale.value = true
    else error.value = (e as Error).message
  } finally {
    if (!signal.aborted) {
      loading.value = false
      poll = setTimeout(() => {
        if (document.visibilityState === 'visible') void refresh(true)
      }, 30_000)
    }
  }
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') void refresh(true)
}

/**
 * The poll, the clock and the listener are browser-only, so none of them may
 * start during SSR: a timer scheduled while rendering outlives the response
 * and fires inside the Node process, where `document` does not exist. That
 * throws outside any request, which takes the server down with it. The server
 * renders the loading state; the browser starts the polling.
 */
onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange)
  clock = setInterval(() => (now.value = Date.now()), 1000)
  watch(
    () => props.puuid,
    () => {
      game.value = null
      void refresh()
    },
    { immediate: true }
  )
})

onBeforeUnmount(() => {
  controller?.abort()
  clearInterval(clock)
  clearTimeout(poll)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

/** Riot sends no start time while the players are still loading in. */
const loadingIn = computed(() => !!game.value && !game.value.gameStartTime)
const elapsed = computed(() =>
  game.value?.gameStartTime
    ? Math.max(0, Math.floor((now.value - game.value.gameStartTime) / 1000))
    : Math.max(0, game.value?.gameLength ?? 0)
)

const MAPS: Record<number, string> = {
  11: "Summoner's Rift",
  12: 'Howling Abyss',
  30: 'Rings of Wrath',
}
const where = computed(() => {
  if (!game.value) return ''
  const map = MAPS[game.value.mapId ?? 0]
  const queue = queueName(game.value.gameQueueConfigId)
  return map && map !== queue ? `${queue} · ${map}` : queue
})

type Player = LiveGame['participants'][number]

/** A team's average Solo/Duo rank, when at least three of its players have one. */
function averageRank(players: Player[]) {
  const values = players
    .map((p) => (p.rank ? rankValue({ ...p.rank, lp: p.rank.leaguePoints }) : null))
    .filter((v): v is number => v !== null)
  if (values.length < 3) return null
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  if (mean >= 28)
    return { tier: 'MASTER', label: rankLabel({ tier: 'MASTER', division: '', lp: 0 }, false) }
  const tier = TIERS[Math.min(6, Math.floor(mean / 4))]
  const division = ['IV', 'III', 'II', 'I'][Math.floor(mean) % 4]
  return { tier, label: rankLabel({ tier, division, lp: 0 }, false) }
}

/** The viewed player's team on the left, the enemy on the right. */
const allyTeam = computed(
  () => game.value?.participants.find((p) => p.puuid === props.puuid)?.teamId ?? 100
)

const teams = computed(() => {
  const all = game.value?.participants ?? []
  return (['ally', 'enemy'] as const).map((side) => {
    const ally = side === 'ally'
    const players = all.filter((p) => (p.teamId === allyTeam.value) === ally)
    const teamId = players[0]?.teamId ?? (ally ? allyTeam.value : 300 - allyTeam.value)
    return {
      side,
      label: ally ? `${props.name}'s team` : 'Enemy team',
      mapSide: teamId === 100 ? 'Blue side' : teamId === 200 ? 'Red side' : '',
      average: averageRank(players),
      bans: (game.value?.bannedChampions ?? []).filter(
        (b) => b.teamId === teamId && b.championId > 0
      ),
      players,
    }
  })
})

/**
 * Lanes, Top to Support, the two players of each facing each other. The server seats each team in
 * lane order; a mode without lanes pairs the players as Riot lists them.
 */
const lanes = computed(() => {
  const [ally, enemy] = teams.value
  return Array.from({ length: Math.max(ally.players.length, enemy.players.length) }, (_, i) => {
    const a = ally.players[i]
    const e = enemy.players[i]
    const position = a?.position ?? e?.position ?? null
    const sure = Math.min(a?.positionConfidence ?? 1, e?.positionConfidence ?? 1)
    return { key: i, ally: a, enemy: e, position, likely: !!position && sure < 0.7 }
  })
})

const roleTitle = (lane: { position: Player['position']; likely: boolean }) =>
  lane.likely
    ? `${positionName(lane.position)}, likely: read from champions, spells and recent games`
    : positionName(lane.position)
</script>

<template>
  <section class="lv">
    <!-- Riot did not answer (or the check failed) and there is no game to keep showing. -->
    <div v-if="error" class="iv-panel lit-sheet lv-idle" role="alert">
      <span class="lv-idle-mark"><CloudOff :size="18" /></span>
      <h2>{{ error === 'riot' ? 'Riot is not answering' : 'Could not check this live game' }}</h2>
      <p>Live games come from Riot. Try again in a moment.</p>
      <button type="button" class="iv-btn sm" :disabled="loading" @click="refresh(false, true)">
        <RefreshCw :size="12" :class="{ 'animate-spin': loading }" />
        Retry
      </button>
    </div>

    <div v-else-if="loading && !game" class="lv-skel" aria-busy="true" aria-label="Checking">
      <div class="iv-skel lv-skel-head" />
      <div class="iv-skel lv-skel-board" />
    </div>

    <div v-else-if="!game" class="iv-panel lit-sheet lv-idle">
      <span class="lv-idle-mark"><Radio :size="18" /></span>
      <h2>{{ name }} is not in a game</h2>
      <p>The game shows here as soon as it starts.</p>
      <button type="button" class="iv-btn sm" :disabled="loading" @click="refresh(false, true)">
        <RefreshCw :size="12" :class="{ 'animate-spin': loading }" />
        Check now
      </button>
      <small class="lv-idle-note">
        Checked every 30 seconds<template v-if="checkedAt">, last at {{ checkedAt }}</template>
      </small>
    </div>

    <template v-else>
      <div class="section lv-head">
        <h2><span class="lv-dot" aria-hidden="true" />Live game</h2>
        <span class="meta">{{ where }}</span>
        <span class="lv-checked meta">
          {{ stale ? 'Could not refresh' : checkedAt ? `Updated ${checkedAt}` : '' }}
        </span>
        <button type="button" class="iv-btn sm" :disabled="loading" @click="refresh(false, true)">
          <RefreshCw :size="12" :class="{ 'animate-spin': loading }" />
          Refresh
        </button>
      </div>

      <div class="iv-panel lit-sheet lv-board">
        <header class="lv-teams">
          <div
            v-for="(team, t) in teams"
            :key="team.side"
            class="lv-team"
            :class="`is-${team.side}`"
            :style="{ gridColumn: t === 0 ? 1 : 3 }"
          >
            <span class="lv-team-name">
              <i class="lv-mark" aria-hidden="true" />
              <span class="truncate">{{ team.label }}</span>
            </span>
            <span class="lv-team-meta">
              <span v-if="team.mapSide">{{ team.mapSide }}</span>
              <span
                v-if="team.average"
                class="lv-avg"
                :title="`Average Solo/Duo rank: ${team.average.label}`"
              >
                <RankCrest :tier="team.average.tier" :size="14" />
                {{ team.average.label }} avg
              </span>
            </span>
            <span v-if="team.bans.length" class="lv-bans" :aria-label="`${team.label} bans`">
              <img
                v-for="(ban, i) in team.bans"
                :key="i"
                :src="champIcon(ban.championId)"
                :alt="championName(ban.championId)"
                :title="`Banned: ${championName(ban.championId)}`"
                class="thumb"
              />
            </span>
          </div>
          <div class="lv-clock" :title="loadingIn ? 'Players are loading in' : 'Game time'">
            <b class="fig">{{ loadingIn ? '0:00' : duration(elapsed) }}</b>
            <small>{{ loadingIn ? 'Loading in' : 'In game' }}</small>
          </div>
        </header>

        <ol class="lv-lanes">
          <li
            v-for="lane in lanes"
            :key="lane.key"
            class="lv-lane"
            :class="{
              'is-self-ally': lane.ally?.puuid === puuid,
              'is-self-enemy': lane.enemy?.puuid === puuid,
            }"
          >
            <LivePlayer
              v-if="lane.ally"
              :player="lane.ally"
              :enemy="false"
              :self="lane.ally.puuid === puuid"
              class="lv-ally"
            />
            <span v-else class="lv-ally" />
            <span class="lv-role" :title="roleTitle(lane)">
              <span v-if="lane.position" class="lv-role-key" :class="{ 'is-likely': lane.likely }">
                <RoleIcon :lane="lane.position" :size="16" />
              </span>
              <span v-if="lane.position" class="lv-role-name">{{
                positionName(lane.position)
              }}</span>
              <small v-if="lane.likely">likely</small>
            </span>
            <LivePlayer
              v-if="lane.enemy"
              :player="lane.enemy"
              :enemy="true"
              :self="lane.enemy.puuid === puuid"
            />
            <span v-else class="is-enemy" />
          </li>
        </ol>
      </div>
    </template>
  </section>
</template>

<style>
/* ── Live game: one lit sheet, the two teams facing each other lane by lane ── */
.lv-head {
  flex-wrap: wrap;
  align-items: center;
  row-gap: 4px;
}

.lv-head > h2 {
  display: inline-flex;
  align-items: center;
  gap: 9px;
}

.lv-checked {
  margin-left: auto;
}

.lv-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--brand);
  animation: lv-breathe 2.4s ease-in-out infinite;
}

@keyframes lv-breathe {
  50% {
    opacity: 0.35;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lv-dot {
    animation: none;
  }
}

/* The board: a header with both teams and the clock, then five lanes. */
.lv-board {
  container: lv-board / inline-size;
  overflow: hidden;
}

.lv-teams {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 128px minmax(0, 1fr);
  align-items: center;
  column-gap: 12px;
  padding: 16px 20px 14px;
}

.lv-team {
  display: grid;
  gap: 5px;
  min-width: 0;
  grid-row: 1;
}

.lv-team.is-enemy {
  justify-items: end;
  text-align: right;
}

.lv-team-name {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
  font-size: 14px;
  font-weight: 600;
  line-height: 18px;
  color: var(--text-1);
}

.lv-team.is-enemy .lv-team-name {
  flex-direction: row-reverse;
}

/* Ally or enemy, for the viewed player: the only colour on the board. */
.lv-mark {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--win);
}

.is-enemy > .lv-team-name > .lv-mark,
.lv-player.is-enemy .lv-side {
  background: var(--loss);
}

.lv-team-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}

.lv-team.is-enemy .lv-team-meta {
  justify-content: flex-end;
}

.lv-avg {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-2);
  white-space: nowrap;
}

.lv-bans {
  display: flex;
  gap: 3px;
  margin-top: 3px;
}

.lv-bans > img {
  width: 20px;
  height: 20px;
  border-radius: var(--r-xs);
  filter: grayscale(1);
  opacity: 0.6;
}

.lv-clock {
  display: grid;
  justify-items: center;
  gap: 6px;
  grid-column: 2;
  grid-row: 1;
}

.lv-clock > b {
  font-size: 28px;
  color: var(--text-1);
}

.lv-clock > small {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}

/* Lanes: ally | role | enemy, the champions meeting at the role. */
.lv-lanes {
  margin: 0;
  padding: 0;
  list-style: none;
}

.lv-lane {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 64px minmax(0, 1fr);
  align-items: stretch;
  min-height: 76px;
  border-top: 1px solid var(--line);
}

.lv-role {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 4px;
}

.lv-role-key {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  color: var(--text-2);
  background: var(--inset);
  border-radius: var(--r-sm);
  box-shadow: var(--inset-shadow);
}

.lv-role-key.is-likely {
  color: var(--text-3);
}

.lv-role > small {
  font-size: 11px;
  line-height: 12px;
  color: var(--text-4);
}

/* Said by the icon on a wide board; spelt out where the lane is a header (narrow). */
.lv-role-name {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* A player: rank and form on the outside, the champion at the role. */
.lv-player {
  display: grid;
  grid-template-columns: 104px 40px minmax(0, 1fr) 40px 44px;
  grid-template-areas: 'rank form id load face';
  align-items: center;
  column-gap: 8px;
  min-width: 0;
  padding: 12px 4px 12px 16px;
}

.lv-player.is-enemy {
  grid-template-columns: 44px 40px minmax(0, 1fr) 40px 104px;
  grid-template-areas: 'face load id form rank';
  padding: 12px 16px 12px 4px;
}

/* The viewed player: a pool of the brand light under their half, brightest at their champion. */
.lv-lane.is-self-ally {
  background: radial-gradient(
    34% 130% at 40% 50%,
    rgb(var(--brand-rgb) / calc(var(--sheet-light) * 2.4)),
    rgb(var(--brand-rgb) / 0)
  );
}

.lv-lane.is-self-enemy {
  background: radial-gradient(
    34% 130% at 60% 50%,
    rgb(var(--brand-rgb) / calc(var(--sheet-light) * 2.4)),
    rgb(var(--brand-rgb) / 0)
  );
}

.lv-face {
  grid-area: face;
  width: 44px;
  height: 44px;
}

.lv-player.is-self .lv-face {
  box-shadow:
    0 0 0 1.5px rgb(var(--brand-rgb) / 0.75),
    var(--portrait-sm);
}

/* Spells beside runes, two by two; mirrored on the enemy side so runes sit by the champion. */
.lv-load {
  grid-area: load;
  display: grid;
  grid-template-columns: 19px 19px;
  grid-auto-rows: 19px;
  gap: 2px;
  place-items: center;
}

.lv-player.is-enemy .lv-load {
  direction: rtl;
}

.lv-spell {
  width: 19px;
  height: 19px;
  border-radius: var(--r-xs);
}

.lv-rune {
  width: 19px;
  height: 19px;
}

.lv-tree {
  width: 13px;
  height: 13px;
  opacity: 0.8;
}

.lv-id {
  grid-area: id;
  display: grid;
  justify-items: end;
  gap: 3px;
  min-width: 0;
  text-align: right;
}

.lv-player.is-enemy .lv-id {
  justify-items: start;
  text-align: left;
}

.lv-name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
  font-size: 13.5px;
  line-height: 18px;
}

.lv-side {
  display: none;
  flex: none;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--win);
}

.lv-anon {
  font-weight: 500;
  color: var(--text-3);
}

.lv-sub {
  max-width: 100%;
  overflow: hidden;
  font-size: 12px;
  line-height: 16px;
  color: var(--text-3);
  white-space: nowrap;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}

.lv-champ {
  color: var(--text-2);
}

.lv-form {
  grid-area: form;
  display: grid;
  justify-items: center;
  gap: 2px;
}

.lv-form > b {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}

.lv-form > small {
  font-size: 11px;
  color: var(--text-4);
  white-space: nowrap;
}

.lv-rank {
  grid-area: rank;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.lv-player.is-enemy .lv-rank {
  flex-direction: row-reverse;
  text-align: right;
}

.lv-rank-text {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.lv-rank-text > b {
  overflow: hidden;
  font-size: 12.5px;
  font-weight: 600;
  line-height: 17px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.lv-rank-text > small {
  font-size: 12px;
  line-height: 15px;
  color: var(--text-3);
}

.lv-unranked {
  font-size: 12px;
  color: var(--text-4);
}

/* Medium: no room for the form column. */
@container lv-board (max-width: 860px) {
  .lv-player {
    grid-template-columns: 104px minmax(0, 1fr) 40px 44px;
    grid-template-areas: 'rank id load face';
  }

  .lv-player.is-enemy {
    grid-template-columns: 44px 40px minmax(0, 1fr) 104px;
    grid-template-areas: 'face load id rank';
  }

  .lv-form {
    display: none;
  }
}

/* Narrow (a phone, a tablet beside the rail): each lane a pair, ally over enemy, beside its role. */
@container lv-board (max-width: 700px) {
  .lv-teams {
    padding: 16px 16px 14px;
  }

  .lv-lane {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'role' 'ally' 'enemy';
    padding: 10px 10px 8px;
  }

  .lv-role {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 0 4px 8px;
  }

  .lv-role-key,
  .lv-role-key.is-likely {
    width: auto;
    height: auto;
    color: var(--text-3);
    background: none;
    box-shadow: none;
  }

  .lv-role-name {
    position: static;
    width: auto;
    height: auto;
    clip-path: none;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-3);
  }

  .lv-lane > .lv-ally {
    grid-area: ally;
  }

  .lv-lane > .is-enemy {
    grid-area: enemy;
  }

  .lv-lane > .lv-role {
    grid-area: role;
    justify-items: start;
  }

  .lv-player,
  .lv-player.is-enemy {
    grid-template-columns: 36px 36px minmax(0, 1fr) 100px;
    grid-template-areas: 'face load id rank';
    column-gap: 8px;
    padding: 6px 8px;
    border-radius: var(--r-sm);
  }

  .lv-lane.is-self-ally,
  .lv-lane.is-self-enemy {
    background: none;
  }

  .lv-player.is-self {
    background: linear-gradient(
      90deg,
      rgb(var(--brand-rgb) / calc(var(--sheet-light) * 2)),
      rgb(var(--brand-rgb) / 0) 85%
    );
  }

  .lv-face {
    width: 36px;
    height: 36px;
  }

  .lv-load {
    grid-template-columns: 17px 17px;
    grid-auto-rows: 17px;
  }

  .lv-player.is-enemy .lv-load {
    direction: ltr;
  }

  .lv-spell,
  .lv-rune {
    width: 17px;
    height: 17px;
  }

  .lv-tree {
    width: 12px;
    height: 12px;
  }

  .lv-id,
  .lv-player.is-enemy .lv-id {
    justify-items: start;
    text-align: left;
  }

  .lv-side {
    display: block;
  }

  .lv-rank,
  .lv-player.is-enemy .lv-rank {
    flex-direction: row;
    gap: 6px;
    text-align: left;
  }
}

/* A phone: the clock above the two teams; the portrait says the champion, its record gets the room. */
@container lv-board (max-width: 519px) {
  .lv-teams {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    row-gap: 14px;
    padding: 16px 14px 14px;
  }

  .lv-team {
    grid-row: 2;
  }

  .lv-team.is-enemy {
    grid-column: 2 !important;
  }

  .lv-clock {
    grid-column: 1 / -1;
    grid-row: 1;
    gap: 4px;
  }

  .lv-clock > b {
    font-size: 26px;
  }

  .lv-sub.has-record > :is(.lv-champ, .lv-sep) {
    display: none;
  }
}

@container lv-board (min-width: 520px) and (max-width: 700px) {
  .lv-player,
  .lv-player.is-enemy {
    grid-template-columns: 36px 36px minmax(0, 1fr) 40px 100px;
    grid-template-areas: 'face load id form rank';
  }

  .lv-form {
    display: grid;
  }
}

/* States: checking, not in a game, Riot not answering. */
.lv-idle-note {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-4);
}

.lv-skel {
  display: grid;
  gap: 8px;
}

.lv-skel-head {
  height: 32px;
  max-width: 360px;
}

.lv-skel-board {
  height: 492px;
  border-radius: var(--r-md);
}

.lv-idle {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 8px;
  min-height: 260px;
  padding: 40px 24px;
  text-align: center;
}

.lv-idle-mark {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  margin-bottom: 6px;
  color: var(--text-3);
  background: var(--inset);
  border-radius: var(--r-md);
  box-shadow: var(--inset-shadow);
}

.lv-idle > h2 {
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
  letter-spacing: -0.005em;
  color: var(--text-1);
}

.lv-idle > p {
  max-width: 400px;
  margin-bottom: 10px;
  font-size: 13px;
  line-height: 20px;
  color: var(--text-3);
}
</style>
