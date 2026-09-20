<script setup lang="ts">
import { computed, onMounted, ref, shallowReactive, watch } from 'vue'
import { Link } from '@inertiajs/vue3'
import { ChevronDown, Share2, Check } from 'lucide-vue-next'
import { LineChart } from '../lib/lazy_charts.js'
import MatchScoreboard from './MatchScoreboard.vue'
import RuneBuild from './RuneBuild.vue'
import PlayerPicker from './PlayerPicker.vue'
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

type TabKey = 'scoreboard' | 'details' | 'graphs' | 'runes'

const TABS = [
  { value: 'scoreboard' as const, label: 'Overview' },
  { value: 'details' as const, label: 'Details' },
  { value: 'graphs' as const, label: 'Timeline' },
  { value: 'runes' as const, label: 'Runes' },
]

const expanded = ref<string | null>(null)
const copied = ref('')
const copyError = ref('')
const minute = ref(0)
async function shareMatch(id: string) {
  copyError.value = ''
  try {
    await navigator.clipboard.writeText(
      `${location.origin}/${encodeURIComponent(props.summonerSlug)}/match/${encodeURIComponent(id)}`
    )
    copied.value = id
  } catch {
    copyError.value = 'Could not copy the link. Open Full analysis and copy its address.'
  }
}
function day(ms: number) {
  return new Date(Number(ms)).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}
const days = computed(() => {
  const result: Record<string, { wins: number; losses: number }> = {}
  for (const m of props.matches) {
    const d = day(m.gameStartMs)
    result[d] ??= { wins: 0, losses: 0 }
    const p = m.participants.find((p) => p.puuid === props.puuid)
    if (p) result[d][p.win ? 'wins' : 'losses']++
  }
  return result
})
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
  minute.value = 0
  tab.value[matchId] ??= 'scoreboard'
  focus.value[matchId] ??= props.puuid
}

// The list already contains the scoreboard. Only graphs and runes need timeline data.
watch(
  () => [expanded.value, expanded.value ? tab.value[expanded.value] : null] as const,
  ([matchId, selectedTab]) => {
    if (matchId && (selectedTab === 'graphs' || selectedTab === 'runes')) void fetchDetails(matchId)
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
  <section class="match-feed">
    <p v-if="copyError" role="alert" class="notice-error">{{ copyError }}</p>
    <EmptyState
      v-if="!matches.length"
      message="No matches recorded"
      hint="Hit Update to pull this player’s history from Riot."
    />

    <ul v-else class="match-feed-list">
      <li v-for="(row, rowIndex) in rows" :key="row.matchId">
        <div
          v-if="
            rowIndex === 0 ||
            day(row.match.gameStartMs) !== day(rows[rowIndex - 1].match.gameStartMs)
          "
          class="match-day"
        >
          <span>{{ day(row.match.gameStartMs) }}</span
          ><span
            ><b class="text-win">{{ days[day(row.match.gameStartMs)].wins }}W</b>
            <b class="text-loss">{{ days[day(row.match.gameStartMs)].losses }}L</b
            ><span>
              ·
              {{ days[day(row.match.gameStartMs)].wins + days[day(row.match.gameStartMs)].losses }}
              games</span
            ></span
          >
        </div>
        <div
          class="match-card"
          :class="[
            row.win ? 'match-win' : 'match-loss',
            { 'match-open': expanded === row.matchId },
          ]"
        >
          <button
            type="button"
            class="match-summary"
            :aria-expanded="expanded === row.matchId"
            @click="toggle(row.matchId)"
          >
            <span class="match-outcome"
              ><strong>{{ row.win ? 'Victory' : 'Defeat' }}</strong
              ><span>{{ row.queue }}</span
              ><small>{{ row.duration }} · {{ row.ago }}</small></span
            >
            <span class="match-champion"
              ><span class="match-portrait"
                ><img
                  :src="champIcon(row.championId)"
                  :alt="row.championLabel"
                  loading="lazy"
                /><small>{{ row.me?.champLevel }}</small></span
              ><span class="match-spells"
                ><img
                  v-for="spell in row.spells"
                  :key="spell"
                  :src="spellIcon(spell)"
                  alt="Summoner spell"
                  loading="lazy" /></span
              ><span class="match-champ-label"
                >{{ row.championLabel
                }}<small>{{ POSITION_NAMES[row.me?.position ?? ''] || '—' }}</small></span
              ></span
            >
            <span class="match-kda"
              ><strong
                >{{ row.me?.kills }} <i>/</i> <em>{{ row.me?.deaths }}</em> <i>/</i>
                {{ row.me?.assists }}</strong
              ><span
                >{{ row.kdaRatio }} KDA <small>· {{ row.killParticipation }}% KP</small></span
              ></span
            >
            <span class="match-economy"
              ><strong
                >{{ row.me?.cs }} <small>CS</small> <span>({{ row.csPerMinute }}/min)</span></strong
              ><span>{{ row.damage }} damage · {{ row.me?.visionScore }} vision</span></span
            >
            <span
              class="match-standing"
              title="Performance rank in this lobby, based on damage, gold, and KDA"
              ><strong>{{ row.standing }}</strong
              ><small>in lobby</small></span
            >
            <ChevronDown
              :size="16"
              class="match-chevron"
              :class="{ 'rotate-180': expanded === row.matchId }"
            />
          </button>
          <div class="match-loadout">
            <div class="match-build">
              <ItemRow :items="row.items" size="sm" /><span class="loadout-separator" /><RuneGlyphs
                :runes="runeSet([], row.me)"
              />
            </div>
            <div class="match-teams">
              <div
                v-for="team in row.teams"
                :key="team.teamId"
                :class="team.teamId === 100 ? 'team-blue' : 'team-red'"
              >
                <img
                  v-for="member in team.members"
                  :key="member.participant.puuid"
                  :src="champIcon(member.participant.championId)"
                  :alt="member.championLabel"
                  :title="`${member.participant.gameName} · ${member.championLabel}`"
                  :class="{ 'team-me': member.isMe }"
                  loading="lazy"
                />
              </div>
            </div>
            <button
              class="icon-button match-share"
              :aria-label="`Share match ${row.matchId}`"
              @click="shareMatch(row.matchId)"
            >
              <Check v-if="copied === row.matchId" :size="14" /><Share2 v-else :size="14" />
            </button>
          </div>

          <!-- ── Expanded detail ───────────────────────────── -->
          <div v-if="expanded === row.matchId" class="match-detail">
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
              v-if="
                (tab[row.matchId] === 'graphs' || tab[row.matchId] === 'runes') &&
                loading[row.matchId]
              "
              class="py-6 text-center text-[0.8125rem] text-ink-3"
            >
              Loading match details…
            </p>
            <p
              v-else-if="
                (tab[row.matchId] === 'graphs' || tab[row.matchId] === 'runes') &&
                failed[row.matchId]
              "
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

              <div v-else-if="tab[row.matchId] === 'details'" class="space-y-4">
                <MatchScoreboard
                  v-for="team in row.teams"
                  :key="team.teamId"
                  :match="row.match"
                  :team-id="team.teamId"
                  :lobby="row.lobby"
                  :totals="row.totals"
                  :max-damage="row.maxDamage"
                  :selected-puuid="focus[row.matchId] ?? puuid"
                  @select="focus[row.matchId] = $event"
                />
              </div>
              <!-- Graphs -->
              <div v-else-if="tab[row.matchId] === 'graphs'">
                <p
                  v-if="!detailed(row).timeline?.length"
                  class="py-6 text-center text-[0.8125rem] text-ink-3"
                >
                  No timeline recorded for this match.
                </p>
                <div v-else class="space-y-4">
                  <PlayerPicker v-model="focus[row.matchId]" :match="detailed(row)" />
                  <div class="timeline-snapshot">
                    <label
                      >Timeline
                      <input
                        v-model.number="minute"
                        type="range"
                        min="0"
                        :max="
                          Math.max(0, (timeline[focus[row.matchId] ?? puuid]?.length ?? 1) - 1)
                        " /></label
                    ><span v-if="timeline[focus[row.matchId] ?? puuid]?.[minute]"
                      >{{ clock(timeline[focus[row.matchId] ?? puuid][minute].frameMs) }} ·
                      {{ compact(timeline[focus[row.matchId] ?? puuid][minute].goldTotal) }} gold ·
                      {{ timeline[focus[row.matchId] ?? puuid][minute].cs }} CS · Level
                      {{ timeline[focus[row.matchId] ?? puuid][minute].level }}</span
                    >
                  </div>
                  <div class="grid gap-4 md:grid-cols-3">
                    <div v-for="graph in GRAPHS" :key="graph.key" class="card p-3">
                      <div class="mb-2 flex items-baseline justify-between">
                        <h4 class="card-title">{{ graph.title }}</h4>
                        <span class="text-[0.625rem] text-ink-3">over time</span>
                      </div>
                      <div class="h-36">
                        <LineChart
                          :data="chart(detailed(row), graph.key)"
                          :options="chartOptions"
                        />
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
              </div>

              <div v-else class="space-y-4">
                <PlayerPicker v-model="focus[row.matchId]" :match="detailed(row)" /><RuneBuild
                  :runes="runeSet(timeline[focus[row.matchId] ?? puuid] ?? [], focused(row.match))"
                />
              </div>
            </template>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>
