<script setup lang="ts">
import { computed } from 'vue'
import { RankCrest, useFormat } from '@invadelol/ui'
import { rankFromCore, rankLabel, rankValue, tierColor, tierRgb } from '@invadelol/ui/logic'
import VioletLine from './ui/VioletLine.vue'
import WinLoss from './ui/WinLoss.vue'
import type { Rank, RanksPayload } from '../lib/types.js'

const props = defineProps<{ ranks: RanksPayload | null }>()

const { date } = useFormat()
const time = (rank: Rank) => new Date(rank.fetchedAt ?? 0).getTime()
const name = (rank: Rank) => rankLabel(rankFromCore(rank), false)
const ladder = (rank: Pick<Rank, 'tier' | 'division' | 'leaguePoints'>) => {
  const v = rankValue(rankFromCore(rank as Rank))
  return v === null ? null : Math.round(v * 100)
}

const solo = computed(
  () => props.ranks?.current?.find((r) => r.queueType === 'RANKED_SOLO_5x5' && r.tier) ?? null
)
const flex = computed(
  () => props.ranks?.current?.find((r) => r.queueType === 'RANKED_FLEX_SR' && r.tier) ?? null
)

const knownLosses = (rank: Rank) => rank.losses !== null && rank.losses !== undefined

/**
 * Wins and losses when both are known. A rank the Invade app read from another player's client
 * has no losses (the client hides them): its record comes from the newest row of the queue that
 * has them, if any; never a made-up 100%.
 */
function record(rank: Rank) {
  if (knownLosses(rank)) return { wins: rank.wins, losses: rank.losses as number }
  const basis = (props.ranks?.history ?? [])
    .filter((r) => r.queueType === rank.queueType && knownLosses(r))
    .sort((a, b) => time(b) - time(a))[0]
  return basis ? { wins: basis.wins, losses: basis.losses as number } : null
}

/** Solo queue snapshots, oldest first, one per moment, on the whole ladder's LP axis. */
const climb = computed(() => {
  const rows = (props.ranks?.history ?? [])
    .filter((r) => r.queueType === 'RANKED_SOLO_5x5' && r.tier && r.fetchedAt)
    .map((r) => ({ t: time(r), v: ladder(r), r }))
    .filter((p): p is { t: number; v: number; r: Rank } => p.v !== null)
    .sort((a, b) => a.t - b.t)
  const now = solo.value
  const v = now ? ladder(now) : null
  if (now && v !== null && (!rows.length || rows[rows.length - 1].v !== v))
    rows.push({ t: Math.max(time(now), rows[rows.length - 1]?.t ?? 0), v, r: now })
  /* Repeated readings of the same LP add nothing to the line. */
  return rows.filter((p, i) => i === 0 || i === rows.length - 1 || p.v !== rows[i - 1].v)
})

/** A line needs a few snapshots; fewer read as noise. */
const charted = computed(() => climb.value.length > 2)

const chart = computed(() => {
  const points = climb.value
  const t0 = points[0]?.t ?? 0
  const t1 = points[points.length - 1]?.t ?? 1
  const span = Math.max(1, t1 - t0)
  const values = points.map((p) => p.v)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  /* The floor of the current division, as a dashed line, when it falls inside the chart. */
  const now = solo.value
  const floor = now ? (ladder({ ...now, leaguePoints: 0 }) ?? null) : null
  const apex = now && !now.division
  const guides =
    floor !== null && !apex && floor > lo - 15 && floor < hi + 15
      ? [{ value: floor, above: name(now!), below: below(now!), tone: tierColor(now!.tier) }]
      : []
  return {
    values,
    xs: points.map((p) => (p.t - t0) / span),
    min: Math.min(lo, ...guides.map((g) => g.value)) - 12,
    max: Math.max(hi, ...guides.map((g) => g.value)) + 18,
    guides,
    from: date(t0, { day: 'numeric', month: 'short' }),
    mid: date(t0 + span / 2, { day: 'numeric', month: 'short' }),
  }
})

const TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND']
const DIVS = ['IV', 'III', 'II', 'I']
/** The division just under a rank, by name. */
function below(rank: Rank) {
  const d = DIVS.indexOf(rank.division)
  const t = TIERS.indexOf(rank.tier)
  if (d > 0) return rankLabel(rankFromCore({ ...rank, division: DIVS[d - 1] }), false)
  if (t > 0) return rankLabel(rankFromCore({ ...rank, tier: TIERS[t - 1], division: 'I' }), false)
  return ''
}

/** LP won or lost over the last 30 days of snapshots. */
const month = computed(() => {
  const points = climb.value
  if (points.length < 2) return null
  const last = points[points.length - 1]
  const since = last.t - 30 * 864e5
  const first = points.find((p) => p.t >= since) ?? points[0]
  if (first === last) return null
  const days = Math.max(1, Math.round((last.t - first.t) / 864e5))
  return { lp: last.v - first.v, days: Math.min(30, days) }
})

const crestTone = computed(() => tierRgb(solo.value?.tier) ?? '255 255 255')
</script>

<template>
  <section class="rd-card rk">
    <div class="rd-head">
      <h3>Ranked Solo/Duo</h3>
      <span
        v-if="month && month.lp"
        class="num rk-m"
        :class="month.lp > 0 ? 'rd-up' : 'rd-dn'"
        :title="`From the stored rank snapshots of the last ${month.days} days`"
        >{{ month.lp > 0 ? '+' : '−' }}{{ Math.abs(month.lp) }} LP in {{ month.days }}
        {{ month.days === 1 ? 'day' : 'days' }}</span
      >
    </div>

    <div v-if="solo" class="rkc">
      <span class="crestb" :style="{ '--tier': crestTone }">
        <RankCrest :tier="solo.tier" :size="40" />
      </span>
      <span class="min-w-0">
        <b :style="{ color: tierColor(solo.tier) }">{{ name(solo) }}</b>
        <small class="num"
          >{{ solo.leaguePoints }} LP<template v-if="solo.source === 'desktop'"
            >, via the Invade app</template
          ></small
        >
      </span>
      <WinLoss v-if="record(solo)" :wins="record(solo)!.wins" :losses="record(solo)!.losses" />
      <span v-else class="num rk-w">{{ solo.wins }} wins</span>
    </div>
    <div v-else class="rkc">
      <span class="crestb none"><RankCrest :size="40" /></span>
      <span>
        <b class="text-ink-2">Unranked</b>
        <small>No Solo/Duo rank this season</small>
      </span>
    </div>

    <template v-if="charted">
      <VioletLine
        class="lpg"
        :values="chart.values"
        :xs="chart.xs"
        :min="chart.min"
        :max="chart.max"
        :height="150"
        :guides="chart.guides"
        :end="`${solo?.leaguePoints ?? ''} LP`"
      />
      <div class="lpx num">
        <span>{{ chart.from }}</span
        ><span>{{ chart.mid }}</span
        ><span>Today</span>
      </div>
    </template>

    <div v-if="flex" class="fx num">
      Flex<b :style="{ color: tierColor(flex.tier) }">{{ name(flex) }}</b>
      <span
        >{{ flex.leaguePoints }} LP<template v-if="record(flex)"
          >, {{ record(flex)!.wins }}W {{ record(flex)!.losses }}L</template
        ></span
      >
    </div>
  </section>
</template>

<style scoped>
.rk-m {
  font-size: 13px;
  font-weight: 600;
}
.rkc {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  padding: 16px;
}
.crestb {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: rgb(var(--tier) / 0.1);
  box-shadow: inset 0 0 0 1px rgb(var(--tier) / 0.35);
}
.crestb.none {
  background: var(--surface-2);
  box-shadow: inset 0 0 0 1px var(--rd-line);
  opacity: 0.8;
}
.rkc b {
  display: block;
  font-size: 18px;
  font-weight: 650;
}
.rkc small {
  font-size: 12px;
  color: var(--text-3);
}
.rkc :deep(.rd-wl),
.rk-w {
  grid-column: 1 / -1;
}
.rk-w {
  font-size: 12px;
  color: var(--text-3);
}
.lpg {
  margin: 4px 22px 0 16px;
}
.lpx {
  display: flex;
  justify-content: space-between;
  padding: 8px 22px 14px 16px;
  font-size: 11px;
  color: var(--text-3);
}
.fx {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  font-size: 13px;
  color: var(--text-3);
  box-shadow: inset 0 1px 0 var(--rd-line);
}
.fx b {
  font-weight: 600;
}
</style>
