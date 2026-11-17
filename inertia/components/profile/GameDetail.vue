<script lang="ts">
import type { MatchDetail } from '@invadelol/ui/logic'

/** Games opened during the visit, so closing and reopening one is instant. */
const cache = new Map<string, MatchDetail>()
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import { Link } from '@inertiajs/vue3'
import { Breakdown, BuildTab, Icon, Scoreboard, Timeline, useFormat } from '@invadelol/ui'
import { hasEvents } from '@invadelol/ui/logic'
import MatchChart from '../match/MatchChart.vue'
import { afterPaint } from '../../lib/after_paint.js'
import { detailOf } from '../../lib/match.js'
import { profilePath } from '../../lib/format.js'
import type { Match } from '../../lib/types.js'

/**
 * An opened game of a profile's list: the shared views (scoreboard, breakdown, timeline, build)
 * and the site's Chart, under one tab line with the game's patch and date, its link and the way
 * to its own page. The list already carries the scoreboard columns, so the game opens on them at
 * once; the stored match with its timeline and events follows.
 */
const props = defineProps<{ match: Match; puuid: string; gameName: string; tagLine: string }>()

const detail = shallowRef<MatchDetail | null>(null)
const error = shallowRef<string | null>(null)
const loading = shallowRef(false)

async function load() {
  const id = props.match.matchId
  error.value = null
  detail.value = cache.get(id) ?? detailOf(props.match)
  loading.value = !cache.has(id)
  if (!loading.value) return
  try {
    const res = await fetch(`/api/matches/${encodeURIComponent(id)}`)
    // 202 is a game not stored yet (the API is fetching it), never a match to draw.
    if (res.status !== 200) throw new Error()
    const d = detailOf((await res.json()) as Match)
    cache.set(id, d)
    if (id === props.match.matchId) detail.value = d
  } catch {
    if (id === props.match.matchId) error.value = 'This game could not be loaded.'
  } finally {
    if (id === props.match.matchId) loading.value = false
  }
}
watch(() => props.match.matchId, load, { immediate: true })

/* ── The tabs: Chart (formerly Gold) and Timeline need the game's timeline ── */
const TABS = [
  { id: 'scoreboard', label: 'Scoreboard', timeline: false },
  { id: 'breakdown', label: 'Breakdown', timeline: false },
  { id: 'chart', label: 'Chart', timeline: true },
  { id: 'timeline', label: 'Timeline', timeline: true },
  { id: 'build', label: 'Build', timeline: false },
] as const
type TabId = (typeof TABS)[number]['id']
/** Older names of a tab. */
const ALIASES: Record<string, TabId> = { gold: 'chart' }

const tabs = computed(() =>
  TABS.filter(
    (s) =>
      !s.timeline || (detail.value?.timeline && (s.id !== 'timeline' || hasEvents(detail.value)))
  )
)
const tab = shallowRef<TabId>('scoreboard')
/** The tab drawn: it follows `tab` once the tab line has painted, so a tap answers at once. */
const drawn = shallowRef<TabId>('scoreboard')
function show(id: string) {
  const want = ALIASES[id] ?? (id as TabId)
  if (tabs.value.some((s) => s.id === want)) tab.value = want
}
watch(tab, (id) => afterPaint(() => tab.value === id && (drawn.value = id)))
watch(tabs, (list) => {
  if (!list.some((s) => s.id === tab.value)) tab.value = 'scoreboard'
})

const selected = shallowRef(0)
watch(
  detail,
  (d) => (selected.value = Math.max(0, d?.players.findIndex((p) => p.puuid === props.puuid) ?? 0)),
  { immediate: true }
)
const me = computed(() => detail.value?.players.find((p) => p.puuid === props.puuid))

const { date } = useFormat()
const meta = computed(() => {
  const d = detail.value
  if (!d) return ''
  const when = date(d.creation, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `Patch ${d.version.split('.').slice(0, 2).join('.')} · ${when}${d.fromCore ? ' · invade.lol' : ''}`
})

const href = computed(
  () =>
    `${profilePath(props.gameName, props.tagLine)}/match/${encodeURIComponent(props.match.matchId)}`
)
const copied = shallowRef(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
async function copyLink() {
  try {
    await navigator.clipboard.writeText(`${location.origin}${href.value}`)
    copied.value = true
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (copied.value = false), 1600)
  } catch {
    /* the match page is still one click away */
  }
}
onBeforeUnmount(() => clearTimeout(copiedTimer))
</script>

<template>
  <div class="iv-md">
    <div v-if="error" class="iv-md-state">
      <p class="iv-error"><Icon name="x" :size="15" />{{ error }}</p>
      <button type="button" class="iv-btn sm" @click="load">
        <Icon name="refresh" :size="13" />Try again
      </button>
    </div>
    <template v-else-if="detail">
      <div class="iv-md-top">
        <nav class="iv-tabs">
          <button
            v-for="s in tabs"
            :key="s.id"
            type="button"
            :class="{ on: tab === s.id }"
            @click="show(s.id)"
          >
            {{ s.label }}
          </button>
        </nav>
        <p class="iv-md-meta">
          <span
            v-if="!detail.timeline && !loading"
            title="invade.lol has no timeline for this game: no graphs and no events."
            >No timeline ·
          </span>
          {{ meta }}
        </p>
        <span class="iv-md-actions">
          <button
            type="button"
            class="iv-btn ghost sm"
            :title="copied ? 'Copied' : 'Copy the link to this game'"
            @click="copyLink"
          >
            <Icon :name="copied ? 'check' : 'copy'" :size="13" /><span>{{
              copied ? 'Copied' : 'Copy link'
            }}</span>
          </button>
          <Link :href="href" class="iv-btn ghost sm" title="Open this game on its own page">
            <span>Match page</span><Icon name="arrow" :size="13" />
          </Link>
        </span>
      </div>
      <div class="iv-md-body">
        <Scoreboard v-if="drawn === 'scoreboard'" :detail="detail" :puuid="puuid" />
        <Breakdown
          v-else-if="drawn === 'breakdown'"
          :detail="detail"
          :selected="selected"
          :me="me"
          @select="selected = $event"
        />
        <MatchChart
          v-else-if="drawn === 'chart' && detail.timeline"
          :detail="detail"
          :timeline="detail.timeline"
          :selected="selected"
          :me="me"
        />
        <Timeline
          v-else-if="drawn === 'timeline' && detail.timeline"
          :detail="detail"
          :timeline="detail.timeline"
          :selected="selected"
          :me="me"
          @select="selected = $event"
        />
        <BuildTab
          v-else-if="drawn === 'build'"
          :detail="detail"
          :selected="selected"
          :me="me"
          @select="selected = $event"
        />
      </div>
    </template>
    <div v-else class="iv-md-loading" aria-busy="true">
      <div class="iv-md-skel-tabs"><span v-for="n in 5" :key="n" class="iv-skel" /></div>
      <div v-for="n in 6" :key="n" class="iv-skel iv-md-skel-row" />
    </div>
  </div>
</template>
