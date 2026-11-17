<script setup lang="ts">
import { computed } from 'vue'
import { rankFromCore, rankLabel, rankValue } from '@invadelol/ui/logic'
import RankEmblem from '../ui/RankEmblem.vue'
import { tierVar } from './rank.js'
import type { Rank, RanksPayload } from '../../lib/types.js'

/**
 * The rail's Ranked sheet: Solo/Duo with its emblem, the tier in its colour, LP and the season's
 * record, then flex, smaller, under a hairline. Under each, the peak stored for that queue when it is
 * above where the player stands now.
 */
const props = defineProps<{ ranks: RanksPayload | null }>()

const time = (r: Rank) => new Date(r.fetchedAt ?? 0).getTime()
const label = (r: Rank) => rankLabel(rankFromCore(r), false)
const find = (queue: string) =>
  props.ranks?.current?.find((r) => r.queueType === queue && r.tier) ?? null
const solo = computed(() => find('RANKED_SOLO_5x5'))
const flex = computed(() => find('RANKED_FLEX_SR'))

/** A queue's record, from the rank itself or the latest snapshot that had one. */
function recordOf(r: Rank | null) {
  if (!r) return null
  if (r.losses !== null && r.losses !== undefined) return { wins: r.wins, losses: r.losses }
  const basis = (props.ranks?.history ?? [])
    .filter((h) => h.queueType === r.queueType && h.losses !== null && h.losses !== undefined)
    .sort((a, b) => time(b) - time(a))[0]
  return basis ? { wins: basis.wins, losses: basis.losses as number } : null
}
const soloRecord = computed(() => recordOf(solo.value))
const flexRecord = computed(() => recordOf(flex.value))
/** The highest rank stored for a queue, only when it beats the current one. */
function peakOf(r: Rank | null) {
  if (!r) return null
  const value = (x: Rank) => rankValue(rankFromCore(x))
  const now = value(r)
  if (now === null) return null
  let best: Rank | null = null
  let bestValue = now
  for (const h of props.ranks?.history ?? []) {
    if (h.queueType !== r.queueType || !h.tier) continue
    const v = value(h)
    if (v !== null && v > bestValue) [best, bestValue] = [h, v]
  }
  return best
}
const soloPeak = computed(() => peakOf(solo.value))
const flexPeak = computed(() => peakOf(flex.value))
const pct = (r: { wins: number; losses: number }) =>
  r.wins + r.losses ? Math.round((r.wins / (r.wins + r.losses)) * 100) : 0
</script>

<template>
  <section class="card pl-sec">
    <div class="pl-sec-h"><h2 class="h4">Ranked</h2></div>
    <div class="pl-rk">
      <RankEmblem :tier="solo?.tier" :size="64" />
      <div class="col" style="gap: 2px; min-width: 0">
        <span class="lab">Solo/Duo</span>
        <span class="h3 pl-tier" :style="{ color: solo ? tierVar(solo.tier) : 'var(--t2)' }">{{
          solo ? label(solo) : 'Unranked'
        }}</span>
        <span v-if="soloRecord" class="meta num"
          ><b class="wn">{{ soloRecord.wins }}W</b> <b class="ls">{{ soloRecord.losses }}L</b> ·
          {{ pct(soloRecord) }}%</span
        >
        <span v-if="soloPeak" class="lab num pl-peak"
          >Peak <b :style="{ color: tierVar(soloPeak.tier) }">{{ label(soloPeak) }}</b> {{ soloPeak.leaguePoints }} LP</span
        >
      </div>
      <span v-if="solo" class="fg-s num">{{ solo.leaguePoints }}<span class="u">LP</span></span>
    </div>
    <div v-if="flex" class="pl-rk sm">
      <RankEmblem :tier="flex.tier" :size="40" />
      <div class="col" style="gap: 2px; min-width: 0">
        <span class="lab">Flex</span>
        <span class="h5" :style="{ color: tierVar(flex.tier) }">{{ label(flex) }}</span>
        <span v-if="flexRecord" class="meta num"
          >{{ flexRecord.wins }}W {{ flexRecord.losses }}L · {{ pct(flexRecord) }}%</span
        >
        <span v-if="flexPeak" class="lab num pl-peak"
          >Peak <b :style="{ color: tierVar(flexPeak.tier) }">{{ label(flexPeak) }}</b> {{ flexPeak.leaguePoints }} LP</span
        >
      </div>
      <span class="h5 num">{{ flex.leaguePoints }}<span class="u">LP</span></span>
    </div>
  </section>
</template>

<style scoped>
/* the peak: one quiet line, only the rank name in its tier colour */
.pl-peak {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pl-peak b {
  font-weight: 650;
}
</style>
