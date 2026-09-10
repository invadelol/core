<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { computed, onMounted, ref, shallowRef } from 'vue'
import { BarChart, LineChart } from '../lib/lazy_charts.js'
import AppHeader from '../components/AppHeader.vue'
import MatchScoreboard from '../components/MatchScoreboard.vue'
import PlayerPicker from '../components/PlayerPicker.vue'
import ItemRow from '../components/ItemRow.vue'
import RuneGlyphs from '../components/RuneGlyphs.vue'
import Card from '../components/ui/Card.vue'
import Meter from '../components/ui/Meter.vue'
import Segmented from '../components/ui/Segmented.vue'
import StatCell from '../components/ui/StatCell.vue'
import StatRow from '../components/ui/StatRow.vue'
import {
  champIcon,
  championName,
  loadChampions,
  loadItems,
  queueName,
  spellIcon,
  POSITION_NAMES,
} from '../lib/assets.js'
import {
  clock,
  compact,
  decodeSlug,
  duration,
  kda,
  ordinal,
  parseSlug,
  percent,
  timeAgo,
} from '../lib/format.js'
import {
  damageShare,
  frameValue,
  goldShare,
  indexTimeline,
  killParticipation,
  laneOpponent,
  matchMinutes,
  objectives,
  rankLobby,
  runeSet,
  skillMatrix,
  skillOrderOf,
  teamGoldSeries,
  teamMembers,
  teamOrder,
  teamTotals,
  totalPings,
} from '../lib/match.js'
import { CHART_COLORS, areaFill, barOptions, lineOptions } from '../lib/chart.js'
import type { Match, Participant } from '../lib/types.js'

const props = defineProps<{ summoner: string; matchId: string }>()

/** The route param, decoded exactly once. Encode from this, never from the prop. */
const slug = computed(() => decodeSlug(props.summoner))
const parsed = computed(() => parseSlug(props.summoner))

const match = shallowRef<Match | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
const selectedPuuid = ref('')
const section = ref<'overview' | 'timeline' | 'comparison'>('overview')

const SECTIONS = [
  { value: 'overview' as const, label: 'Overview' },
  { value: 'timeline' as const, label: 'Timeline' },
  { value: 'comparison' as const, label: 'Comparison' },
]

onMounted(async () => {
  loadChampions()
  loadItems()

  try {
    const res = await fetch(`/api/matches/${encodeURIComponent(props.matchId)}`)
    if (!res.ok) {
      error.value = 'Match not found'
      return
    }
    match.value = await res.json()

    const owner = match.value?.participants.find((p) => `${p.gameName}-${p.tagLine}` === slug.value)
    selectedPuuid.value = owner?.puuid ?? match.value?.participants[0]?.puuid ?? ''
  } catch {
    error.value = 'Failed to load this match'
  } finally {
    isLoading.value = false
  }
})

/* ── Derived lobby context ──────────────────────────────────── */
const totals = computed(() => (match.value ? teamTotals(match.value) : {}))
const lobby = computed(() =>
  match.value
    ? rankLobby(match.value)
    : { score: {}, rank: {}, rating: {}, mvpPuuid: null, acePuuid: null }
)
const timeline = computed(() => indexTimeline(match.value))
const minutes = computed(() => (match.value ? matchMinutes(match.value) : 1))

/** Lobby-wide maxima. Every meter on the page reads against these. */
const maxima = computed(() => {
  const players = match.value?.participants ?? []
  const max = (pick: (p: Participant) => number) => Math.max(...players.map(pick), 1)
  return {
    damage: max((p) => p.totalDamageDealtToChampions || 0),
    damageTaken: max((p) => p.damageTaken || 0),
    gold: max((p) => p.goldEarned || 0),
    cs: max((p) => p.cs || 0),
    vision: max((p) => p.visionScore || 0),
    wards: max((p) => p.wardsPlaced || 0),
    wardsKilled: max((p) => p.wardsKilled || 0),
    controlWards: max((p) => p.visionWardsBoughtInGame || 0),
    objectives: max((p) => p.damageDealtToObjectives || 0),
    turrets: max((p) => p.damageDealtToTurrets || 0),
  }
})

const player = computed(
  () =>
    match.value?.participants.find((p) => p.puuid === selectedPuuid.value) ??
    match.value?.participants[0]
)

const opponent = computed(() =>
  match.value && player.value ? laneOpponent(match.value, player.value) : undefined
)

const playerFrames = computed(() =>
  player.value ? (timeline.value[player.value.puuid] ?? []) : []
)
const playerRunes = computed(() => runeSet(playerFrames.value, player.value))
const skills = computed(() => skillMatrix(skillOrderOf(playerFrames.value)))

const goldLead = computed(() => {
  if (!match.value) return 0
  return (totals.value[100]?.gold ?? 0) - (totals.value[200]?.gold ?? 0)
})

/** Where each side's gold sits as a share of the two combined. */
const goldSplit = computed(() => {
  const blue = totals.value[100]?.gold ?? 0
  const red = totals.value[200]?.gold ?? 0
  const sum = blue + red
  return sum ? (blue / sum) * 100 : 50
})

/* ── Focus-player headline metrics ──────────────────────────── */
const headline = computed(() => {
  const p = player.value
  if (!p || !match.value) return []
  return [
    {
      label: 'Rating',
      value: lobby.value.rating[p.puuid] ?? 0,
      hint: `${ordinal(lobby.value.rank[p.puuid])} of 10 in this lobby`,
      meter: lobby.value.rating[p.puuid] ?? 0,
      tone: 'ink' as const,
    },
    {
      label: 'Kill participation',
      value: `${Math.round(killParticipation(p, totals.value))}%`,
      hint: `${p.kills + p.assists} of ${totals.value[p.teamId]?.kills ?? 0} team kills`,
      meter: killParticipation(p, totals.value),
      tone: 'ink' as const,
    },
    {
      label: 'Damage share',
      value: `${Math.round(damageShare(p, totals.value))}%`,
      hint: `${compact(p.totalDamageDealtToChampions / minutes.value)} per minute`,
      meter: damageShare(p, totals.value),
      tone: 'ink' as const,
    },
    {
      label: 'Gold share',
      value: `${Math.round(goldShare(p, totals.value))}%`,
      hint: `${compact(p.goldEarned / minutes.value)} per minute`,
      meter: goldShare(p, totals.value),
      tone: 'gold' as const,
    },
    {
      label: 'CS',
      value: p.cs,
      unit: `${(p.cs / minutes.value).toFixed(1)}/m`,
      hint: `${p.totalMinionsKilled} lane · ${p.neutralMinionsKilled} jungle`,
      meter: (p.cs / maxima.value.cs) * 100,
      tone: 'ink' as const,
    },
    {
      label: 'Vision',
      value: p.visionScore,
      unit: `${(p.visionScore / minutes.value).toFixed(2)}/m`,
      hint: `${p.wardsPlaced} placed · ${p.wardsKilled} cleared`,
      meter: (p.visionScore / maxima.value.vision) * 100,
      tone: 'ink' as const,
    },
  ]
})

const PING_FIELDS: Array<[keyof Participant, string]> = [
  ['enemyMissingPings', 'Enemy missing'],
  ['onMyWayPings', 'On my way'],
  ['dangerPings', 'Danger'],
  ['assistPings', 'Assist me'],
  ['allInPings', 'All in'],
  ['pushPings', 'Push'],
  ['getBackPings', 'Get back'],
  ['commandPings', 'Command'],
  ['needVisionPings', 'Need vision'],
  ['enemyVisionPings', 'Enemy vision'],
  ['visionClearedPings', 'Vision cleared'],
  ['baitPings', 'Bait'],
  ['holdPings', 'Hold'],
]

const activePings = computed(() => {
  const p = player.value
  if (!p) return []
  return PING_FIELDS.filter(([key]) => Number(p[key]) > 0).map(([key, label]) => ({
    label,
    value: Number(p[key]),
  }))
})

/* ── Charts ─────────────────────────────────────────────────── */
function seriesFor(puuid: string | undefined, key: 'gold' | 'cs' | 'xp') {
  if (!puuid) return [] as number[]
  return (timeline.value[puuid] ?? []).map((f) => frameValue(f, key))
}

const frameLabels = computed(() => playerFrames.value.map((f) => clock(f.frameMs)))

function duelChart(key: 'gold' | 'cs' | 'xp') {
  return {
    labels: frameLabels.value,
    datasets: [
      {
        label: player.value?.gameName ?? 'Player',
        data: seriesFor(player.value?.puuid, key),
        borderColor: CHART_COLORS.ink,
        backgroundColor: areaFill(CHART_COLORS.ink),
        borderWidth: 1.75,
        pointRadius: 0,
        pointHoverRadius: 3,
        tension: 0.25,
        fill: true,
      },
      {
        label: opponent.value?.gameName ?? 'Opponent',
        data: seriesFor(opponent.value?.puuid, key),
        borderColor: CHART_COLORS.muted,
        borderWidth: 1.5,
        borderDash: [4, 3],
        pointRadius: 0,
        pointHoverRadius: 3,
        tension: 0.25,
        fill: false,
      },
    ],
  }
}

const goldDiffChart = computed(() => {
  const mine = seriesFor(player.value?.puuid, 'gold')
  const theirs = seriesFor(opponent.value?.puuid, 'gold')
  return {
    labels: frameLabels.value,
    datasets: [
      {
        label: 'Gold difference',
        data: mine.map((value, index) => value - (theirs[index] ?? 0)),
        borderColor: CHART_COLORS.ink,
        backgroundColor: areaFill(CHART_COLORS.ink),
        borderWidth: 1.75,
        pointRadius: 0,
        pointHoverRadius: 3,
        tension: 0.25,
        fill: 'origin' as const,
      },
    ],
  }
})

const teamGoldChart = computed(() => {
  const series = match.value ? teamGoldSeries(match.value) : { times: [], blue: [], red: [] }
  return {
    labels: series.times.map(clock),
    datasets: [
      {
        label: 'Blue side',
        data: series.blue,
        borderColor: CHART_COLORS.win,
        backgroundColor: areaFill(CHART_COLORS.win),
        borderWidth: 1.75,
        pointRadius: 0,
        tension: 0.25,
        fill: true,
      },
      {
        label: 'Red side',
        data: series.red,
        borderColor: CHART_COLORS.loss,
        backgroundColor: areaFill(CHART_COLORS.loss),
        borderWidth: 1.75,
        pointRadius: 0,
        tension: 0.25,
        fill: true,
      },
    ],
  }
})

function teamBarChart(teamId: number, pick: (p: Participant) => number) {
  if (!match.value) return { labels: [], datasets: [] }
  const team = teamMembers(match.value, teamId)
  return {
    labels: team.map((p) => championName(p.championId)),
    datasets: [
      {
        data: team.map(pick),
        backgroundColor: team.map((p) =>
          p.puuid === selectedPuuid.value ? CHART_COLORS.ink : '#d5d7dd'
        ),
        borderWidth: 0,
        borderRadius: 3,
        barThickness: 14,
      },
    ],
  }
}

const duelOptions = lineOptions({ yTicks: 4, xTicks: 6 })
const diffOptions = lineOptions({
  yTicks: 4,
  xTicks: 6,
  tooltipLabel: (ctx: any) =>
    `${ctx.parsed.y >= 0 ? '+' : ''}${compact(ctx.parsed.y)} gold at ${ctx.label}`,
})
const bars = barOptions()

/* ── Comparison table ───────────────────────────────────────── */
const ladder = computed(() =>
  [...(match.value?.participants ?? [])].sort(
    (a, b) => (lobby.value.score[b.puuid] ?? 0) - (lobby.value.score[a.puuid] ?? 0)
  )
)

const duelRows = computed(() => {
  const a = player.value
  const b = opponent.value
  if (!a || !b) return []
  return [
    {
      label: 'KDA',
      mine: `${a.kills}/${a.deaths}/${a.assists}`,
      theirs: `${b.kills}/${b.deaths}/${b.assists}`,
      a: kda(a.kills, a.deaths, a.assists),
      b: kda(b.kills, b.deaths, b.assists),
    },
    {
      label: 'Damage',
      mine: compact(a.totalDamageDealtToChampions),
      theirs: compact(b.totalDamageDealtToChampions),
      a: a.totalDamageDealtToChampions,
      b: b.totalDamageDealtToChampions,
    },
    {
      label: 'Damage taken',
      mine: compact(a.damageTaken),
      theirs: compact(b.damageTaken),
      a: a.damageTaken,
      b: b.damageTaken,
    },
    {
      label: 'Gold',
      mine: compact(a.goldEarned),
      theirs: compact(b.goldEarned),
      a: a.goldEarned,
      b: b.goldEarned,
    },
    { label: 'CS', mine: String(a.cs), theirs: String(b.cs), a: a.cs, b: b.cs },
    {
      label: 'Vision',
      mine: String(a.visionScore),
      theirs: String(b.visionScore),
      a: a.visionScore,
      b: b.visionScore,
    },
    {
      label: 'Objectives',
      mine: compact(a.damageDealtToObjectives),
      theirs: compact(b.damageDealtToObjectives),
      a: a.damageDealtToObjectives,
      b: b.damageDealtToObjectives,
    },
  ]
})
</script>

<template>
  <Head :title="`${parsed.gameName} · ${matchId}`" />

  <AppHeader
    :crumbs="[
      { label: `${parsed.gameName}#${parsed.tagLine}`, href: `/${encodeURIComponent(slug)}` },
      { label: 'Match' },
    ]"
  />

  <main class="mx-auto max-w-[1180px] px-4 py-6">
    <div v-if="isLoading" class="space-y-5">
      <div class="skel h-28 rounded-[10px]" />
      <div class="skel h-40 rounded-[10px]" />
      <div class="grid gap-5 lg:grid-cols-2">
        <div class="skel h-64 rounded-[10px]" />
        <div class="skel h-64 rounded-[10px]" />
      </div>
    </div>

    <div v-else-if="error" class="card px-6 py-16 text-center">
      <p class="text-[0.9375rem] font-medium text-ink">{{ error }}</p>
      <a :href="`/${encodeURIComponent(slug)}`" class="btn mt-5">Back to profile</a>
    </div>

    <div v-else-if="match" class="space-y-5">
      <!-- ── Match banner ──────────────────────────────────── -->
      <section class="card p-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="flex flex-wrap items-baseline gap-x-2.5 text-[0.75rem] text-ink-3">
              <span class="text-[0.9375rem] font-semibold text-ink">
                {{ queueName(match.queueId) }}
              </span>
              <span class="num">{{ duration(match.duration) }}</span>
              <span>·</span>
              <span>{{ timeAgo(match.gameStartMs) }}</span>
              <span>·</span>
              <span>Patch {{ match.patch }}</span>
            </div>
            <p class="num mt-1 font-mono text-[0.6875rem] text-ink-4">{{ match.matchId }}</p>
          </div>

          <div class="flex items-center gap-5">
            <div class="text-right">
              <div
                class="num text-[1.75rem] font-semibold leading-none"
                :class="match.t1Win ? 'text-win' : 'text-ink-3'"
              >
                {{ totals[100].kills }}
              </div>
              <div class="label mt-1">Blue {{ match.t1Win ? '· won' : '' }}</div>
            </div>
            <span class="label pb-3">vs</span>
            <div>
              <div
                class="num text-[1.75rem] font-semibold leading-none"
                :class="match.t2Win ? 'text-loss' : 'text-ink-3'"
              >
                {{ totals[200].kills }}
              </div>
              <div class="label mt-1">Red {{ match.t2Win ? '· won' : '' }}</div>
            </div>
          </div>
        </div>

        <!-- Gold split: one bar that says who owned the map -->
        <div class="mt-5">
          <div class="mb-1.5 flex items-baseline justify-between text-[0.6875rem]">
            <span class="num text-win">{{ compact(totals[100].gold) }} gold</span>
            <span class="num text-ink-3">
              {{
                goldLead === 0
                  ? 'even'
                  : `${goldLead > 0 ? 'Blue' : 'Red'} +${compact(Math.abs(goldLead))}`
              }}
            </span>
            <span class="num text-loss">{{ compact(totals[200].gold) }} gold</span>
          </div>
          <div class="flex h-1.5 overflow-hidden rounded-full bg-[#f0f0f3]">
            <span class="bg-win" :style="{ width: `${goldSplit}%` }" />
            <span class="flex-1 bg-loss" />
          </div>
        </div>

        <!-- Objectives, side by side -->
        <div class="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-2">
          <div
            v-for="teamId in [100, 200]"
            :key="teamId"
            class="num flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.6875rem] text-ink-2"
          >
            <span
              class="label !text-[0.625rem]"
              :class="teamId === 100 ? '!text-win' : '!text-loss'"
            >
              {{ teamId === 100 ? 'Blue' : 'Red' }}
            </span>
            <span>{{ objectives(match, teamId).towers }} towers</span>
            <span>{{ objectives(match, teamId).inhibs }} inhibitors</span>
            <span>{{ objectives(match, teamId).dragons }} dragons</span>
            <span>{{ objectives(match, teamId).barons }} barons</span>
            <span>{{ objectives(match, teamId).heralds }} heralds</span>
          </div>
        </div>
      </section>

      <!-- ── Focus + section switch ────────────────────────── -->
      <div class="card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <PlayerPicker v-model="selectedPuuid" :match="match" />
        <Segmented v-model="section" :options="SECTIONS" />
      </div>

      <!-- ═══════════════ OVERVIEW ═══════════════ -->
      <template v-if="section === 'overview'">
        <section v-if="player" class="card p-5">
          <div class="flex flex-wrap items-start gap-5">
            <div class="relative shrink-0">
              <img
                :src="champIcon(player.championId)"
                :alt="championName(player.championId)"
                class="thumb h-16 w-16 rounded-xl"
              />
              <span
                class="num absolute -bottom-1.5 -right-1.5 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-surface px-1 text-[0.625rem] font-semibold text-white"
                :class="player.win ? 'bg-win' : 'bg-loss'"
              >
                {{ player.champLevel }}
              </span>
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <h2 class="text-[1.125rem] font-semibold text-ink">{{ player.gameName }}</h2>
                <span class="text-[0.8125rem] text-ink-3">#{{ player.tagLine }}</span>
                <span
                  v-if="player.puuid === lobby.mvpPuuid"
                  class="label rounded bg-[#f2f2f5] px-1.5 py-0.5 !text-ink-2"
                >
                  MVP
                </span>
                <span
                  v-else-if="player.puuid === lobby.acePuuid"
                  class="label rounded bg-[#f2f2f5] px-1.5 py-0.5 !text-ink-2"
                >
                  ACE
                </span>
              </div>
              <p class="mt-0.5 text-[0.75rem] text-ink-3">
                {{ championName(player.championId) }}
                <template v-if="player.position">
                  · {{ POSITION_NAMES[player.position] || player.position }}
                </template>
                · {{ player.win ? 'won' : 'lost' }} in {{ duration(match.duration) }}
              </p>

              <div class="num mt-3 flex items-baseline gap-2">
                <span class="text-[1.5rem] font-semibold leading-none text-ink">
                  {{ player.kills }}
                  <span class="text-ink-4">/</span>
                  <span class="text-loss">{{ player.deaths }}</span>
                  <span class="text-ink-4">/</span>
                  {{ player.assists }}
                </span>
                <span class="text-[0.8125rem] text-ink-2">
                  {{ kda(player.kills, player.deaths, player.assists).toFixed(2) }} KDA
                </span>
              </div>

              <div class="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
                <div>
                  <div class="label mb-1.5">Build</div>
                  <ItemRow :items="player.items" size="md" />
                </div>
                <div>
                  <div class="label mb-1.5">Spells</div>
                  <div class="flex gap-1">
                    <img
                      v-for="spell in player.spells"
                      :key="spell"
                      :src="spellIcon(spell)"
                      alt=""
                      class="thumb h-7 w-7 rounded"
                    />
                  </div>
                </div>
                <div>
                  <div class="label mb-1.5">Runes</div>
                  <RuneGlyphs :runes="playerRunes" full />
                </div>
              </div>
            </div>
          </div>

          <div
            class="mt-6 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-line pt-5 sm:grid-cols-3 lg:grid-cols-6"
          >
            <StatCell
              v-for="cell in headline"
              :key="cell.label"
              :label="cell.label"
              :value="cell.value"
              :unit="cell.unit"
              :hint="cell.hint"
              :meter="cell.meter"
              :tone="cell.tone"
            />
          </div>
        </section>

        <section class="space-y-5">
          <MatchScoreboard
            v-for="teamId in teamOrder(match)"
            :key="teamId"
            :match="match"
            :team-id="teamId"
            :lobby="lobby"
            :totals="totals"
            :max-damage="maxima.damage"
            :selected-puuid="selectedPuuid"
            @select="selectedPuuid = $event"
          />
        </section>

        <section v-if="player" class="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Card title="Combat" note="bars compare to the lobby best">
            <div class="space-y-2.5">
              <StatRow
                label="Damage to champions"
                :value="compact(player.totalDamageDealtToChampions)"
                :meter="(player.totalDamageDealtToChampions / maxima.damage) * 100"
              />
              <StatRow
                label="Damage taken"
                :value="compact(player.damageTaken)"
                :meter="(player.damageTaken / maxima.damageTaken) * 100"
              />
              <StatRow
                label="Physical"
                :value="compact(player.physicalDamageDealtToChampions)"
                divide
              />
              <StatRow label="Magic" :value="compact(player.magicDamageDealtToChampions)" />
              <StatRow label="True" :value="compact(player.trueDamageDealtToChampions)" />
              <div class="pt-1">
                <div class="flex h-1.5 overflow-hidden rounded-full bg-[#f0f0f3]">
                  <span
                    class="bg-ink"
                    :style="{
                      width: percent(
                        player.physicalDamageDealtToChampions /
                          Math.max(player.totalDamageDealtToChampions, 1)
                      ),
                    }"
                  />
                  <span
                    class="bg-[#9aa0aa]"
                    :style="{
                      width: percent(
                        player.magicDamageDealtToChampions /
                          Math.max(player.totalDamageDealtToChampions, 1)
                      ),
                    }"
                  />
                  <span
                    class="bg-[#d5d7dd]"
                    :style="{
                      width: percent(
                        player.trueDamageDealtToChampions /
                          Math.max(player.totalDamageDealtToChampions, 1)
                      ),
                    }"
                  />
                </div>
                <div class="mt-1.5 flex gap-3 text-[0.625rem] text-ink-3">
                  <span class="flex items-center gap-1"
                    ><i class="h-1.5 w-1.5 rounded-full bg-ink" />Physical</span
                  >
                  <span class="flex items-center gap-1"
                    ><i class="h-1.5 w-1.5 rounded-full bg-[#9aa0aa]" />Magic</span
                  >
                  <span class="flex items-center gap-1"
                    ><i class="h-1.5 w-1.5 rounded-full bg-[#d5d7dd]" />True</span
                  >
                </div>
              </div>
            </div>
          </Card>

          <Card title="Vision & objectives" note="bars compare to the lobby best">
            <div class="space-y-2.5">
              <StatRow
                label="Vision score"
                :value="player.visionScore"
                :meter="(player.visionScore / maxima.vision) * 100"
              />
              <StatRow
                label="Wards placed"
                :value="player.wardsPlaced"
                :meter="(player.wardsPlaced / maxima.wards) * 100"
              />
              <StatRow
                label="Wards cleared"
                :value="player.wardsKilled"
                :meter="(player.wardsKilled / maxima.wardsKilled) * 100"
              />
              <StatRow
                label="Control wards bought"
                :value="player.visionWardsBoughtInGame"
                :meter="(player.visionWardsBoughtInGame / maxima.controlWards) * 100"
              />
              <StatRow
                label="Damage to objectives"
                :value="compact(player.damageDealtToObjectives)"
                :meter="(player.damageDealtToObjectives / maxima.objectives) * 100"
                divide
              />
              <StatRow
                label="Damage to turrets"
                :value="compact(player.damageDealtToTurrets)"
                :meter="(player.damageDealtToTurrets / maxima.turrets) * 100"
              />
            </div>
          </Card>

          <Card title="Economy" note="bars compare to the lobby best">
            <div class="space-y-2.5">
              <StatRow
                label="Gold earned"
                :value="compact(player.goldEarned)"
                :meter="(player.goldEarned / maxima.gold) * 100"
                tone="gold"
              />
              <StatRow label="Gold per minute" :value="compact(player.goldEarned / minutes)" />
              <StatRow
                label="Creep score"
                :value="player.cs"
                :meter="(player.cs / maxima.cs) * 100"
                divide
              />
              <StatRow label="CS per minute" :value="(player.cs / minutes).toFixed(1)" />
              <StatRow label="Lane minions" :value="player.totalMinionsKilled" />
              <StatRow label="Jungle monsters" :value="player.neutralMinionsKilled" />
            </div>
          </Card>

          <Card title="Skill order" note="level each point was spent">
            <div class="scroll-x">
              <div class="min-w-[300px] space-y-1">
                <div
                  v-for="(row, key) in skills"
                  :key="key"
                  class="grid grid-cols-[16px_repeat(18,minmax(0,1fr))] items-center gap-1"
                >
                  <span class="label !text-[0.625rem]">{{ key }}</span>
                  <span
                    v-for="(level, index) in row"
                    :key="index"
                    class="num flex h-5 items-center justify-center rounded text-[0.5625rem] font-semibold"
                    :class="
                      level
                        ? key === 'R'
                          ? 'bg-ink text-white'
                          : 'bg-[#e7e8ec] text-ink'
                        : 'bg-[#f6f6f8] text-transparent'
                    "
                  >
                    {{ level ?? '·' }}
                  </span>
                </div>
              </div>
            </div>
            <p v-if="!skills.Q.some(Boolean)" class="mt-3 text-[0.6875rem] text-ink-3">
              No skill order recorded for this match.
            </p>
          </Card>

          <Card title="Pings" :note="`${totalPings(player)} total`">
            <div v-if="activePings.length" class="space-y-2.5">
              <StatRow
                v-for="ping in activePings"
                :key="ping.label"
                :label="ping.label"
                :value="ping.value"
                :meter="(ping.value / Math.max(totalPings(player), 1)) * 100"
              />
            </div>
            <p v-else class="py-4 text-center text-[0.8125rem] text-ink-3">Silent all game.</p>
          </Card>

          <Card title="Runes" :note="championName(player.championId)">
            <RuneGlyphs :runes="playerRunes" full />
            <p class="mt-3 text-[0.6875rem] text-ink-3">
              {{
                playerRunes.keystone
                  ? `Keystone and ${playerRunes.runes.length} further picks, read from the match timeline.`
                  : 'Only the rune trees are stored for this match, with no timeline to read the picks from.'
              }}
            </p>
          </Card>
        </section>
      </template>

      <!-- ═══════════════ TIMELINE ═══════════════ -->
      <template v-else-if="section === 'timeline'">
        <div v-if="!match.timeline?.length" class="card px-6 py-16 text-center">
          <p class="text-[0.9375rem] font-medium text-ink">No timeline for this match</p>
          <p class="mt-1.5 text-[0.8125rem] text-ink-2">
            Per-minute data isn’t stored for every game. The scoreboard is still complete.
          </p>
        </div>

        <template v-else>
          <section class="grid gap-5 lg:grid-cols-3">
            <Card
              v-for="graph in [
                { key: 'gold' as const, title: 'Gold' },
                { key: 'xp' as const, title: 'Experience' },
                { key: 'cs' as const, title: 'Creep score' },
              ]"
              :key="graph.key"
              :title="graph.title"
              :note="`${player?.gameName} vs ${opponent?.gameName ?? 'opponent'}`"
            >
              <div class="h-44">
                <LineChart :data="duelChart(graph.key)" :options="duelOptions" />
              </div>
            </Card>
          </section>

          <section class="grid gap-5 lg:grid-cols-2">
            <Card title="Gold difference" :note="`${player?.gameName}'s lead over their lane`">
              <div class="h-52">
                <LineChart :data="goldDiffChart" :options="diffOptions" />
              </div>
            </Card>

            <Card title="Team gold" note="blue against red, minute by minute">
              <div class="h-52">
                <LineChart :data="teamGoldChart" :options="duelOptions" />
              </div>
              <div class="mt-3 flex justify-center gap-5 text-[0.6875rem] text-ink-2">
                <span class="flex items-center gap-1.5"
                  ><i class="h-[2px] w-3 bg-win" />Blue side</span
                >
                <span class="flex items-center gap-1.5"
                  ><i class="h-[2px] w-3 bg-loss" />Red side</span
                >
              </div>
            </Card>
          </section>
        </template>
      </template>

      <!-- ═══════════════ COMPARISON ═══════════════ -->
      <template v-else>
        <Card title="Every player, ranked" note="sorted by lobby rating" flush>
          <div class="scroll-x">
            <table class="num w-full min-w-[900px] text-[0.75rem]">
              <thead>
                <tr class="border-b border-line text-left">
                  <th class="label px-4 py-2 font-semibold">#</th>
                  <th class="label px-2 py-2 font-semibold">Player</th>
                  <th class="label px-2 py-2 font-semibold">Rating</th>
                  <th class="label px-2 py-2 text-right font-semibold">KDA</th>
                  <th class="label px-2 py-2 text-right font-semibold">Damage</th>
                  <th class="label px-2 py-2 text-right font-semibold">Dmg/m</th>
                  <th class="label px-2 py-2 text-right font-semibold">Gold</th>
                  <th class="label px-2 py-2 text-right font-semibold">Gold/m</th>
                  <th class="label px-2 py-2 text-right font-semibold">CS</th>
                  <th class="label px-2 py-2 text-right font-semibold">CS/m</th>
                  <th class="label px-2 py-2 text-right font-semibold">Vis</th>
                  <th class="label px-2 py-2 text-right font-semibold">KP</th>
                  <th class="label px-4 py-2 text-right font-semibold">Pings</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(p, index) in ladder"
                  :key="p.puuid"
                  class="cursor-pointer border-b border-line last:border-0 transition-colors hover:bg-[#fafafb]"
                  :class="p.puuid === selectedPuuid ? 'bg-[#f4f5f8]' : ''"
                  @click="selectedPuuid = p.puuid"
                >
                  <td class="px-4 py-2 text-ink-3">{{ index + 1 }}</td>
                  <td class="px-2 py-2">
                    <div class="flex items-center gap-2">
                      <span
                        class="h-6 w-[2px] rounded-full"
                        :class="p.teamId === 100 ? 'bg-win' : 'bg-loss'"
                      />
                      <img
                        :src="champIcon(p.championId)"
                        :alt="championName(p.championId)"
                        class="thumb h-6 w-6 rounded"
                      />
                      <span class="max-w-[9rem] truncate font-medium text-ink">
                        {{ p.gameName }}
                      </span>
                      <span
                        v-if="p.puuid === lobby.mvpPuuid"
                        class="label rounded bg-[#f2f2f5] px-1 py-px !text-ink-2"
                      >
                        MVP
                      </span>
                    </div>
                  </td>
                  <td class="w-24 px-2 py-2">
                    <div class="mb-1 text-ink-2">{{ lobby.rating[p.puuid] }}</div>
                    <Meter
                      :value="lobby.rating[p.puuid]"
                      :tone="p.puuid === selectedPuuid ? 'ink' : 'muted'"
                    />
                  </td>
                  <td class="px-2 py-2 text-right text-ink">
                    {{ p.kills }}/{{ p.deaths }}/{{ p.assists }}
                  </td>
                  <td class="px-2 py-2 text-right text-ink-2">
                    {{ compact(p.totalDamageDealtToChampions) }}
                  </td>
                  <td class="px-2 py-2 text-right text-ink-3">
                    {{ compact(p.totalDamageDealtToChampions / minutes) }}
                  </td>
                  <td class="px-2 py-2 text-right text-gold">{{ compact(p.goldEarned) }}</td>
                  <td class="px-2 py-2 text-right text-ink-3">
                    {{ compact(p.goldEarned / minutes) }}
                  </td>
                  <td class="px-2 py-2 text-right text-ink-2">{{ p.cs }}</td>
                  <td class="px-2 py-2 text-right text-ink-3">
                    {{ (p.cs / minutes).toFixed(1) }}
                  </td>
                  <td class="px-2 py-2 text-right text-ink-2">{{ p.visionScore }}</td>
                  <td class="px-2 py-2 text-right text-ink-2">
                    {{ Math.round(killParticipation(p, totals)) }}%
                  </td>
                  <td class="px-4 py-2 text-right text-ink-3">{{ totalPings(p) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <section class="grid gap-5 lg:grid-cols-2">
          <Card
            v-for="teamId in teamOrder(match)"
            :key="`dmg-${teamId}`"
            title="Damage to champions"
            :note="teamId === 100 ? 'Blue side' : 'Red side'"
          >
            <div class="h-40">
              <BarChart
                :data="teamBarChart(teamId, (p) => p.totalDamageDealtToChampions)"
                :options="bars"
              />
            </div>
          </Card>
        </section>

        <section class="grid gap-5 lg:grid-cols-2">
          <Card
            v-for="teamId in teamOrder(match)"
            :key="`gold-${teamId}`"
            title="Gold earned"
            :note="teamId === 100 ? 'Blue side' : 'Red side'"
          >
            <div class="h-40">
              <BarChart :data="teamBarChart(teamId, (p) => p.goldEarned)" :options="bars" />
            </div>
          </Card>
        </section>

        <Card
          v-if="player && opponent"
          title="Lane matchup"
          :note="`${championName(player.championId)} against ${championName(opponent.championId)}`"
        >
          <div class="mb-4 flex items-center justify-between gap-3">
            <div class="flex min-w-0 items-center gap-2">
              <img
                :src="champIcon(player.championId)"
                :alt="championName(player.championId)"
                class="thumb h-8 w-8 rounded-md"
              />
              <span class="truncate text-[0.8125rem] font-medium text-ink">
                {{ player.gameName }}
              </span>
            </div>
            <span class="label shrink-0">vs</span>
            <div class="flex min-w-0 items-center justify-end gap-2">
              <span class="truncate text-[0.8125rem] font-medium text-ink">
                {{ opponent.gameName }}
              </span>
              <img
                :src="champIcon(opponent.championId)"
                :alt="championName(opponent.championId)"
                class="thumb h-8 w-8 rounded-md"
              />
            </div>
          </div>

          <ul class="space-y-3">
            <li v-for="row in duelRows" :key="row.label">
              <div class="num mb-1 flex items-baseline justify-between text-[0.75rem]">
                <span :class="row.a >= row.b ? 'font-semibold text-ink' : 'text-ink-2'">
                  {{ row.mine }}
                </span>
                <span class="label">{{ row.label }}</span>
                <span :class="row.b > row.a ? 'font-semibold text-ink' : 'text-ink-2'">
                  {{ row.theirs }}
                </span>
              </div>
              <div class="flex h-1 gap-px overflow-hidden rounded-full">
                <span class="flex-1 bg-[#f0f0f3]">
                  <span
                    class="ml-auto block h-full bg-ink"
                    :style="{ width: percent(row.a / Math.max(row.a + row.b, 1)) }"
                  />
                </span>
                <span class="flex-1 bg-[#f0f0f3]">
                  <span
                    class="block h-full bg-[#9aa0aa]"
                    :style="{ width: percent(row.b / Math.max(row.a + row.b, 1)) }"
                  />
                </span>
              </div>
            </li>
          </ul>
        </Card>
      </template>
    </div>
  </main>
</template>
