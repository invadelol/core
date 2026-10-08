<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Pause, Play } from 'lucide-vue-next'
import Minimap from './Minimap.vue'
import PlayerLink from './PlayerLink.vue'
import RoleIcon from './RoleIcon.vue'
import { LineChart } from '../lib/lazy_charts.js'
import { champIcon, championName } from '../lib/assets.js'
import { clock, compact, signed } from '../lib/format.js'
import { lineOptions, palette } from '../lib/chart.js'
import {
  frameAt,
  frameTimes,
  frameValue,
  indexTimeline,
  killsPerFrame,
  laneOpponent,
  positionsAt,
  positionTrails,
  teamOrder,
  teamSeries,
} from '../lib/match.js'
import type { Match } from '../lib/types.js'

const props = defineProps<{ match: Match; selectedPuuid: string; ownerPuuid?: string }>()
const emit = defineEmits<{ select: [puuid: string] }>()

const times = computed(() => frameTimes(props.match))
const frames = computed(() => indexTimeline(props.match))

const index = ref(0)
watch(times, () => (index.value = Math.max(0, times.value.length - 1)), { immediate: true })

const now = computed(() => times.value[index.value] ?? 0)

/* ── Playback ──────────────────────────────────────────────────── */
const playing = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

function stop() {
  playing.value = false
  clearInterval(timer)
}

function toggle() {
  if (playing.value) return stop()
  if (index.value >= times.value.length - 1) index.value = 0
  playing.value = true
  timer = setInterval(() => {
    if (index.value >= times.value.length - 1) return stop()
    index.value += 1
  }, 400)
}

onBeforeUnmount(stop)

/* Your team reads as blue and above the line wherever it played; blue side when nobody is viewed. */
const owner = computed(() => props.match.participants.find((p) => p.puuid === props.ownerPuuid))
const ally = computed(() => owner.value?.teamId ?? 100)
const names = computed(() =>
  owner.value ? { ally: 'Your team', enemy: 'Enemy' } : { ally: 'Blue side', enemy: 'Red side' }
)

/* ── Gold advantage, as the chart the match is actually read from ── */
const gold = computed(() => {
  const raw = teamSeries(props.match, 'gold')
  if (ally.value === 100) return raw
  return { times: raw.times, blue: raw.red, red: raw.blue, diff: raw.diff.map((d) => -d) }
})
const kills = computed(() => {
  const raw = killsPerFrame(props.match)
  return ally.value === 100 ? raw : { times: raw.times, blue: raw.red, red: raw.blue }
})

/** `gutter` is the right-hand strip the axis labels live in. */
const CHART = { w: 1000, h: 190, pad: 22, foot: 16, gutter: 58 }

const chart = computed(() => {
  const diff = gold.value.diff
  if (diff.length < 2) return null

  const peak = Math.max(...diff.map(Math.abs), 1000)
  // Round the axis out to something a person would say out loud.
  const step = peak > 12000 ? 5000 : peak > 4000 ? 2000 : peak > 1500 ? 1000 : 500
  // The axis follows the game instead of staying mirrored: when one side leads
  // from the first minute, a symmetric axis leaves half the chart empty. Each
  // side keeps at least one step so the zero line never sits on the border.
  const up = Math.ceil(Math.max(...diff, step) / step) * step
  const down = Math.ceil(Math.max(-Math.min(...diff), step) / step) * step

  const plot = CHART.w - CHART.gutter
  const top = CHART.pad / 2
  const inner = CHART.h - CHART.pad - CHART.foot
  const x = (i: number) => (i / (diff.length - 1)) * plot
  const y = (v: number) => top + ((up - v) / (up + down)) * inner
  const zero = y(0)

  const line = diff.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

  const minutes: Array<{ x: number; label: string }> = []
  for (let i = 0; i < times.value.length; i++) {
    const minute = Math.round(times.value[i] / 60_000)
    if (minute && minute % 5 === 0) minutes.push({ x: x(i), label: `${minute}` })
  }

  // One mark per side per minute, sized by how many kills landed in it.
  const events: Array<{ x: number; count: number; side: 'blue' | 'red' }> = []
  kills.value.blue.forEach((count, i) => {
    if (count) events.push({ x: x(i), count, side: 'blue' })
  })
  kills.value.red.forEach((count, i) => {
    if (count) events.push({ x: x(i), count, side: 'red' })
  })

  return {
    up,
    down,
    zero,
    top,
    inner,
    plot,
    line,
    minutes,
    events,
    area: `M0,${zero} L${line} L${plot},${zero} Z`,
    cursor: x(index.value),
    cursorY: y(diff[Math.min(index.value, diff.length - 1)] ?? 0),
    x,
  }
})

const surface = ref<SVGSVGElement>()
let dragging = false

/** Click or drag anywhere on the chart to move through the game. */
function scrubAt(clientX: number) {
  const box = surface.value?.getBoundingClientRect()
  if (!box) return
  const ratio = Math.min(1, Math.max(0, (clientX - box.left) / box.width))
  index.value = Math.round(ratio * (times.value.length - 1))
}

function onDown(event: PointerEvent) {
  dragging = true
  stop()
  ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
  scrubAt(event.clientX)
}

function onMove(event: PointerEvent) {
  if (dragging) scrubAt(event.clientX)
}

function onUp(event: PointerEvent) {
  dragging = false
  ;(event.currentTarget as Element).releasePointerCapture(event.pointerId)
}

/* ── The lobby, frozen at the scrubbed minute ──────────────────── */
const standings = computed(() =>
  (owner.value ? [ally.value, ally.value === 100 ? 200 : 100] : teamOrder(props.match)).map(
    (teamId) => ({
      teamId,
      label: `${teamId === ally.value && owner.value ? 'Your team' : owner.value ? 'Enemy team' : teamId === 100 ? 'Blue side' : 'Red side'}`,
      side: teamId === 100 ? 'Blue side' : 'Red side',
      players: props.match.participants
        .filter((p) => p.teamId === teamId)
        .map((p) => {
          const frame = frameAt(frames.value[p.puuid] ?? [], now.value)
          return {
            p,
            level: frame?.level ?? 0,
            gold: frame?.goldTotal ?? 0,
            cs: (frame?.cs ?? 0) + (frame?.jungleCs ?? 0),
            kills: frame?.kills ?? 0,
            deaths: frame?.deaths ?? 0,
            assists: frame?.assists ?? 0,
          }
        })
        .sort((a, b) => b.gold - a.gold),
    })
  )
)

/** The richest player at this instant, so every gold bar shares one scale. */
const peakGold = computed(() =>
  Math.max(1, ...standings.value.flatMap((team) => team.players.map((entry) => entry.gold)))
)

const teamGoldNow = computed(() => ({
  blue: gold.value.blue[index.value] ?? 0,
  red: gold.value.red[index.value] ?? 0,
}))

const dots = computed(() => positionsAt(props.match, now.value))
const trails = computed(() => positionTrails(props.match, now.value))

/* ── The focused duel: all three curves at once ───────────────── */
const player = computed(() => props.match.participants.find((p) => p.puuid === props.selectedPuuid))
const opponent = computed(() => laneOpponent(props.match, player.value))

const mineFrames = computed(() => frames.value[player.value?.puuid ?? ''] ?? [])
const theirFrames = computed(() => frames.value[opponent.value?.puuid ?? ''] ?? [])

const DUELS = [
  { key: 'gold' as const, title: 'Gold' },
  { key: 'xp' as const, title: 'Experience' },
  { key: 'cs' as const, title: 'Creep score' },
]

function duelChart(key: 'gold' | 'xp' | 'cs') {
  return {
    labels: mineFrames.value.map((f) => clock(f.frameMs)),
    datasets: [
      {
        label: player.value?.gameName ?? 'Player',
        data: mineFrames.value.map((f) => frameValue(f, key)),
        borderColor: palette.accent,
        backgroundColor: palette.accentFill,
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 3,
        tension: 0,
        fill: true,
      },
      {
        label: opponent.value?.gameName ?? 'Opponent',
        data: theirFrames.value.map((f) => frameValue(f, key)),
        borderColor: palette.ink3,
        borderWidth: 1,
        borderDash: [3, 3],
        pointRadius: 0,
        pointHoverRadius: 3,
        tension: 0,
        fill: false,
      },
    ],
  }
}

/** The player-level lead, which a team curve cannot show. */
const duelDiffChart = computed(() => {
  const mine = mineFrames.value.map((f) => frameValue(f, 'gold'))
  const theirs = theirFrames.value.map((f) => frameValue(f, 'gold'))
  return {
    labels: mineFrames.value.map((f) => clock(f.frameMs)),
    datasets: [
      {
        label: 'Gold difference',
        data: mine.map((value, i) => value - (theirs[i] ?? 0)),
        borderColor: palette.accent,
        backgroundColor: palette.accentFill,
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 3,
        tension: 0,
        fill: 'origin' as const,
      },
    ],
  }
})

const duelOptions = computed(() => lineOptions({ yTicks: 4, xTicks: 5 }))
const diffOptions = computed(() =>
  lineOptions({
    yTicks: 4,
    xTicks: 5,
    tooltipLabel: (ctx: any) =>
      `${ctx.parsed.y >= 0 ? '+' : ''}${compact(ctx.parsed.y)} gold at ${ctx.label}`,
  })
)
</script>

<template>
  <p v-if="!times.length" class="py-6 text-[13px] text-ink-2">
    No timeline is stored for this match.
  </p>

  <div v-else class="space-y-4">
    <!-- One chart the whole match can be read off -->
    <section class="tl-card card">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2.5 px-4 pt-3">
        <button
          class="icon-btn shrink-0 bg-control text-ink-2"
          :aria-label="playing ? 'Pause' : 'Play'"
          @click="toggle"
        >
          <Pause v-if="playing" :size="14" />
          <Play v-else :size="14" />
        </button>

        <span class="fig w-[64px] shrink-0 text-[22px] text-ink">{{ clock(now) }}</span>

        <input
          v-model.number="index"
          type="range"
          min="0"
          :max="Math.max(0, times.length - 1)"
          class="scrub min-w-[140px] flex-1"
          aria-label="Match time"
          @input="stop"
        />

        <div class="num flex shrink-0 items-baseline gap-3 text-[13px]">
          <span class="text-ink-2" :title="names.ally">{{ compact(teamGoldNow.blue) }}</span>
          <span
            class="min-w-[52px] text-center text-[16px] font-semibold"
            :class="
              teamGoldNow.blue === teamGoldNow.red
                ? 'text-ink-3'
                : teamGoldNow.blue > teamGoldNow.red
                  ? 'text-win'
                  : 'text-loss'
            "
          >
            {{ signed(teamGoldNow.blue - teamGoldNow.red, 'even') }}
          </span>
          <span class="text-ink-2" :title="names.enemy">{{ compact(teamGoldNow.red) }}</span>
        </div>
      </div>

      <div class="px-4 pb-4 pt-3">
        <div v-if="chart" class="tl-plot relative overflow-hidden rounded-[8px] bg-well">
          <svg
            ref="surface"
            :viewBox="`0 0 ${CHART.w} ${CHART.h}`"
            preserveAspectRatio="none"
            class="block h-[210px] w-full cursor-ew-resize touch-none select-none"
            @pointerdown="onDown"
            @pointermove="onMove"
            @pointerup="onUp"
            @pointercancel="onUp"
          >
            <!-- Minute grid -->
            <g>
              <line
                v-for="minute in chart.minutes"
                :key="minute.label"
                :x1="minute.x"
                :x2="minute.x"
                :y1="chart.top"
                :y2="chart.top + chart.inner"
                stroke="var(--color-line)"
                stroke-width="1"
                vector-effect="non-scaling-stroke"
              />
            </g>

            <!-- The lead itself -->
            <defs>
              <clipPath id="tl-above">
                <rect x="0" y="0" :width="chart.plot" :height="chart.zero" />
              </clipPath>
              <clipPath id="tl-below">
                <rect x="0" :y="chart.zero" :width="chart.plot" :height="CHART.h - chart.zero" />
              </clipPath>
            </defs>
            <path
              :d="chart.area"
              fill="var(--color-win)"
              fill-opacity="0.16"
              clip-path="url(#tl-above)"
            />
            <path
              :d="chart.area"
              fill="var(--color-loss)"
              fill-opacity="0.16"
              clip-path="url(#tl-below)"
            />
            <line
              x1="0"
              :x2="chart.plot"
              :y1="chart.zero"
              :y2="chart.zero"
              stroke="var(--color-line-2)"
              stroke-width="1"
              vector-effect="non-scaling-stroke"
            />
            <polyline
              :points="chart.line"
              fill="none"
              stroke="var(--color-ink-2)"
              stroke-width="1.5"
              stroke-linejoin="round"
              vector-effect="non-scaling-stroke"
            />

            <!-- Kills, read off the frame-to-frame counts -->
            <g>
              <rect
                v-for="(event, i) in chart.events"
                :key="i"
                :x="event.x - 1.5"
                :y="event.side === 'blue' ? chart.zero - 5 - event.count * 3 : chart.zero + 5"
                width="3"
                :height="event.count * 3"
                :fill="event.side === 'blue' ? 'var(--color-win)' : 'var(--color-loss)'"
                :opacity="0.75"
              >
                <title>
                  {{ event.count }} {{ event.count === 1 ? 'kill' : 'kills' }} for
                  {{ event.side === 'blue' ? names.ally : names.enemy }}
                </title>
              </rect>
            </g>

            <!-- Where you are -->
            <line
              :x1="chart.cursor"
              :x2="chart.cursor"
              :y1="chart.top"
              :y2="chart.top + chart.inner"
              stroke="var(--color-ink)"
              stroke-width="1.5"
              vector-effect="non-scaling-stroke"
            />
            <circle :cx="chart.cursor" :cy="chart.cursorY" r="3.5" fill="var(--color-ink)" />
          </svg>

          <!-- Axes, in HTML so the type does not stretch with the chart -->
          <span class="label pointer-events-none absolute left-3 top-2">
            Gold lead · {{ names.ally.toLowerCase() }}
          </span>
          <span
            class="num pointer-events-none absolute right-3 -translate-y-1/2 text-[11px] text-ink-3"
            :style="{ top: `${(chart.top / CHART.h) * 100}%` }"
          >
            +{{ compact(chart.up) }}
          </span>
          <span
            class="num pointer-events-none absolute right-3 -translate-y-1/2 text-[11px] text-ink-4"
            :style="{ top: `${(chart.zero / CHART.h) * 100}%` }"
          >
            0
          </span>
          <span
            class="num pointer-events-none absolute right-3 -translate-y-1/2 text-[11px] text-ink-3"
            :style="{ top: `${((chart.top + chart.inner) / CHART.h) * 100}%` }"
          >
            −{{ compact(chart.down) }}
          </span>
          <div class="pointer-events-none absolute inset-x-0 bottom-1.5">
            <div class="num relative h-3 text-[11px] text-ink-4">
              <span
                v-for="minute in chart.minutes"
                :key="minute.label"
                class="absolute -translate-x-1/2"
                :style="{ left: `${(minute.x / CHART.w) * 100}%` }"
              >
                {{ minute.label }}
              </span>
            </div>
          </div>
        </div>

        <p class="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-3">
          <span class="flex items-center gap-1.5">
            <i class="h-2.5 w-[3px] rounded-[1px]" style="background: var(--color-win)" />
            {{ names.ally }} kills
          </span>
          <span class="flex items-center gap-1.5">
            <i class="h-2.5 w-[3px] rounded-[1px]" style="background: var(--color-loss)" />
            {{ names.enemy }} kills
          </span>
          <span class="text-ink-4">per minute</span>
        </p>
      </div>
    </section>

    <!-- Map and standings share one instant -->
    <div class="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <section class="tl-card card min-w-0">
        <div class="section">
          <h3>Positions</h3>
          <span class="meta num">{{ clock(now) }}</span>
        </div>
        <div>
          <Minimap
            :dots="dots"
            :trails="trails"
            :highlight="selectedPuuid"
            :map-id="match.mapId"
            :ally-team="ally"
          />
          <p v-if="!dots.length" class="mt-2 text-[12px] text-ink-3">
            No positions recorded for this frame.
          </p>
        </div>
      </section>

      <section class="tl-card card min-w-0">
        <div class="section">
          <h3>State of the game</h3>
          <span class="meta num">{{ clock(now) }}</span>
        </div>
        <div class="scroll-x !p-0">
          <table class="dt dt-hover">
            <thead>
              <tr>
                <th colspan="2" class="!pl-4">Player</th>
                <th class="text-right">KDA</th>
                <th>Gold</th>
                <th class="text-right !pr-4">CS</th>
              </tr>
            </thead>
            <tbody v-for="team in standings" :key="team.teamId">
              <tr class="band">
                <td colspan="5" class="!px-4">
                  <span class="flex items-center gap-2 text-[13px]">
                    <span class="font-semibold text-ink">{{ team.label }}</span>
                    <span v-if="owner" class="text-ink-3">· {{ team.side }}</span>
                    <span class="num ml-auto text-[12px] text-ink-3">
                      {{ compact(team.players.reduce((sum, entry) => sum + entry.gold, 0)) }} gold
                    </span>
                  </span>
                </td>
              </tr>
              <tr
                v-for="entry in team.players"
                :key="entry.p.puuid"
                class="cursor-pointer"
                :class="[
                  entry.p.puuid === ownerPuuid ? 'is-self' : '',
                  entry.p.puuid === selectedPuuid ? '[&>td]:!bg-raised' : '',
                ]"
                @click="emit('select', entry.p.puuid)"
              >
                <td class="w-[42px] !pl-4">
                  <span class="relative block w-7">
                    <span class="portrait block h-7 w-7">
                      <img
                        :src="champIcon(entry.p.championId)"
                        :alt="championName(entry.p.championId)"
                        loading="lazy"
                      />
                    </span>
                    <span
                      class="lvl absolute -bottom-1 -right-1 !h-[14px] !min-w-[15px] !text-[10px]"
                    >
                      {{ entry.level }}
                    </span>
                  </span>
                </td>
                <td>
                  <span class="flex items-center gap-2">
                    <RoleIcon
                      v-if="entry.p.position"
                      :role="entry.p.position"
                      :size="12"
                      class="shrink-0 text-ink-3"
                    />
                    <PlayerLink
                      :game-name="entry.p.gameName"
                      :tag-line="entry.p.tagLine"
                      class="max-w-[16ch]"
                      @click.stop
                    />
                  </span>
                </td>
                <td class="whitespace-nowrap text-right text-[13px] font-semibold text-ink">
                  {{ entry.kills }}<span class="mx-[3px] font-normal text-ink-4">/</span
                  >{{ entry.deaths }}<span class="mx-[3px] font-normal text-ink-4">/</span
                  >{{ entry.assists }}
                </td>
                <td class="w-[34%] min-w-[110px]">
                  <span class="flex items-center gap-2">
                    <span class="meter !h-[3px] flex-1">
                      <span
                        :style="{
                          width: `${(entry.gold / peakGold) * 100}%`,
                          background:
                            entry.p.puuid === ownerPuuid
                              ? 'var(--color-brand)'
                              : 'var(--color-ink-4)',
                        }"
                      />
                    </span>
                    <span class="num w-[38px] text-right text-ink">
                      {{ compact(entry.gold) }}
                    </span>
                  </span>
                </td>
                <td class="num !pr-4 text-right text-ink-2">{{ entry.cs }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- The lane, in full: three curves plus the running lead -->
    <section v-if="player && opponent" class="tl-card card">
      <div class="section">
        <h3>Lane</h3>
        <span class="meta flex items-center gap-1.5">
          <RoleIcon v-if="player.position" :role="player.position" :size="11" />
          {{ championName(player.championId) }}
          <span class="text-ink-4">against</span>
          {{ championName(opponent.championId) }}
        </span>
        <span class="meta ml-auto hidden items-center gap-4 sm:flex">
          <span class="flex items-center gap-1.5 text-ink-2">
            <i class="h-[2px] w-4 rounded-full bg-brand" />
            {{ player.gameName }}
          </span>
          <span class="flex items-center gap-1.5">
            <i
              class="h-[2px] w-4"
              style="
                background: repeating-linear-gradient(
                  90deg,
                  var(--color-ink-3) 0 3px,
                  transparent 3px 6px
                );
              "
            />
            {{ opponent.gameName }}
          </span>
        </span>
      </div>

      <div class="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <div v-for="graph in DUELS" :key="graph.key" class="min-w-0">
          <div class="label mb-2">{{ graph.title }}</div>
          <div class="h-[150px]">
            <LineChart :data="duelChart(graph.key)" :options="duelOptions" />
          </div>
        </div>
        <div class="min-w-0">
          <div class="label mb-2">Gold difference</div>
          <div class="h-[150px]">
            <LineChart :data="duelDiffChart" :options="diffOptions" />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Inside an expanded match row the row itself is the card, and cards do
   not nest: there the blocks fall back to plain sections split by rules. */
:global(.mrow-detail .tl-card) {
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  overflow: visible;
}

:global(.mrow-detail .tl-card > *) {
  padding-inline: 0;
}
</style>
