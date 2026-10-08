<script setup lang="ts">
import { computed } from 'vue'
import ItemRow from './ItemRow.vue'
import PerfPlate from './PerfPlate.vue'
import RuneTrees from './RuneTrees.vue'
import RoleIcon from './RoleIcon.vue'
import { champIcon, championName, spellIcon, POSITION_NAMES } from '../lib/assets.js'
import { compact, ordinal, percent } from '../lib/format.js'
import {
  laneDiff,
  laneOpponent,
  matchMinutes,
  runeSet,
  SCORE_CATEGORIES,
  SCORE_CATEGORY_LABEL,
  scoreLobby,
  skillMatrix,
  skillOrderOf,
  skillPriority,
  totalPings,
  type LobbyRanking,
  type TeamTotals,
} from '../lib/match.js'
import type { Match, Participant, TimelineEntry } from '../lib/types.js'

const props = defineProps<{
  match: Match
  player: Participant
  totals: Record<number, TeamTotals>
  lobby: LobbyRanking
  maxima: Record<string, number>
  frames: TimelineEntry[]
  allFrames?: Record<string, TimelineEntry[]>
}>()

const minutes = computed(() => matchMinutes(props.match))
const runes = computed(() => runeSet(props.frames, props.player))
const skills = computed(() => skillMatrix(skillOrderOf(props.frames)))
const priority = computed(() => skillPriority(skillOrderOf(props.frames)))
const hasSkills = computed(() => skills.value.Q.some(Boolean))
const opponent = computed(() => laneOpponent(props.match, props.player))

/** The score, and the five categories it is built from, weighted for the role. */
const breakdown = computed(() => {
  const entry = scoreLobby(props.match)[props.player.puuid]
  if (!entry) return null
  return {
    score: entry.score,
    rank: props.lobby.rank[props.player.puuid] ?? 0,
    tag: (props.lobby.mvpPuuid === props.player.puuid
      ? 'MVP'
      : props.lobby.acePuuid === props.player.puuid
        ? 'ACE'
        : null) as 'MVP' | 'ACE' | null,
    rows: SCORE_CATEGORIES.filter((key) => entry.weights[key] > 0).map((key) => ({
      key,
      label: SCORE_CATEGORY_LABEL[key],
      value: entry.categories[key],
      weight: entry.weights[key],
    })),
  }
})

/** Rows read against the best value anyone in this lobby managed. */
const groups = computed<
  Array<{ title: string; rows: Array<{ k: string; v: string | number; b?: number; c?: string }> }>
>(() => {
  const p = props.player
  const bar = (value: number, max: number) => (value / Math.max(max, 1)) * 100
  return [
    {
      title: 'Combat',
      rows: [
        {
          k: 'Damage to champions',
          v: compact(p.totalDamageDealtToChampions),
          b: bar(p.totalDamageDealtToChampions, props.maxima.damage),
        },
        {
          k: 'Damage taken',
          v: compact(p.damageTaken),
          b: bar(p.damageTaken, props.maxima.damageTaken),
        },
        { k: 'Physical', v: compact(p.physicalDamageDealtToChampions), c: 'var(--color-s1)' },
        { k: 'Magic', v: compact(p.magicDamageDealtToChampions), c: 'var(--color-s2)' },
        { k: 'True', v: compact(p.trueDamageDealtToChampions), c: 'var(--color-s3)' },
      ],
    },
    {
      title: 'Vision & objectives',
      rows: [
        { k: 'Vision score', v: p.visionScore, b: bar(p.visionScore, props.maxima.vision) },
        { k: 'Wards placed', v: p.wardsPlaced, b: bar(p.wardsPlaced, props.maxima.wards) },
        { k: 'Wards cleared', v: p.wardsKilled, b: bar(p.wardsKilled, props.maxima.wardsKilled) },
        {
          k: 'Control wards',
          v: p.visionWardsBoughtInGame,
          b: bar(p.visionWardsBoughtInGame, props.maxima.controlWards),
        },
        {
          k: 'Damage to objectives',
          v: compact(p.damageDealtToObjectives),
          b: bar(p.damageDealtToObjectives, props.maxima.objectives),
        },
        {
          k: 'Damage to turrets',
          v: compact(p.damageDealtToTurrets),
          b: bar(p.damageDealtToTurrets, props.maxima.turrets),
        },
      ],
    },
    {
      title: 'Economy',
      rows: [
        { k: 'Gold earned', v: compact(p.goldEarned), b: bar(p.goldEarned, props.maxima.gold) },
        { k: 'Gold per minute', v: compact(p.goldEarned / minutes.value) },
        { k: 'Creep score', v: p.cs, b: bar(p.cs, props.maxima.cs) },
        { k: 'CS per minute', v: (p.cs / minutes.value).toFixed(1) },
        { k: 'Lane minions', v: p.totalMinionsKilled },
        { k: 'Jungle monsters', v: p.neutralMinionsKilled },
      ],
    },
  ]
})

const PING_FIELDS: Array<[keyof Participant, string]> = [
  ['enemyMissingPings', 'Enemy missing'],
  ['onMyWayPings', 'On my way'],
  ['dangerPings', 'Danger'],
  ['assistPings', 'Assist me'],
  ['allInPings', 'All in'],
  ['pushPings', 'Push'],
  ['getBackPings', 'Get back'],
  ['commandPings', 'Command'],
  ['needVisionPings', 'Need vision'],
  ['enemyVisionPings', 'Enemy vision'],
  ['visionClearedPings', 'Vision cleared'],
  ['baitPings', 'Bait'],
  ['holdPings', 'Hold'],
]

const pings = computed(() =>
  PING_FIELDS.filter(([key]) => Number(props.player[key]) > 0)
    .map(([key, label]) => ({ label, value: Number(props.player[key]) }))
    .sort((a, b) => b.value - a.value)
)

const duel = computed(() => {
  const a = props.player
  const b = opponent.value
  if (!b) return []
  const row = (label: string, mine: number, theirs: number, format = compact) => ({
    label,
    mine,
    theirs,
    mineText: format(mine),
    theirsText: format(theirs),
    mineShare: mine + theirs ? (mine / (mine + theirs)) * 100 : 50,
  })
  const plain = (n: number) => String(Math.round(n))
  return [
    row('Damage', a.totalDamageDealtToChampions, b.totalDamageDealtToChampions),
    row('Taken', a.damageTaken, b.damageTaken),
    row('Gold', a.goldEarned, b.goldEarned),
    row('CS', a.cs, b.cs, plain),
    row('Vision', a.visionScore, b.visionScore, plain),
    row('Objectives', a.damageDealtToObjectives, b.damageDealtToObjectives),
  ]
})

/** The lane checkpoints, when the match was loaded with its timeline. */
const checkpoints = computed(() => {
  const theirs = props.allFrames?.[opponent.value?.puuid ?? ''] ?? []
  if (!props.frames.length || !theirs.length) return []
  return [10, 15]
    .map((minute) => laneDiff(props.frames, theirs, minute))
    .filter((d): d is NonNullable<typeof d> => Boolean(d?.complete))
})
</script>

<template>
  <div class="grid gap-x-8 gap-y-6 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
    <!-- Build -->
    <section class="min-w-0">
      <div class="label mb-2.5">Build</div>
      <ItemRow :items="player.items" size="md" />

      <div class="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <div class="label mb-1.5">Spells</div>
          <div class="flex gap-1">
            <img
              v-for="spell in player.spells"
              :key="spell"
              :src="spellIcon(spell)"
              alt=""
              class="thumb h-6 w-6 rounded-[3px]"
            />
          </div>
        </div>
        <div v-if="priority.length">
          <div class="label mb-1.5">Skill priority</div>
          <div class="flex items-center gap-1">
            <template v-for="(key, index) in priority" :key="key">
              <span v-if="index" class="text-[11px] text-ink-4">›</span>
              <span
                class="grid h-6 w-6 place-items-center rounded-[3px] bg-control text-[12px] font-semibold text-ink"
              >
                {{ key }}
              </span>
            </template>
          </div>
        </div>
      </div>

      <div v-if="hasSkills" class="mt-4">
        <div class="label mb-2">Skill order</div>
        <div class="scroll-x">
          <div class="min-w-[290px] space-y-[3px]">
            <div
              v-for="(row, key) in skills"
              :key="key"
              class="grid grid-cols-[14px_repeat(18,minmax(0,1fr))] items-center gap-[3px]"
            >
              <span class="text-[11px] font-semibold text-ink-3">{{ key }}</span>
              <span
                v-for="(level, index) in row"
                :key="index"
                class="num grid h-[16px] place-items-center rounded-[2px] text-[10px] font-semibold"
                :class="level ? 'bg-track text-ink' : 'bg-well text-transparent'"
              >
                {{ level ?? '.' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-5">
        <div class="label mb-2">Runes</div>
        <RuneTrees :runes="runes" compact />
      </div>
    </section>

    <!-- Numbers against the lobby -->
    <section class="min-w-0 lg:border-l lg:border-line lg:pl-8">
      <div v-if="breakdown" class="mb-6">
        <div class="flex items-center gap-3">
          <PerfPlate
            :score="breakdown.score"
            :place="breakdown.rank"
            :of="match.participants.length"
            :tag="breakdown.tag"
          />
          <span class="min-w-0">
            <span class="block text-[13px] font-semibold text-ink">Score</span>
            <span class="num block text-[12px] text-ink-3">
              <template v-if="breakdown.rank">
                {{ ordinal(breakdown.rank) }} of {{ match.participants.length }} in this game
              </template>
              <template v-else>In this game</template>
            </span>
          </span>
        </div>
        <ul class="mt-4 space-y-2">
          <li
            v-for="row in breakdown.rows"
            :key="row.key"
            class="grid grid-cols-[80px_minmax(0,1fr)_28px_40px] items-center gap-2 text-[12px]"
          >
            <span class="text-ink-2">{{ row.label }}</span>
            <span class="meter !h-[3px]">
              <span :style="{ width: `${row.value}%` }" />
            </span>
            <span class="num text-right font-semibold text-ink">{{ row.value }}</span>
            <span
              class="num text-right text-[11px] text-ink-4"
              :title="`${row.weight}% of the score for this role`"
            >
              ×{{ row.weight }}%
            </span>
          </li>
        </ul>
      </div>

      <div v-for="(group, gi) in groups" :key="group.title" :class="gi ? 'mt-5' : ''">
        <div class="label mb-2.5">{{ group.title }}</div>
        <ul class="space-y-2">
          <li v-for="row in group.rows" :key="row.k">
            <div class="flex items-baseline justify-between gap-3 text-[12.5px]">
              <span class="flex items-center gap-1.5 truncate text-ink-2">
                <i
                  v-if="row.c"
                  class="h-2 w-2 shrink-0 rounded-full"
                  :style="{ background: row.c }"
                />
                {{ row.k }}
              </span>
              <span class="num font-medium text-ink">{{ row.v }}</span>
            </div>
            <div v-if="row.b !== undefined" class="meter mt-1.5 !h-[3px]">
              <span :style="{ width: `${row.b}%` }" />
            </div>
          </li>
        </ul>
      </div>
    </section>

    <!-- The lane -->
    <section v-if="opponent" class="min-w-0 lg:border-l lg:border-line lg:pl-8">
      <div class="label mb-3">Lane matchup</div>

      <div class="mb-4 flex items-center justify-between gap-3">
        <span class="flex min-w-0 items-center gap-2">
          <img
            :src="champIcon(player.championId)"
            :alt="championName(player.championId)"
            class="thumb h-9 w-9 rounded-[5px]"
          />
          <span class="min-w-0">
            <span class="block truncate text-[13px] font-medium text-ink">
              {{ player.gameName }}
            </span>
            <span class="flex items-center gap-1 text-[12px] text-ink-3">
              <RoleIcon v-if="player.position" :role="player.position" :size="10" />
              {{ POSITION_NAMES[player.position] || championName(player.championId) }}
            </span>
          </span>
        </span>
        <span class="shrink-0 text-[12px] text-ink-4">vs</span>
        <span class="flex min-w-0 items-center justify-end gap-2">
          <span class="min-w-0 text-right">
            <span class="block truncate text-[13px] font-medium text-ink">
              {{ opponent.gameName }}
            </span>
            <span class="block truncate text-[12px] text-ink-3">
              {{ championName(opponent.championId) }}
            </span>
          </span>
          <img
            :src="champIcon(opponent.championId)"
            :alt="championName(opponent.championId)"
            class="thumb h-9 w-9 rounded-[5px]"
          />
        </span>
      </div>

      <ul class="space-y-2.5">
        <li v-for="row in duel" :key="row.label">
          <div class="num mb-1 flex items-baseline justify-between gap-2 text-[12px]">
            <span :class="row.mine >= row.theirs ? 'font-semibold text-ink' : 'text-ink-3'">
              {{ row.mineText }}
            </span>
            <span class="text-[12px] text-ink-3">{{ row.label }}</span>
            <span :class="row.theirs > row.mine ? 'font-semibold text-ink' : 'text-ink-3'">
              {{ row.theirsText }}
            </span>
          </div>
          <div class="flex h-[3px] gap-[2px] overflow-hidden rounded-[2px]">
            <span class="flex flex-1 justify-end bg-control">
              <span
                class="block h-full bg-ink-2"
                :style="{ width: percent(row.mineShare / 100) }"
              />
            </span>
            <span class="flex-1 bg-control">
              <span
                class="block h-full bg-ink-4"
                :style="{ width: percent(1 - row.mineShare / 100) }"
              />
            </span>
          </div>
        </li>
      </ul>

      <div v-if="checkpoints.length" class="mt-5 border-t border-line pt-4">
        <div class="label mb-2.5">Lane checkpoints</div>
        <table class="num w-full text-[12px]">
          <thead>
            <tr class="text-[12px] text-ink-3">
              <th class="pb-1.5 text-left font-medium">At</th>
              <th class="pb-1.5 text-right font-medium">Gold</th>
              <th class="pb-1.5 text-right font-medium">CS</th>
              <th class="pb-1.5 text-right font-medium">XP</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="point in checkpoints" :key="point.minute">
              <td class="py-1 text-ink-2">{{ point.minute }} min</td>
              <td
                class="py-1 text-right font-medium"
                :class="point.gold > 0 ? 'text-win' : point.gold < 0 ? 'text-loss' : 'text-ink-3'"
              >
                {{ point.gold > 0 ? '+' : '' }}{{ compact(point.gold) }}
              </td>
              <td
                class="py-1 text-right font-medium"
                :class="point.cs > 0 ? 'text-win' : point.cs < 0 ? 'text-loss' : 'text-ink-3'"
              >
                {{ point.cs > 0 ? '+' : '' }}{{ Math.round(point.cs) }}
              </td>
              <td
                class="py-1 text-right font-medium"
                :class="point.xp > 0 ? 'text-win' : point.xp < 0 ? 'text-loss' : 'text-ink-3'"
              >
                {{ point.xp > 0 ? '+' : '' }}{{ compact(point.xp) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- The League client does not report pings: desktop games leave them out rather than show 0. -->
      <div v-if="match.completeness?.pings !== false" class="mt-5 border-t border-line pt-4">
        <div class="label mb-2.5">Pings · {{ totalPings(player) }}</div>
        <ul v-if="pings.length" class="space-y-2">
          <li v-for="ping in pings" :key="ping.label">
            <div class="flex items-baseline justify-between gap-3 text-[12px]">
              <span class="truncate text-ink-2">{{ ping.label }}</span>
              <span class="num font-medium text-ink">{{ ping.value }}</span>
            </div>
            <div class="meter mt-1.5 !h-[3px]">
              <span
                :style="{ width: `${(ping.value / Math.max(totalPings(player), 1)) * 100}%` }"
              />
            </div>
          </li>
        </ul>
        <p v-else class="text-[12.5px] text-ink-3">No pings this game.</p>
      </div>
    </section>
  </div>
</template>
