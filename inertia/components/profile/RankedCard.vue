<script setup lang="ts">
import { computed } from 'vue'
import { rankFromCore, rankLabel } from '@invadelol/ui/logic'
import RankEmblem from '../ui/RankEmblem.vue'
import { tierVar } from './rank.js'
import type { Rank, RanksPayload } from '../../lib/types.js'

/**
 * The rail's Ranked sheet: Solo/Duo with its emblem, the tier in its colour, LP and the season's
 * record, then flex, smaller, under a hairline.
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
      </div>
      <span class="h5 num">{{ flex.leaguePoints }}<span class="u">LP</span></span>
    </div>
  </section>
</template>
