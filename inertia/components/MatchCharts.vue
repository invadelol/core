<script setup lang="ts">
import { computed, ref } from 'vue'
import { LineChart } from '../lib/lazy_charts.js'
import PlayerLink from './PlayerLink.vue'
import RoleIcon from './RoleIcon.vue'
import { champIcon, championName } from '../lib/assets.js'
import { clock, compact, signed } from '../lib/format.js'
import { lineOptions, niceMax, palette } from '../lib/chart.js'
import { objectives, teamSeries, teamTotals, type SeriesKey } from '../lib/match.js'
import type { Match, Participant } from '../lib/types.js'

const props = defineProps<{ match: Match; ownerPuuid?: string; selectedPuuid?: string }>()
const emit = defineEmits<{ select: [puuid: string] }>()

const totals = computed(() => teamTotals(props.match))

/* ── Team comparison, as one diverging axis ───────────────────── */
const comparison = computed(() => {
  const blueObjectives = objectives(props.match, 100)
  const redObjectives = objectives(props.match, 200)
  const row = (label: string, blue: number, red: number, format = compact) => {
    const sum = blue + red
    return {
      label,
      blue,
      red,
      blueText: format(blue),
      redText: format(red),
      blueShare: sum ? (blue / sum) * 100 : 50,
    }
  }
  const plain = (n: number) => String(Math.round(n))
  return [
    row('Kills', totals.value[100].kills, totals.value[200].kills, plain),
    row('Gold', totals.value[100].gold, totals.value[200].gold),
    row('Damage', totals.value[100].damage, totals.value[200].damage),
    row('Damage taken', totals.value[100].damageTaken, totals.value[200].damageTaken),
    row('Creep score', totals.value[100].cs, totals.value[200].cs, plain),
    row('Vision', totals.value[100].vision, totals.value[200].vision, plain),
    row('Turrets', blueObjectives.towers, redObjectives.towers, plain),
    row('Dragons', blueObjectives.dragons, redObjectives.dragons, plain),
    row('Barons', blueObjectives.barons, redObjectives.barons, plain),
  ]
})

/* ── Damage dealt against damage taken, one row per player ───── */
const damageRows = computed(() => {
  const players = [...props.match.participants]
  const scale = Math.max(
    ...players.map((p: Participant) => Math.max(p.totalDamageDealtToChampions, p.damageTaken)),
    1
  )
  return players
    .sort((a, b) => b.totalDamageDealtToChampions - a.totalDamageDealtToChampions)
    .map((p) => ({
      p,
      dealt: (p.totalDamageDealtToChampions / scale) * 100,
      taken: (p.damageTaken / scale) * 100,
      color: p.teamId === 100 ? 'var(--color-blue)' : 'var(--color-red)',
    }))
})

/* ── One metric, both sides, over time ───────────────────────── */
const metric = ref<SeriesKey>('gold')
const METRICS: Array<{ value: SeriesKey; label: string }> = [
  { value: 'gold', label: 'Gold' },
  { value: 'xp', label: 'Experience' },
  { value: 'cs', label: 'Creep score' },
  { value: 'kills', label: 'Kills' },
]

const series = computed(() => teamSeries(props.match, metric.value))
const hasTimeline = computed(() => series.value.times.length > 1)

const chartData = computed(() => ({
  labels: series.value.times.map(clock),
  datasets: [
    {
      label: 'Blue side',
      data: series.value.blue,
      borderColor: palette.blue,
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 3,
      tension: 0.25,
    },
    {
      label: 'Red side',
      data: series.value.red,
      borderColor: palette.red,
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 3,
      tension: 0.25,
    },
  ],
}))

const chartOptions = computed(() =>
  lineOptions({
    yTicks: 5,
    xTicks: 7,
    yMax: niceMax(Math.max(...series.value.blue, ...series.value.red, 1)),
  })
)

const finalLead = computed(() => {
  const diff = series.value.diff
  return diff.length ? diff[diff.length - 1] : 0
})
</script>

<template>
  <div class="grid gap-x-10 gap-y-8 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]">
    <!-- Team against team -->
    <section class="min-w-0">
      <div class="section">
        <h2>Team comparison</h2>
        <span class="meta">blue against red</span>
      </div>

      <ul class="space-y-3">
        <li v-for="row in comparison" :key="row.label">
          <div class="num mb-1.5 flex items-baseline justify-between gap-3 text-[12px]">
            <span :class="row.blue >= row.red ? 'font-semibold text-blue' : 'text-ink-3'">
              {{ row.blueText }}
            </span>
            <span class="text-[10.5px] uppercase tracking-[0.06em] text-ink-3">
              {{ row.label }}
            </span>
            <span :class="row.red >= row.blue ? 'font-semibold text-red' : 'text-ink-3'">
              {{ row.redText }}
            </span>
          </div>
          <div class="flex h-[5px] gap-[2px] overflow-hidden">
            <span class="flex flex-1 justify-end bg-sunken">
              <span
                class="block h-full"
                :style="{ width: `${row.blueShare}%`, background: 'var(--color-blue)' }"
              />
            </span>
            <span class="flex-1 bg-sunken">
              <span
                class="block h-full"
                :style="{ width: `${100 - row.blueShare}%`, background: 'var(--color-red)' }"
              />
            </span>
          </div>
        </li>
      </ul>
    </section>

    <!-- Damage dealt and damage absorbed, on one axis -->
    <section class="min-w-0">
      <div class="section">
        <h2>Damage profile</h2>
        <span class="meta">dealt to champions against damage taken</span>
        <span class="meta ml-auto flex items-center gap-3">
          <span class="flex items-center gap-1.5">
            <i class="h-2 w-2 rounded-[2px]" style="background: var(--color-blue)" />
            dealt
          </span>
          <span class="flex items-center gap-1.5">
            <i class="h-2 w-2 rounded-[2px] bg-ink-4" />
            taken
          </span>
        </span>
      </div>

      <ul class="space-y-1">
        <li
          v-for="row in damageRows"
          :key="row.p.puuid"
          class="grid cursor-pointer grid-cols-[136px_minmax(0,1fr)_60px] items-center gap-3 rounded-[6px] px-1.5 py-1 transition-colors hover:bg-raised"
          :class="row.p.puuid === selectedPuuid ? 'bg-raised' : ''"
          @click="emit('select', row.p.puuid)"
        >
          <span class="flex min-w-0 items-center gap-2">
            <img
              :src="champIcon(row.p.championId)"
              :alt="championName(row.p.championId)"
              loading="lazy"
              class="thumb h-[22px] w-[22px] rounded-[5px]"
            />
            <RoleIcon v-if="row.p.position" :role="row.p.position" :size="11" class="text-ink-4" />
            <PlayerLink
              :game-name="row.p.gameName"
              :tag-line="row.p.tagLine"
              :is-self="row.p.puuid === ownerPuuid"
              class="min-w-0 text-[11.5px]"
              @click.stop
            />
          </span>

          <span class="flex flex-col gap-[3px]">
            <span
              class="block h-[7px] rounded-[2px]"
              :style="{ width: `${row.dealt}%`, background: row.color }"
            />
            <span
              class="block h-[4px] rounded-[2px] bg-ink-4"
              :style="{ width: `${row.taken}%` }"
            />
          </span>

          <span class="num text-right text-[11.5px] text-ink-2">
            {{ compact(row.p.totalDamageDealtToChampions) }}
          </span>
        </li>
      </ul>
    </section>

    <!-- The game over time -->
    <section v-if="hasTimeline" class="min-w-0 xl:col-span-2">
      <div class="section">
        <h2>Over time</h2>
        <span class="meta">
          {{ METRICS.find((m) => m.value === metric)?.label.toLowerCase() }} by side
        </span>
        <span
          class="num meta ml-auto"
          :class="finalLead > 0 ? 'text-blue' : finalLead < 0 ? 'text-red' : ''"
        >
          {{
            finalLead === 0
              ? 'level'
              : `${finalLead > 0 ? 'Blue' : 'Red'} ${signed(Math.abs(finalLead))}`
          }}
        </span>
        <div class="seg ml-3">
          <button
            v-for="option in METRICS"
            :key="option.value"
            type="button"
            :data-active="metric === option.value"
            @click="metric = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <div class="h-[220px]">
        <LineChart :data="chartData" :options="chartOptions" />
      </div>

      <div class="mt-3 flex justify-center gap-6 text-[11.5px] text-ink-2">
        <span class="flex items-center gap-1.5">
          <i class="h-[2px] w-4" style="background: var(--color-blue)" />
          Blue side
        </span>
        <span class="flex items-center gap-1.5">
          <i class="h-[2px] w-4" style="background: var(--color-red)" />
          Red side
        </span>
      </div>
    </section>
  </div>
</template>
