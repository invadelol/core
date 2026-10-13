<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { Link } from '@inertiajs/vue3'
import { MatchRowSkeleton, RoleIcon } from '@invadelol/ui'
import { positionOf } from '@invadelol/ui/logic'
import DuoTrend from './DuoTrend.vue'
import MatchList from './MatchList.vue'
import { champIcon, championName, profileIcon } from '../lib/assets.js'
import { profilePath, shortDate } from '../lib/format.js'
import { roleLabel, rollingForm, type Partner } from '../lib/synergy.js'
import type { Match, Summoner } from '../lib/types.js'

/**
 * One duo, opened: their record and what it is worth against the player's usual one, their form
 * over time, the seats and picks that work, how the player's own game moves beside them, and the
 * games themselves.
 */
const props = defineProps<{
  partner: Partner
  profile: Summoner
}>()

const PAGE = 10
/** Under this many games a seat's or a pick's win rate is shown, but quietly. */
const SOLID = 5
/** Under this many games together a form line would only be noise. */
const TREND_MIN = 8
const TIER: Record<Partner['tier'], string> = {
  duo: 'Duo partner',
  regular: 'Regular',
  occasional: 'Now and then',
}

const rate = (wins: number, games: number) => (games ? Math.round((wins / games) * 100) : 0)

/** "+4", "−3", "±0": a sign, never a colour. */
function signed(value: number, digits = 0) {
  const rounded = Number(value.toFixed(digits))
  if (!rounded) return '±0'
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(digits)}`
}

const synergy = computed(() => {
  const value = props.partner.synergy
  return {
    text: signed(value),
    /** Strong enough, on enough games, to be read as a real difference. */
    clear: props.partner.confidence !== 'low' && Math.abs(value) >= 2,
    note:
      props.partner.confidence === 'low'
        ? 'Few games: kept close to the usual rate'
        : props.partner.confidence === 'fair'
          ? 'Some games: a hint, not a verdict'
          : 'Enough games to rely on',
  }
})

const form = computed(() => rollingForm(props.partner.series, props.partner.baseline))

/** The player's own game beside them and without them. */
const splits = computed(() => {
  const { together, apart } = props.partner
  const rows = [
    {
      label: 'Score',
      with: together.score,
      without: apart?.score ?? null,
      format: (v: number) => Math.round(v).toString(),
      floor: 2,
    },
    {
      label: 'KDA',
      with: together.kda,
      without: apart?.kda ?? null,
      format: (v: number) => v.toFixed(2),
      floor: 0.15,
    },
    {
      label: 'Kill share',
      with: together.kp,
      without: apart?.kp ?? null,
      format: (v: number) => `${Math.round(v)}%`,
      floor: 2,
    },
    {
      label: 'Deaths',
      with: together.deaths,
      without: apart?.deaths ?? null,
      format: (v: number) => v.toFixed(1),
      floor: 0.3,
    },
  ]
  return rows.flatMap((row) =>
    row.with === null
      ? []
      : [
          {
            label: row.label,
            with: row.format(row.with),
            without: row.without === null ? '' : row.format(row.without),
            /** Bold only where the two differ by enough to read. */
            clear: row.without !== null && Math.abs(row.with - row.without) >= row.floor,
          },
        ]
  )
})

const seats = computed(() => props.partner.roles.slice(0, 4))
const picks = computed(() => props.partner.champions.slice(0, 4))

/* ── The games together, a page at a time ─────────────────────── */
const games = shallowRef<Match[]>([])
const loading = ref(false)
const failed = ref(false)
let controller: AbortController | undefined

async function load(more = false) {
  controller?.abort()
  controller = new AbortController()
  const signal = controller.signal
  loading.value = true
  failed.value = false
  const offset = more ? games.value.length : 0
  try {
    const response = await fetch(
      `/api/summoners/puuid/${props.profile.puuid}/synergy/${props.partner.puuid}?count=${PAGE}&offset=${offset}`,
      { signal }
    )
    if (!response.ok) throw new Error()
    const page = (await response.json()) as Match[]
    if (signal.aborted) return
    games.value = more
      ? [...new Map([...games.value, ...page].map((m) => [m.matchId, m])).values()]
      : page
    exhausted.value = page.length < PAGE
  } catch {
    if (!signal.aborted) failed.value = true
  } finally {
    if (!signal.aborted) loading.value = false
  }
}

const exhausted = ref(false)

watch(
  () => props.partner.puuid,
  () => {
    games.value = []
    exhausted.value = false
    void load()
  },
  { immediate: true }
)
onBeforeUnmount(() => controller?.abort())

const more = computed(() => games.value.length > 0 && !exhausted.value)
</script>

<template>
  <section class="fr-duo" :aria-label="`With ${partner.gameName}`">
    <div class="iv-panel lit-sheet">
      <!-- Who -->
      <header class="flex items-center gap-3 px-4 pt-4 sm:px-5">
        <span class="fr-pair" aria-hidden="true">
          <img
            :src="profileIcon(profile.profileIconId)"
            alt=""
            width="40"
            height="40"
            class="thumb"
          />
          <img
            :src="profileIcon(partner.profileIconId)"
            alt=""
            width="40"
            height="40"
            class="thumb"
          />
        </span>
        <div class="min-w-0 flex-1">
          <h3 class="truncate text-[16px] font-semibold leading-5 text-ink">
            With {{ partner.gameName
            }}<span class="font-normal text-ink-3">#{{ partner.tagLine }}</span>
          </h3>
          <p class="num mt-0.5 truncate text-[12px] text-ink-3">
            {{ TIER[partner.tier] }} · {{ partner.games }} games
            <span class="max-sm:hidden"
              >since {{ shortDate(partner.firstMs) }} · last {{ shortDate(partner.lastMs) }}</span
            >
          </p>
        </div>
        <Link
          v-if="partner.gameName && partner.tagLine"
          :href="profilePath(partner.gameName, partner.tagLine)"
          class="iv-btn sm shrink-0"
        >
          Profile
        </Link>
      </header>

      <!-- The record, and what it is worth -->
      <dl class="fr-figures">
        <div>
          <dt class="label">Win rate together</dt>
          <dd>
            <span class="iv-fig text-[28px] text-ink"
              >{{ rate(partner.wins, partner.games) }}%</span
            >
            <span class="num text-[12px] text-ink-3">
              {{ partner.wins }}W {{ partner.games - partner.wins }}L
            </span>
          </dd>
        </div>
        <div>
          <dt class="label">Synergy</dt>
          <dd>
            <span class="iv-fig text-[28px]" :class="synergy.clear ? 'text-ink' : 'text-ink-3'">
              {{ synergy.text }}
            </span>
            <span class="num text-[12px] text-ink-3">
              vs {{ Math.round(partner.baseline * 100) }}% without
            </span>
          </dd>
          <p class="mt-1.5 text-[12px] leading-4 text-ink-4">{{ synergy.note }}</p>
        </div>
        <div v-if="partner.together.score !== null">
          <dt class="label">Your score together</dt>
          <dd>
            <span class="iv-fig text-[28px] text-ink">{{
              Math.round(partner.together.score)
            }}</span>
            <span v-if="partner.apart?.score != null" class="num text-[12px] text-ink-3">
              {{ Math.round(partner.apart.score) }} without
            </span>
          </dd>
        </div>
        <div v-if="partner.theirScore !== null">
          <dt class="label">Their score</dt>
          <dd>
            <span class="iv-fig text-[28px] text-ink">{{ Math.round(partner.theirScore) }}</span>
            <span class="num text-[12px] text-ink-3">beside you</span>
          </dd>
        </div>
      </dl>

      <!-- Form over time -->
      <div
        v-if="partner.series.length >= TREND_MIN"
        class="border-t border-line px-4 pb-3 pt-4 sm:px-5"
      >
        <div class="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span class="text-[13px] font-semibold text-ink">Form together</span>
          <span class="text-[12px] text-ink-3">
            Win rate over the last 10 games together. Dashed:
            {{ Math.round(partner.baseline * 100) }}% without them.
          </span>
        </div>
        <DuoTrend
          :values="form"
          :games="partner.series"
          :baseline="partner.baseline"
          :label="`Win rate over the last 10 games with ${partner.gameName}, from ${shortDate(partner.firstMs)} to ${shortDate(partner.lastMs)}`"
        />
      </div>

      <!-- What works -->
      <div class="fr-works border-t border-line">
        <section v-if="!seats.length && !picks.length">
          <h4 class="label mb-2">What works</h4>
          <p class="fr-line text-ink-3">No seat or pick taken three times together yet.</p>
        </section>

        <section v-if="seats.length">
          <h4 class="label mb-2">Seats</h4>
          <ul>
            <li v-for="seat in seats" :key="`${seat.mine}:${seat.theirs}`" class="fr-line">
              <span class="flex shrink-0 items-center gap-1 text-ink-3">
                <RoleIcon :lane="positionOf(seat.mine)" :size="14" />
                <RoleIcon :lane="positionOf(seat.theirs)" :size="14" />
              </span>
              <span class="min-w-0 flex-1 truncate text-ink-2">
                {{ roleLabel(seat.mine) }} <span class="text-ink-4">+</span>
                {{ roleLabel(seat.theirs) }}
              </span>
              <span class="num shrink-0 text-[12px] text-ink-3"
                >{{ seat.wins }}W {{ seat.games - seat.wins }}L</span
              >
              <span class="fr-rate num" :class="{ quiet: seat.games < SOLID }">
                {{ rate(seat.wins, seat.games) }}%
              </span>
            </li>
          </ul>
        </section>

        <section v-if="seats.length || picks.length">
          <h4 class="label mb-2">Best picks together</h4>
          <ul v-if="picks.length">
            <li v-for="pick in picks" :key="`${pick.mine}:${pick.theirs}`" class="fr-line">
              <span class="flex shrink-0 gap-[3px]">
                <span class="portrait h-6 w-6" :title="championName(pick.mine)">
                  <img :src="champIcon(pick.mine)" :alt="championName(pick.mine)" loading="lazy" />
                </span>
                <span class="portrait h-6 w-6" :title="championName(pick.theirs)">
                  <img
                    :src="champIcon(pick.theirs)"
                    :alt="championName(pick.theirs)"
                    loading="lazy"
                  />
                </span>
              </span>
              <span class="min-w-0 flex-1 truncate text-ink-2">
                {{ championName(pick.mine) }} <span class="text-ink-4">+</span>
                {{ championName(pick.theirs) }}
              </span>
              <span class="num shrink-0 text-[12px] text-ink-3"
                >{{ pick.wins }}W {{ pick.games - pick.wins }}L</span
              >
              <span class="fr-rate num" :class="{ quiet: pick.games < SOLID }">
                {{ rate(pick.wins, pick.games) }}%
              </span>
            </li>
          </ul>
          <p v-else class="fr-line text-ink-3">No pair of picks played three times yet.</p>
        </section>

        <section v-if="partner.apart">
          <h4 class="label mb-2 flex">
            <span class="flex-1">You, beside them</span>
            <span class="w-12 text-right">With</span>
            <span class="w-14 text-right">Without</span>
          </h4>
          <ul>
            <li v-for="row in splits" :key="row.label" class="fr-line">
              <span class="min-w-0 flex-1 truncate text-ink-2">{{ row.label }}</span>
              <span
                class="num w-12 shrink-0 text-right"
                :class="row.clear ? 'font-semibold text-ink' : 'text-ink-2'"
                >{{ row.with }}</span
              >
              <span class="num w-14 shrink-0 text-right text-ink-3">{{ row.without }}</span>
            </li>
          </ul>
        </section>
      </div>
    </div>

    <!-- The games themselves -->
    <div class="section mt-6">
      <h3>Games together</h3>
      <span class="meta num">{{ partner.games }}</span>
    </div>

    <p v-if="failed && !games.length" class="notice" role="alert">
      <span>These games could not be loaded.</span>
      <button type="button" class="iv-btn sm ml-auto" @click="load()">Retry</button>
    </p>
    <MatchRowSkeleton v-else-if="!games.length" :count="4" />
    <MatchList
      v-else
      :matches="games"
      :puuid="profile.puuid"
      :game-name="profile.gameName"
      :tag-line="profile.tagLine"
    />

    <div v-if="games.length && (more || failed)" class="mt-4 flex justify-center">
      <button type="button" class="iv-btn" :disabled="loading" @click="load(true)">
        {{ failed ? 'Retry' : loading ? 'Loading' : 'Show older games' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
/* Two players side by side, the second over the first and cut out of it by a ring. */
.fr-pair {
  display: flex;
  flex-shrink: 0;
}

.fr-pair img {
  width: 40px;
  height: 40px;
  border-radius: var(--r-sm);
}

.fr-pair img + img {
  margin-left: -8px;
  outline: 2px solid var(--solid-1);
}

.fr-figures {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px 16px;
  padding: 18px 16px 10px;
}

.fr-figures dd {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin-top: 8px;
}

@media (min-width: 40rem) {
  .fr-figures {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    padding-inline: 20px;
  }
}

.fr-works {
  display: grid;
  gap: 20px;
  padding: 16px;
}

@media (min-width: 48rem) {
  .fr-works {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 28px;
    padding: 16px 20px 18px;
  }
}

.fr-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  font-size: 13px;
}

.fr-rate {
  flex: none;
  width: 40px;
  text-align: right;
  font-weight: 600;
  color: var(--text-1);
}

.fr-rate.quiet {
  font-weight: 400;
  color: var(--text-3);
}

.fr-line + .fr-line {
  border-top: 1px solid var(--line);
}
</style>
