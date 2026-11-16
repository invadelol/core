<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Link } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import { queueName, rankLabel, rankValue, TIERS } from '@invadelol/ui/logic'
import Frame from './ui/Frame.vue'
import Icon from './ui/Icon.vue'
import RankEmblem from './ui/RankEmblem.vue'
import TierChip from './ui/TierChip.vue'
import EmptyState from './ui/EmptyState.vue'
import Skeleton from './ui/Skeleton.vue'
import { assetUrl, champIcon, championName } from '../lib/assets.js'
import { profilePath } from '../lib/format.js'
import { SERVER } from '../lib/board.js'
import { patchName } from '../lib/patch.js'
import type { LiveGame } from '../lib/types.js'
import '../css/live.css'

/**
 * A player's live game as the board draws it: the two sides with their average rank and bans,
 * the clock, then each lane: both players (champion, spells, rank, their games on the champion, a
 * tag worth knowing) and between them what the counted ranked games say of the lane
 * (`/api/lanes`: each champion's tier and win rate in the role, the matchup). Polled every 30 s.
 */
const props = defineProps<{
  puuid: string
  name: string
  platform?: string | null
  patch?: string | null
}>()

const game = ref<LiveGame | null>(null)
const loading = ref(true)
const error = ref('')
const stale = ref(false)
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
// Browser-only: a timer started during SSR would fire inside the server.
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

type Player = LiveGame['participants'][number]
const elapsed = computed(() =>
  game.value?.gameStartTime
    ? Math.max(0, Math.floor((now.value - game.value.gameStartTime) / 1000))
    : Math.max(0, game.value?.gameLength ?? 0)
)
const clockText = computed(
  () => `${Math.floor(elapsed.value / 60)}:${String(elapsed.value % 60).padStart(2, '0')}`
)
const where = computed(() => {
  if (!game.value) return ''
  return [
    queueName(game.value.gameQueueConfigId),
    props.platform ? (SERVER[props.platform] ?? props.platform) : null,
    props.patch ? `patch ${patchName(props.patch)}` : null,
  ]
    .filter(Boolean)
    .join(', ')
})

function averageRank(players: Player[]) {
  const values = players
    .map((p) => (p.rank ? rankValue({ ...p.rank, lp: p.rank.leaguePoints }) : null))
    .filter((v): v is number => v !== null)
  if (values.length < 3) return null
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  if (mean >= 28) return rankLabel({ tier: 'MASTER', division: '', lp: 0 }, false)
  const tier = TIERS[Math.min(6, Math.floor(mean / 4))]
  const division = ['IV', 'III', 'II', 'I'][Math.floor(mean) % 4]
  return rankLabel({ tier, division, lp: 0 }, false)
}
const teams = computed(() => {
  const all = game.value?.participants ?? []
  return [100, 200].map((teamId) => {
    const players = all.filter((p) => p.teamId === teamId)
    return {
      teamId,
      players,
      average: averageRank(players),
      bans: (game.value?.bannedChampions ?? []).filter(
        (b) => b.teamId === teamId && b.championId > 0
      ),
    }
  })
})
const POS: Record<string, { label: string; stat: string }> = {
  TOP: { label: 'Top', stat: 'TOP' },
  JUNGLE: { label: 'Jungle', stat: 'JUNGLE' },
  MID: { label: 'Mid', stat: 'MIDDLE' },
  ADC: { label: 'Bot', stat: 'BOTTOM' },
  SUPPORT: { label: 'Support', stat: 'UTILITY' },
}
const lanes = computed(() => {
  const [blue, red] = teams.value
  return Array.from({ length: Math.max(blue.players.length, red.players.length) }, (_, i) => {
    const b = blue.players[i]
    const r = red.players[i]
    return { key: i, blue: b, red: r, position: b?.position ?? r?.position ?? null }
  })
})

/* What the counted ranked games say of each lane. */
interface LaneStat {
  position: string
  blue: { champion: number; tier: number | null; win: number | null; games: number }
  red: { champion: number; tier: number | null; win: number | null; games: number }
  matchup: { win: number; games: number } | null
}
const laneStats = ref<Record<string, LaneStat>>({})
watch(
  () =>
    game.value
      ? lanes.value.map((l) => `${l.position}.${l.blue?.championId}.${l.red?.championId}`).join(',')
      : '',
  async (key) => {
    if (!key || typeof window === 'undefined') return
    const pairs = lanes.value
      .filter((l) => l.position && l.blue && l.red && POS[l.position])
      .map((l) => `${POS[l.position!].stat}.${l.blue!.championId}.${l.red!.championId}`)
    if (!pairs.length) return
    try {
      const res = await fetch(`/api/lanes?pairs=${pairs.join(',')}`)
      if (!res.ok) return
      const body = (await res.json()) as { lanes: LaneStat[] }
      laneStats.value = Object.fromEntries(body.lanes.map((l) => [l.position, l]))
    } catch {
      /* the lanes read without them */
    }
  },
  { immediate: true }
)
const statOf = (position: string | null) =>
  position && POS[position] ? laneStats.value[POS[position].stat] : undefined
const pct = (x: number | null | undefined, d = 1) =>
  x === null || x === undefined ? '–' : `${(x * 100).toFixed(d)}%`

const nameOf = (p: Player) =>
  p.riotId?.split('#')[0] || (p.bot ? 'Bot' : championName(p.championId))
const hrefOf = (p: Player) => {
  if (!p.riotId || !p.riotId.includes('#')) return null
  const [n, t] = p.riotId.split('#')
  return profilePath(n, t)
}
/** One fact worth knowing about a player, or none. */
function tagOf(p: Player): { text: string; violet?: boolean } | null {
  if (p.puuid === props.puuid) return { text: 'You', violet: true }
  const mates = (p.premade ?? [])
    .map((id) => game.value?.participants.find((o) => o.puuid === id))
    .filter((o): o is Player => Boolean(o))
  if (mates.length)
    return {
      text: `${mates.length === 1 ? 'Duo' : 'Premade'} with ${mates.map(nameOf).join(', ')}`,
      violet: true,
    }
  if ((p.streak ?? 0) >= 3) return { text: `Hot streak, ${p.streak} wins` }
  if ((p.streak ?? 0) <= -3) return { text: `${-p.streak!} losses in a row` }
  if ((p.championShare ?? 0) >= 0.5 && (p.championStats?.games ?? 0) >= 10)
    return { text: 'One-trick' }
  if (p.mainPosition && p.position && p.mainPosition !== p.position)
    return { text: `Usually ${POS[p.mainPosition]?.label.toLowerCase() ?? 'another role'}` }
  if ((p.championStats?.games ?? 0) > 0 && (p.championStats?.games ?? 0) < 3)
    return {
      text: `${p.championStats!.games} ${p.championStats!.games === 1 ? 'game' : 'games'} on ${championName(p.championId)}`,
    }
  return null
}
const rankLine = (p: Player) => {
  if (!p.rank) return null
  const games = (p.rank.wins ?? 0) + (p.rank.losses ?? 0)
  return `${p.rank.leaguePoints} LP${games ? `, ${Math.round(((p.rank.wins ?? 0) / games) * 100)}% in ${games}` : ''}`
}
const tierWord = (p: Player) =>
  p.rank ? rankLabel({ tier: p.rank.tier, division: p.rank.division, lp: 0 }, false) : 'Unranked'
</script>

<template>
  <div class="lv">
    <template v-if="loading && !game">
      <div class="card" style="padding: 20px"><Skeleton :height="96" /></div>
      <div class="card" style="padding: 20px; margin-top: 12px"><Skeleton :rows="5" pic /></div>
    </template>
    <EmptyState
      v-else-if="error && !game"
      icon="live"
      :title="
        error === 'riot' ? 'Riot is not answering right now' : `Could not check ${name}'s game`
      "
      line="Try again in a moment."
    >
      <button class="btn" type="button" @click="refresh(false, true)">
        <Icon name="refresh" />Check again
      </button>
    </EmptyState>
    <EmptyState
      v-else-if="!game"
      icon="live"
      :title="`${name} is not in a game`"
      line="The page checks again every 30 seconds, and opens the game as soon as it starts."
    >
      <button class="btn" type="button" @click="refresh(false, true)">
        <Icon name="refresh" />Check now
      </button>
    </EmptyState>

    <template v-else>
      <section class="card lv-h">
        <div v-for="t in [teams[0]]" :key="t.teamId">
          <span class="h3 row" style="gap: 8px"
            ><span class="dotb"></span>Blue side<span v-if="t.average" class="meta"
              >average {{ t.average }}</span
            ></span
          >
          <div class="bns">
            <Frame
              v-for="b in t.bans"
              :key="b.championId"
              :src="champIcon(b.championId)"
              size="xs"
              :alt="championName(b.championId)"
            />
          </div>
        </div>
        <div style="text-align: center">
          <span class="fg-l row" style="gap: 12px; justify-content: center"
            ><span class="live" style="font-size: 0"></span
            >{{ game.gameStartTime ? clockText : 'Loading in' }}</span
          >
          <span class="meta" style="display: block; margin-top: 6px"
            >{{ where }}<template v-if="stale">, last checked a moment ago</template></span
          >
        </div>
        <div v-for="t in [teams[1]]" :key="t.teamId" style="text-align: right">
          <span class="h3 row" style="gap: 8px; justify-content: flex-end"
            ><span v-if="t.average" class="meta">average {{ t.average }}</span
            >Red side<span class="dotr"></span
          ></span>
          <div class="bns" style="justify-content: flex-end">
            <Frame
              v-for="b in t.bans"
              :key="b.championId"
              :src="champIcon(b.championId)"
              size="xs"
              :alt="championName(b.championId)"
            />
          </div>
        </div>
      </section>

      <div v-for="l in lanes" :key="l.key" class="lane4">
        <template v-for="(p, side) in [l.blue, l.red]" :key="side">
          <div v-if="side === 1" class="lmid2">
            <span v-if="l.position && POS[l.position]" class="row" style="gap: 6px"
              ><RoleIcon :lane="l.position" :size="16" />{{ POS[l.position].label }}</span
            >
            <template v-if="statOf(l.position)">
              <template
                v-if="
                  statOf(l.position)!.matchup && (l.blue?.puuid === puuid || l.red?.puuid === puuid)
                "
              >
                <span class="fg-s t1"
                  >{{
                    (
                      (l.red?.puuid === puuid
                        ? 1 - statOf(l.position)!.matchup!.win
                        : statOf(l.position)!.matchup!.win) * 100
                    ).toFixed(1)
                  }}<span class="u">%</span></span
                >
                <span
                  >{{
                    championName(l.red?.puuid === puuid ? l.red!.championId : l.blue!.championId)
                  }}
                  wins this lane<br />{{
                    statOf(l.position)!.matchup!.games.toLocaleString('en-US')
                  }}
                  games</span
                >
              </template>
              <template v-else>
                <span class="row" style="gap: 6px"
                  ><TierChip :tier="statOf(l.position)!.blue.tier" /><span class="t3">vs</span
                  ><TierChip :tier="statOf(l.position)!.red.tier"
                /></span>
                <span
                  >{{ pct(statOf(l.position)!.blue.win) }} and
                  {{ pct(statOf(l.position)!.red.win) }}</span
                >
              </template>
            </template>
          </div>
          <component
            :is="p && hrefOf(p) ? Link : 'div'"
            v-if="p"
            class="card pc3"
            :class="{ r: side === 1, me: p.puuid === puuid }"
            :href="p && hrefOf(p) ? hrefOf(p)! : undefined"
          >
            <span v-if="side === 0" class="ch6">
              <Frame :src="champIcon(p.championId)" size="s" :alt="championName(p.championId)" />
              <span class="sps"
                ><img :src="assetUrl('spell', p.spell1Id)" alt="" /><img
                  :src="assetUrl('spell', p.spell2Id)"
                  alt=""
              /></span>
            </span>
            <span v-if="side === 1" class="col">
              <template v-if="p.championStats"
                ><span class="fg-xs"
                  >{{ Math.round(p.championStats.winrate * 100) }}<span class="u">%</span></span
                ><span class="meta"
                  >{{ p.championStats.games }} {{ p.championStats.games === 1 ? 'game' : 'games'
                  }}<template
                    v-if="p.championStats.kda !== null && p.championStats.kda !== undefined"
                    >, {{ p.championStats.kda.toFixed(1) }} KDA</template
                  ></span
                ></template
              >
              <span v-else class="meta">First stored game on it</span>
            </span>
            <span v-if="side === 1" class="rk6">
              <span class="col"
                ><span class="h5">{{ tierWord(p) }}</span
                ><span v-if="rankLine(p)" class="meta">{{ rankLine(p) }}</span></span
              >
              <RankEmblem :tier="p.rank?.tier" :size="32" />
            </span>
            <span style="min-width: 0">
              <span class="h4 ell" style="display: block">{{ nameOf(p) }}</span>
              <span class="meta">{{ championName(p.championId) }}</span>
              <span v-if="tagOf(p)" class="tg2"
                ><span :class="{ v: tagOf(p)!.violet }">{{ tagOf(p)!.text }}</span></span
              >
            </span>
            <span v-if="side === 0" class="rk6">
              <RankEmblem :tier="p.rank?.tier" :size="32" />
              <span class="col"
                ><span class="h5">{{ tierWord(p) }}</span
                ><span v-if="rankLine(p)" class="meta">{{ rankLine(p) }}</span></span
              >
            </span>
            <span v-if="side === 0" class="col">
              <template v-if="p.championStats"
                ><span class="fg-xs"
                  >{{ Math.round(p.championStats.winrate * 100) }}<span class="u">%</span></span
                ><span class="meta"
                  >{{ p.championStats.games }} {{ p.championStats.games === 1 ? 'game' : 'games'
                  }}<template
                    v-if="p.championStats.kda !== null && p.championStats.kda !== undefined"
                    >, {{ p.championStats.kda.toFixed(1) }} KDA</template
                  ></span
                ></template
              >
              <span v-else class="meta">First stored game on it</span>
            </span>
            <span v-if="side === 1" class="ch6">
              <Frame :src="champIcon(p.championId)" size="s" :alt="championName(p.championId)" />
              <span class="sps"
                ><img :src="assetUrl('spell', p.spell1Id)" alt="" /><img
                  :src="assetUrl('spell', p.spell2Id)"
                  alt=""
              /></span>
            </span>
          </component>
          <div v-else class="card pc3" :class="{ r: side === 1 }"></div>
        </template>
      </div>
    </template>
  </div>
</template>
