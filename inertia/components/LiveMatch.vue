<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Radio, RefreshCw, CloudOff } from 'lucide-vue-next'
import { RoleIcon } from '@invadelol/ui'
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
  return map && map !== queue ? `${queue}, ${map}` : queue
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

/** Blue side on the left, red side on the right, as the map is drawn. */
const teams = computed(() => {
  const all = game.value?.participants ?? []
  const ids = [...new Set(all.map((p) => p.teamId))].sort((x, y) => x - y)
  return [0, 1].map((t) => {
    const teamId = ids[t] ?? (t ? 200 : 100)
    const players = all.filter((p) => p.teamId === teamId)
    return {
      teamId,
      label: teamId === 100 ? 'Blue side' : teamId === 200 ? 'Red side' : `Team ${t + 1}`,
      mine: players.some((p) => p.puuid === props.puuid),
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
  const [blue, red] = teams.value
  return Array.from({ length: Math.max(blue.players.length, red.players.length) }, (_, i) => {
    const b = blue.players[i]
    const r = red.players[i]
    const position = b?.position ?? r?.position ?? null
    const sure = Math.min(b?.positionConfidence ?? 1, r?.positionConfidence ?? 1)
    return { key: i, blue: b, red: r, position, likely: !!position && sure < 0.7 }
  })
})

/** Riot IDs of the teammates a player queued with. */
function premadeOf(player: Player) {
  const ids = new Set(player.premade ?? [])
  return (game.value?.participants ?? [])
    .filter((p) => p.puuid && ids.has(p.puuid))
    .map((p) => p.riotId?.split('#')[0] || 'a teammate')
}

/** The two teams side by side: average rank, season win rate, games on their champions. */
const balance = computed(() => {
  const [blue, red] = teams.value
  const rankOf = (players: Player[]) => {
    const values = players
      .map((p) => (p.rank ? rankValue({ ...p.rank, lp: p.rank.leaguePoints }) : null))
      .filter((v): v is number => v !== null)
    return values.length >= 3 ? values.reduce((a, b) => a + b, 0) / values.length : null
  }
  const winOf = (players: Player[]) => {
    const rated = players.filter((p) => p.rank?.wins != null && p.rank?.losses != null)
    const games = rated.reduce((n, p) => n + p.rank!.wins! + p.rank!.losses!, 0)
    const wins = rated.reduce((n, p) => n + p.rank!.wins!, 0)
    return rated.length >= 3 && games ? Math.round((wins / games) * 100) : null
  }
  const gamesOf = (players: Player[]) =>
    players.reduce((n, p) => n + (p.championStats?.games ?? 0), 0)
  const split = (a: number | null, b: number | null) =>
    a === null || b === null || a + b <= 0 ? 50 : (a / (a + b)) * 100
  const rows = []
  const ra = rankOf(blue.players)
  const rb = rankOf(red.players)
  if (ra !== null && rb !== null && blue.average && red.average)
    rows.push({
      label: 'Average rank',
      a: blue.average.label,
      b: red.average.label,
      share: split(ra + 1, rb + 1),
    })
  const wa = winOf(blue.players)
  const wb = winOf(red.players)
  if (wa !== null && wb !== null)
    rows.push({ label: 'Season win rate', a: `${wa}%`, b: `${wb}%`, share: split(wa, wb) })
  const ga = gamesOf(blue.players)
  const gb = gamesOf(red.players)
  if (ga + gb > 0)
    rows.push({
      label: 'Games on their champions',
      a: String(ga),
      b: String(gb),
      share: split(ga, gb),
    })
  return rows
})

const roleTitle = (lane: { position: Player['position']; likely: boolean }) =>
  lane.likely
    ? `${positionName(lane.position)}, likely: read from champions, spells and recent games`
    : positionName(lane.position)
</script>

<template>
  <section class="lv">
    <!-- Riot did not answer (or the check failed) and there is no game to keep showing. -->
    <div v-if="error" class="rd-card lv-idle" role="alert">
      <span class="lv-idle-mark"><CloudOff :size="18" /></span>
      <h2>{{ error === 'riot' ? 'Riot is not answering' : 'Could not check this live game' }}</h2>
      <p>Live games come from Riot. Try again in a moment.</p>
      <button type="button" class="iv-btn sm" :disabled="loading" @click="refresh(false, true)">
        <RefreshCw :size="12" :class="{ 'animate-spin': loading }" />
        Retry
      </button>
    </div>

    <div v-else-if="loading && !game" class="grid gap-2" aria-busy="true" aria-label="Checking">
      <div class="iv-skel h-[88px]" />
      <div v-for="i in 5" :key="i" class="iv-skel h-[118px]" />
    </div>

    <div v-else-if="!game" class="rd-card lv-idle">
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
      <div class="lvt">
        <div v-for="(team, t) in teams" :key="team.teamId" class="sd" :class="t ? 'rd r' : 'bl'">
          <span>
            <h2>{{ team.label }}</h2>
            <small>
              <template v-if="team.average">Average {{ team.average.label }}</template>
              <template v-if="team.mine"
                ><template v-if="team.average">, </template>{{ name }}'s team</template
              >
            </small>
          </span>
          <span v-if="team.bans.length" class="bans" :aria-label="`${team.label} bans`">
            <span
              v-for="(ban, i) in team.bans"
              :key="i"
              :title="`Banned: ${championName(ban.championId)}`"
              ><img
                :src="champIcon(ban.championId)"
                :alt="`Banned: ${championName(ban.championId)}`"
            /></span>
          </span>
        </div>
        <div class="mid">
          <span class="live">{{ loadingIn ? 'Loading in' : 'In game' }}</span>
          <div class="rd-fig num clock" :title="loadingIn ? 'Players are loading in' : 'Game time'">
            {{ loadingIn ? '0:00' : duration(elapsed) }}
          </div>
          <small>{{ where }}</small>
          <span class="upd">
            {{ stale ? 'Could not refresh' : checkedAt ? `Updated ${checkedAt}` : '' }}
            <button
              type="button"
              class="iv-btn ghost sm"
              :disabled="loading"
              @click="refresh(false, true)"
            >
              <RefreshCw :size="12" :class="{ 'animate-spin': loading }" />
              Refresh
            </button>
          </span>
        </div>
      </div>

      <ol class="lanes">
        <li v-for="lane in lanes" :key="lane.key" class="fo">
          <LivePlayer
            v-if="lane.blue"
            :player="lane.blue"
            :red="false"
            :self="lane.blue.puuid === puuid"
            :lane="lane.position"
            :premade="premadeOf(lane.blue)"
          />
          <span v-else />
          <span class="vz" :title="roleTitle(lane)">
            <span v-if="lane.position" class="key" :class="{ likely: lane.likely }"
              ><RoleIcon :lane="lane.position" :size="18"
            /></span>
            <template v-if="lane.position">{{ positionName(lane.position) }}</template>
            <small v-if="lane.likely">likely</small>
          </span>
          <LivePlayer
            v-if="lane.red"
            :player="lane.red"
            :red="true"
            :self="lane.red.puuid === puuid"
            :lane="lane.position"
            :premade="premadeOf(lane.red)"
          />
          <span v-else />
        </li>
      </ol>

      <section v-if="balance.length" class="rd-card cmpb">
        <div v-for="row in balance" :key="row.label" class="cb">
          <label
            ><b class="num">{{ row.a }}</b
            >{{ row.label }}<b class="num">{{ row.b }}</b></label
          >
          <div class="vs">
            <i :style="{ width: `${row.share}%` }" /><i :style="{ width: `${100 - row.share}%` }" />
          </div>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.lv-idle {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 44px 16px;
  text-align: center;
}
.lv-idle h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-1);
}
.lv-idle p {
  margin: 0;
  font-size: 13px;
  color: var(--text-3);
}
.lv-idle-mark {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  color: var(--text-2);
  background: var(--surface-3);
}
.lv-idle-note {
  font-size: 12px;
  color: var(--text-4);
}
.lvt {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 24px;
  padding: 6px 2px 18px;
}
.lvt .sd:nth-child(2) {
  grid-column: 3;
  grid-row: 1;
}
.lvt .mid {
  grid-column: 2;
  grid-row: 1;
  display: grid;
  justify-items: center;
  text-align: center;
}
.live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-1);
}
.live::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 9px;
  background: var(--loss);
}
.clock {
  margin-top: 8px;
  font-size: 40px;
  line-height: 1;
  letter-spacing: -0.02em;
}
.mid small {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-3);
}
.upd {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-4);
}
.sd {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}
.sd.r {
  flex-direction: row-reverse;
  text-align: right;
}
.sd h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.01em;
}
.sd.bl h2 {
  color: var(--win);
}
.sd.rd h2 {
  color: var(--loss);
}
.sd small {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-3);
}
.bans {
  display: flex;
  gap: 4px;
}
.bans > span {
  position: relative;
  width: 30px;
  height: 30px;
  overflow: hidden;
  border-radius: 7px;
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.08);
}
.bans img {
  width: 30px;
  height: 30px;
  filter: grayscale(1) brightness(0.6);
}
.bans > span::after {
  content: '';
  position: absolute;
  left: -4px;
  right: -4px;
  top: 14px;
  height: 2px;
  background: rgb(var(--loss-rgb) / 0.8);
  transform: rotate(-45deg);
}
.lanes {
  margin: 0;
  padding: 0;
  list-style: none;
}
.fo {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 56px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
}
.fo + .fo {
  margin-top: 8px;
}
.vz {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-3);
}
.vz .key {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  color: var(--text-2);
  background: var(--rd-card-2);
  box-shadow: inset 0 0 0 1px var(--rd-line);
}
.vz .key.likely {
  opacity: 0.7;
  box-shadow:
    inset 0 0 0 1px var(--rd-line),
    0 0 0 1px dashed var(--line-3);
}
.vz small {
  font-size: 10px;
  color: var(--text-4);
}
.cmpb {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 20px;
}
.cb {
  padding: 16px 22px;
}
.cb + .cb {
  box-shadow: inset 1px 0 0 var(--rd-line);
}
.cb label {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}
.cb label b {
  font-size: 14px;
  font-weight: 650;
  color: var(--text-1);
}
.cb .vs {
  display: flex;
  gap: 2px;
  height: 6px;
  margin-top: 10px;
  overflow: hidden;
  border-radius: 9px;
}
.cb .vs i {
  background: var(--win);
}
.cb .vs i + i {
  background: var(--loss);
}

@media (max-width: 1100px) {
  .fo {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }
  .fo + .fo {
    margin-top: 18px;
  }
  .vz {
    flex-direction: row;
    justify-content: center;
    order: -1;
  }
  .vz .key {
    width: 28px;
    height: 28px;
  }
  .lvt,
  .cmpb {
    grid-template-columns: minmax(0, 1fr);
  }
  .lvt .sd:nth-child(2),
  .lvt .mid {
    grid-column: 1;
    grid-row: auto;
  }
  .lvt .mid {
    order: -1;
  }
  .sd.r {
    flex-direction: row;
    text-align: left;
  }
  .cb + .cb {
    box-shadow: inset 0 1px 0 var(--rd-line);
  }
}
</style>
