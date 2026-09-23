<script setup lang="ts">
import { computed } from 'vue'
import RoleIcon from './RoleIcon.vue'
import { champIcon, championName, queueName } from '../lib/assets.js'
import { compact, duration, shortDate } from '../lib/format.js'
import { duoFrom, type DuoSplit } from '../lib/synergy.js'
import type { Match } from '../lib/types.js'

/**
 * One teammate, opened in place.
 *
 * The row above says how often the two win. This says what that was made of:
 * the seats they took, the champions they kept pairing, the games themselves,
 * and whether the player is actually playing differently beside them.
 */
const props = defineProps<{
  matches: Match[]
  puuid: string
  matePuuid: string
}>()

const duo = computed(() => duoFrom(props.matches, props.puuid, props.matePuuid))

/** Long partnerships would push the other two columns off the screen. */
const LIMIT = 12
const games = computed(() => duo.value.games.slice(0, LIMIT))

const FORMAT: Record<DuoSplit['key'], (value: number) => string> = {
  kda: (value) => value.toFixed(2),
  kp: (value) => `${Math.round(value)}%`,
  cs: (value) => value.toFixed(1),
  gold: (value) => compact(value),
  vision: (value) => value.toFixed(2),
}

/**
 * Coloured only where the gap is worth reading: printed at the same precision
 * as the number itself, and at least a twentieth of it. A vision score that
 * moves by a hundredth is the same vision score.
 */
const MOVED = 0.05

const splits = computed(() =>
  duo.value.splits.map((split) => {
    const here = FORMAT[split.key](split.together)
    const there = split.apart === null ? null : FORMAT[split.key](split.apart)
    const apart = split.apart ?? 0
    const moved =
      there !== null && here !== there && Math.abs(split.together - apart) > Math.abs(apart) * MOVED
    return {
      ...split,
      here,
      there,
      tone: !moved ? 'text-ink' : split.together > apart ? 'text-win' : 'text-loss',
    }
  })
)
</script>

<template>
  <div
    class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.05fr)] gap-x-7 py-5 text-[12px]"
  >
    <!-- The player's own numbers, beside them and away from them -->
    <section class="min-w-0">
      <div class="label mb-3">Your form</div>
      <!-- With nothing to compare against there is no second column to draw. -->
      <div
        class="num grid items-baseline gap-y-2.5"
        :class="
          duo.apartGames ? 'grid-cols-[minmax(0,1fr)_58px_58px]' : 'grid-cols-[minmax(0,1fr)_58px]'
        "
      >
        <template v-if="duo.apartGames">
          <span />
          <span class="label !text-[9.5px] text-right">With</span>
          <span class="label !text-[9.5px] text-right">Without</span>
        </template>

        <template v-for="split in splits" :key="split.key">
          <span class="truncate text-ink-2">{{ split.label }}</span>
          <span class="stat text-right text-[14px]" :class="split.tone">{{ split.here }}</span>
          <span v-if="duo.apartGames" class="text-right text-ink-3">{{ split.there }}</span>
        </template>
      </div>
    </section>

    <!-- What the pairing was made of -->
    <section class="min-w-0 border-l border-line-2 pl-7">
      <div v-if="duo.roles.length" class="label mb-3">Lanes</div>
      <ul v-if="duo.roles.length" class="space-y-2.5">
        <li v-for="row in duo.roles" :key="row.label" class="flex items-center gap-2">
          <span class="flex shrink-0 items-center gap-0.5 text-ink-3">
            <RoleIcon :role="row.myRole" :size="13" />
            <RoleIcon :role="row.theirRole" :size="13" />
          </span>
          <span class="min-w-0 flex-1 truncate text-ink-2">{{ row.label }}</span>
          <span class="num shrink-0 text-[11.5px] text-ink-3">
            {{ row.wins }}W {{ row.games - row.wins }}L
          </span>
        </li>
      </ul>

      <div class="label mb-3" :class="duo.roles.length ? 'mt-5' : ''">Picks together</div>
      <ul class="space-y-2">
        <li v-for="pick in duo.duos.slice(0, 5)" :key="`${pick.mine}-${pick.theirs}`">
          <div class="flex items-center gap-2">
            <span class="flex shrink-0 gap-[2px]">
              <img
                :src="champIcon(pick.mine)"
                :alt="championName(pick.mine)"
                :title="championName(pick.mine)"
                loading="lazy"
                class="thumb h-[20px] w-[20px] rounded-[5px]"
              />
              <img
                :src="champIcon(pick.theirs)"
                :alt="championName(pick.theirs)"
                :title="championName(pick.theirs)"
                loading="lazy"
                class="thumb h-[20px] w-[20px] rounded-[5px]"
              />
            </span>
            <span class="min-w-0 flex-1 truncate text-ink-2">
              {{ championName(pick.mine) }}
              <span class="text-ink-4">+</span>
              {{ championName(pick.theirs) }}
            </span>
            <span class="num shrink-0 text-[11.5px] text-ink-3">
              {{ pick.wins }}W {{ pick.games - pick.wins }}L
            </span>
          </div>
        </li>
      </ul>
    </section>

    <!-- The games themselves -->
    <section class="min-w-0 border-l border-line-2 pl-7">
      <div class="label mb-3 flex items-baseline gap-2">
        <span>Games together</span>
        <span class="num !tracking-normal text-ink-4">
          {{
            games.length < duo.games.length
              ? `${games.length} of ${duo.games.length}`
              : duo.games.length
          }}
        </span>
      </div>

      <ul class="space-y-1.5">
        <li
          v-for="game in games"
          :key="game.matchId"
          class="flex items-center gap-2"
          :title="`${queueName(game.queueId)} · ${duration(game.duration)}`"
        >
          <span
            class="display w-[10px] shrink-0 text-[12px]"
            :class="game.win ? 'text-win' : 'text-loss'"
          >
            {{ game.win ? 'W' : 'L' }}
          </span>

          <span class="flex shrink-0 items-center gap-1">
            <img
              :src="champIcon(game.myChampion)"
              :alt="championName(game.myChampion)"
              loading="lazy"
              class="thumb h-[20px] w-[20px] rounded-[5px]"
            />
            <RoleIcon :role="game.myRole" :size="11" class="text-ink-4" />
          </span>

          <span class="flex shrink-0 items-center gap-1">
            <img
              :src="champIcon(game.theirChampion)"
              :alt="championName(game.theirChampion)"
              loading="lazy"
              class="thumb h-[20px] w-[20px] rounded-[5px]"
            />
            <RoleIcon :role="game.theirRole" :size="11" class="text-ink-4" />
          </span>

          <span class="stat ml-auto shrink-0 text-[13px] text-ink">
            {{ game.kills }}<span class="text-ink-4">/</span
            ><span class="text-loss">{{ game.deaths }}</span
            ><span class="text-ink-4">/</span>{{ game.assists }}
          </span>
          <span class="num w-[52px] shrink-0 whitespace-nowrap text-right text-ink-4">
            {{ shortDate(game.gameStartMs) }}
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>
