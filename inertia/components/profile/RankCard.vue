<script setup lang="ts">
import { computed } from 'vue'
import { rankFromCore, rankLabel, rankValue } from '@invadelol/ui/logic'
import FormStrip from '../ui/FormStrip.vue'
import RankEmblem from '../ui/RankEmblem.vue'
import WinRate from '../ui/WinRate.vue'
import { isRemake } from '../../lib/match.js'
import type { Match, Rank, RanksPayload } from '../../lib/types.js'

/**
 * The rank card (`.pf-rank`): Solo/Duo with its record, the LP of the last 30 days as one violet
 * line (from the snapshots kept each time the profile is looked up), then the last ten games,
 * today's LP and games, and the flex rank.
 */
const props = defineProps<{ ranks: RanksPayload | null; matches: Match[]; puuid: string }>()

const time = (r: Rank) => new Date(r.fetchedAt ?? 0).getTime()
const label = (r: Rank) => rankLabel(rankFromCore(r), false)
const ladder = (r: Pick<Rank, 'tier' | 'division' | 'leaguePoints'>) => {
  const v = rankValue(rankFromCore(r as Rank))
  return v === null ? null : Math.round(v * 100)
}
const solo = computed(
  () => props.ranks?.current?.find((r) => r.queueType === 'RANKED_SOLO_5x5' && r.tier) ?? null
)
const flex = computed(
  () => props.ranks?.current?.find((r) => r.queueType === 'RANKED_FLEX_SR' && r.tier) ?? null
)
const record = computed(() => {
  const r = solo.value
  if (!r) return null
  if (r.losses !== null && r.losses !== undefined) return { wins: r.wins, losses: r.losses }
  const basis = (props.ranks?.history ?? [])
    .filter((h) => h.queueType === r.queueType && h.losses !== null && h.losses !== undefined)
    .sort((a, b) => time(b) - time(a))[0]
  return basis ? { wins: basis.wins, losses: basis.losses as number } : null
})
const winRate = computed(() =>
  record.value && record.value.wins + record.value.losses
    ? Math.round((record.value.wins / (record.value.wins + record.value.losses)) * 100)
    : null
)
const tierVar = (tier: string | undefined) =>
  tier
    ? `var(--${({ PLATINUM: 'plat' } as Record<string, string>)[tier] ?? tier.toLowerCase()}, var(--t1))`
    : 'var(--t1)'

/* The LP line: snapshots of the last 30 days, oldest first, the rank now last. */
const W = 600
const H = 150
const line = computed(() => {
  const since = Date.now() - 30 * 864e5
  const pts = (props.ranks?.history ?? [])
    .filter((r) => r.queueType === 'RANKED_SOLO_5x5' && r.tier && r.fetchedAt && time(r) >= since)
    .map((r) => ({ t: time(r), v: ladder(r), r }))
    .filter((p): p is { t: number; v: number; r: Rank } => p.v !== null)
    .sort((a, b) => a.t - b.t)
  const now = solo.value
  const v = now ? ladder(now) : null
  if (now && v !== null && (!pts.length || pts.at(-1)!.v !== v))
    pts.push({ t: Math.max(Date.now(), pts.at(-1)?.t ?? 0), v, r: now })
  const kept = pts.filter((p, i) => i === 0 || i === pts.length - 1 || p.v !== pts[i - 1].v)
  if (kept.length < 3) return null
  const t0 = kept[0].t
  const t1 = kept.at(-1)!.t
  const lo = Math.min(...kept.map((p) => p.v)) - 15
  const hi = Math.max(...kept.map((p) => p.v)) + 15
  const x = (t: number) => ((t - t0) / Math.max(1, t1 - t0)) * W
  const y = (val: number) => H - ((val - lo) / Math.max(1, hi - lo)) * H
  const d = `M${kept.map((p) => `${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' L')}`
  // Division floors inside the range, named.
  const guides: { y: number; t: string }[] = []
  for (let g = Math.ceil(lo / 100) * 100; g <= hi; g += 100) {
    const r = kept.find((p) => Math.floor(p.v / 100) * 100 === g)?.r
    if (r && r.division) guides.push({ y: (y(g) / H) * 100, t: label({ ...r, leaguePoints: 0 }) })
  }
  const first = kept[0]
  const last = kept.at(-1)!
  return {
    d,
    area: `${d} L${W} ${H} L0 ${H}Z`,
    guides: guides.slice(-4),
    end: { x: (x(last.t) / W) * 100, y: (y(last.v) / H) * 100, lp: last.r.leaguePoints },
    gain: last.v - first.v,
    from: label(first.r),
    start: new Date(t0).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }),
  }
})

const mine = (m: Match) => m.participants.find((p) => p.puuid === props.puuid)
const played = computed(() => props.matches.filter((m) => m.queueId !== 0 && !isRemake(m)))
const last10 = computed(() => played.value.slice(0, 10).map((m) => Boolean(mine(m)?.win)))
const today = computed(() => {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const games = played.value.filter((m) => Number(m.gameStartMs) >= start.getTime())
  const lp = games.reduce((s, m) => s + (m.lpChange ?? 0), 0)
  const wins = games.filter((m) => mine(m)?.win).length
  return {
    games: games.length,
    wins,
    lp,
    known: games.some((m) => m.lpChange !== null && m.lpChange !== undefined),
  }
})
</script>

<template>
  <section class="card pf-rank">
    <div class="col" style="gap: 16px">
      <div class="row" style="gap: 16px">
        <RankEmblem class="pf-em" :tier="solo?.tier" :size="92" />
        <div class="col" style="gap: 2px">
          <span class="lab">Ranked solo</span>
          <span class="h2" :style="{ color: tierVar(solo?.tier), fontSize: '24px' }">{{
            solo ? label(solo) : 'Unranked'
          }}</span>
          <span v-if="solo" class="fg-l">{{ solo.leaguePoints }}<span class="u">LP</span></span>
        </div>
      </div>
      <WinRate
        v-if="record && winRate !== null"
        :wins="record.wins"
        :losses="record.losses"
        style="margin-top: auto"
      />
    </div>
    <div class="col">
      <div class="row" style="gap: 10px">
        <span class="h5">LP, last 30 days</span>
        <span v-if="line" class="meta"
          >{{ line.gain >= 0 ? '+' : '−' }}{{ Math.abs(line.gain) }} LP since {{ line.from }}</span
        >
      </div>
      <template v-if="line">
        <div class="chart pf-lp">
          <svg
            class="fade"
            :viewBox="`0 0 ${W} ${H}`"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path class="area" :d="line.area" />
          </svg>
          <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
            <path
              v-for="g in line.guides"
              :key="g.t"
              class="gd"
              :d="`M0 ${(g.y / 100) * H} H${W}`"
            />
            <path class="ln" :d="line.d" />
          </svg>
          <span v-for="g in line.guides" :key="g.t" class="gl" :style="{ top: `${g.y}%` }">{{
            g.t
          }}</span>
          <span class="dot" :style="{ left: `${line.end.x}%`, top: `${line.end.y}%` }"></span>
          <span class="end" :style="{ left: `${line.end.x}%`, top: `${line.end.y}%` }"
            >{{ line.end.lp }} LP</span
          >
        </div>
        <div class="row meta" style="justify-content: space-between; margin: 8px 56px 0 64px">
          <span>{{ line.start }}</span
          ><span>Today</span>
        </div>
      </template>
      <p v-else class="meta pf-nolp">
        The line fills in as the profile is looked up: a few ranks over the month draw it.
      </p>
    </div>
    <div class="col" style="gap: 18px">
      <div v-if="last10.length" class="col" style="gap: 10px">
        <span class="lab">Last {{ last10.length }} games</span>
        <div class="row" style="gap: 12px">
          <FormStrip :results="[...last10].reverse()" tall />
          <span class="h4"
            >{{ last10.filter(Boolean).length }}W {{ last10.filter((w) => !w).length }}L</span
          >
        </div>
      </div>
      <div v-if="today.games" class="col" style="gap: 6px">
        <span class="lab">Today</span>
        <span class="row" style="gap: 10px; align-items: baseline">
          <span v-if="today.known" class="fg-m"
            >{{ today.lp >= 0 ? '+' : '−' }}{{ Math.abs(today.lp) }}<span class="u">LP</span></span
          >
          <span class="meta"
            >{{ today.wins }}W {{ today.games - today.wins }}L in {{ today.games }}
            {{ today.games === 1 ? 'game' : 'games' }}</span
          >
        </span>
      </div>
      <div v-if="flex" class="row" style="gap: 10px; margin-top: auto">
        <RankEmblem :tier="flex.tier" :size="32" />
        <div class="col">
          <span class="lab">Ranked flex</span>
          <span class="h5"
            ><span :style="{ color: tierVar(flex.tier) }">{{ label(flex) }}</span
            >, {{ flex.leaguePoints }} LP</span
          >
        </div>
      </div>
    </div>
  </section>
</template>
