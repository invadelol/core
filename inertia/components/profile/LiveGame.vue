<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Link } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import { queueName, rankLabel, rankValue, TIERS } from '@invadelol/ui/logic'
import EmptyState from '../ui/EmptyState.vue'
import Icon from '../ui/Icon.vue'
import RankEmblem from '../ui/RankEmblem.vue'
import Skeleton from '../ui/Skeleton.vue'
import { assetUrl, champIcon, championName, nameOf as assetName } from '../../lib/assets.js'
import { SERVER } from '../../lib/board.js'
import { profilePath } from '../../lib/format.js'
import { since } from '../../lib/ladders.js'
import type { LiveCheck, LiveGame } from '../../lib/types.js'

/**
 * A profile's Live section: whether the player is in a game right now and, when they are, the
 * game itself (both teams seated by lane, each player's rank and record on their champion). Riot
 * is asked once, when the section opens, and again only on "Check again" once the answer is old
 * enough; nothing here polls (app/services/live/live_service.ts).
 */
const props = defineProps<{
  puuid: string
  gameName: string
  platform?: string | null
  /** Their newest stored game, in ms. */
  lastGameMs?: number | null
}>()

/** "Check again" asks Riot anew past this (the server keeps the answer as long). */
const RECHECK_MS = 20_000

const check = ref<LiveCheck | null>(null)
const loading = ref(true)
const error = ref<{ kind: 'riot' | 'limit' | 'other'; retryAfter?: number } | null>(null)
const now = ref(Date.now())
let controller: AbortController | undefined
let clock: ReturnType<typeof setInterval> | undefined

async function load(again = false) {
  controller?.abort()
  controller = new AbortController()
  const signal = controller.signal
  loading.value = true
  error.value = null
  try {
    const response = await fetch(
      `/api/summoners/puuid/${props.puuid}/live${again ? '?again=1' : ''}`,
      { signal, cache: 'no-store' }
    )
    if (response.status === 429) {
      const body = await response.json().catch(() => null)
      const retryAfter = Number(body?.retryAfter ?? response.headers.get('retry-after')) || 60
      // Riot's own limit says E_RIOT_RATE_LIMITED; ours counts this address's checks.
      error.value = body?.errors ? { kind: 'riot' } : { kind: 'limit', retryAfter }
      return
    }
    if (!response.ok) {
      error.value = { kind: response.status === 503 ? 'riot' : 'other' }
      return
    }
    const data = (await response.json()) as LiveCheck
    if (!signal.aborted) check.value = data
  } catch {
    if (!signal.aborted) error.value = { kind: 'other' }
  } finally {
    if (!signal.aborted) loading.value = false
  }
}

// Browser only: the server renders the waiting shape, and never asks Riot.
onMounted(() => {
  clock = setInterval(() => (now.value = Date.now()), 1000)
  watch(
    () => props.puuid,
    () => {
      check.value = null
      void load()
    },
    { immediate: true }
  )
})
onBeforeUnmount(() => {
  controller?.abort()
  clearInterval(clock)
})

const game = computed<LiveGame | null>(() => check.value?.game ?? null)
type Player = LiveGame['participants'][number]

/** "just now", "40 s ago", "3 min ago". */
const checked = computed(() => {
  if (!check.value) return ''
  const s = Math.max(0, Math.round((now.value - check.value.checkedAt) / 1000))
  if (s < 10) return 'just now'
  if (s < 60) return `${s} s ago`
  return `${Math.floor(s / 60)} min ago`
})
const canRecheck = computed(
  () => !loading.value && (!check.value || now.value - check.value.checkedAt >= RECHECK_MS)
)

const elapsed = computed(() => {
  const g = game.value
  if (!g) return 0
  return g.gameStartTime
    ? Math.max(0, Math.floor((now.value - g.gameStartTime) / 1000))
    : Math.max(0, g.gameLength)
})
const clockText = computed(
  () => `${Math.floor(elapsed.value / 60)}:${String(elapsed.value % 60).padStart(2, '0')}`
)
const MAPS: Record<number, string> = { 11: "Summoner's Rift", 12: 'Howling Abyss' }
const where = computed(() => {
  const g = game.value
  if (!g) return ''
  return [
    queueName(g.gameQueueConfigId),
    g.mapId ? MAPS[g.mapId] : null,
    props.platform ? (SERVER[props.platform] ?? props.platform) : null,
  ]
    .filter(Boolean)
    .join(', ')
})
const me = computed(() => game.value?.participants.find((p) => p.puuid === props.puuid) ?? null)

/** A team's average Solo/Duo rank, from three ranked players up. */
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
/** The player's team first, then the other. */
const teams = computed(() => {
  const g = game.value
  if (!g) return []
  const sides = [...new Set(g.participants.map((p) => p.teamId))].sort((a, b) =>
    a === me.value?.teamId ? -1 : b === me.value?.teamId ? 1 : a - b
  )
  return sides.map((teamId) => {
    const players = g.participants.filter((p) => p.teamId === teamId)
    return {
      teamId,
      side: teamId === 100 ? 'Blue side' : teamId === 200 ? 'Red side' : `Team ${teamId}`,
      players,
      average: averageRank(players),
      bans: g.bannedChampions.filter((b) => b.teamId === teamId && b.championId > 0),
    }
  })
})

const nameOf = (p: Player) =>
  p.riotId?.split('#')[0] || (p.bot ? 'Bot' : championName(p.championId))
const tagOf = (p: Player) => (p.riotId?.includes('#') ? p.riotId.split('#')[1] : null)
const hrefOf = (p: Player) => {
  const tag = tagOf(p)
  return tag ? profilePath(p.riotId!.split('#')[0], tag) : null
}
const record = (p: Player) => {
  const c = p.championStats
  if (!c?.games) return `First stored game on ${championName(p.championId)}`
  return `${c.games} ${c.games === 1 ? 'game' : 'games'} on ${championName(p.championId)}, ${Math.round(c.winrate * 100)}%`
}
const tierLine = (p: Player) =>
  p.rank
    ? rankLabel({ tier: p.rank.tier, division: p.rank.division, lp: 0 }, false)
    : p.rankStatus === 'unranked'
      ? 'Unranked'
      : null
const keystone = (p: Player) => p.perks?.perkIds?.[0] ?? null
const spellName = (id: number) => assetName('spell', id) ?? ''
const runeName = (id: number) => assetName('rune', id) ?? ''
</script>

<template>
  <div class="lg">
    <div class="ptb">
      <h2 class="h3">Live game</h2>
      <span v-if="check && !loading" class="meta">Checked {{ checked }}</span>
      <button
        v-if="check || error"
        type="button"
        class="btn sm lg-again"
        :disabled="!canRecheck"
        @click="load(true)"
      >
        <Icon name="refresh" :size="14" />Check again
      </button>
    </div>

    <!-- The first check -->
    <template v-if="loading && !check">
      <div class="card" style="padding: 20px 24px"><Skeleton :height="72" /></div>
      <div class="lg-teams">
        <div v-for="n in 2" :key="n" class="card" style="padding: 16px">
          <Skeleton :rows="5" pic />
        </div>
      </div>
    </template>

    <article v-else-if="error && !check" class="card">
      <EmptyState
        icon="live"
        :title="
          error.kind === 'limit'
            ? 'Too many checks from this connection'
            : error.kind === 'riot'
              ? 'Riot is not answering right now'
              : `${gameName}'s game could not be checked`
        "
        :line="
          error.kind === 'limit'
            ? `Try again in ${Math.max(1, Math.ceil((error.retryAfter ?? 60) / 60))} min.`
            : 'Try again in a moment.'
        "
      />
    </article>

    <!-- Between games -->
    <article v-else-if="check && !game" class="card lg-off" :class="{ 'mh-busy': loading }">
      <span class="lg-ic"><Icon name="live" :size="20" /></span>
      <span class="col" style="gap: 4px; min-width: 0">
        <span class="h4">{{ gameName }} is not in a game right now</span>
        <span v-if="lastGameMs" class="meta">Last stored game {{ since(lastGameMs) }}</span>
      </span>
    </article>

    <!-- In a game -->
    <template v-else-if="game">
      <section class="card lit lg-h" :class="{ 'mh-busy': loading }">
        <span class="col" style="gap: 6px; min-width: 0">
          <span class="live">In game</span>
          <span class="fg-l num lg-clock">{{ game.gameStartTime ? clockText : 'Loading in' }}</span>
          <span class="meta">{{ where }}</span>
        </span>
        <span v-if="me" class="lg-me">
          <img
            :src="champIcon(me.championId)"
            :alt="championName(me.championId)"
            width="48"
            height="48"
          />
          <span class="col" style="gap: 3px; min-width: 0">
            <span class="h5 ell">{{ gameName }} on {{ championName(me.championId) }}</span>
            <span class="meta ell">{{ record(me) }}</span>
          </span>
        </span>
      </section>

      <div class="lg-teams">
        <section v-for="t in teams" :key="t.teamId" class="card lg-t">
          <header class="lg-th">
            <span class="lg-sd" :class="t.teamId === 100 ? 'b' : 'r'" />
            <h3 class="h4">{{ t.side }}</h3>
            <span v-if="t.average" class="meta">average {{ t.average }}</span>
            <span v-if="t.bans.length" class="lg-bans" :aria-label="`${t.side} bans`">
              <img
                v-for="b in t.bans"
                :key="b.championId"
                :src="champIcon(b.championId)"
                :alt="championName(b.championId)"
                :title="`${championName(b.championId)}, banned`"
                width="22"
                height="22"
                loading="lazy"
              />
            </span>
          </header>
          <component
            :is="hrefOf(p) ? Link : 'div'"
            v-for="(p, i) in t.players"
            :key="`${t.teamId}:${i}`"
            :href="hrefOf(p) ?? undefined"
            class="lg-p"
            :class="{ me: p.puuid === puuid }"
          >
            <span class="lg-rl"><RoleIcon v-if="p.position" :lane="p.position" :size="16" /></span>
            <span class="lg-ch">
              <img
                class="c"
                :src="champIcon(p.championId)"
                :alt="championName(p.championId)"
                width="40"
                height="40"
                loading="lazy"
              />
              <span class="lg-sp">
                <img
                  :src="assetUrl('spell', p.spell1Id)"
                  :alt="spellName(p.spell1Id)"
                  :title="spellName(p.spell1Id)"
                  width="19"
                  height="19"
                  loading="lazy"
                /><img
                  :src="assetUrl('spell', p.spell2Id)"
                  :alt="spellName(p.spell2Id)"
                  :title="spellName(p.spell2Id)"
                  width="19"
                  height="19"
                  loading="lazy"
                />
              </span>
              <img
                v-if="keystone(p)"
                class="k"
                :src="assetUrl('rune', keystone(p)!)"
                :alt="runeName(keystone(p)!)"
                :title="runeName(keystone(p)!)"
                width="22"
                height="22"
                loading="lazy"
              />
            </span>
            <span class="col lg-who">
              <span class="h5 ell"
                >{{ nameOf(p) }}<span v-if="tagOf(p)" class="t3 lg-tag">#{{ tagOf(p) }}</span></span
              >
              <span class="meta ell">{{ record(p) }}</span>
            </span>
            <span class="lg-rk">
              <span class="col" style="gap: 2px; align-items: flex-end">
                <span class="h5" :class="{ t3: !p.rank }">{{ tierLine(p) ?? '–' }}</span>
                <span v-if="p.rank" class="meta num">{{ p.rank.leaguePoints }} LP</span>
              </span>
              <RankEmblem
                v-if="p.rank || p.rankStatus === 'unranked'"
                :tier="p.rank?.tier"
                :size="30"
              />
              <span v-else class="lg-nr" />
            </span>
          </component>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.lg {
  display: flex;
  flex-direction: column;
  gap: 20px;
  container: lg / inline-size;
}
.lg-again {
  margin-left: auto;
}
.lg-again:disabled {
  opacity: 0.5;
  cursor: default;
}

/* Between games */
.lg-off {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 22px 24px;
}
.lg-ic {
  display: grid;
  flex: none;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: var(--r2, 8px);
  background: var(--well, var(--s2));
  box-shadow: var(--inset-shadow, inset 0 0 0 1px var(--line));
  color: var(--t3);
}

/* In a game: the clock, then the viewed player's pick */
.lg-h {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 22px 24px;
}
.lg-clock {
  font-size: 34px;
  line-height: 1.05;
  letter-spacing: -0.02em;
}
.lg-me {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  margin-left: auto;
  padding-left: 24px;
  border-left: 1px solid var(--line);
}
.lg-me img {
  flex: none;
  width: 48px;
  height: 48px;
  border-radius: 10px;
}

/* The teams */
.lg-teams {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}
.lg-t {
  padding-bottom: 6px;
}
.lg-th {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 52px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--line);
}
.lg-th .h4 {
  font-size: 15px;
  font-weight: 650;
}
.lg-sd {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 2px;
}
.lg-sd.b {
  background: var(--win);
}
.lg-sd.r {
  background: var(--loss);
}
.lg-bans {
  display: flex;
  gap: 3px;
  margin-left: auto;
}
.lg-bans img {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  filter: grayscale(0.85);
  opacity: 0.6;
}
.lg-p {
  display: grid;
  grid-template-columns: 18px auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-height: 60px;
  padding: 8px 16px;
  color: inherit;
  transition: background 160ms var(--ease);
}
.lg-p + .lg-p {
  border-top: 1px solid var(--line);
}
a.lg-p:hover {
  background: rgb(var(--v-rgb) / 0.04);
}
.lg-p.me {
  background: rgb(var(--v-rgb) / 0.08);
  box-shadow: inset 3px 0 0 var(--v400);
}
.lg-rl {
  display: flex;
  opacity: 0.6;
}
.lg-ch {
  display: flex;
  align-items: center;
  gap: 3px;
}
.lg-ch .c {
  width: 40px;
  height: 40px;
  border-radius: 8px;
}
.lg-sp {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.lg-sp img {
  width: 19px;
  height: 19px;
  border-radius: 4px;
}
.lg-ch .k {
  width: 22px;
  height: 22px;
  margin-left: 2px;
  border-radius: 50%;
  background: var(--ink-0);
}
.lg-who {
  gap: 3px;
  min-width: 0;
}
.lg-tag {
  margin-left: 0.28em;
  font-weight: 500;
}
.lg-nr {
  width: 30px;
}
.lg-rk {
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: right;
}

/* The section's own width decides: two teams side by side, else one over the other. */
@container lg (max-width: 819px) {
  .lg-teams {
    grid-template-columns: minmax(0, 1fr);
  }
}
@container lg (max-width: 519px) {
  .lg-h {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    padding: 18px 16px;
  }
  .lg-me {
    margin-left: 0;
    padding: 16px 0 0;
    border-left: 0;
    border-top: 1px solid var(--line);
    width: 100%;
  }
  .lg-off {
    padding: 18px 16px;
    align-items: flex-start;
  }
  .lg-p {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 10px;
    padding: 8px 12px;
  }
  .lg-rl {
    display: none;
  }
  .lg-ch .k {
    display: none;
  }
  .lg-rk .rk-emb,
  .lg-nr {
    display: none;
  }
  .lg-th {
    flex-wrap: wrap;
    padding: 10px 12px;
  }
}
</style>
