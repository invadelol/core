<script setup lang="ts">
import ItemRow from './ItemRow.vue'
import Meter from './ui/Meter.vue'
import { champIcon, championName, POSITION_NAMES } from '../lib/assets.js'
import { compact, kda } from '../lib/format.js'
import {
  killParticipation,
  matchMinutes,
  objectives,
  teamMembers,
  teamWon,
  type LobbyRanking,
  type TeamTotals,
} from '../lib/match.js'
import type { Match } from '../lib/types.js'

defineProps<{
  match: Match
  teamId: number
  lobby: LobbyRanking
  totals: Record<number, TeamTotals>
  /** Largest value in the whole lobby, so both teams share one scale. */
  maxDamage: number
  selectedPuuid: string
}>()

defineEmits<{ select: [puuid: string] }>()

const OBJECTIVE_LABELS: Array<[keyof ReturnType<typeof objectives>, string]> = [
  ['towers', 'Towers'],
  ['inhibs', 'Inhibitors'],
  ['dragons', 'Dragons'],
  ['barons', 'Barons'],
  ['heralds', 'Heralds'],
]
</script>

<template>
  <div class="card overflow-hidden">
    <div
      class="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-2.5"
    >
      <span
        class="text-[0.8125rem] font-semibold"
        :class="teamWon(match, teamId) ? 'text-win' : 'text-loss'"
      >
        {{ teamWon(match, teamId) ? 'Victory' : 'Defeat' }}
        <span class="font-normal text-ink-3"
          >· {{ teamId === 100 ? 'Blue side' : 'Red side' }}</span
        >
      </span>
      <span class="num flex flex-wrap gap-3 text-[0.6875rem] text-ink-2">
        <span>{{ totals[teamId].kills }} kills</span>
        <span>{{ compact(totals[teamId].gold) }} gold</span>
        <span v-for="[key, label] in OBJECTIVE_LABELS" :key="key" class="text-ink-3" :title="label">
          {{ label.slice(0, 1) }}{{ objectives(match, teamId)[key] }}
        </span>
      </span>
    </div>

    <div class="scroll-x">
      <table class="w-full min-w-[560px] text-[0.75rem]">
        <thead>
          <tr class="border-b border-line text-left">
            <th class="label px-4 py-1.5 font-semibold">Player</th>
            <th class="label px-2 py-1.5 text-right font-semibold">KDA</th>
            <th class="label px-2 py-1.5 text-right font-semibold">KP</th>
            <th class="label px-2 py-1.5 font-semibold">Damage</th>
            <th class="label px-2 py-1.5 text-right font-semibold">CS</th>
            <th class="label px-2 py-1.5 text-right font-semibold">Gold</th>
            <th class="label px-2 py-1.5 text-right font-semibold">Vis</th>
            <th class="label px-4 py-1.5 font-semibold">Build</th>
          </tr>
        </thead>
        <tbody class="num">
          <tr
            v-for="p in teamMembers(match, teamId)"
            :key="p.puuid"
            class="cursor-pointer border-b border-line last:border-0 transition-colors hover:bg-[#fafafb]"
            :class="p.puuid === selectedPuuid ? 'bg-[#f4f5f8]' : ''"
            @click="$emit('select', p.puuid)"
          >
            <td class="px-4 py-2">
              <div class="flex items-center gap-2">
                <img
                  :src="champIcon(p.championId)"
                  :alt="championName(p.championId)"
                  class="thumb h-7 w-7 shrink-0 rounded-md"
                />
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="truncate font-medium text-ink">{{ p.gameName }}</span>
                    <span
                      v-if="p.puuid === lobby.mvpPuuid"
                      class="label rounded bg-[#f2f2f5] px-1 py-px !text-ink-2"
                    >
                      MVP
                    </span>
                    <span
                      v-else-if="p.puuid === lobby.acePuuid"
                      class="label rounded bg-[#f2f2f5] px-1 py-px !text-ink-2"
                    >
                      ACE
                    </span>
                  </div>
                  <div class="truncate text-[0.625rem] text-ink-3">
                    {{ POSITION_NAMES[p.position] || championName(p.championId) }} · lvl
                    {{ p.champLevel }}
                  </div>
                </div>
              </div>
            </td>

            <td class="px-2 py-2 text-right">
              <div class="font-medium text-ink">{{ p.kills }}/{{ p.deaths }}/{{ p.assists }}</div>
              <div class="text-[0.625rem] text-ink-3">
                {{ kda(p.kills, p.deaths, p.assists).toFixed(2) }}
              </div>
            </td>

            <td class="px-2 py-2 text-right text-ink-2">
              {{ Math.round(killParticipation(p, totals)) }}%
            </td>

            <td class="w-[6.5rem] px-2 py-2">
              <div class="mb-1 text-ink-2">{{ compact(p.totalDamageDealtToChampions) }}</div>
              <Meter
                :value="(p.totalDamageDealtToChampions / maxDamage) * 100"
                :tone="p.puuid === selectedPuuid ? 'ink' : 'muted'"
              />
            </td>

            <td class="px-2 py-2 text-right">
              <div class="text-ink-2">{{ p.cs }}</div>
              <div class="text-[0.625rem] text-ink-3">
                {{ (p.cs / matchMinutes(match)).toFixed(1) }}/m
              </div>
            </td>

            <td class="px-2 py-2 text-right text-gold">{{ compact(p.goldEarned) }}</td>
            <td class="px-2 py-2 text-right text-ink-2">{{ p.visionScore }}</td>

            <td class="px-4 py-2">
              <ItemRow :items="p.items" size="xs" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
