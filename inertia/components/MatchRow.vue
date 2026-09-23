<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { Link } from '@inertiajs/vue3'
import { Check, ChevronDown, Link2 } from 'lucide-vue-next'
import ItemRow from './ItemRow.vue'
import RuneGlyphs from './RuneGlyphs.vue'
import RuneTrees from './RuneTrees.vue'
import RoleIcon from './RoleIcon.vue'
import ScoreRing from './ScoreRing.vue'
import Scoreboard from './Scoreboard.vue'
import MatchTimeline from './MatchTimeline.vue'
import { champIcon, championName, queueName, spellIcon, POSITION_NAMES } from '../lib/assets.js'
import { compact, duration, kda, ordinal, timeAgo } from '../lib/format.js'
import {
  indexTimeline,
  killParticipation,
  matchMinutes,
  rankLobby,
  runeSet,
  teamMembers,
  teamOrder,
  teamTotals,
} from '../lib/match.js'
import type { Match, Participant } from '../lib/types.js'

const props = defineProps<{
  match: Match
  puuid: string
  summonerSlug: string
  expanded: boolean
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
  const player = full.value.participants.find((p) => p.puuid === focusPuuid.value)
  return runeSet(frames.value[focusPuuid.value] ?? [], player)
})
const focusPlayer = computed(() =>
  full.value.participants.find((p) => p.puuid === focusPuuid.value)
)

function maxOf(participants: Participant[], read: (p: Participant) => number) {
  let max = 1
  for (const p of participants) {
    const value = read(p) || 0
    if (value > max) max = value
  }
  return max
}

/** Derived once: a template expression would re-run on every render. */
const row = computed(() => {
  const match = props.match
  const me = match.participants.find((p) => p.puuid === props.puuid)
  const totals = teamTotals(match)
  const lobby = rankLobby(match)
  const minutes = matchMinutes(match)

  return {
    me,
    win: Boolean(me?.win),
    queue: queueName(match.queueId),
    duration: duration(match.duration),
    ago: timeAgo(match.gameStartMs),
    champion: championName(me?.championId ?? 0),
    role: POSITION_NAMES[me?.position ?? ''] ?? '',
    runes: runeSet([], me),
    ratio: kda(me?.kills ?? 0, me?.deaths ?? 0, me?.assists ?? 0).toFixed(2),
    kp: me ? Math.round(killParticipation(me, totals)) : 0,
    csMin: ((me?.cs ?? 0) / minutes).toFixed(1),
    gold: compact(me?.goldEarned ?? 0),
    damage: compact(me?.totalDamageDealtToChampions ?? 0),
    damageBar:
      ((me?.totalDamageDealtToChampions ?? 0) /
        maxOf(match.participants, (p) => p.totalDamageDealtToChampions)) *
      100,
    standing: lobby.rank[props.puuid] ?? 0,
    score: lobby.score[props.puuid] ?? null,
    badge: props.puuid === lobby.mvpPuuid ? 'MVP' : props.puuid === lobby.acePuuid ? 'ACE' : null,
    teams: teamOrder(match).map((teamId) => ({ teamId, members: teamMembers(match, teamId) })),
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
  <div
    class="match-row relative overflow-hidden rounded-[10px] border border-line bg-panel"
    :data-result="row.win ? 'win' : 'loss'"
  >
    <div class="flex items-stretch">
      <button
        type="button"
        class="flex min-w-0 flex-1 items-center gap-2.5 py-3 pl-4 pr-2 text-left transition-colors hover:bg-white/[0.025] sm:gap-4 sm:pl-5 sm:pr-4"
        :aria-expanded="expanded"
        @click="$emit('toggle')"
      >
        <!-- Result -->
        <span class="w-[64px] shrink-0 sm:w-[86px]">
          <span class="display block text-[14px]" :class="row.win ? 'text-win' : 'text-loss'">
            {{ row.win ? 'Victory' : 'Defeat' }}
          </span>
          <span class="mt-1 block truncate text-[11px] font-medium text-ink-2">{{
            row.queue
          }}</span>
          <span class="num mt-px block truncate text-[10.5px] text-ink-3">
            {{ row.duration }} · {{ row.ago }}
          </span>
        </span>

        <!-- Champion -->
        <span class="flex shrink-0 items-center gap-1.5">
          <span class="relative">
            <img
              :src="champIcon(row.me?.championId ?? 0)"
              :alt="row.champion"
              width="46"
              height="46"
              loading="lazy"
              decoding="async"
              class="thumb h-[40px] w-[40px] rounded-[8px] sm:h-[46px] sm:w-[46px]"
            />
            <span class="lvl absolute -bottom-1 -right-1">{{ row.me?.champLevel }}</span>
          </span>
          <span class="flex flex-col gap-[3px]">
            <img
              v-for="spell in (row.me?.spells ?? []).slice(0, 2)"
              :key="spell"
              :src="spellIcon(spell)"
              alt=""
              loading="lazy"
              class="thumb h-[18px] w-[18px] rounded-[4px] sm:h-[20px] sm:w-[20px]"
            />
          </span>
          <RuneGlyphs :runes="row.runes" size="xs" class="hidden xs:flex xs:flex-col" />
        </span>

        <!-- Who they played -->
        <span class="hidden w-[92px] shrink-0 lg:block">
          <span class="block truncate text-[13px] font-semibold text-ink">{{ row.champion }}</span>
          <span class="mt-0.5 flex items-center gap-1 text-[10.5px] text-ink-3">
            <RoleIcon v-if="row.me?.position" :role="row.me.position" :size="11" />
            {{ row.role || '—' }}
          </span>
        </span>

        <!-- Score line -->
        <span class="w-[72px] shrink-0 whitespace-nowrap sm:w-[96px]">
          <span class="num stat block text-[18px] text-ink sm:text-[21px]">
            {{ row.me?.kills }}<span class="text-ink-4"> / </span
            ><span class="text-loss">{{ row.me?.deaths }}</span
            ><span class="text-ink-4"> / </span>{{ row.me?.assists }}
          </span>
          <span class="num mt-1 block text-[10.5px] text-ink-2">
            <b class="font-semibold text-ink">{{ row.ratio }}</b> KDA
            <span class="hidden text-ink-3 sm:inline">· {{ row.kp }}% KP</span>
          </span>
        </span>

        <!-- Economy and contribution, all four numbers kept -->
        <span class="num hidden w-[128px] shrink-0 whitespace-nowrap md:block">
          <span class="block text-[11.5px] text-ink-2">
            <b class="font-semibold text-ink">{{ row.me?.cs }}</b> CS
            <span class="text-ink-3">{{ row.csMin }}/m</span>
          </span>
          <span class="mt-0.5 block text-[10.5px] text-ink-3">
            <span class="text-gold">{{ row.gold }}</span> gold · {{ row.me?.visionScore }} vis
          </span>
          <span class="mt-1.5 flex items-center gap-1.5">
            <span class="meter w-[56px]"><span :style="{ width: `${row.damageBar}%` }" /></span>
            <span class="text-[10px] text-ink-3">{{ row.damage }}</span>
          </span>
        </span>

        <!-- Build -->
        <span class="hidden shrink-0 xl:block">
          <ItemRow :items="row.me?.items ?? []" size="sm" />
        </span>

        <!-- Both line-ups, winning side first -->
        <span class="ml-auto hidden shrink-0 flex-col gap-[3px] 2xl:flex">
          <span
            v-for="team in row.teams"
            :key="team.teamId"
            class="flex gap-[2px] border-l-2 pl-1.5"
            :style="{ borderColor: team.teamId === 100 ? 'var(--color-blue)' : 'var(--color-red)' }"
          >
            <img
              v-for="member in team.members"
              :key="member.puuid"
              :src="champIcon(member.championId)"
              :alt="championName(member.championId)"
              :title="`${member.gameName} · ${championName(member.championId)}`"
              loading="lazy"
              decoding="async"
              class="thumb h-[17px] w-[17px] rounded-[3px]"
              :class="
                member.puuid === puuid
                  ? 'ring-1 ring-ink-2 ring-offset-1 ring-offset-panel'
                  : 'opacity-75'
              "
            />
          </span>
        </span>

        <ChevronDown
          :size="15"
          class="ml-auto hidden shrink-0 text-ink-4 transition-transform duration-200 sm:block 2xl:ml-1"
          :class="expanded ? 'rotate-180' : ''"
        />
      </button>

      <!-- The score gets its own column, so it reads as the verdict on the game -->
      <button
        type="button"
        class="flex w-[54px] shrink-0 items-center justify-center gap-3 border-l border-line px-2 transition-colors hover:bg-white/[0.025] sm:w-[132px] sm:justify-start sm:px-4"
        :title="
          row.score !== null
            ? `Score ${row.score} · ${ordinal(row.standing)} of 10 in this lobby`
            : 'Games under five minutes are not scored'
        "
        :aria-expanded="expanded"
        @click="$emit('toggle')"
      >
        <template v-if="row.score !== null">
          <ScoreRing :score="row.score" :size="44" :stroke="4" class="max-sm:hidden" />
          <ScoreRing :score="row.score" :size="36" :stroke="3.5" class="sm:hidden" />
          <span class="hidden min-w-0 flex-col sm:flex">
            <span class="label">Score</span>
            <span
              class="num mt-1 text-[13px] font-semibold"
              :class="row.badge === 'MVP' ? 'text-signal' : row.badge ? 'text-ink' : 'text-ink-2'"
            >
              {{ row.badge ?? ordinal(row.standing) }}
            </span>
          </span>
        </template>
        <template v-else>
          <span class="tag max-sm:!hidden">Remake</span>
          <span class="text-ink-4 sm:hidden">—</span>
        </template>
      </button>

      <Link
        :href="matchHref"
        class="flex w-[36px] shrink-0 items-center justify-center border-l sm:w-[40px] border-line text-ink-3 transition-colors hover:bg-white/[0.025] hover:text-ink"
        title="Open full match analysis"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M6 3h7v7M13 3 4 12"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="sr-only">Open match</span>
      </Link>
    </div>

    <!-- Expanded: the same depth the match page has, in place -->
    <div v-if="expanded" class="relative border-t border-line bg-panel">
      <div class="flex flex-wrap items-center gap-3 px-4 py-2.5">
        <div class="seg">
          <button
            v-for="option in VIEWS"
            :key="option.value"
            type="button"
            :data-active="view === option.value"
            @click="view = option.value"
          >
            {{ option.label }}
          </button>
        </div>
        <button class="btn btn-sm btn-ghost ml-auto" @click="copyLink">
          <Check v-if="copied" :size="13" />
          <Link2 v-else :size="13" />
          {{ copied ? 'Copied' : 'Copy link' }}
        </button>
        <Link :href="matchHref" class="btn btn-sm">Open full analysis</Link>
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

        <div v-else-if="loading" class="py-12 text-center text-[12.5px] text-ink-3">
          Loading match details
        </div>
        <div v-else-if="failed" class="flex items-center justify-center gap-3 py-12 text-[12.5px]">
          <span class="text-ink-2">This match could not be loaded.</span>
          <button class="btn btn-sm" @click="fetchDetail">Try again</button>
        </div>

        <div v-else-if="view === 'timeline'" class="px-4 py-5">
          <MatchTimeline :match="full" :selected-puuid="focusPuuid" @select="focusPuuid = $event" />
        </div>

        <div v-else class="px-4 py-5">
          <div class="mb-4 flex flex-wrap items-center gap-2">
            <button
              v-for="p in full.participants"
              :key="p.puuid"
              type="button"
              class="rounded-[7px] border p-[3px] transition-colors"
              :class="
                focusPuuid === p.puuid ? 'border-ink-2' : 'border-transparent hover:border-line-2'
              "
              :title="`${p.gameName} · ${championName(p.championId)}`"
              @click="focusPuuid = p.puuid"
            >
              <img
                :src="champIcon(p.championId)"
                :alt="championName(p.championId)"
                class="thumb h-7 w-7 rounded-[5px]"
              />
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
/* The outcome reads as a colour before it reads as a word: an edge, and a
   wash that fades out before it reaches the numbers. */
.match-row {
  background-image: linear-gradient(
    90deg,
    color-mix(in srgb, var(--result) 10%, transparent),
    color-mix(in srgb, var(--result) 3%, transparent) 36%,
    transparent 70%
  );
}

.match-row::after {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--result);
  pointer-events: none;
}

.match-row[data-result='win'] {
  --result: var(--color-win);
}

.match-row[data-result='loss'] {
  --result: var(--color-loss);
}
</style>
