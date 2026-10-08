<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { Link } from '@inertiajs/vue3'
import { ArrowUpRight, Check, ChevronDown, Link2 } from 'lucide-vue-next'
import ItemRow from './ItemRow.vue'
import PerfPlate from './PerfPlate.vue'
import RuneTrees from './RuneTrees.vue'
import Scoreboard from './Scoreboard.vue'
import MatchTimeline from './MatchTimeline.vue'
import {
  champIcon,
  championName,
  queueName,
  runeIcon,
  runeName,
  runeStyleIcon,
  spellIcon,
} from '../lib/assets.js'
import { compact, duration, kda } from '../lib/format.js'
import {
  earnedBadges,
  indexTimeline,
  isLanedMode,
  isRemake,
  killParticipation,
  laneOpponent,
  matchMinutes,
  rankLobby,
  runeSet,
  teamTotals,
} from '../lib/match.js'
import type { Match } from '../lib/types.js'

/**
 * One game in one line (DIRECTION.md §8). The result is the row's straight edge and a faint
 * tint, nothing else; figures stay white. The whole row toggles the detail below it, and the
 * full match page is an action inside that detail.
 */
const props = defineProps<{
  match: Match
  puuid: string
  summonerSlug: string
  expanded: boolean
  /** Opens a player's breakdown in the scoreboard from outside (the /app page's demo). */
  focus?: string
}>()

defineEmits<{ toggle: [] }>()

type View = 'scoreboard' | 'timeline' | 'runes'
const view = ref<View>('scoreboard')
const VIEWS: Array<{ value: View; label: string }> = [
  { value: 'scoreboard', label: 'Scoreboard' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'runes', label: 'Build & runes' },
]

/* The list payload carries the scoreboard already; only the timeline and the
   full rune pages need the heavier per-match request. */
const detail = shallowRef<Match | null>(null)
const loading = ref(false)
const failed = ref(false)
const focusPuuid = ref('')
watch(
  () => props.focus,
  (puuid) => {
    if (puuid !== undefined) focusPuuid.value = puuid
  },
  { immediate: true }
)
/** Timeline and build tabs always show somebody: the profile's player until another is picked. */
const activePuuid = computed(() => focusPuuid.value || props.puuid)
const copied = ref(false)

async function fetchDetail() {
  if (detail.value || loading.value) return
  loading.value = true
  failed.value = false
  try {
    const res = await fetch(`/api/matches/${encodeURIComponent(props.match.matchId)}`)
    if (!res.ok) throw new Error('request failed')
    detail.value = await res.json()
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

/** Opening a player needs the detail columns the list payload leaves out. */
function openPlayer(puuid: string) {
  focusPuuid.value = focusPuuid.value === puuid ? '' : puuid
  if (focusPuuid.value) void fetchDetail()
}

watch(
  () => [props.expanded, view.value] as const,
  ([open, current]) => {
    if (open && (current === 'timeline' || current === 'runes')) void fetchDetail()
  },
  { immediate: true }
)

const full = computed(() => detail.value ?? props.match)
const frames = computed(() => indexTimeline(detail.value))
const focusRunes = computed(() => {
  const player = full.value.participants.find((p) => p.puuid === activePuuid.value)
  return runeSet(frames.value[activePuuid.value] ?? [], player)
})
const focusPlayer = computed(() =>
  full.value.participants.find((p) => p.puuid === activePuuid.value)
)

/** Derived once: a template expression would re-run on every render. */
const row = computed(() => {
  const match = props.match
  const me = match.participants.find((p) => p.puuid === props.puuid)
  const remake = isRemake(match)
  const lobby = rankLobby(match)
  const minutes = matchMinutes(match)
  const opponent = me && isLanedMode(match) ? laneOpponent(match, me) : undefined

  return {
    me,
    remake,
    result: remake ? 'remake' : me?.win ? 'win' : 'loss',
    outcome: remake ? 'Remake' : me?.win ? 'Win' : 'Loss',
    queue: queueName(match.queueId),
    duration: duration(match.duration),
    champion: championName(me?.championId ?? 0),
    runes: runeSet([], me),
    ratio:
      me && me.deaths === 0 && me.kills + me.assists > 0
        ? 'Perfect'
        : kda(me?.kills ?? 0, me?.deaths ?? 0, me?.assists ?? 0).toFixed(2),
    kp: me ? Math.round(killParticipation(me, teamTotals(match))) : 0,
    csMin: ((me?.cs ?? 0) / minutes).toFixed(1),
    damage: compact(me?.totalDamageDealtToChampions ?? 0),
    opponent,
    standing: lobby.rank[props.puuid] ?? 0,
    score: lobby.score[props.puuid] ?? null,
    tag: (props.puuid === lobby.mvpPuuid
      ? 'MVP'
      : props.puuid === lobby.acePuuid
        ? 'ACE'
        : null) as 'MVP' | 'ACE' | null,
    badges: remake || !me ? [] : earnedBadges(match, me).slice(0, 2),
  }
})

const matchHref = computed(
  () =>
    `/${encodeURIComponent(props.summonerSlug)}/match/${encodeURIComponent(props.match.matchId)}`
)

async function copyLink() {
  try {
    await navigator.clipboard.writeText(`${location.origin}${matchHref.value}`)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    /* the match page is still one click away */
  }
}
</script>

<template>
  <div class="mrow-wrap @container" :class="{ open: expanded }">
    <button
      type="button"
      class="mrow"
      :class="row.result"
      :aria-expanded="expanded"
      :title="`${row.champion} · ${row.queue}`"
      @click="$emit('toggle')"
    >
      <!-- Champion -->
      <span class="mrow-champ">
        <span class="portrait h-full w-full">
          <img
            :src="champIcon(row.me?.championId ?? 0)"
            :alt="row.champion"
            width="44"
            height="44"
            loading="lazy"
            decoding="async"
          />
        </span>
        <span class="lvl absolute -bottom-1 -right-1">{{ row.me?.champLevel }}</span>
      </span>

      <!-- Spells and runes, two by two -->
      <span class="mrow-load">
        <img
          v-for="(spell, i) in (row.me?.spells ?? []).slice(0, 2)"
          :key="`s${i}`"
          :src="spellIcon(spell)"
          alt=""
          loading="lazy"
          class="spell"
        />
        <img
          v-if="row.runes.keystone"
          :src="runeIcon(row.runes.keystone)"
          :alt="runeName(row.runes.keystone)"
          :title="runeName(row.runes.keystone)"
          loading="lazy"
          class="key"
        />
        <i v-else />
        <img
          v-if="row.runes.secondaryStyle"
          :src="runeStyleIcon(row.runes.secondaryStyle)"
          :alt="runeName(row.runes.secondaryStyle)"
          :title="runeName(row.runes.secondaryStyle)"
          loading="lazy"
          class="sub"
        />
        <i v-else />
      </span>

      <!-- The game -->
      <span class="mrow-game">
        <b>{{ row.queue }}</b>
        <small>
          <span class="text-ink-2">{{ row.outcome }}</span>
          <span class="text-ink-4"> · </span>{{ row.duration }}
        </small>
      </span>

      <!-- KDA -->
      <span class="mrow-kda">
        <b> {{ row.me?.kills }}<i>/</i>{{ row.me?.deaths }}<i>/</i>{{ row.me?.assists }} </b>
        <small>
          {{ row.ratio }} KDA<span class="mrow-kp"> · {{ row.kp }}% KP</span>
        </small>
      </span>

      <!-- Farm and damage -->
      <span class="mrow-farm">
        <b>{{ row.csMin }}<span class="unit">CS/min</span></b>
        <small>{{ row.damage }} dmg</small>
      </span>

      <!-- Items in one well, then what the game earned -->
      <span class="mrow-items">
        <span class="mrow-well"><ItemRow :items="row.me?.items ?? []" size="row" /></span>
        <span v-if="row.badges.length" class="flex gap-1">
          <span v-for="badge in row.badges" :key="badge.key" class="tag" :title="badge.tip">
            {{ badge.label }}
          </span>
        </span>
      </span>

      <!-- Lane opponent -->
      <span class="mrow-vs">
        <template v-if="row.opponent">
          <small>vs</small>
          <span class="portrait h-7 w-7" :title="championName(row.opponent.championId)">
            <img
              :src="champIcon(row.opponent.championId)"
              :alt="championName(row.opponent.championId)"
              loading="lazy"
            />
          </span>
        </template>
      </span>

      <!-- Score: the row's focal point, the performance plate -->
      <span class="mrow-score">
        <PerfPlate
          :score="row.score"
          :place="row.standing"
          :of="match.participants.length"
          :tag="row.tag"
        />
      </span>

      <ChevronDown :size="16" class="mrow-chev" />
    </button>

    <!-- Expanded: the same depth as the match page, in place -->
    <div v-if="expanded" class="mrow-detail">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4">
        <nav class="tabs min-w-0 flex-1 !shadow-none" aria-label="Match detail">
          <button
            v-for="option in VIEWS"
            :key="option.value"
            type="button"
            :data-active="view === option.value"
            @click="view = option.value"
          >
            {{ option.label }}
          </button>
        </nav>
        <button class="btn btn-sm btn-ghost" @click="copyLink">
          <Check v-if="copied" :size="13" />
          <Link2 v-else :size="13" />
          {{ copied ? 'Copied' : 'Copy link' }}
        </button>
        <Link :href="matchHref" class="btn btn-sm">
          Open match page
          <ArrowUpRight :size="13" />
        </Link>
      </div>

      <div class="border-t border-line">
        <Scoreboard
          v-if="view === 'scoreboard'"
          dense
          :match="full"
          :owner-puuid="puuid"
          :timeline="frames"
          :open-puuid="focusPuuid"
          @open="openPlayer"
        />

        <div v-else-if="loading" class="px-4 py-5">
          <div class="skel h-[220px]" />
        </div>
        <div v-else-if="failed" class="flex items-center justify-center gap-3 py-12 text-[13px]">
          <span class="text-ink-2">This match could not be loaded.</span>
          <button class="btn btn-sm" @click="fetchDetail">Retry</button>
        </div>

        <div v-else-if="view === 'timeline'" class="px-4 py-5">
          <MatchTimeline
            :match="full"
            :selected-puuid="activePuuid"
            :owner-puuid="puuid"
            @select="focusPuuid = $event"
          />
        </div>

        <div v-else class="px-4 py-5">
          <div class="mb-5 flex flex-wrap items-center gap-1">
            <button
              v-for="p in full.participants"
              :key="p.puuid"
              type="button"
              class="pick"
              :data-active="activePuuid === p.puuid"
              :title="`${p.gameName} · ${championName(p.championId)}`"
              @click="focusPuuid = p.puuid"
            >
              <span class="portrait h-7 w-7">
                <img :src="champIcon(p.championId)" :alt="championName(p.championId)" />
              </span>
            </button>
          </div>
          <div class="grid gap-8 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <div>
              <div class="label mb-2.5">Final build</div>
              <ItemRow :items="focusPlayer?.items ?? []" size="md" />
            </div>
            <div>
              <div class="label mb-2.5">Runes</div>
              <RuneTrees :runes="focusRunes" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mrow-wrap {
  border-radius: var(--radius-sm);
}

.mrow {
  --edge: transparent;
  --tint: transparent;
  position: relative;
  display: grid;
  grid-template-columns:
    44px 42px minmax(96px, 1.1fr) minmax(104px, 1fr) minmax(80px, 0.8fr)
    auto 56px 84px 16px;
  align-items: center;
  column-gap: 14px;
  width: 100%;
  height: 68px;
  padding: 0 14px 0 16px;
  text-align: left;
  color: var(--color-ink);
  background: linear-gradient(var(--tint), var(--tint)), var(--color-panel);
  border-radius: var(--radius-sm);
  box-shadow: var(--hi);
  transition: background-color var(--t-fast) var(--ease);
}

/* The result: a straight edge and a faint tint of the same hue. */
.mrow::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--edge);
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
}

.mrow.win {
  --edge: var(--color-win);
  --tint: rgb(var(--win-rgb) / 0.06);
}

.mrow.loss {
  --edge: var(--color-loss);
  --tint: rgb(var(--loss-rgb) / 0.06);
}

.mrow.remake {
  opacity: 0.6;
}

.mrow:hover,
.open .mrow {
  --plate-hover: 1;
  background: linear-gradient(var(--tint), var(--tint)), var(--color-raised);
}

.open .mrow {
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}

.open .mrow::before {
  border-radius: var(--radius-sm) 0 0 0;
}

.mrow img {
  display: block;
}

.mrow-champ {
  position: relative;
  width: 44px;
  height: 44px;
}

.mrow-load {
  display: grid;
  grid-template-columns: 20px 20px;
  grid-template-rows: 20px 20px;
  gap: 2px;
  place-items: center;
}

.mrow-load img {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-xs);
}

.mrow-load img.key {
  border-radius: 0;
}

.mrow-load img.sub {
  width: 14px;
  height: 14px;
  border-radius: 0;
  opacity: 0.85;
}

.mrow-game,
.mrow-kda,
.mrow-farm {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.mrow b {
  font-weight: 600;
  white-space: nowrap;
}

.mrow-game b,
.mrow-farm b {
  overflow: hidden;
  font-size: 13px;
  line-height: 18px;
  text-overflow: ellipsis;
}

.mrow small {
  overflow: hidden;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--color-ink-3);
}

.mrow-kda b {
  font-size: 15px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}

.mrow-kda b i {
  margin: 0 4px;
  font-style: normal;
  font-weight: 400;
  color: var(--color-ink-4);
}

.mrow-items {
  display: grid;
  gap: 4px;
  justify-items: start;
}

.mrow-well {
  display: flex;
  padding: 3px;
  background: var(--color-well);
  border-radius: var(--radius-sm);
}

.mrow-vs {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mrow-vs small {
  font-size: 11px;
  color: var(--color-ink-4);
}

.mrow-score {
  display: flex;
  justify-content: flex-end;
}

.mrow-chev {
  color: var(--color-ink-4);
  transition:
    transform var(--t-base) var(--ease),
    color var(--t-fast) var(--ease);
}

.mrow:hover .mrow-chev {
  color: var(--color-ink-2);
}

.open .mrow-chev {
  transform: rotate(180deg);
}

.mrow-detail {
  background: var(--color-panel);
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
}

.pick {
  padding: 2px;
  border-radius: 7px;
  transition: box-shadow var(--t-fast) var(--ease);
}

.pick[data-active='true'] {
  box-shadow: inset 0 0 0 2px var(--color-brand);
}

.pick:not([data-active='true']):hover {
  box-shadow: inset 0 0 0 2px var(--color-line-2);
}

/* Narrower containers drop the matchup, then the farm, then the build. */
@container (max-width: 920px) {
  .mrow {
    grid-template-columns: 44px 42px minmax(92px, 1fr) minmax(100px, 1fr) auto 84px 16px;
  }
  .mrow-farm,
  .mrow-vs {
    display: none;
  }
}

@container (max-width: 700px) {
  .mrow {
    grid-template-columns: 44px 42px minmax(0, 1fr) minmax(0, 1fr) 84px 16px;
    column-gap: 12px;
  }
  .mrow-items {
    display: none;
  }
}

@container (max-width: 480px) {
  .mrow {
    grid-template-columns: 40px minmax(0, 1fr) auto 84px;
    height: 64px;
    padding: 0 12px 0 14px;
  }
  .mrow-champ {
    width: 40px;
    height: 40px;
  }
  .mrow-load,
  .mrow-chev,
  .mrow-kp {
    display: none;
  }
  .mrow-kda {
    justify-items: end;
    text-align: right;
  }
}
</style>
