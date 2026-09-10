<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import { ChevronDown } from 'lucide-vue-next'
import { Line as LineChart } from 'vue-chartjs'
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
  loadRunes,
  queueName,
  spellIcon,
  POSITION_NAMES,
} from '../lib/ddragon.js'
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
import { CHART_COLORS, areaFill, lineOptions, useChartJs } from '../lib/chart.js'
import type { Match, Participant } from '../lib/types.js'

useChartJs()

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
/** Full match payloads (with timeline), fetched the first time a row opens. */
const details = ref<Record<string, Match>>({})
const loading = ref<Record<string, boolean>>({})
const failed = ref<Record<string, boolean>>({})

onMounted(() => {
  loadChampions()
  loadItems()
  loadRunes()
})

/* ── Row-level derived data ─────────────────────────────────── */
function resolve(match: Match) {
  return details.value[match.matchId] ?? match
}

function me(match: Match) {
  return match.participants.find((p) => p.puuid === props.puuid)
}

function focused(match: Match) {
  const chosen = focus.value[match.matchId] ?? props.puuid
  return match.participants.find((p) => p.puuid === chosen) ?? match.participants[0]
}

/** Precomputed per match: lobby ranking, team totals, lobby-wide maxima. */
const context = computed(() => {
  const out: Record<
    string,
    {
      lobby: ReturnType<typeof rankLobby>
      totals: ReturnType<typeof teamTotals>
      maxDamage: number
      maxGold: number
      maxCs: number
      maxVision: number
    }
  > = {}
  for (const match of props.matches) {
    const full = resolve(match)
    out[match.matchId] = {
      lobby: rankLobby(full),
      totals: teamTotals(full),
      maxDamage: Math.max(...full.participants.map((p) => p.totalDamageDealtToChampions || 0), 1),
      maxGold: Math.max(...full.participants.map((p) => p.goldEarned || 0), 1),
      maxCs: Math.max(...full.participants.map((p) => p.cs || 0), 1),
      maxVision: Math.max(...full.participants.map((p) => p.visionScore || 0), 1),
    }
  }
  return out
})

async function toggle(matchId: string) {
  if (expanded.value === matchId) {
    expanded.value = null
    return
  }
  expanded.value = matchId
  tab.value[matchId] ??= 'scoreboard'
  focus.value[matchId] ??= props.puuid
  await fetchDetails(matchId)
}

async function fetchDetails(matchId: string) {
  if (details.value[matchId] || loading.value[matchId]) return
  loading.value[matchId] = true
  failed.value[matchId] = false
  try {
    const res = await fetch(`/api/matches/${encodeURIComponent(matchId)}`)
    if (!res.ok) throw new Error('request failed')
    details.value[matchId] = await res.json()
  } catch {
    failed.value[matchId] = true
  } finally {
    loading.value[matchId] = false
  }
}

/* ── Charts ─────────────────────────────────────────────────── */
function series(match: Match, p: Participant | undefined, key: 'gold' | 'cs' | 'xp') {
  if (!p) return { labels: [] as string[], values: [] as number[] }
  const frames = indexTimeline(match)[p.puuid] ?? []
  return {
    labels: frames.map((f) => clock(f.frameMs)),
    values: frames.map((f) => frameValue(f, key)),
  }
}

function chart(match: Match, key: 'gold' | 'cs' | 'xp') {
  const player = focused(match)
  const enemy = laneOpponent(match, player)
  const mine = series(match, player, key)
  const theirs = series(match, enemy, key)
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
</script>

<template>
  <Card title="Matches" :note="`${matches.length} most recent`" flush>
    <EmptyState
      v-if="!matches.length"
      message="No matches recorded"
      hint="Hit Update to pull this player’s history from Riot."
    />

    <ul v-else class="divide-y divide-line">
      <li v-for="match in matches" :key="match.matchId">
        <!-- ── Summary row ───────────────────────────────── -->
        <button
          type="button"
          class="flex w-full items-stretch text-left transition-colors hover:bg-[#fafafb]"
          :aria-expanded="expanded === match.matchId"
          @click="toggle(match.matchId)"
        >
          <span
            class="w-[3px] shrink-0"
            :class="me(match)?.win ? 'bg-win' : 'bg-loss'"
            aria-hidden="true"
          />

          <span class="flex min-w-0 flex-1 items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
            <!-- Champion + summoner spells -->
            <span class="flex shrink-0 items-center gap-1.5">
              <span class="relative">
                <img
                  :src="champIcon(me(match)?.championId ?? 0)"
                  :alt="championName(me(match)?.championId ?? 0)"
                  class="thumb h-10 w-10 rounded-lg"
                />
                <span
                  class="num absolute -bottom-1 -right-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-surface px-[3px] text-[9px] font-semibold text-white"
                  :class="me(match)?.win ? 'bg-win' : 'bg-loss'"
                >
                  {{ me(match)?.champLevel }}
                </span>
              </span>
              <span class="flex flex-col gap-[2px]">
                <img
                  v-for="spell in (me(match)?.spells ?? []).slice(0, 2)"
                  :key="spell"
                  :src="spellIcon(spell)"
                  alt=""
                  class="thumb h-[19px] w-[19px] rounded"
                />
              </span>
            </span>

            <!-- Outcome -->
            <span class="min-w-0 flex-1 sm:w-[7rem] sm:flex-none">
              <span
                class="block text-[0.8125rem] font-semibold"
                :class="me(match)?.win ? 'text-win' : 'text-loss'"
              >
                {{ me(match)?.win ? 'Victory' : 'Defeat' }}
              </span>
              <span class="block truncate text-[0.6875rem] text-ink-2">
                {{ queueName(match.queueId) }}
              </span>
              <span class="num block whitespace-nowrap text-[0.6875rem] text-ink-3">
                {{ duration(match.duration) }} · {{ timeAgo(match.gameStartMs) }}
              </span>
            </span>

            <!-- KDA -->
            <span class="w-[6.25rem] shrink-0 sm:w-[7.5rem]">
              <span class="num block text-[0.875rem] font-semibold text-ink">
                {{ me(match)?.kills }}
                <span class="text-ink-4">/</span>
                <span class="text-loss">{{ me(match)?.deaths }}</span>
                <span class="text-ink-4">/</span>
                {{ me(match)?.assists }}
              </span>
              <span class="num block text-[0.6875rem] text-ink-3">
                {{
                  kda(
                    me(match)?.kills ?? 0,
                    me(match)?.deaths ?? 0,
                    me(match)?.assists ?? 0
                  ).toFixed(2)
                }}
                KDA ·
                {{ Math.round(killParticipation(me(match)!, context[match.matchId].totals)) }}% KP
              </span>
            </span>

            <!-- Economy -->
            <span class="hidden w-[9rem] shrink-0 grid-cols-2 gap-x-2 gap-y-0.5 sm:grid">
              <span class="num text-[0.6875rem] text-ink-2">
                <span class="font-medium text-ink">{{ me(match)?.cs }}</span> cs
                <span class="text-ink-3">
                  ({{ ((me(match)?.cs ?? 0) / matchMinutes(match)).toFixed(1) }})
                </span>
              </span>
              <span class="num text-[0.6875rem] text-ink-2">
                <span class="font-medium text-ink">{{ compact(me(match)?.goldEarned ?? 0) }}</span>
                gold
              </span>
              <span class="num text-[0.6875rem] text-ink-2">
                <span class="font-medium text-ink">
                  {{ compact(me(match)?.totalDamageDealtToChampions ?? 0) }}
                </span>
                dmg
              </span>
              <span class="num text-[0.6875rem] text-ink-2">
                <span class="font-medium text-ink">{{ me(match)?.visionScore }}</span> vis
              </span>
            </span>

            <!-- Items -->
            <span class="hidden shrink-0 lg:flex">
              <ItemRow :items="me(match)?.items ?? []" size="xs" />
            </span>

            <!-- Standing in the lobby -->
            <span class="ml-auto flex shrink-0 items-center gap-3 pl-1">
              <span class="hidden text-right sm:block">
                <span class="num block text-[0.8125rem] font-semibold text-ink">
                  {{ ordinal(context[match.matchId].lobby.rank[props.puuid]) }}
                </span>
                <span class="label">of 10</span>
              </span>
              <ChevronDown
                class="h-4 w-4 text-ink-3 transition-transform"
                :class="expanded === match.matchId && 'rotate-180'"
              />
            </span>
          </span>
        </button>

        <!-- ── Expanded detail ───────────────────────────── -->
        <div v-if="expanded === match.matchId" class="border-t border-line bg-[#fcfcfd] px-4 py-4">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Segmented v-model="tab[match.matchId]" :options="TABS" />
            <Link
              :href="`/${encodeURIComponent(summonerSlug)}/match/${encodeURIComponent(match.matchId)}`"
              class="text-[0.75rem] font-medium text-ink-2 underline-offset-2 hover:text-ink hover:underline"
            >
              Full analysis →
            </Link>
          </div>

          <p v-if="loading[match.matchId]" class="py-6 text-center text-[0.8125rem] text-ink-3">
            Loading match details…
          </p>
          <p
            v-else-if="failed[match.matchId]"
            class="flex items-center justify-center gap-3 py-6 text-[0.8125rem] text-neg"
          >
            Couldn’t load this match.
            <button class="btn" @click="fetchDetails(match.matchId)">Retry</button>
          </p>

          <template v-else>
            <!-- Scoreboard -->
            <div v-if="tab[match.matchId] === 'scoreboard'" class="grid gap-4 lg:grid-cols-2">
              <div v-for="teamId in teamOrder(resolve(match))" :key="teamId" class="card">
                <div class="flex items-baseline justify-between border-b border-line px-3 py-2">
                  <span
                    class="text-[0.75rem] font-semibold"
                    :class="teamWon(resolve(match), teamId) ? 'text-win' : 'text-loss'"
                  >
                    {{ teamWon(resolve(match), teamId) ? 'Victory' : 'Defeat' }}
                    <span class="font-normal text-ink-3">
                      · {{ teamId === 100 ? 'Blue' : 'Red' }}
                    </span>
                  </span>
                  <span class="num flex gap-2.5 text-[0.6875rem] text-ink-3">
                    <span>{{ context[match.matchId].totals[teamId].kills }} kills</span>
                    <span>{{ compact(context[match.matchId].totals[teamId].gold) }} gold</span>
                    <span title="Towers · Dragons · Barons">
                      {{ objectives(resolve(match), teamId).towers }}/{{
                        objectives(resolve(match), teamId).dragons
                      }}/{{ objectives(resolve(match), teamId).barons }}
                    </span>
                  </span>
                </div>

                <ul class="divide-y divide-line">
                  <li
                    v-for="p in teamMembers(resolve(match), teamId)"
                    :key="p.puuid"
                    class="px-3 py-2"
                    :class="p.puuid === props.puuid ? 'bg-[#f6f7f9]' : ''"
                  >
                    <div class="flex items-center gap-2.5">
                      <img
                        :src="champIcon(p.championId)"
                        :alt="championName(p.championId)"
                        class="thumb h-7 w-7 shrink-0 rounded-md"
                      />
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-[0.75rem] font-medium text-ink">
                          {{ p.gameName }}
                        </span>
                        <span class="num block truncate text-[0.625rem] text-ink-3">
                          {{ POSITION_NAMES[p.position] || championName(p.championId) }} ·
                          {{ p.cs }} cs
                        </span>
                      </span>
                      <span class="num w-[4.25rem] shrink-0 text-right">
                        <span class="block text-[0.75rem] font-medium text-ink">
                          {{ p.kills }}/{{ p.deaths }}/{{ p.assists }}
                        </span>
                        <span class="block text-[0.625rem] text-ink-3">
                          {{ Math.round(killParticipation(p, context[match.matchId].totals)) }}% kp
                        </span>
                      </span>
                      <span class="num w-[3rem] shrink-0 text-right">
                        <span class="block text-[0.75rem] text-ink-2">
                          {{ compact(p.totalDamageDealtToChampions) }}
                        </span>
                        <span class="block text-[0.625rem] text-ink-3">dmg</span>
                      </span>
                    </div>
                    <Meter
                      class="mt-1.5"
                      :value="
                        (p.totalDamageDealtToChampions / context[match.matchId].maxDamage) * 100
                      "
                      :tone="p.puuid === props.puuid ? 'ink' : 'muted'"
                    />
                  </li>
                </ul>
              </div>
            </div>

            <!-- Graphs -->
            <div v-else-if="tab[match.matchId] === 'graphs'">
              <p
                v-if="!resolve(match).timeline?.length"
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
                    <LineChart :data="chart(resolve(match), graph.key)" :options="chartOptions" />
                  </div>
                  <div class="mt-2 flex items-center justify-between text-[0.625rem]">
                    <span class="flex items-center gap-1.5 text-ink">
                      <span class="h-[2px] w-3 bg-ink" />
                      {{ focused(resolve(match))?.gameName }}
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
                      {{ laneOpponent(resolve(match), focused(resolve(match)))?.gameName }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Runes -->
            <div v-else class="grid gap-4 lg:grid-cols-2">
              <div v-for="teamId in teamOrder(resolve(match))" :key="teamId">
                <h4 class="card-title mb-2">{{ teamId === 100 ? 'Blue' : 'Red' }} team</h4>
                <ul class="card divide-y divide-line">
                  <li
                    v-for="p in teamMembers(resolve(match), teamId)"
                    :key="p.puuid"
                    class="flex items-center gap-3 px-3 py-2"
                    :class="p.puuid === props.puuid ? 'bg-[#f6f7f9]' : ''"
                  >
                    <img
                      :src="champIcon(p.championId)"
                      :alt="championName(p.championId)"
                      class="thumb h-7 w-7 rounded-md"
                    />
                    <span class="min-w-0 flex-1 truncate text-[0.75rem] text-ink">
                      {{ championName(p.championId) }}
                    </span>
                    <RuneGlyphs :runes="runeSet(indexTimeline(resolve(match))[p.puuid] ?? [], p)" />
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
