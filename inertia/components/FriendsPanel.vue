<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ChevronDown, Users } from 'lucide-vue-next'
import DuoDetail from './DuoDetail.vue'
import PlayerLink from './PlayerLink.vue'
import { profileIcon } from '../lib/assets.js'
import { shortDate, timeAgo } from '../lib/format.js'
import { roleLabel, type Partner, type SynergyReport } from '../lib/synergy.js'
import type { Summoner } from '../lib/types.js'

/**
 * The Friends section: who the player queues with, whether it helps, and one duo opened below.
 * Everything is read by the server from the player's latest stored games (lib/synergy.ts).
 */
const props = defineProps<{
  report: SynergyReport | null
  profile: Summoner
  loading: boolean
  error: boolean
}>()

defineEmits<{ retry: [] }>()

const rate = (wins: number, games: number) => (games ? Math.round((wins / games) * 100) : 0)

/** "+4", "−3", "±0": a sign and a weight, never a colour. */
function signed(value: number) {
  const rounded = Math.round(value)
  if (!rounded) return '±0'
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)}`
}

const partners = computed(() => props.report?.partners ?? [])
/** Duo partners and regulars: the people the player actually plays with. */
const friends = computed(() => partners.value.filter((p) => p.tier !== 'occasional'))
const occasional = computed(() => partners.value.filter((p) => p.tier === 'occasional'))
const main = computed(() => friends.value[0] ?? null)

const LIST = 8
const showAll = ref(false)
const listed = computed(() => (showAll.value ? friends.value : friends.value.slice(0, LIST)))
const CHIPS = 8
const allChips = ref(false)
const chips = computed(() => (allChips.value ? occasional.value : occasional.value.slice(0, CHIPS)))

/** The group opened to list its members, by their puuids. */
const groupKey = (group: { members: Array<{ puuid: string }> }) =>
  group.members.map((m) => m.puuid).join()
const openGroup = ref<string | null>(null)

const summary = computed(() => {
  const r = props.report
  if (!r || !r.friends.games) return null
  return {
    share: rate(r.friends.games, r.games),
    withRate: rate(r.friends.wins, r.friends.games),
    aloneRate: r.alone.games ? rate(r.alone.wins, r.alone.games) : null,
    withScore: r.friends.score === null ? null : Math.round(r.friends.score),
    aloneScore: r.alone.games && r.alone.score !== null ? Math.round(r.alone.score) : null,
  }
})

/* ── The duo shown below the list ─────────────────────────────── */
const selected = ref<string | null>(null)
const duo = computed(() => partners.value.find((p) => p.puuid === selected.value) ?? null)

/** `?with=Name-Tag` keeps the open duo in the address, so it can be shared or reloaded. */
function fromAddress() {
  if (typeof window === 'undefined') return null
  const wanted = new URLSearchParams(window.location.search).get('with')?.toLowerCase()
  if (!wanted) return null
  return (
    partners.value.find((p) => `${p.gameName}-${p.tagLine}`.toLowerCase() === wanted)?.puuid ?? null
  )
}

watch(
  partners,
  (list) => {
    if (list.some((p) => p.puuid === selected.value)) return
    selected.value = fromAddress() ?? friends.value[0]?.puuid ?? null
  },
  { immediate: true }
)
onMounted(() => {
  const linked = fromAddress()
  if (linked) selected.value = linked
})

function pick(partner: Partner) {
  selected.value = partner.puuid
  const url = new URL(window.location.href)
  url.searchParams.set('with', `${partner.gameName}-${partner.tagLine}`)
  window.history.replaceState(window.history.state, '', url)
  // On a phone the duo opens a screen or two below: bring it up.
  void nextTick(() => {
    const target = document.getElementById('duo')
    if (!target || target.getBoundingClientRect().top < window.innerHeight * 0.6) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' })
  })
}

/** A difference worth reading: on enough games, and not within a couple of points. */
const clear = (row: { confidence: string; synergy: number }) =>
  row.confidence !== 'low' && Math.abs(row.synergy) >= 2

function seats(partner: Partner) {
  if (!partner.theirRole) return ''
  const theirs = roleLabel(partner.theirRole)
  return partner.myRole ? `${theirs}, you ${roleLabel(partner.myRole).toLowerCase()}` : theirs
}
</script>

<template>
  <section class="fr">
    <div class="section flex-wrap">
      <h2>Friends</h2>
      <span v-if="report?.games" class="meta num">
        From the last {{ report.games }} games
        <span class="max-sm:hidden"
          >· {{ shortDate(report.firstMs) }} to {{ shortDate(report.lastMs) }}</span
        >
      </span>
    </div>

    <!-- Loading: the shape of what is coming -->
    <div v-if="!report && !error" class="space-y-4" aria-busy="true">
      <div class="iv-skel h-[118px]" />
      <div class="iv-skel h-[280px]" />
      <div class="iv-skel h-[340px]" />
    </div>

    <p v-else-if="error && !report" class="notice" role="alert">
      <span>Friends could not be loaded.</span>
      <button type="button" class="iv-btn sm ml-auto" @click="$emit('retry')">Retry</button>
    </p>

    <!-- Nothing stored yet -->
    <div v-else-if="report && !report.games" class="iv-panel fr-empty">
      <Users :size="20" class="text-ink-3" />
      <h3>No games yet</h3>
      <p>Once this player's games are stored, the people they play with show up here.</p>
    </div>

    <template v-else-if="report">
      <!-- Plays solo -->
      <div v-if="!summary" class="iv-panel fr-empty">
        <Users :size="20" class="text-ink-3" />
        <h3>Plays solo</h3>
        <p class="num">
          No one was on their team in {{ report.thresholds.regular }} or more of the last
          {{ report.games }} games.
          <template v-if="occasional.length">A few came back now and then.</template>
        </p>
      </div>

      <!-- With friends, and without -->
      <div v-else class="iv-panel lit-sheet">
        <dl class="fr-summary">
          <div>
            <dt class="label">With friends</dt>
            <dd>
              <span class="iv-fig text-[28px] text-ink">{{ summary.share }}%</span>
              <span class="num text-[12px] text-ink-3"
                >{{ report.friends.games }} of {{ report.games }} games</span
              >
            </dd>
          </div>
          <div>
            <dt class="label">Win rate with friends</dt>
            <dd>
              <span class="iv-fig text-[28px] text-ink">{{ summary.withRate }}%</span>
              <span v-if="summary.aloneRate !== null" class="num text-[12px] text-ink-3">
                {{ summary.aloneRate }}% without
              </span>
            </dd>
          </div>
          <div v-if="summary.withScore !== null">
            <dt class="label">Score with friends</dt>
            <dd>
              <span class="iv-fig text-[28px] text-ink">{{ summary.withScore }}</span>
              <span v-if="summary.aloneScore !== null" class="num text-[12px] text-ink-3">
                {{ summary.aloneScore }} without
              </span>
            </dd>
          </div>
          <div v-if="main" class="min-w-0">
            <dt class="label">{{ main.tier === 'duo' ? 'Main duo' : 'Plays most with' }}</dt>
            <dd>
              <button type="button" class="fr-main" @click="pick(main)">
                <img
                  :src="profileIcon(main.profileIconId)"
                  alt=""
                  width="28"
                  height="28"
                  class="thumb"
                />
                <span class="min-w-0">
                  <span class="block truncate text-[14px] font-semibold leading-[18px] text-ink">
                    {{ main.gameName }}
                  </span>
                  <span class="num block text-[12px] leading-4 text-ink-3">
                    {{ main.games }} games · {{ rate(main.wins, main.games) }}% won
                  </span>
                </span>
              </button>
            </dd>
          </div>
        </dl>
      </div>

      <div class="fr-grid mt-4">
        <!-- Who -->
        <section
          v-if="friends.length || occasional.length"
          class="iv-panel fr-people"
          :class="{ wide: !report.groups.length }"
        >
          <div class="section">
            <h3>Played with</h3>
            <span class="meta max-sm:hidden">Pick someone to see the duo</span>
          </div>
          <p v-if="friends.length" class="fr-lead">
            Synergy is your win rate with them minus your win rate without them.
          </p>

          <div v-if="friends.length" class="!px-2 !pb-2 sm:!px-3">
            <ul>
              <li v-for="partner in listed" :key="partner.puuid">
                <button
                  type="button"
                  class="fr-row"
                  :class="{ on: selected === partner.puuid }"
                  :aria-pressed="selected === partner.puuid"
                  @click="pick(partner)"
                >
                  <img
                    :src="profileIcon(partner.profileIconId)"
                    alt=""
                    width="36"
                    height="36"
                    loading="lazy"
                    class="thumb fr-icon"
                  />
                  <span class="min-w-0 flex-1 text-left">
                    <span class="block truncate text-[14px] leading-[18px]">
                      <span class="font-semibold text-ink">{{ partner.gameName }}</span>
                      <span class="text-ink-3">#{{ partner.tagLine }}</span>
                    </span>
                    <span class="fr-sub num">
                      <span v-if="partner.tier === 'duo'" class="text-ink-2">Duo</span>
                      <span
                        :class="{ 'text-ink-2': clear(partner) }"
                        :title="`${rate(partner.wins, partner.games)}% together, ${Math.round(partner.baseline * 100)}% without`"
                        >{{ signed(partner.synergy) }} synergy</span
                      >
                      <span v-if="partner.theirRole" class="max-xs:hidden">{{
                        seats(partner)
                      }}</span>
                      <span class="max-sm:hidden">{{ timeAgo(partner.lastMs) }}</span>
                    </span>
                  </span>
                  <span class="fr-fig" :class="{ quiet: partner.confidence === 'low' }">
                    <b class="num">{{ rate(partner.wins, partner.games) }}%</b>
                    <small class="num">{{ partner.games }} games</small>
                  </span>
                </button>
              </li>
            </ul>
            <button
              v-if="friends.length > LIST"
              type="button"
              class="iv-btn ghost sm mt-1 w-full"
              @click="showAll = !showAll"
            >
              {{ showAll ? 'Show fewer' : `Show all ${friends.length}` }}
            </button>
          </div>

          <!-- The ones who came back once or twice -->
          <div v-if="occasional.length" class="fr-chips" :class="{ alone: !friends.length }">
            <div class="label mb-2">Now and then</div>
            <ul class="flex flex-wrap gap-1.5">
              <li v-for="partner in chips" :key="partner.puuid">
                <button
                  type="button"
                  class="fr-chip"
                  :class="{ on: selected === partner.puuid }"
                  :aria-pressed="selected === partner.puuid"
                  @click="pick(partner)"
                >
                  <img
                    :src="profileIcon(partner.profileIconId)"
                    alt=""
                    width="20"
                    height="20"
                    loading="lazy"
                    class="thumb"
                  />
                  <span class="max-w-[140px] truncate">{{ partner.gameName }}</span>
                  <span class="num text-ink-4">{{ partner.games }}</span>
                </button>
              </li>
              <li v-if="occasional.length > CHIPS">
                <button type="button" class="fr-chip more" @click="allChips = !allChips">
                  {{ allChips ? 'Fewer' : `+${occasional.length - CHIPS}` }}
                </button>
              </li>
            </ul>
          </div>
        </section>

        <!-- Premade groups -->
        <section v-if="report.groups.length" class="iv-panel fr-groups">
          <div class="section">
            <h3>Groups</h3>
            <span class="meta">Three or more of you</span>
          </div>
          <ul class="!px-2 !pb-2 !pt-1 sm:!px-3">
            <li v-for="group in report.groups" :key="groupKey(group)">
              <button
                type="button"
                class="fr-row fr-group"
                :class="{ open: openGroup === groupKey(group) }"
                :aria-expanded="openGroup === groupKey(group)"
                @click="openGroup = openGroup === groupKey(group) ? null : groupKey(group)"
              >
                <span class="fr-stack" aria-hidden="true">
                  <img
                    v-for="member in group.members.slice(0, 4)"
                    :key="member.puuid"
                    :src="profileIcon(member.profileIconId)"
                    alt=""
                    width="24"
                    height="24"
                    loading="lazy"
                    class="thumb"
                  />
                </span>
                <span class="min-w-0 flex-1 text-left">
                  <span class="block truncate text-[13px] font-semibold leading-[17px] text-ink">
                    {{ group.members.map((m) => m.gameName).join(', ') }}
                  </span>
                  <span class="fr-sub num">
                    <span
                      :class="{ 'text-ink-2': clear(group) }"
                      :title="`${rate(group.wins, group.games)}% together, ${Math.round((report.wins / report.games) * 100)}% overall`"
                      >{{ signed(group.synergy) }} synergy</span
                    >
                    <span>{{ shortDate(group.lastMs) }}</span>
                  </span>
                </span>
                <span class="fr-fig" :class="{ quiet: group.confidence === 'low' }">
                  <b class="num">{{ rate(group.wins, group.games) }}%</b>
                  <small class="num">{{ group.games }} games</small>
                </span>
                <ChevronDown :size="14" class="fr-chevron" />
              </button>

              <!-- Everyone in it, each to their profile -->
              <ul v-if="openGroup === groupKey(group)" class="fr-members">
                <li v-for="member in group.members" :key="member.puuid">
                  <img
                    :src="profileIcon(member.profileIconId)"
                    alt=""
                    width="24"
                    height="24"
                    loading="lazy"
                    class="thumb"
                  />
                  <PlayerLink
                    :game-name="member.gameName"
                    :tag-line="member.tagLine"
                    show-tag
                    class="text-[13px]"
                  />
                </li>
              </ul>
            </li>
          </ul>
        </section>

        <!-- One duo, opened -->
        <DuoDetail
          v-if="duo"
          id="duo"
          :key="duo.puuid"
          class="fr-duo-slot"
          :partner="duo"
          :profile="profile"
        />
      </div>
    </template>
  </section>
</template>

<style scoped>
.fr-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px 16px;
  padding: 18px 16px;
}

.fr-summary dd {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin-top: 8px;
}

@media (min-width: 48rem) {
  .fr-summary {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    padding: 20px;
  }

  .fr-summary > div + div {
    padding-left: 16px;
    border-left: 1px solid var(--line);
  }
}

/* The main duo: a quiet button, lit on hover like a row. */
.fr-main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  max-width: 100%;
  margin: -4px -6px;
  padding: 4px 6px;
  text-align: left;
  border-radius: var(--r-sm);
  transition: background-color var(--t-base) var(--ease);
}

.fr-main:hover {
  background: var(--glint);
}

.fr-main img {
  width: 28px;
  height: 28px;
  border-radius: var(--r-sm);
}

/* People and groups beside each other where there is room, the duo below at full width. */
.fr-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.fr-duo-slot {
  margin-top: 8px;
}

@media (min-width: 80rem) {
  .fr-grid {
    grid-template-columns: minmax(0, 1fr) 320px;
  }

  .fr-duo-slot,
  .fr-people.wide {
    grid-column: 1 / -1;
  }
}

/* ── People ─────────────────────────────────────────────────── */
.fr-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 58px;
  padding: 8px 10px;
  border-radius: var(--r-sm);
  transition: background-color var(--t-base) var(--ease);
}

button.fr-row:hover {
  background: var(--glint);
}

/* The open duo: the violet-lit pill of the current place. */
button.fr-row.on {
  background: var(--lit-pill);
  box-shadow: var(--lit-pill-edge);
}

.fr-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--r-sm);
}

/* The quiet line under a name: facts separated by small dots. */
.fr-sub {
  display: flex;
  align-items: center;
  min-width: 0;
  margin-top: 2px;
  overflow: hidden;
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
  color: var(--text-3);
}

.fr-sub > span + span::before {
  content: '·';
  margin: 0 6px;
  color: var(--text-4);
}

/* The row's figure: the win rate together over the games together, muted on a handful. */
.fr-fig {
  display: grid;
  justify-items: end;
  flex: none;
  min-width: 52px;
  text-align: right;
}

.fr-fig b {
  font-size: 17px;
  font-weight: 650;
  font-stretch: var(--fig);
  line-height: 20px;
  letter-spacing: -0.01em;
  color: var(--text-1);
}

.fr-fig small {
  font-size: 11px;
  font-weight: 500;
  line-height: 14px;
  color: var(--text-4);
}

.fr-fig.quiet b {
  font-weight: 500;
  color: var(--text-3);
}

.fr-chips {
  margin: 4px 16px 0;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}

.fr-chips.alone {
  margin-top: 0;
  padding-top: 4px;
  border-top: 0;
}

.fr-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 9px 0 5px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-2);
  background: var(--surface-1);
  border-radius: var(--r-sm);
  box-shadow: var(--row);
  transition: background-color var(--t-base) var(--ease);
}

.fr-chip:hover {
  background: var(--surface-2);
}

.fr-chip.on {
  color: var(--text-1);
  background: var(--lit-pill);
  box-shadow: var(--lit-pill-edge);
}

.fr-chip.more {
  padding: 0 10px;
  color: var(--text-3);
}

.fr-chip img {
  width: 20px;
  height: 20px;
  border-radius: var(--r-xs);
}

@media (pointer: coarse) {
  .fr-chip {
    height: 40px;
  }
}

.fr-lead {
  margin: -6px 16px 6px;
  font-size: 12px;
  line-height: 16px;
  color: var(--text-3);
}

/* ── Groups ─────────────────────────────────────────────────── */
.fr-groups > ul > li + li {
  border-top: 1px solid var(--line);
}

.fr-group {
  min-height: 56px;
}

.fr-chevron {
  flex: none;
  color: var(--text-4);
  transition: transform var(--t-base) var(--ease);
}

.fr-group.open .fr-chevron {
  transform: rotate(180deg);
}

.fr-members {
  display: grid;
  gap: 2px;
  padding: 0 10px 10px;
}

.fr-members li {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 32px;
}

.fr-members img {
  width: 24px;
  height: 24px;
  border-radius: var(--r-sm);
}

.fr-stack {
  display: flex;
  flex-shrink: 0;
}

.fr-stack img {
  width: 24px;
  height: 24px;
  border-radius: var(--r-sm);
  outline: 2px solid var(--solid-1);
}

.fr-stack img + img {
  margin-left: -6px;
}

/* ── Empty ──────────────────────────────────────────────────── */
.fr-empty {
  display: grid;
  justify-items: start;
  gap: 6px;
  padding: 22px 20px;
}

.fr-empty h3 {
  margin-top: 4px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
}

.fr-empty p {
  max-width: 460px;
  font-size: 13px;
  line-height: 19px;
  color: var(--text-2);
}
</style>
