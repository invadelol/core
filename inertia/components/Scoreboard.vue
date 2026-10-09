<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import ItemRow from './ItemRow.vue'
import RuneGlyphs from './RuneGlyphs.vue'
import PlayerLink from './PlayerLink.vue'
import PlayerRowDetail from './PlayerRowDetail.vue'
import PerfDial from './PerfDial.vue'
import ObjectiveTally from './ObjectiveTally.vue'
import RoleIcon from './RoleIcon.vue'
import { champIcon, championName, spellIcon, POSITION_NAMES } from '../lib/assets.js'
import { compact, kda } from '../lib/format.js'
import {
  bansOf,
  damageShare,
  killParticipation,
  matchMinutes,
  rankLobby,
  runeSet,
  teamMembers,
  teamOrder,
  teamTotals,
  teamWon,
} from '../lib/match.js'
import type { Match, Participant, TimelineEntry } from '../lib/types.js'

const props = withDefaults(
  defineProps<{
    match: Match
    /** The profile being viewed, marked wherever it appears. */
    ownerPuuid?: string
    /** Frames per player, when the match has been loaded in full. */
    timeline?: Record<string, TimelineEntry[]>
    /** Which player's detail row is open. */
    openPuuid?: string
    /** Drops the per-minute second lines and shrinks the score. */
    dense?: boolean
  }>(),
  { dense: false }
)

const emit = defineEmits<{ open: [puuid: string] }>()

const totals = computed(() => teamTotals(props.match))
const lobby = computed(() => rankLobby(props.match))
const minutes = computed(() => matchMinutes(props.match))

const maxima = computed(() => {
  const players = props.match.participants
  const max = (pick: (p: Participant) => number) => Math.max(...players.map(pick), 1)
  return {
    damage: max((p) => p.totalDamageDealtToChampions || 0),
    damageTaken: max((p) => p.damageTaken || 0),
    gold: max((p) => p.goldEarned || 0),
    cs: max((p) => p.cs || 0),
    vision: max((p) => p.visionScore || 0),
    wards: max((p) => p.wardsPlaced || 0),
    wardsKilled: max((p) => p.wardsKilled || 0),
    controlWards: max((p) => p.visionWardsBoughtInGame || 0),
    objectives: max((p) => p.damageDealtToObjectives || 0),
    turrets: max((p) => p.damageDealtToTurrets || 0),
  }
})

/** The viewed player's team first; without one, the winners. */
const order = computed(() => {
  const owner = props.match.participants.find((p) => p.puuid === props.ownerPuuid)
  if (!owner) return teamOrder(props.match)
  return owner.teamId === 100 ? [100, 200] : [200, 100]
})

const sides = computed(() =>
  order.value.map((teamId) => {
    const won = teamWon(props.match, teamId)
    return {
      teamId,
      won,
      side: teamId === 100 ? 'Blue side' : 'Red side',
      kills: totals.value[teamId].kills,
      gold: totals.value[teamId].gold,
      bans: bansOf(props.match, teamId),
      rows: teamMembers(props.match, teamId).map((p) => {
        const total = Math.max(p.totalDamageDealtToChampions, 1)
        return {
          p,
          role: POSITION_NAMES[p.position] || '',
          champion: championName(p.championId),
          ratio: kda(p.kills, p.deaths, p.assists),
          kp: Math.round(killParticipation(p, totals.value)),
          share: Math.round(damageShare(p, totals.value)),
          score: lobby.value.score[p.puuid] ?? null,
          rank: lobby.value.rank[p.puuid] ?? 0,
          damageBar: (p.totalDamageDealtToChampions / maxima.value.damage) * 100,
          takenBar: (p.damageTaken / maxima.value.damageTaken) * 100,
          /* The physical / magic / true split, read on hover. */
          mix: `${Math.round((p.physicalDamageDealtToChampions / total) * 100)}% physical · ${Math.round((p.magicDamageDealtToChampions / total) * 100)}% magic · ${Math.round((p.trueDamageDealtToChampions / total) * 100)}% true`,
          csMin: (p.cs / minutes.value).toFixed(1),
          goldMin: Math.round(p.goldEarned / minutes.value),
          damageMin: Math.round(p.totalDamageDealtToChampions / minutes.value),
          runes: runeSet(props.timeline?.[p.puuid] ?? [], p),
          badge: (p.puuid === lobby.value.mvpPuuid
            ? 'MVP'
            : p.puuid === lobby.value.acePuuid
              ? 'ACE'
              : null) as 'MVP' | 'ACE' | null,
        }
      }),
    }
  })
)

const columnCount = 10
</script>

<template>
  <div class="scroll-x [container-type:inline-size]">
    <table class="dt dt-hover num" :class="dense ? 'min-w-[880px]' : 'min-w-[960px]'">
      <thead>
        <tr>
          <th class="w-[30%] !pl-4">Player</th>
          <th class="w-[124px] text-right" title="0–100, against the other nine players">Score</th>
          <th class="text-right">KDA</th>
          <th class="text-right">KP</th>
          <th class="w-[14%]">Damage</th>
          <th class="w-[9%]">Taken</th>
          <th class="text-right">CS</th>
          <th class="text-right">Gold</th>
          <th class="text-right">Vision</th>
          <th class="!pr-4">Build</th>
        </tr>
      </thead>

      <tbody v-for="side in sides" :key="side.teamId">
        <!-- One table banded by team: the result word is the only result colour. -->
        <tr class="band">
          <td :colspan="columnCount" class="!pl-4">
            <div class="flex flex-wrap items-center gap-x-5 gap-y-1.5">
              <span class="text-[13px] font-semibold">
                <span :class="side.won ? 'text-win' : 'text-loss'">
                  {{ side.won ? 'Victory' : 'Defeat' }}
                </span>
                <span class="font-medium text-ink-3"> · {{ side.side }}</span>
              </span>

              <span class="text-[12px] text-ink-2">
                {{ side.kills }} kills <span class="text-ink-4">·</span>
                {{ compact(side.gold) }} gold
              </span>

              <ObjectiveTally :match="match" :team-id="side.teamId" />

              <span v-if="side.bans.length" class="ml-auto flex items-center gap-1">
                <span class="mr-1 text-[12px] text-ink-3">Bans</span>
                <img
                  v-for="(id, i) in side.bans"
                  :key="`${id}-${i}`"
                  :src="champIcon(id)"
                  :alt="championName(id)"
                  :title="championName(id)"
                  loading="lazy"
                  class="thumb h-[18px] w-[18px] rounded-[3px] opacity-40 grayscale transition hover:opacity-100 hover:grayscale-0"
                />
              </span>
            </div>
          </td>
        </tr>

        <template v-for="row in side.rows" :key="row.p.puuid">
          <tr
            class="cursor-pointer"
            :class="[
              row.p.puuid === ownerPuuid ? 'is-self' : '',
              openPuuid === row.p.puuid ? '[&>td]:!bg-raised' : '',
            ]"
            :aria-expanded="openPuuid === row.p.puuid"
            @click="emit('open', row.p.puuid)"
          >
            <td class="!pl-4">
              <div class="flex items-center gap-2">
                <span class="relative shrink-0">
                  <span class="portrait block h-8 w-8">
                    <img
                      :src="champIcon(row.p.championId)"
                      :alt="row.champion"
                      width="32"
                      height="32"
                      loading="lazy"
                      decoding="async"
                    />
                  </span>
                  <span
                    class="lvl absolute -bottom-1 -right-1 !h-[14px] !min-w-[15px] !text-[10px]"
                  >
                    {{ row.p.champLevel }}
                  </span>
                </span>

                <span class="ml-0.5 flex shrink-0 flex-col gap-[2px]">
                  <img
                    v-for="spell in row.p.spells.slice(0, 2)"
                    :key="spell"
                    :src="spellIcon(spell)"
                    alt=""
                    loading="lazy"
                    class="thumb h-[15px] w-[15px] rounded-[3px]"
                  />
                </span>

                <RuneGlyphs :runes="row.runes" size="xs" class="hidden shrink-0 sm:flex" />

                <span class="ml-1 min-w-0 flex-1">
                  <PlayerLink
                    :game-name="row.p.gameName"
                    :tag-line="row.p.tagLine"
                    :is-self="row.p.puuid === ownerPuuid"
                    wrap
                    class="text-[13px] leading-[17px]"
                    @click.stop
                  />
                  <span class="flex items-center gap-1 text-[12px] leading-4 text-ink-3">
                    <RoleIcon
                      v-if="row.p.position"
                      :role="row.p.position"
                      :size="12"
                      class="shrink-0"
                    />
                    <span class="[overflow-wrap:anywhere]">{{ row.champion }}</span>
                  </span>
                </span>

                <ChevronRight
                  :size="14"
                  class="shrink-0 text-ink-4 transition-transform"
                  :class="openPuuid === row.p.puuid ? 'rotate-90 text-ink-2' : ''"
                />
              </div>
            </td>

            <td class="text-right">
              <PerfDial
                size="sm"
                :score="row.score"
                :place="row.rank"
                :of="match.participants.length"
                :tag="row.badge"
              />
            </td>

            <td class="text-right">
              <div class="whitespace-nowrap text-[13px] font-semibold text-ink">
                {{ row.p.kills }}<span class="mx-[3px] font-normal text-ink-4">/</span
                >{{ row.p.deaths }}<span class="mx-[3px] font-normal text-ink-4">/</span
                >{{ row.p.assists }}
              </div>
              <div class="text-[11px] text-ink-3">{{ row.ratio.toFixed(2) }}</div>
            </td>

            <td class="text-right text-ink-2">{{ row.kp }}%</td>

            <td :title="`${row.share}% of team damage · ${row.mix}`">
              <div class="mb-1 flex items-baseline justify-between gap-2">
                <span class="text-ink">{{ compact(row.p.totalDamageDealtToChampions) }}</span>
                <span v-if="!dense" class="text-[11px] text-ink-3">{{ row.share }}%</span>
              </div>
              <div class="meter !h-[3px]">
                <span
                  :style="{
                    width: `${Math.max(row.damageBar, 3)}%`,
                    background:
                      row.p.puuid === ownerPuuid ? 'var(--color-brand)' : 'var(--color-ink-4)',
                  }"
                />
              </div>
            </td>

            <td>
              <div class="mb-1 text-ink-2">{{ compact(row.p.damageTaken) }}</div>
              <div class="meter !h-[3px]">
                <span :style="{ width: `${row.takenBar}%`, background: 'var(--color-ink-4)' }" />
              </div>
            </td>

            <td class="text-right">
              <div class="text-ink">{{ row.p.cs }}</div>
              <div class="text-[11px] text-ink-3">{{ row.csMin }}/min</div>
            </td>

            <td class="text-right">
              <div class="text-ink">{{ compact(row.p.goldEarned) }}</div>
              <div v-if="!dense" class="text-[11px] text-ink-3">{{ row.goldMin }}/min</div>
            </td>

            <td class="text-right">
              <div class="text-ink">{{ row.p.visionScore }}</div>
              <!-- Ward counts are analysis-only columns: the list payload
                   does not carry them, so printing 0/0 would be a lie. -->
              <div v-if="row.p.wardsPlaced !== undefined" class="text-[11px] text-ink-3">
                {{ row.p.wardsPlaced }} / {{ row.p.wardsKilled }}
              </div>
            </td>

            <td class="!pr-4"><ItemRow :items="row.p.items" size="xs" /></td>
          </tr>

          <!-- The player deep dive opens in place, not on a second screen. -->
          <tr v-if="openPuuid === row.p.puuid">
            <td :colspan="columnCount" class="!h-auto !bg-raised !px-4 !py-0">
              <!-- Stays as wide as the visible strip, however far the table is scrolled. -->
              <div class="sticky left-0 w-[calc(100cqw-32px)]">
                <PlayerRowDetail
                  :match="match"
                  :player="row.p"
                  :totals="totals"
                  :lobby="lobby"
                  :maxima="maxima"
                  :frames="timeline?.[row.p.puuid] ?? []"
                  :all-frames="timeline"
                />
              </div>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
