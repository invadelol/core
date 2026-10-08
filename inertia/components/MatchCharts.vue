<script setup lang="ts">
import { computed, ref } from 'vue'
import { LineChart } from '../lib/lazy_charts.js'
import PlayerLink from './PlayerLink.vue'
import { champIcon, championName } from '../lib/assets.js'
import { clock, compact, signed } from '../lib/format.js'
import { lineOptions, niceMax, palette } from '../lib/chart.js'
import { objectives, teamSeries, teamTotals, type SeriesKey } from '../lib/match.js'
import type { Match, Participant } from '../lib/types.js'

const props = defineProps<{ match: Match; ownerPuuid?: string; selectedPuuid?: string }>()
const emit = defineEmits<{ select: [puuid: string] }>()

const totals = computed(() => teamTotals(props.match))

/* Your team on the left in blue, the enemy on the right in red; sides when nobody is viewed. */
const owner = computed(() => props.match.participants.find((p) => p.puuid === props.ownerPuuid))
const ally = computed(() => owner.value?.teamId ?? 100)
const enemy = computed(() => (ally.value === 100 ? 200 : 100))
const names = computed(() =>
  owner.value
    ? { ally: 'Your team', enemy: 'Enemy team' }
    : { ally: 'Blue side', enemy: 'Red side' }
)

/* ── Team comparison, as one diverging axis ───────────────────── */
const comparison = computed(() => {
  const blueObjectives = objectives(props.match, ally.value)
  const redObjectives = objectives(props.match, enemy.value)
  const a = totals.value[ally.value]
  const e = totals.value[enemy.value]
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
    row('Kills', a.kills, e.kills, plain),
    row('Gold', a.gold, e.gold),
    row('Damage', a.damage, e.damage),
    row('Damage taken', a.damageTaken, e.damageTaken),
    row('Creep score', a.cs, e.cs, plain),
    row('Vision', a.vision, e.vision, plain),
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

const series = computed(() => {
  const raw = teamSeries(props.match, metric.value)
  if (ally.value === 100) return raw
  return { times: raw.times, blue: raw.red, red: raw.blue, diff: raw.diff.map((d) => -d) }
})
const hasTimeline = computed(() => series.value.times.length > 1)

const chartData = computed(() => ({
  labels: series.value.times.map(clock),
  datasets: [
    {
      label: names.value.ally,
      data: series.value.blue,
      borderColor: palette.win,
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      pointRadius: 0,
      pointHoverRadius: 3,
      tension: 0,
    },
    {
      label: names.value.enemy,
      data: series.value.red,
      borderColor: palette.loss,
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      pointRadius: 0,
      pointHoverRadius: 3,
      tension: 0,
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
  <div class="grid gap-3 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]">
    <!-- Team against team -->
    <section class="card min-w-0">
      <div class="section">
        <h2>Team comparison</h2>
        <span class="meta ml-auto flex items-center gap-3">
          <span class="flex items-center gap-1.5">
            <i class="h-2 w-2 rounded-[2px]" style="background: var(--color-win)" />{{ names.ally }}
          </span>
          <span class="flex items-center gap-1.5">
            <i class="h-2 w-2 rounded-[2px]" style="background: var(--color-loss)" />{{
              names.enemy
            }}
          </span>
        </span>
      </div>

      <ul class="space-y-3.5">
        <li v-for="row in comparison" :key="row.label">
          <div class="num mb-1.5 flex items-baseline justify-between gap-3">
            <span
              class="text-[14px] font-semibold"
              :class="row.blue >= row.red ? 'text-ink' : 'text-ink-3'"
            >
              {{ row.blueText }}
            </span>
            <span class="text-[12px] text-ink-3">{{ row.label }}</span>
            <span
              class="text-[14px] font-semibold"
              :class="row.red >= row.blue ? 'text-ink' : 'text-ink-3'"
            >
              {{ row.redText }}
            </span>
          </div>
          <div class="flex h-[4px] gap-[2px]">
            <span class="flex flex-1 justify-end overflow-hidden rounded-l-[2px] bg-control">
              <span
                class="block h-full"
                :style="{ width: `${row.blueShare}%`, background: 'var(--color-win)' }"
              />
            </span>
            <span class="flex-1 overflow-hidden rounded-r-[2px] bg-control">
              <span
                class="block h-full"
                :style="{ width: `${100 - row.blueShare}%`, background: 'var(--color-loss)' }"
              />
            </span>
          </div>
        </li>
      </ul>
    </section>

    <!-- Damage dealt and damage absorbed, on one axis -->
    <section class="card min-w-0">
      <div class="section">
        <h2>Damage</h2>
        <span class="meta ml-auto flex items-center gap-3">
          <span class="flex items-center gap-1.5">
            <i class="h-2 w-2 rounded-[2px] bg-ink-3" />
            to champions
          </span>
          <span class="flex items-center gap-1.5">
            <i class="h-[3px] w-2 rounded-[2px] bg-ink-4" />
            taken
          </span>
        </span>
      </div>

      <ul class="!px-2">
        <li
          v-for="row in damageRows"
          :key="row.p.puuid"
          class="grid h-[36px] cursor-pointer grid-cols-[150px_minmax(0,1fr)_56px] items-center gap-3 rounded-[5px] px-2 transition-colors"
          :class="row.p.puuid === selectedPuuid ? 'bg-raised' : 'hover:bg-raised'"
          @click="emit('select', row.p.puuid)"
        >
          <span class="flex min-w-0 items-center gap-2">
            <span class="portrait h-6 w-6">
              <img
                :src="champIcon(row.p.championId)"
                :alt="championName(row.p.championId)"
                loading="lazy"
              />
            </span>
            <span
              class="h-4 w-[2px] shrink-0 rounded-full"
              :style="{
                background: row.p.teamId === ally ? 'var(--color-win)' : 'var(--color-loss)',
              }"
              :title="row.p.teamId === ally ? names.ally : names.enemy"
            />
            <PlayerLink
              :game-name="row.p.gameName"
              :tag-line="row.p.tagLine"
              :is-self="row.p.puuid === ownerPuuid"
              class="min-w-0 text-[12.5px]"
              @click.stop
            />
          </span>

          <span class="flex flex-col gap-[3px]">
            <span
              class="block h-[6px] rounded-[2px]"
              :style="{
                width: `${row.dealt}%`,
                background:
                  row.p.puuid === ownerPuuid ? 'var(--color-brand)' : 'var(--color-ink-3)',
              }"
            />
            <span
              class="block h-[3px] rounded-[2px] bg-ink-4"
              :style="{ width: `${row.taken}%` }"
            />
          </span>

          <span class="num text-right text-[13px] font-semibold text-ink">
            {{ compact(row.p.totalDamageDealtToChampions) }}
          </span>
        </li>
      </ul>
    </section>

    <!-- The game over time -->
    <section v-if="hasTimeline" class="card min-w-0 xl:col-span-2">
      <div class="section flex-wrap !items-center gap-y-2">
        <h2>Over time</h2>
        <span
          class="num text-[13px] font-semibold"
          :class="finalLead > 0 ? 'text-win' : finalLead < 0 ? 'text-loss' : 'text-ink-3'"
        >
          {{ finalLead === 0 ? 'Level' : `${signed(finalLead)} at the end` }}
        </span>
        <div class="seg ml-auto">
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

      <div>
        <div class="h-[240px]">
          <LineChart :data="chartData" :options="chartOptions" />
        </div>

        <div class="mt-3 flex justify-center gap-6 text-[12px] text-ink-2">
          <span class="flex items-center gap-1.5">
            <i class="h-[2px] w-4 rounded-full" style="background: var(--color-win)" />
            {{ names.ally }}
          </span>
          <span class="flex items-center gap-1.5">
            <i class="h-[2px] w-4 rounded-full" style="background: var(--color-loss)" />
            {{ names.enemy }}
          </span>
        </div>
      </div>
    </section>
  </div>
</template>
