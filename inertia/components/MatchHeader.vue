<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon, ObjectiveIcon, useFormat, type ObjectiveIconName } from '@invadelol/ui'
import { queueName, type MatchDetail } from '@invadelol/ui/logic'
import { regionLabel } from '../lib/assets.js'
import type { Match } from '../lib/types.js'

/**
 * The top of a match page, which has no row above its detail: the queue and when, then the
 * scorebug (each team's result and kills, the clock and the gold race). The viewed player's team
 * is on the left; blue side when nobody is viewed.
 */
const props = defineProps<{
  detail: MatchDetail
  match: Pick<Match, 'matchId' | 'platform' | 'source' | 'verification'>
  puuid?: string
}>()
const { ago, compact, date, mmss, signedGold } = useFormat()

/** One quiet line for games the desktop app recorded; Riot's own games need none. */
const provenance = computed(() => {
  if (props.match.source !== 'desktop') return ''
  return props.match.verification === 'verified'
    ? 'Recorded by the Invade app, verified by Riot'
    : 'Recorded by the Invade app'
})

const mine = computed(() => props.detail.players.find((p) => p.puuid === props.puuid)?.teamId)
const sides = computed(() =>
  [...props.detail.teams]
    .sort((a, b) =>
      a.teamId === mine.value ? -1 : b.teamId === mine.value ? 1 : a.teamId - b.teamId
    )
    .map((team) => ({ ...team, side: team.teamId === 100 ? 'Blue side' : 'Red side' }))
)

/** What each team took, on Summoner's Rift (the other maps have none of these). */
const OBJECTIVES: Array<{
  id: ObjectiveIconName
  key: 'towers' | 'inhibitors' | 'dragons' | 'barons' | 'heralds'
  label: string
}> = [
  { id: 'tower', key: 'towers', label: 'Turrets' },
  { id: 'inhib', key: 'inhibitors', label: 'Inhibitors' },
  { id: 'dragon', key: 'dragons', label: 'Dragons' },
  { id: 'baron', key: 'barons', label: 'Barons' },
  { id: 'herald', key: 'heralds', label: 'Rift Heralds' },
]

/** Gold lead of the left team: blue when ahead, red when behind (good or bad for you). */
const lead = computed(() => sides.value[0].gold - (sides.value[1]?.gold ?? 0))
const split = computed(() => {
  const sum = sides.value[0].gold + (sides.value[1]?.gold ?? 0)
  return sum ? (sides.value[0].gold / sum) * 100 : 50
})

const copied = ref(false)
async function copyId() {
  try {
    await navigator.clipboard.writeText(props.match.matchId)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    /* the id is selectable either way */
  }
}
</script>

<template>
  <header class="iv-panel match-head">
    <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
      <div class="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 class="text-[20px] font-semibold leading-6 tracking-[-0.01em] text-ink">
          {{ queueName(detail.queueId) }}
        </h1>
        <p class="num text-[12.5px] text-ink-3">
          {{ date(detail.creation, { day: 'numeric', month: 'short', year: 'numeric' }) }},
          {{ ago(detail.creation) }}
          <span class="text-ink-4">·</span> {{ regionLabel(match.platform) }}
          <template v-if="provenance">
            <span class="text-ink-4">·</span> {{ provenance }}
          </template>
        </p>
      </div>

      <button
        type="button"
        class="num flex shrink-0 items-center gap-1.5 text-[12px] text-ink-4 transition-colors hover:text-ink-2 pointer-coarse:h-9"
        title="Copy match id"
        @click="copyId"
      >
        {{ copied ? 'Copied' : match.matchId }}
        <Icon name="copy" :size="12" />
      </button>
    </div>

    <div
      class="mt-5 grid grid-cols-2 items-center gap-x-4 gap-y-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)] sm:gap-10"
    >
      <div
        v-for="(team, index) in sides"
        :key="team.teamId"
        :class="index ? 'text-right sm:order-3' : ''"
      >
        <div class="text-[13px] font-semibold">
          <span :class="team.win ? 'text-win' : 'text-loss'">{{
            team.win ? 'Victory' : 'Defeat'
          }}</span>
          <span class="font-medium text-ink-3"> · {{ team.side }}</span>
        </div>
        <div class="iv-fig mt-2 text-[40px] sm:text-[44px]">{{ team.kills }}</div>
        <div
          class="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 sm:gap-x-3"
          :class="index ? 'justify-end' : ''"
        >
          <span
            v-for="o in OBJECTIVES"
            :key="o.id"
            class="num flex items-center gap-1 text-[13px] font-semibold"
            :class="team[o.key] ? 'text-ink' : 'text-ink-4'"
            :title="`${team[o.key]} ${o.label}`"
          >
            <ObjectiveIcon :name="o.id" :size="14" :class="{ 'text-ink-3': team[o.key] }" />
            {{ team[o.key] }}
          </span>
        </div>
      </div>

      <div class="col-span-2 min-w-0 sm:order-2 sm:col-span-1">
        <div class="iv-fig text-center text-[24px]">{{ mmss(detail.duration) }}</div>
        <div class="num mb-2 mt-2 text-center text-[12px] font-medium">
          <span v-if="lead === 0" class="text-ink-3">Even gold</span>
          <span v-else :class="lead > 0 ? 'text-win' : 'text-loss'">
            {{ signedGold(lead) }} gold
            <span class="text-ink-3">{{
              mine ? 'for your team' : `for ${sides[0].side.toLowerCase()}`
            }}</span>
          </span>
        </div>
        <div class="flex h-[4px] gap-[2px]">
          <span class="rounded-l-[2px] bg-win" :style="{ width: `${split}%` }" />
          <span class="flex-1 rounded-r-[2px] bg-loss" />
        </div>
        <div class="num mt-1.5 flex justify-between text-[12px] text-ink-3">
          <span>{{ compact(sides[0].gold) }}</span>
          <span>{{ compact(sides[1]?.gold ?? 0) }}</span>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.match-head {
  padding: 16px 20px 20px;
}
</style>
