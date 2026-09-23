<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import RoleIcon from './RoleIcon.vue'
import PlayerLink from './PlayerLink.vue'
import DuoDetail from './DuoDetail.vue'
import { champIcon, championName } from '../lib/assets.js'
import { partnershipsFrom, teammatesFrom } from '../lib/synergy.js'
import type { Match } from '../lib/types.js'

const props = defineProps<{
  matches: Match[]
  puuid: string
  loading: boolean
}>()

const mates = computed(() => teammatesFrom(props.matches, props.puuid))

/** Counted game by game, so a lane's sample is the games it was really played. */
const pairings = computed(() =>
  partnershipsFrom(props.matches, props.puuid, mates.value).filter((pair) => pair.games > 1)
)

/** The same sample split by whether anyone recurring was on the team. */
const company = computed(() => {
  const known = new Set(mates.value.map((mate) => mate.puuid))
  let duoGames = 0
  let duoWins = 0
  let soloGames = 0
  let soloWins = 0
  for (const match of props.matches) {
    const me = match.participants.find((p) => p.puuid === props.puuid)
    if (!me) continue
    const withMate = match.participants.some(
      (p) => p.teamId === me.teamId && p.puuid !== props.puuid && known.has(p.puuid)
    )
    if (withMate) {
      duoGames++
      if (me.win) duoWins++
    } else {
      soloGames++
      if (me.win) soloWins++
    }
  }
  return { duoGames, duoWins, soloGames, soloWins }
})

const mostGames = computed(() => Math.max(...mates.value.map((m) => m.games), 1))

/** The first partnership opens on arrival; the page is never a list of rows. */
const open = ref<string | null>(null)
const picked = ref(false)

watch(
  mates,
  (list) => {
    if (picked.value) {
      if (!list.some((mate) => mate.puuid === open.value)) open.value = null
      return
    }
    open.value = list[0]?.puuid ?? null
  },
  { immediate: true }
)

function toggle(puuid: string) {
  picked.value = true
  open.value = open.value === puuid ? null : puuid
}

function rate(wins: number, games: number) {
  return games ? Math.round((wins / games) * 100) : 0
}
</script>

<template>
  <section>
    <div v-if="loading" class="skel h-[420px]" />

    <p v-else-if="!mates.length" class="card py-20 text-center text-[12.5px] text-ink-3">
      Nobody appears in more than one of the last {{ matches.length }} games.
    </p>

    <div v-else class="space-y-3">
      <!-- Which partnership, not just which person -->
      <section v-if="pairings.length" class="card">
        <div class="section">
          <h2>Lane partnerships</h2>
          <span class="meta">from the last {{ matches.length }} games</span>
        </div>

        <div class="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
          <div v-for="pair in pairings" :key="pair.id" class="rounded-[8px] bg-raised p-3.5">
            <div class="flex items-center justify-between gap-3">
              <span class="flex min-w-0 items-center gap-2">
                <span class="flex shrink-0 items-center gap-0.5 text-ink-3">
                  <RoleIcon :role="pair.myRole" :size="13" />
                  <RoleIcon :role="pair.theirRole" :size="13" />
                </span>
                <span class="truncate text-[13px] font-semibold text-ink">{{ pair.label }}</span>
              </span>
              <span
                class="stat shrink-0 text-[22px]"
                :class="pair.wins / pair.games >= 0.5 ? 'text-win' : 'text-loss'"
              >
                {{ rate(pair.wins, pair.games) }}%
              </span>
            </div>

            <div
              class="mt-2.5 flex h-[4px] overflow-hidden rounded-[1px]"
              style="background: var(--color-loss)"
            >
              <span
                :style="{
                  width: `${(pair.wins / pair.games) * 100}%`,
                  background: 'var(--color-win)',
                }"
              />
            </div>

            <div class="num mt-1.5 flex items-center justify-between text-[10.5px] text-ink-3">
              <span>{{ pair.games }} games</span>
              <span>{{ pair.wins }}W {{ pair.games - pair.wins }}L</span>
            </div>

            <ul class="mt-3 space-y-1.5 border-t border-line-2 pt-3">
              <li
                v-for="pick in pair.duos.slice(0, 3)"
                :key="`${pick.mine}-${pick.theirs}`"
                class="flex items-center gap-2"
              >
                <span class="flex shrink-0 gap-[2px]">
                  <img
                    :src="champIcon(pick.mine)"
                    :alt="championName(pick.mine)"
                    :title="championName(pick.mine)"
                    loading="lazy"
                    class="thumb h-[22px] w-[22px] rounded-[5px]"
                  />
                  <img
                    :src="champIcon(pick.theirs)"
                    :alt="championName(pick.theirs)"
                    :title="championName(pick.theirs)"
                    loading="lazy"
                    class="thumb h-[22px] w-[22px] rounded-[5px]"
                  />
                </span>
                <span class="min-w-0 flex-1 truncate text-[11.5px] text-ink-2">
                  {{ championName(pick.mine) }}
                  <span class="text-ink-4">+</span>
                  {{ championName(pick.theirs) }}
                </span>
                <span class="num shrink-0 text-[11px] text-ink-3">
                  {{ pick.wins }}W {{ pick.games - pick.wins }}L
                </span>
              </li>
            </ul>

            <div class="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px]">
              <template v-for="(mate, index) in pair.mates" :key="mate.puuid">
                <span v-if="index" class="text-ink-4">·</span>
                <PlayerLink
                  :game-name="mate.gameName"
                  :tag-line="mate.tagLine"
                  class="!font-normal text-ink-2"
                />
              </template>
            </div>
          </div>
        </div>
      </section>

      <!-- Who, and what the record with them is made of -->
      <section class="card">
        <div class="section">
          <h2>Played with</h2>
          <span v-if="company.soloGames && company.duoGames" class="meta num">
            duo {{ company.duoGames }} games
            <b class="font-semibold text-ink">{{ rate(company.duoWins, company.duoGames) }}%</b>
            <span class="ml-3">
              solo {{ company.soloGames }} games
              <b class="font-semibold text-ink">{{ rate(company.soloWins, company.soloGames) }}%</b>
            </span>
          </span>
          <span v-else class="meta num">{{ matches.length }} games</span>
        </div>

        <div class="scroll-x !p-0">
          <table class="dt dt-hover num min-w-[760px]">
            <thead>
              <tr>
                <th class="w-[24%] !pl-4">Player</th>
                <th class="w-[15%]">Lane</th>
                <th class="text-right">Games</th>
                <th class="text-right">Record</th>
                <th class="w-[14%]">Win rate</th>
                <th class="text-right">With − without</th>
                <th class="!pr-4">Champions</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="mate in mates" :key="mate.puuid">
                <tr
                  data-mate-row
                  class="cursor-pointer"
                  :class="open === mate.puuid ? '[&>td]:!bg-raised' : ''"
                  :aria-expanded="open === mate.puuid"
                  @click="toggle(mate.puuid)"
                >
                  <td class="!pl-4">
                    <span class="flex items-center gap-2">
                      <ChevronRight
                        :size="13"
                        class="shrink-0 text-ink-4 transition-transform"
                        :class="open === mate.puuid ? 'rotate-90 text-ink-2' : ''"
                      />
                      <PlayerLink
                        :game-name="mate.gameName"
                        :tag-line="mate.tagLine"
                        show-tag
                        class="text-[13px]"
                        @click.stop
                      />
                    </span>
                  </td>

                  <td>
                    <span class="flex items-center gap-1.5 text-ink-2">
                      <span class="flex shrink-0 items-center gap-0.5 text-ink-3">
                        <RoleIcon v-if="mate.myRole" :role="mate.myRole" :size="13" />
                        <RoleIcon v-if="mate.role" :role="mate.role" :size="13" />
                      </span>
                      <span class="truncate">{{
                        mate.pairing?.label || mate.roleLabel || '—'
                      }}</span>
                    </span>
                  </td>

                  <td class="text-right">
                    <div class="stat text-[15px] text-ink">{{ mate.games }}</div>
                    <div class="meter mt-1.5 !h-[3px]">
                      <span
                        class="!bg-ink-3"
                        :style="{ width: `${(mate.games / mostGames) * 100}%` }"
                      />
                    </div>
                  </td>

                  <td class="text-right text-ink-3">
                    {{ mate.wins }}W {{ mate.games - mate.wins }}L
                  </td>

                  <td>
                    <div
                      class="stat mb-1.5 text-[15px]"
                      :class="mate.winrate >= 50 ? 'text-win' : 'text-loss'"
                    >
                      {{ Math.round(mate.winrate) }}%
                    </div>
                    <div
                      class="flex h-[4px] overflow-hidden rounded-[1px]"
                      style="background: var(--color-loss)"
                    >
                      <span
                        :style="{ width: `${mate.winrate}%`, background: 'var(--color-win)' }"
                      />
                    </div>
                  </td>

                  <td class="text-right">
                    <span
                      v-if="mate.lift !== null"
                      class="stat text-[15px]"
                      :class="
                        mate.lift > 2 ? 'text-win' : mate.lift < -2 ? 'text-loss' : 'text-ink-3'
                      "
                      :title="`${Math.round(mate.winrate)}% with them, ${Math.round(mate.soloWinrate)}% without`"
                    >
                      {{ mate.lift > 0 ? '+' : '' }}{{ Math.round(mate.lift) }}
                    </span>
                    <span v-else class="text-[12.5px] text-ink-4">—</span>
                  </td>

                  <td class="!pr-4">
                    <span class="flex items-center gap-1">
                      <img
                        v-for="id in mate.champions"
                        :key="id"
                        :src="champIcon(id)"
                        :alt="championName(id)"
                        :title="championName(id)"
                        loading="lazy"
                        class="thumb h-[24px] w-[24px] rounded-[5px]"
                      />
                    </span>
                  </td>
                </tr>

                <!-- The duo opens in place, under the row it belongs to. -->
                <tr v-if="open === mate.puuid">
                  <td :colspan="7" class="!bg-raised !px-4 !py-0">
                    <DuoDetail :matches="matches" :puuid="puuid" :mate-puuid="mate.puuid" />
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </section>
</template>
