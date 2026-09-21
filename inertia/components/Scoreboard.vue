<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import ItemRow from './ItemRow.vue'
import RuneGlyphs from './RuneGlyphs.vue'
import PlayerLink from './PlayerLink.vue'
import PlayerRowDetail from './PlayerRowDetail.vue'
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
    /** Drops the rating column and the per-minute second lines. */
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

const sides = computed(() =>
  teamOrder(props.match).map((teamId) => {
    const won = teamWon(props.match, teamId)
    return {
      teamId,
      won,
      side: teamId === 100 ? 'Blue' : 'Red',
      color: teamId === 100 ? 'var(--color-blue)' : 'var(--color-red)',
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
          rating: lobby.value.rating[p.puuid] ?? 0,
          rank: lobby.value.rank[p.puuid] ?? 0,
          damageBar: (p.totalDamageDealtToChampions / maxima.value.damage) * 100,
          takenBar: (p.damageTaken / maxima.value.damageTaken) * 100,
          /* The physical/magic/true split used to be buried in one player's
             panel. On every row it is the fastest way to read a team's
             damage profile, and it costs no extra width. */
          mix: [
            { w: (p.physicalDamageDealtToChampions / total) * 100, c: 'var(--color-s1)' },
            { w: (p.magicDamageDealtToChampions / total) * 100, c: 'var(--color-s2)' },
            { w: (p.trueDamageDealtToChampions / total) * 100, c: 'var(--color-s3)' },
          ],
          csMin: (p.cs / minutes.value).toFixed(1),
          goldMin: Math.round(p.goldEarned / minutes.value),
          damageMin: Math.round(p.totalDamageDealtToChampions / minutes.value),
          runes: runeSet(props.timeline?.[p.puuid] ?? [], p),
          badge:
            p.puuid === lobby.value.mvpPuuid
              ? 'MVP'
              : p.puuid === lobby.value.acePuuid
                ? 'ACE'
                : null,
        }
      }),
    }
  })
)

const columnCount = computed(() => (props.dense ? 9 : 10))
</script>

<template>
  <div class="scroll-x">
    <table class="dt dt-hover num" :class="dense ? 'min-w-[880px]' : 'min-w-[1040px]'">
      <thead>
        <tr>
          <th class="w-[30%] !pl-3">Player</th>
          <th v-if="!dense" class="w-[74px]">Rating</th>
          <th class="text-right">KDA</th>
          <th class="text-right">KP</th>
          <th class="w-[15%]">Damage</th>
          <th class="w-[9%]">Taken</th>
          <th class="text-right">CS</th>
          <th class="text-right">Gold</th>
          <th class="text-right">Vision</th>
          <th class="!pr-3">Build</th>
        </tr>
      </thead>

      <tbody v-for="side in sides" :key="side.teamId">
        <!-- One table banded by team, rather than two tables side by side. -->
        <tr class="band">
          <td :colspan="columnCount">
            <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span class="flex items-center gap-2">
                <span class="h-3 w-[3px] rounded-full" :style="{ background: side.color }" />
                <span
                  class="text-[12px] font-semibold uppercase tracking-[0.06em]"
                  :class="side.won ? 'text-win' : 'text-loss'"
                >
                  {{ side.won ? 'Victory' : 'Defeat' }}
                </span>
                <span class="text-[11.5px] text-ink-3">{{ side.side }} side</span>
              </span>

              <span class="text-[11.5px] text-ink-2">
                <b class="font-semibold text-ink">{{ side.kills }}</b> kills
                <span class="text-ink-4">·</span>
                <span class="text-gold">{{ compact(side.gold) }}</span> gold
              </span>

              <ObjectiveTally :match="match" :team-id="side.teamId" />

              <span v-if="side.bans.length" class="ml-auto flex items-center gap-1.5">
                <span class="label !text-[9.5px]">Banned</span>
                <img
                  v-for="(id, i) in side.bans"
                  :key="`${id}-${i}`"
                  :src="champIcon(id)"
                  :alt="championName(id)"
                  :title="championName(id)"
                  loading="lazy"
                  class="thumb h-[17px] w-[17px] rounded-[3px] opacity-45 grayscale transition hover:opacity-100 hover:grayscale-0"
                />
              </span>
            </div>
          </td>
        </tr>

        <template v-for="row in side.rows" :key="row.p.puuid">
          <tr
            class="cursor-pointer"
            :class="openPuuid === row.p.puuid ? '[&>td]:!bg-raised' : ''"
            @click="emit('open', row.p.puuid)"
          >
            <td class="!pl-3">
              <div class="flex items-center gap-2">
                <ChevronRight
                  :size="13"
                  class="shrink-0 text-ink-4 transition-transform"
                  :class="openPuuid === row.p.puuid ? 'rotate-90 text-ink-2' : ''"
                />

                <span class="relative shrink-0">
                  <img
                    :src="champIcon(row.p.championId)"
                    :alt="row.champion"
                    width="30"
                    height="30"
                    loading="lazy"
                    decoding="async"
                    class="thumb h-[30px] w-[30px] rounded-[6px]"
                  />
                  <span
                    class="absolute -bottom-1 -left-1 grid h-[14px] min-w-[14px] place-items-center rounded-full bg-ink px-[3px] text-[8.5px] font-semibold text-bg"
                  >
                    {{ row.p.champLevel }}
                  </span>
                </span>

                <span class="flex shrink-0 flex-col gap-[2px]">
                  <img
                    v-for="spell in row.p.spells.slice(0, 2)"
                    :key="spell"
                    :src="spellIcon(spell)"
                    alt=""
                    loading="lazy"
                    class="thumb h-[14px] w-[14px] rounded-[3px]"
                  />
                </span>

                <RuneGlyphs :runes="row.runes" size="xs" class="hidden shrink-0 sm:flex" />

                <span class="min-w-0 flex-1">
                  <span class="flex items-center gap-1.5">
                    <PlayerLink
                      :game-name="row.p.gameName"
                      :tag-line="row.p.tagLine"
                      :is-self="row.p.puuid === ownerPuuid"
                      class="max-w-[15ch] text-[12.5px]"
                      @click.stop
                    />
                    <span
                      v-if="row.badge"
                      class="rounded-[3px] px-1 py-px text-[9px] font-semibold tracking-[0.04em]"
                      :class="row.badge === 'MVP' ? 'bg-ink text-bg' : 'bg-sunken text-ink-2'"
                    >
                      {{ row.badge }}
                    </span>
                  </span>
                  <span class="flex items-center gap-1 truncate text-[10.5px] text-ink-3">
                    <RoleIcon v-if="row.p.position" :role="row.p.position" :size="11" />
                    <span class="truncate">
                      {{ row.role ? `${row.role} · ` : '' }}{{ row.champion }}
                    </span>
                  </span>
                </span>
              </div>
            </td>

            <td v-if="!dense">
              <div class="mb-1 text-[11.5px] text-ink-2">{{ row.rating }}</div>
              <div class="meter">
                <span
                  :style="{
                    width: `${row.rating}%`,
                    background: row.rank <= 3 ? 'var(--color-ink)' : 'var(--color-ink-4)',
                  }"
                />
              </div>
            </td>

            <td class="text-right">
              <div class="text-ink">
                {{ row.p.kills }}<span class="text-ink-4">/</span
                ><span class="text-loss">{{ row.p.deaths }}</span
                ><span class="text-ink-4">/</span>{{ row.p.assists }}
              </div>
              <div class="text-[10.5px] text-ink-3">{{ row.ratio.toFixed(2) }}</div>
            </td>

            <td class="text-right text-ink-2">{{ row.kp }}%</td>

            <td>
              <div class="mb-1 flex items-baseline justify-between gap-2">
                <span class="text-ink-2">{{ compact(row.p.totalDamageDealtToChampions) }}</span>
                <span v-if="!dense" class="text-[10.5px] text-ink-4">{{ row.damageMin }}/m</span>
              </div>
              <div
                class="flex h-[4px] overflow-hidden rounded-full bg-sunken"
                :style="{ width: `${Math.max(row.damageBar, 4)}%` }"
                :title="`${row.share}% of team damage`"
              >
                <span
                  v-for="(part, i) in row.mix"
                  :key="i"
                  :style="{ width: `${part.w}%`, background: part.c }"
                />
              </div>
            </td>

            <td>
              <div class="mb-1 text-ink-3">{{ compact(row.p.damageTaken) }}</div>
              <div class="meter">
                <span :style="{ width: `${row.takenBar}%`, background: 'var(--color-ink-4)' }" />
              </div>
            </td>

            <td class="text-right">
              <div class="text-ink-2">{{ row.p.cs }}</div>
              <div class="text-[10.5px] text-ink-3">{{ row.csMin }}/m</div>
            </td>

            <td class="text-right">
              <div class="text-gold">{{ compact(row.p.goldEarned) }}</div>
              <div v-if="!dense" class="text-[10.5px] text-ink-3">{{ row.goldMin }}/m</div>
            </td>

            <td class="text-right">
              <div class="text-ink-2">{{ row.p.visionScore }}</div>
              <!-- Ward counts are analysis-only columns: the list payload
                   does not carry them, so printing 0/0 would be a lie. -->
              <div v-if="row.p.wardsPlaced !== undefined" class="text-[10.5px] text-ink-3">
                {{ row.p.wardsPlaced }}/{{ row.p.wardsKilled }}
              </div>
            </td>

            <td class="!pr-3"><ItemRow :items="row.p.items" size="xs" /></td>
          </tr>

          <!-- The player deep dive opens in place, not on a second screen. -->
          <tr v-if="openPuuid === row.p.puuid">
            <td :colspan="columnCount" class="!bg-raised !px-3 !py-0">
              <PlayerRowDetail
                :match="match"
                :player="row.p"
                :totals="totals"
                :lobby="lobby"
                :maxima="maxima"
                :frames="timeline?.[row.p.puuid] ?? []"
                :all-frames="timeline"
              />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
