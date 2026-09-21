<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { Link } from '@inertiajs/vue3'
import { Check, ChevronDown, Link2 } from 'lucide-vue-next'
import ItemRow from './ItemRow.vue'
import RuneGlyphs from './RuneGlyphs.vue'
import RuneTrees from './RuneTrees.vue'
import RoleIcon from './RoleIcon.vue'
import GradeBadge from './GradeBadge.vue'
import Scoreboard from './Scoreboard.vue'
import MatchTimeline from './MatchTimeline.vue'
import { champIcon, championName, queueName, spellIcon, POSITION_NAMES } from '../lib/assets.js'
import { compact, duration, kda, ordinal, timeAgo } from '../lib/format.js'
import {
  gradeFor,
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
    grade: gradeFor(lobby, props.puuid),
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
  <div class="relative">
    <!-- The outcome reads as a colour before it reads as a word. -->
    <span
      class="absolute inset-y-0 left-0 w-[3px]"
      :style="{ background: row.win ? 'var(--color-win)' : 'var(--color-loss)' }"
    />

    <div class="flex items-stretch">
      <button
        type="button"
        class="flex min-w-0 flex-1 items-center gap-2 py-2.5 pl-3.5 pr-1 text-left transition-colors hover:bg-raised sm:gap-3 sm:pl-4 sm:pr-2"
        :aria-expanded="expanded"
        @click="$emit('toggle')"
      >
        <!-- Result -->
        <span class="w-[74px] shrink-0 sm:w-[88px]">
          <span class="text-[12px] font-semibold" :class="row.win ? 'text-win' : 'text-loss'">
            {{ row.win ? 'Victory' : 'Defeat' }}
          </span>
          <span class="mt-0.5 block truncate text-[11px] text-ink-2">{{ row.queue }}</span>
          <span class="num mt-0.5 block text-[10.5px] text-ink-3">
            {{ row.duration }} · {{ row.ago }}
          </span>
        </span>

        <!-- Champion -->
        <span class="flex shrink-0 items-center gap-1.5">
          <span class="relative">
            <img
              :src="champIcon(row.me?.championId ?? 0)"
              :alt="row.champion"
              width="42"
              height="42"
              loading="lazy"
              decoding="async"
              class="thumb h-[42px] w-[42px] rounded-[8px]"
            />
            <span
              class="num absolute -bottom-1 -right-1 grid h-[16px] min-w-[16px] place-items-center rounded-full border-2 border-bg bg-ink px-[3px] text-[8.5px] font-semibold text-bg"
            >
              {{ row.me?.champLevel }}
            </span>
          </span>
          <span class="flex flex-col gap-[3px]">
            <img
              v-for="spell in (row.me?.spells ?? []).slice(0, 2)"
              :key="spell"
              :src="spellIcon(spell)"
              alt=""
              loading="lazy"
              class="thumb h-[18px] w-[18px] rounded-[4px]"
            />
          </span>
          <RuneGlyphs :runes="row.runes" size="xs" class="hidden xs:flex" />
        </span>

        <!-- Who they played -->
        <span class="hidden w-[92px] shrink-0 lg:block">
          <span class="block truncate text-[12px] font-medium text-ink">{{ row.champion }}</span>
          <span class="flex items-center gap-1 text-[10.5px] text-ink-3">
            <RoleIcon v-if="row.me?.position" :role="row.me.position" :size="11" />
            {{ row.role || '—' }}
          </span>
        </span>

        <!-- Score -->
        <span class="w-[104px] shrink-0 whitespace-nowrap">
          <span class="num block text-[15px] font-semibold tracking-[-0.02em] text-ink">
            {{ row.me?.kills }}<span class="font-normal text-ink-4"> / </span
            ><span class="text-loss">{{ row.me?.deaths }}</span
            ><span class="font-normal text-ink-4"> / </span>{{ row.me?.assists }}
          </span>
          <span class="num mt-0.5 block text-[10.5px] text-ink-2">
            {{ row.ratio }} KDA <span class="text-ink-3">· {{ row.kp }}% KP</span>
          </span>
        </span>

        <!-- Economy and contribution, all four numbers kept -->
        <span class="num hidden w-[136px] shrink-0 whitespace-nowrap md:block">
          <span class="block text-[11px] text-ink-2">
            {{ row.me?.cs }} CS <span class="text-ink-3">({{ row.csMin }}/m)</span>
          </span>
          <span class="mt-0.5 block text-[10.5px] text-ink-3">
            {{ row.gold }} gold · {{ row.me?.visionScore }} vis
          </span>
          <span class="mt-1 flex items-center gap-1.5">
            <span class="meter w-[52px]"><span :style="{ width: `${row.damageBar}%` }" /></span>
            <span class="text-[10px] text-ink-3">{{ row.damage }}</span>
          </span>
        </span>

        <!-- Build -->
        <span class="hidden shrink-0 xl:block">
          <ItemRow :items="row.me?.items ?? []" size="sm" />
        </span>

        <!-- Both line-ups, winning side first -->
        <span class="ml-auto hidden shrink-0 gap-2 2xl:flex">
          <span
            v-for="team in row.teams"
            :key="team.teamId"
            class="flex gap-[2px] border-l-2 pl-1"
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
              class="thumb h-[16px] w-[16px] rounded-[3px]"
              :class="
                member.puuid === puuid
                  ? 'ring-1 ring-ink ring-offset-1 ring-offset-bg'
                  : 'opacity-80'
              "
            />
          </span>
        </span>

        <!-- How the game actually went, as one glyph -->
        <GradeBadge
          v-if="row.grade"
          :grade="row.grade"
          :size="32"
          class="ml-auto hidden sm:grid 2xl:ml-0"
          :title="`${ordinal(row.standing)} of 10 in this lobby`"
        />

        <ChevronDown
          :size="15"
          class="shrink-0 text-ink-4 transition-transform duration-200"
          :class="expanded ? 'rotate-180' : ''"
        />
      </button>

      <div class="flex shrink-0 items-center gap-0.5 pr-2">
        <Link :href="matchHref" class="icon-btn" title="Open full match analysis">
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
        <button
          class="icon-btn hidden sm:inline-flex"
          :title="copied ? 'Copied' : 'Copy match link'"
          @click="copyLink"
        >
          <Check v-if="copied" :size="13" />
          <Link2 v-else :size="13" />
        </button>
      </div>
    </div>

    <!-- Expanded: the same depth the match page has, in place -->
    <div v-if="expanded" class="border-t border-line bg-raised">
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
        <Link :href="matchHref" class="btn btn-sm ml-auto">Open full analysis</Link>
      </div>

      <div class="border-t border-line bg-bg">
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
                focusPuuid === p.puuid ? 'border-ink' : 'border-transparent hover:border-line-2'
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
