<script setup lang="ts">
import { computed, onMounted, ref, shallowReactive, watch } from 'vue'
import { Link } from '@inertiajs/vue3'
import { ChevronDown } from 'lucide-vue-next'
import { LineChart } from '../lib/lazy_charts.js'
import Card from './ui/Card.vue'
import EmptyState from './ui/EmptyState.vue'
import Meter from './ui/Meter.vue'
import Segmented from './ui/Segmented.vue'
import ItemRow from './ItemRow.vue'
import RuneGlyphs from './RuneGlyphs.vue'
import {
  champIcon,
  championName,
  loadChampions,
  loadItems,
  queueName,
  spellIcon,
  POSITION_NAMES,
} from '../lib/assets.js'
import { clock, compact, duration, kda, ordinal, timeAgo } from '../lib/format.js'
import {
  frameValue,
  indexTimeline,
  killParticipation,
  laneOpponent,
  matchMinutes,
  objectives,
  rankLobby,
  runeSet,
  teamMembers,
  teamOrder,
  teamTotals,
  teamWon,
} from '../lib/match.js'
import { CHART_COLORS, areaFill, lineOptions } from '../lib/chart.js'
import type { Match, Participant } from '../lib/types.js'

const props = defineProps<{
  matches: Match[]
  puuid: string
  summonerSlug: string
}>()

type TabKey = 'scoreboard' | 'graphs' | 'runes'

const TABS = [
  { value: 'scoreboard' as const, label: 'Scoreboard' },
  { value: 'graphs' as const, label: 'Graphs' },
  { value: 'runes' as const, label: 'Runes' },
]

const expanded = ref<string | null>(null)
const tab = ref<Record<string, TabKey>>({})
const focus = ref<Record<string, string>>({})
/** Full match payloads, fetched when a graph or rune view first needs the timeline. */
const details = shallowReactive<Record<string, Match>>({})
const loading = ref<Record<string, boolean>>({})
const failed = ref<Record<string, boolean>>({})

onMounted(() => {
  loadChampions()
  loadItems()
})

/* ── Rows ───────────────────────────────────────────────────────
   Every value the list renders is derived once, here, rather than by
   calling helpers from the template. A template expression re-runs on
   each render, and the summary row alone referenced `me(match)` — a
   linear search through ten participants — fifteen times per row. This
   also deliberately reads only from `props.matches`: the scoreboard
   fields are all present in the summary payload, so opening one match
   and loading its timeline no longer invalidates the derived data for
   every other row in the list.
   ────────────────────────────────────────────────────────────── */

function maxOf(participants: Participant[], read: (p: Participant) => number) {
  let max = 1
  for (const p of participants) {
    const value = read(p) || 0
    if (value > max) max = value
  }
  return max
}

const rows = computed(() =>
  props.matches.map((match) => {
    const participants = match.participants
    const me = participants.find((p) => p.puuid === props.puuid)
    const totals = teamTotals(match)
    const lobby = rankLobby(match)
    const minutes = matchMinutes(match)

    const maxDamage = maxOf(participants, (p) => p.totalDamageDealtToChampions)

    return {
      match,
      matchId: match.matchId,
      me,
      win: Boolean(me?.win),
      totals,
      lobby,
      maxDamage,
      queue: queueName(match.queueId),
      duration: duration(match.duration),
      ago: timeAgo(match.gameStartMs),
      championId: me?.championId ?? 0,
      championLabel: championName(me?.championId ?? 0),
      spells: (me?.spells ?? []).slice(0, 2),
      items: me?.items ?? [],
      kdaRatio: kda(me?.kills ?? 0, me?.deaths ?? 0, me?.assists ?? 0).toFixed(2),
      // A match can be listed without this player's row if ingestion was
      // partial; the previous code assumed it was always there and threw.
      killParticipation: me ? Math.round(killParticipation(me, totals)) : 0,
      csPerMinute: ((me?.cs ?? 0) / minutes).toFixed(1),
      gold: compact(me?.goldEarned ?? 0),
      damage: compact(me?.totalDamageDealtToChampions ?? 0),
      standing: ordinal(lobby.rank[props.puuid]),
      /** Winning side first, each side's members already lane-ordered. */
      teams: teamOrder(match).map((teamId) => ({
        teamId,
        won: teamWon(match, teamId),
        totals: totals[teamId],
        objectives: objectives(match, teamId),
        members: teamMembers(match, teamId).map((p) => ({
          participant: p,
          isMe: p.puuid === props.puuid,
          championLabel: championName(p.championId),
          roleLabel: POSITION_NAMES[p.position] || championName(p.championId),
          killParticipation: Math.round(killParticipation(p, totals)),
          damage: compact(p.totalDamageDealtToChampions),
          damageShare: (p.totalDamageDealtToChampions / maxDamage) * 100,
        })),
      })),
    }
  })
)

type Row = (typeof rows.value)[number]

function toggle(matchId: string) {
  if (expanded.value === matchId) {
    expanded.value = null
    return
  }
  expanded.value = matchId
  tab.value[matchId] ??= 'scoreboard'
  focus.value[matchId] ??= props.puuid
}

// The list already contains the scoreboard. Only graphs and runes need timeline data.
watch(
  () => [expanded.value, expanded.value ? tab.value[expanded.value] : null] as const,
  ([matchId, selectedTab]) => {
    if (matchId && selectedTab !== 'scoreboard') void fetchDetails(matchId)
  }
)

/** Frames per player for the open match, indexed once. */
const timeline = computed(() => indexTimeline(expanded.value ? details[expanded.value] : null))

async function fetchDetails(matchId: string) {
  if (details[matchId] || loading.value[matchId]) return
  loading.value[matchId] = true
  failed.value[matchId] = false
  try {
    const res = await fetch(`/api/matches/${encodeURIComponent(matchId)}`)
    if (!res.ok) throw new Error('request failed')
    details[matchId] = await res.json()
  } catch {
    failed.value[matchId] = true
  } finally {
    loading.value[matchId] = false
  }
}

/* ── Charts ─────────────────────────────────────────────────── */
function focused(match: Match) {
  const chosen = focus.value[match.matchId] ?? props.puuid
  return match.participants.find((p) => p.puuid === chosen) ?? match.participants[0]
}

function series(p: Participant | undefined, key: 'gold' | 'cs' | 'xp') {
  if (!p) return { labels: [] as string[], values: [] as number[] }
  const frames = timeline.value[p.puuid] ?? []
  return {
    labels: frames.map((f) => clock(f.frameMs)),
    values: frames.map((f) => frameValue(f, key)),
  }
}

function chart(match: Match, key: 'gold' | 'cs' | 'xp') {
  const player = focused(match)
  const enemy = laneOpponent(match, player)
  const mine = series(player, key)
  const theirs = series(enemy, key)
  return {
    labels: mine.labels.length ? mine.labels : theirs.labels,
    datasets: [
      {
        label: player?.gameName ?? 'You',
        data: mine.values,
        borderColor: CHART_COLORS.ink,
        backgroundColor: areaFill(CHART_COLORS.ink),
        borderWidth: 1.75,
        pointRadius: 0,
        pointHoverRadius: 3,
        tension: 0.25,
        fill: true,
      },
      {
        label: enemy?.gameName ?? 'Opponent',
        data: theirs.values,
        borderColor: CHART_COLORS.muted,
        backgroundColor: 'transparent',
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

const chartOptions = lineOptions({ yTicks: 4, xTicks: 5 })

const GRAPHS = [
  { key: 'gold' as const, title: 'Gold' },
  { key: 'xp' as const, title: 'Experience' },
  { key: 'cs' as const, title: 'Creep score' },
]

/** The match a graph or rune view reads, which is the one with a timeline. */
function detailed(row: Row) {
  return details[row.matchId] ?? row.match
}
</script>

<template>
  <Card title="Matches" :note="`${matches.length} most recent`" flush>
    <EmptyState
      v-if="!matches.length"
      message="No matches recorded"
      hint="Hit Update to pull this player’s history from Riot."
    />

    <ul v-else class="divide-y divide-line">
      <li
        v-for="row in rows"
        :key="row.matchId"
        :style="
          expanded !== row.matchId
            ? { contentVisibility: 'auto', containIntrinsicSize: 'auto 90px' }
            : undefined
        "
      >
        <!-- ── Summary row ───────────────────────────────── -->
        <button
          type="button"
          class="flex w-full items-stretch text-left transition-colors hover:bg-[#fafafb]"
          :aria-expanded="expanded === row.matchId"
          @click="toggle(row.matchId)"
        >
          <span
            class="w-[3px] shrink-0"
            :class="row.win ? 'bg-win' : 'bg-loss'"
            aria-hidden="true"
          />

          <span class="flex min-w-0 flex-1 items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
            <!-- Champion + summoner spells -->
            <span class="flex shrink-0 items-center gap-1.5">
              <span class="relative">
                <img
                  :src="champIcon(row.championId)"
                  :alt="row.championLabel"
                  width="40"
                  height="40"
                  loading="lazy"
                  decoding="async"
                  class="thumb h-10 w-10 rounded-lg"
                />
                <span
                  class="num absolute -bottom-1 -right-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-surface px-[3px] text-[9px] font-semibold text-white"
                  :class="row.win ? 'bg-win' : 'bg-loss'"
                >
                  {{ row.me?.champLevel }}
                </span>
              </span>
              <span class="flex flex-col gap-[2px]">
                <img
                  v-for="spell in row.spells"
                  :key="spell"
                  :src="spellIcon(spell)"
                  alt=""
                  width="19"
                  height="19"
                  loading="lazy"
                  decoding="async"
                  class="thumb h-[19px] w-[19px] rounded"
                />
              </span>
            </span>

            <!-- Outcome -->
            <span class="min-w-0 flex-1 sm:w-[7rem] sm:flex-none">
              <span
                class="block text-[0.8125rem] font-semibold"
                :class="row.win ? 'text-win' : 'text-loss'"
              >
                {{ row.win ? 'Victory' : 'Defeat' }}
              </span>
              <span class="block truncate text-[0.6875rem] text-ink-2">
                {{ row.queue }}
              </span>
              <span class="num block whitespace-nowrap text-[0.6875rem] text-ink-3">
                {{ row.duration }} · {{ row.ago }}
              </span>
            </span>

            <!-- KDA -->
            <span class="w-[6.25rem] shrink-0 sm:w-[7.5rem]">
              <span class="num block text-[0.875rem] font-semibold text-ink">
                {{ row.me?.kills }}
                <span class="text-ink-4">/</span>
                <span class="text-loss">{{ row.me?.deaths }}</span>
                <span class="text-ink-4">/</span>
                {{ row.me?.assists }}
              </span>
              <span class="num block text-[0.6875rem] text-ink-3">
                {{ row.kdaRatio }} KDA · {{ row.killParticipation }}% KP
              </span>
            </span>

            <!-- Economy -->
            <span class="hidden w-[9rem] shrink-0 grid-cols-2 gap-x-2 gap-y-0.5 sm:grid">
              <span class="num text-[0.6875rem] text-ink-2">
                <span class="font-medium text-ink">{{ row.me?.cs }}</span> cs
                <span class="text-ink-3">({{ row.csPerMinute }})</span>
              </span>
              <span class="num text-[0.6875rem] text-ink-2">
                <span class="font-medium text-ink">{{ row.gold }}</span>
                gold
              </span>
              <span class="num text-[0.6875rem] text-ink-2">
                <span class="font-medium text-ink">{{ row.damage }}</span>
                dmg
              </span>
              <span class="num text-[0.6875rem] text-ink-2">
                <span class="font-medium text-ink">{{ row.me?.visionScore }}</span> vis
              </span>
            </span>

            <!-- Items -->
            <span class="hidden shrink-0 lg:flex">
              <ItemRow :items="row.items" size="xs" />
            </span>

            <!-- Standing in the lobby -->
            <span class="ml-auto flex shrink-0 items-center gap-3 pl-1">
              <span class="hidden text-right sm:block">
                <span class="num block text-[0.8125rem] font-semibold text-ink">
                  {{ row.standing }}
                </span>
                <span class="label">of 10</span>
              </span>
              <ChevronDown
                class="h-4 w-4 text-ink-3 transition-transform"
                :class="expanded === row.matchId && 'rotate-180'"
              />
            </span>
          </span>
        </button>

        <!-- ── Expanded detail ───────────────────────────── -->
        <div v-if="expanded === row.matchId" class="border-t border-line bg-[#fcfcfd] px-4 py-4">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Segmented v-model="tab[row.matchId]" :options="TABS" />
            <Link
              :href="`/${encodeURIComponent(summonerSlug)}/match/${encodeURIComponent(row.matchId)}`"
              class="text-[0.75rem] font-medium text-ink-2 underline-offset-2 hover:text-ink hover:underline"
            >
              Full analysis →
            </Link>
          </div>

          <p
            v-if="tab[row.matchId] !== 'scoreboard' && loading[row.matchId]"
            class="py-6 text-center text-[0.8125rem] text-ink-3"
          >
            Loading match details…
          </p>
          <p
            v-else-if="tab[row.matchId] !== 'scoreboard' && failed[row.matchId]"
            class="flex items-center justify-center gap-3 py-6 text-[0.8125rem] text-neg"
          >
            Couldn’t load this match.
            <button class="btn" @click="fetchDetails(row.matchId)">Retry</button>
          </p>

          <template v-else>
            <!-- Scoreboard -->
            <div v-if="tab[row.matchId] === 'scoreboard'" class="grid gap-4 lg:grid-cols-2">
              <div v-for="team in row.teams" :key="team.teamId" class="card">
                <div class="flex items-baseline justify-between border-b border-line px-3 py-2">
                  <span
                    class="text-[0.75rem] font-semibold"
                    :class="team.won ? 'text-win' : 'text-loss'"
                  >
                    {{ team.won ? 'Victory' : 'Defeat' }}
                    <span class="font-normal text-ink-3">
                      · {{ team.teamId === 100 ? 'Blue' : 'Red' }}
                    </span>
                  </span>
                  <span class="num flex gap-2.5 text-[0.6875rem] text-ink-3">
                    <span>{{ team.totals.kills }} kills</span>
                    <span>{{ compact(team.totals.gold) }} gold</span>
                    <span title="Towers · Dragons · Barons">
                      {{ team.objectives.towers }}/{{ team.objectives.dragons }}/{{
                        team.objectives.barons
                      }}
                    </span>
                  </span>
                </div>

                <ul class="divide-y divide-line">
                  <li
                    v-for="member in team.members"
                    :key="member.participant.puuid"
                    class="px-3 py-2"
                    :class="member.isMe ? 'bg-[#f6f7f9]' : ''"
                  >
                    <div class="flex items-center gap-2.5">
                      <img
                        :src="champIcon(member.participant.championId)"
                        :alt="member.championLabel"
                        width="28"
                        height="28"
                        loading="lazy"
                        decoding="async"
                        class="thumb h-7 w-7 shrink-0 rounded-md"
                      />
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-[0.75rem] font-medium text-ink">
                          {{ member.participant.gameName }}
                        </span>
                        <span class="num block truncate text-[0.625rem] text-ink-3">
                          {{ member.roleLabel }} · {{ member.participant.cs }} cs
                        </span>
                      </span>
                      <span class="num w-[4.25rem] shrink-0 text-right">
                        <span class="block text-[0.75rem] font-medium text-ink">
                          {{ member.participant.kills }}/{{ member.participant.deaths }}/{{
                            member.participant.assists
                          }}
                        </span>
                        <span class="block text-[0.625rem] text-ink-3">
                          {{ member.killParticipation }}% kp
                        </span>
                      </span>
                      <span class="num w-[3rem] shrink-0 text-right">
                        <span class="block text-[0.75rem] text-ink-2">{{ member.damage }}</span>
                        <span class="block text-[0.625rem] text-ink-3">dmg</span>
                      </span>
                    </div>
                    <Meter
                      class="mt-1.5"
                      :value="member.damageShare"
                      :tone="member.isMe ? 'ink' : 'muted'"
                    />
                  </li>
                </ul>
              </div>
            </div>

            <!-- Graphs -->
            <div v-else-if="tab[row.matchId] === 'graphs'">
              <p
                v-if="!detailed(row).timeline?.length"
                class="py-6 text-center text-[0.8125rem] text-ink-3"
              >
                No timeline recorded for this match.
              </p>
              <div v-else class="grid gap-4 md:grid-cols-3">
                <div v-for="graph in GRAPHS" :key="graph.key" class="card p-3">
                  <div class="mb-2 flex items-baseline justify-between">
                    <h4 class="card-title">{{ graph.title }}</h4>
                    <span class="text-[0.625rem] text-ink-3">over time</span>
                  </div>
                  <div class="h-36">
                    <LineChart :data="chart(detailed(row), graph.key)" :options="chartOptions" />
                  </div>
                  <div class="mt-2 flex items-center justify-between text-[0.625rem]">
                    <span class="flex items-center gap-1.5 text-ink">
                      <span class="h-[2px] w-3 bg-ink" />
                      {{ focused(detailed(row))?.gameName }}
                    </span>
                    <span class="flex items-center gap-1.5 text-ink-3">
                      <span
                        class="h-[2px] w-3"
                        style="
                          background: repeating-linear-gradient(
                            90deg,
                            #9aa0aa 0 4px,
                            transparent 4px 7px
                          );
                        "
                      />
                      {{ laneOpponent(detailed(row), focused(detailed(row)))?.gameName }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Runes -->
            <div v-else class="grid gap-4 lg:grid-cols-2">
              <div v-for="team in row.teams" :key="team.teamId">
                <h4 class="card-title mb-2">{{ team.teamId === 100 ? 'Blue' : 'Red' }} team</h4>
                <ul class="card divide-y divide-line">
                  <li
                    v-for="member in team.members"
                    :key="member.participant.puuid"
                    class="flex items-center gap-3 px-3 py-2"
                    :class="member.isMe ? 'bg-[#f6f7f9]' : ''"
                  >
                    <img
                      :src="champIcon(member.participant.championId)"
                      :alt="member.championLabel"
                      width="28"
                      height="28"
                      loading="lazy"
                      decoding="async"
                      class="thumb h-7 w-7 rounded-md"
                    />
                    <span class="min-w-0 flex-1 truncate text-[0.75rem] text-ink">
                      {{ member.championLabel }}
                    </span>
                    <RuneGlyphs
                      :runes="runeSet(timeline[member.participant.puuid] ?? [], member.participant)"
                    />
                  </li>
                </ul>
              </div>
            </div>
          </template>
        </div>
      </li>
    </ul>
  </Card>
</template>
