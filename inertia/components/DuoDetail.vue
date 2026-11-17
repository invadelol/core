<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { Link } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import { positionOf } from '@invadelol/ui/logic'
import DuoTrend from './DuoTrend.vue'
import MatchRows from './profile/MatchRows.vue'
import EmptyState from './ui/EmptyState.vue'
import Frame from './ui/Frame.vue'
import Icon from './ui/Icon.vue'
import Skeleton from './ui/Skeleton.vue'
import ShowMore from './ShowMore.vue'
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
/** Under this many games a win rate (the duo's, a seat's, a pick's) is not shown. */
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
    tone:
      props.partner.confidence === 'low' || Math.abs(value) < 2 ? 't3' : value > 0 ? 'wn' : 'ls',
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

/** Seats and picks shown before "Show all". */
const WORKS = 4
const seatsOpen = ref(false)
const picksOpen = ref(false)
const seats = computed(() =>
  seatsOpen.value ? props.partner.roles : props.partner.roles.slice(0, WORKS)
)
const picks = computed(() =>
  picksOpen.value ? props.partner.champions : props.partner.champions.slice(0, WORKS)
)

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
    seatsOpen.value = false
    picksOpen.value = false
    void load()
  },
  { immediate: true }
)
onBeforeUnmount(() => controller?.abort())

const more = computed(() => games.value.length > 0 && !exhausted.value)
</script>

<template>
  <section class="dd" :aria-label="`With ${partner.gameName}`">
    <article class="card lit">
      <!-- Who -->
      <header class="dd-who">
        <span class="dd-pair" aria-hidden="true">
          <img :src="profileIcon(profile.profileIconId)" alt="" width="44" height="44" />
          <img :src="profileIcon(partner.profileIconId)" alt="" width="44" height="44" />
        </span>
        <div class="col grow" style="gap: 4px; min-width: 0">
          <h3 class="h3 ell">
            With {{ partner.gameName }}<span class="t3">#{{ partner.tagLine }}</span>
          </h3>
          <p class="meta num ell">
            {{ TIER[partner.tier] }}, {{ partner.games }} games
            <span class="dd-hm"
              >since {{ shortDate(partner.firstMs) }} · last {{ shortDate(partner.lastMs) }}</span
            >
          </p>
        </div>
        <Link
          v-if="partner.gameName && partner.tagLine"
          :href="profilePath(partner.gameName, partner.tagLine)"
          class="btn sm"
        >
          Profile<Icon name="chevr" />
        </Link>
      </header>

      <!-- The record, and what it is worth -->
      <dl class="dd-figs">
        <template v-if="partner.games >= SOLID">
          <div>
            <dt class="lab">Win rate together</dt>
            <dd>
              <span class="fg-l">{{ rate(partner.wins, partner.games) }}%</span>
              <span class="meta num">{{ partner.wins }}W {{ partner.games - partner.wins }}L</span>
            </dd>
          </div>
          <div>
            <dt class="lab">Synergy</dt>
            <dd>
              <span class="fg-l num" :class="synergy.tone">{{ synergy.text }}</span>
              <span class="meta num">on {{ Math.round(partner.baseline * 100) }}% without</span>
            </dd>
          </div>
        </template>
        <div v-else>
          <dt class="lab">Games together</dt>
          <dd>
            <span class="fg-l">{{ partner.games }}</span>
            <span class="meta num">{{ partner.wins }}W {{ partner.games - partner.wins }}L</span>
          </dd>
        </div>
        <div v-if="partner.together.score !== null">
          <dt class="lab">Your score together</dt>
          <dd>
            <span class="fg-l">{{ Math.round(partner.together.score) }}</span>
            <span v-if="partner.apart?.score != null" class="meta num"
              >{{ Math.round(partner.apart.score) }} without</span
            >
          </dd>
        </div>
        <div v-if="partner.theirScore !== null">
          <dt class="lab">Their score</dt>
          <dd>
            <span class="fg-l">{{ Math.round(partner.theirScore) }}</span>
            <span class="meta num">beside you</span>
          </dd>
        </div>
      </dl>

      <!-- Form over time -->
      <div v-if="partner.series.length >= TREND_MIN" class="dd-form">
        <div class="row dd-form-h">
          <span class="h5">Form together</span>
          <span class="meta">Win rate, last 10 games together</span>
        </div>
        <DuoTrend
          :values="form"
          :games="partner.series"
          :baseline="partner.baseline"
          :label="`Win rate over the last 10 games with ${partner.gameName}, from ${shortDate(partner.firstMs)} to ${shortDate(partner.lastMs)}`"
        />
      </div>

      <!-- What works -->
      <div class="dd-works">
        <section v-if="!seats.length && !picks.length">
          <h4 class="lab">What works</h4>
          <p class="dd-line meta">No seat or pick taken three times together yet.</p>
        </section>

        <section v-if="seats.length">
          <h4 class="lab">Seats</h4>
          <ul>
            <li v-for="seat in seats" :key="`${seat.mine}:${seat.theirs}`" class="dd-line">
              <span class="row t3" style="gap: 4px; flex: none">
                <RoleIcon :lane="positionOf(seat.mine)" :size="14" />
                <RoleIcon :lane="positionOf(seat.theirs)" :size="14" />
              </span>
              <span class="grow ell t2">
                {{ roleLabel(seat.mine) }} <span class="t3">+</span> {{ roleLabel(seat.theirs) }}
              </span>
              <span class="meta num">{{ seat.wins }}W {{ seat.games - seat.wins }}L</span>
              <span class="dd-rate num">{{
                seat.games >= SOLID ? `${rate(seat.wins, seat.games)}%` : ''
              }}</span>
            </li>
          </ul>
          <ShowMore v-model="seatsOpen" :total="partner.roles.length" :limit="WORKS" />
        </section>

        <section v-if="seats.length || picks.length">
          <h4 class="lab">Best picks together</h4>
          <ul v-if="picks.length">
            <li v-for="pick in picks" :key="`${pick.mine}:${pick.theirs}`" class="dd-line">
              <span class="row" style="gap: 3px; flex: none">
                <Frame
                  :src="champIcon(pick.mine)"
                  :alt="championName(pick.mine)"
                  :width="24"
                  size="xs"
                />
                <Frame
                  :src="champIcon(pick.theirs)"
                  :alt="championName(pick.theirs)"
                  :width="24"
                  size="xs"
                />
              </span>
              <span class="grow ell t2">
                {{ championName(pick.mine) }} <span class="t3">+</span>
                {{ championName(pick.theirs) }}
              </span>
              <span class="meta num">{{ pick.wins }}W {{ pick.games - pick.wins }}L</span>
              <span class="dd-rate num">{{
                pick.games >= SOLID ? `${rate(pick.wins, pick.games)}%` : ''
              }}</span>
            </li>
          </ul>
          <ShowMore
            v-if="picks.length"
            v-model="picksOpen"
            :total="partner.champions.length"
            :limit="WORKS"
          />
          <p v-else class="dd-line meta">No pair of picks played three times yet.</p>
        </section>

        <section v-if="partner.apart">
          <h4 class="lab row">
            <span class="grow">You, beside them</span>
            <span class="dd-c1">With</span>
            <span class="dd-c2">Without</span>
          </h4>
          <ul>
            <li v-for="row in splits" :key="row.label" class="dd-line">
              <span class="grow ell t2">{{ row.label }}</span>
              <span class="dd-c1 num" :class="row.clear ? 't1 b' : 't2'">{{ row.with }}</span>
              <span class="dd-c2 num t3">{{ row.without }}</span>
            </li>
          </ul>
        </section>
      </div>
    </article>

    <!-- The games themselves -->
    <section class="dd-games">
      <div class="mh-h">
        <h2 class="h3">Games together</h2>
        <span class="meta num">{{ partner.games }}</span>
      </div>
      <article v-if="failed && !games.length" class="card" role="alert">
        <EmptyState compact icon="clock" title="These games could not be loaded">
          <button type="button" class="btn sm" @click="load()">Retry</button>
        </EmptyState>
      </article>
      <article v-else-if="!games.length" class="card"><Skeleton :rows="4" pic /></article>
      <MatchRows
        v-else
        :matches="games"
        :puuid="profile.puuid"
        :game-name="profile.gameName"
        :tag-line="profile.tagLine"
      />

      <button
        v-if="games.length && (more || failed)"
        type="button"
        class="btn dd-older"
        :disabled="loading"
        @click="load(true)"
      >
        {{ failed ? 'Retry' : loading ? 'Loading' : 'Show older games' }}<Icon name="chev" />
      </button>
    </section>
  </section>
</template>

<style scoped>
.dd {
  display: flex;
  flex-direction: column;
  gap: 28px;
  scroll-margin-top: 80px;
}
.dd-games {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dd-who {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 20px 4px;
}
.dd-pair {
  display: flex;
  flex: none;
}
.dd-pair img {
  width: 44px;
  height: 44px;
  border-radius: 6px;
  background: var(--s3);
}
.dd-pair img + img {
  margin-left: -10px;
  box-shadow: 0 0 0 2px var(--s1);
}
.dd-figs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0;
  padding: 16px 0 20px;
}
.dd-figs > div {
  min-width: 0;
  padding: 4px 20px;
}
.dd-figs > div + div {
  border-left: 1px solid var(--line);
}
.dd-figs dd {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin: 10px 0 0;
}
.dd-note {
  margin-top: 6px;
}
.dd-form {
  padding: 16px 20px 12px;
  border-top: 1px solid var(--line);
}
.dd-form-h {
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
  margin-bottom: 16px;
}
.dd-works {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 24px;
  padding: 18px 20px 20px;
  border-top: 1px solid var(--line);
}
.dd-works h4 {
  margin: 0 0 8px;
}
.dd-works ul {
  margin: 0 0 6px;
  padding: 0;
  list-style: none;
}
.dd-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  font-size: 13px;
  font-weight: 600;
}
.dd-line + .dd-line {
  border-top: 1px solid var(--line);
}
.dd-rate {
  flex: none;
  width: 40px;
  text-align: right;
  font-weight: 700;
  color: var(--t1);
}
.dd-rate.quiet {
  font-weight: 600;
  color: var(--t3);
}
.dd-c1 {
  width: 48px;
  flex: none;
  text-align: right;
}
.dd-c2 {
  width: 60px;
  flex: none;
  text-align: right;
}
.b {
  font-weight: 700;
}
.dd-older {
  width: 100%;
  margin-top: 6px;
}
@media (max-width: 860px) {
  .dd-figs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 16px;
  }
  .dd-figs > div:nth-child(3) {
    border-left: 0;
  }
  .dd-hm {
    display: none;
  }
}
</style>
