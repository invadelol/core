<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { BuildTab, ObjectiveIcon, Timeline } from '@invadelol/ui'
import { hasEvents, queueName, type MatchDetail } from '@invadelol/ui/logic'
import SiteLayout from '../components/SiteLayout.vue'
import MatchChart from '../components/match/MatchChart.vue'
import Icon from '../components/ui/Icon.vue'
import Frame from '../components/ui/Frame.vue'
import CardHead from '../components/ui/CardHead.vue'
import ScoreDial from '../components/ui/ScoreDial.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import Skeleton from '../components/ui/Skeleton.vue'
import SortHead from '../components/ui/SortHead.vue'
import { useSort } from '../components/ui/sort.js'
import { assetUrl, champIcon, championName, championSplash } from '../lib/assets.js'
import { decodeSlug, ordinal, parseSlug, profilePath } from '../lib/format.js'
import { detailOf } from '../lib/match.js'
import { patchName } from '../lib/patch.js'
import { SERVER } from '../lib/board.js'
import type { Match } from '../lib/types.js'
import '../css/match.css'

type Player = MatchDetail['players'][number]
type Team = MatchDetail['teams'][number]

/**
 * `/:summoner/match/:matchId`: one stored game as the board draws it: the scoreline, then
 * Overview (gold lead, team stats, both sides, lanes at 15, the best player, objectives, bans),
 * Scoreboard (every figure of every player), Chart (every player's gold, XP or CS a minute),
 * Builds and Timeline (the shared views). The game is
 * read from `/api/matches/:id` after the page opens; a game that just ended is waited for.
 */
const props = defineProps<{ summoner: string; matchId: string }>()

const slug = computed(() => decodeSlug(props.summoner))
const parsed = computed(() => parseSlug(props.summoner))

const match = shallowRef<Match | null>(null)
const detail = shallowRef<MatchDetail | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

const ownerPuuid = computed(
  () =>
    match.value?.participants.find((p) => `${p.gameName}-${p.tagLine}` === slug.value)?.puuid ?? ''
)
const selected = ref(0)
const me = computed(() => detail.value?.players.find((p) => p.puuid === ownerPuuid.value))

const TABS = computed(() => [
  { id: 'overview', label: 'Overview' },
  { id: 'scoreboard', label: 'Scoreboard' },
  ...(detail.value?.timeline ? [{ id: 'chart', label: 'Chart' }] : []),
  { id: 'builds', label: 'Builds' },
  ...(detail.value?.timeline && hasEvents(detail.value)
    ? [{ id: 'timeline', label: 'Timeline' }]
    : []),
])
/** The open tab, kept in the address's hash (older links said `#breakdown`, `#gold`, `#build`). */
const tab = ref('overview')
const ALIASES: Record<string, string> = {
  analysis: 'overview',
  breakdown: 'overview',
  gold: 'chart',
  build: 'builds',
}
function readHash() {
  const id = location.hash.slice(1)
  const wanted = ALIASES[id] ?? id
  if (TABS.value.some((s) => s.id === wanted)) tab.value = wanted
}
function show(id: string) {
  tab.value = id
  history.replaceState(
    history.state,
    '',
    id === 'overview' ? location.pathname + location.search : `#${id}`
  )
}

/* A game that just ended is not stored yet: the API answers 202 while it fetches it. */
const pending = ref(false)
const PENDING_FOR_MS = 20 * 60_000
let pendingSince = 0
let retry: ReturnType<typeof setTimeout> | undefined
let disposed = false
function askAgain(seconds: number) {
  retry = setTimeout(
    () => {
      if (document.visibilityState === 'visible') void load()
      else document.addEventListener('visibilitychange', onVisible, { once: true })
    },
    Math.min(60, Math.max(3, seconds)) * 1000
  )
}
function onVisible() {
  if (!disposed) void load()
}
async function load() {
  try {
    const res = await fetch(`/api/matches/${encodeURIComponent(props.matchId)}`, {
      cache: 'no-store',
    })
    if (disposed) return
    if (res.status === 202) {
      const body = await res.json().catch(() => null)
      pendingSince ||= Date.now()
      if (Date.now() - pendingSince < PENDING_FOR_MS) {
        pending.value = true
        askAgain(Number(res.headers.get('Retry-After')) || Number(body?.retryAfter) || 10)
        return
      }
    }
    pending.value = false
    if (res.status !== 200) {
      error.value = 'This match could not be found.'
      return
    }
    match.value = await res.json()
    detail.value = detailOf(match.value!)
    selected.value = Math.max(
      0,
      detail.value.players.findIndex((p) => p.puuid === ownerPuuid.value)
    )
    readHash()
  } catch {
    pending.value = false
    error.value = 'Something broke while loading this match.'
  } finally {
    isLoading.value = false
  }
}
onMounted(load)
onBeforeUnmount(() => {
  disposed = true
  clearTimeout(retry)
  document.removeEventListener('visibilitychange', onVisible)
})

/* ── What the board reads ─────────────────────────────────────── */
const blue = computed(() => detail.value?.teams.find((t) => t.teamId === 100) ?? null)
const red = computed(() => detail.value?.teams.find((t) => t.teamId === 200) ?? null)
const sideOf = (teamId: number) => detail.value?.players.filter((p) => p.teamId === teamId) ?? []
const winner = computed(() => (blue.value?.win ? 'Blue' : 'Red'))
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const k = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 100_000 ? 0 : 1)}k` : String(v))
const n = (v: number) => Math.round(v).toLocaleString('en-US')
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
/** "patch 26.22, Monday 9 November, 23:42, EUW" (the game's own clock, UTC). */
const when = computed(() => {
  if (!match.value || !detail.value) return ''
  const d = new Date(Number(match.value.gameStartMs))
  const day = `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${d.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })}`
  const time = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  const patch = match.value.patch ? `patch ${patchName(match.value.patch)}, ` : ''
  return `${patch}${day}, ${time} UTC, ${SERVER[match.value.platform] ?? match.value.platform}`
})
const shortDay = computed(() =>
  match.value
    ? new Date(Number(match.value.gameStartMs)).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      })
    : ''
)
const queue = computed(() => (detail.value ? queueName(detail.value.queueId) : ''))
const rift = computed(() => detail.value?.mapId === 11)

const OBJ: {
  key: keyof Team
  icon: 'tower' | 'inhib' | 'dragon' | 'baron' | 'herald' | 'grubs'
  label: string
}[] = [
  { key: 'towers', icon: 'tower', label: 'Towers' },
  { key: 'inhibitors', icon: 'inhib', label: 'Inhibitors' },
  { key: 'dragons', icon: 'dragon', label: 'Dragons' },
  { key: 'barons', icon: 'baron', label: 'Barons' },
  { key: 'heralds', icon: 'herald', label: 'Heralds' },
  { key: 'grubs', icon: 'grubs', label: 'Voidgrubs' },
]

/** One bar a minute: blue above the line. */
const gold = computed(() => {
  const diff = detail.value?.timeline?.goldDiff ?? []
  if (diff.length < 2) return null
  const W = 860
  const H = 170
  const max = Math.max(1000, ...diff.map((d) => Math.abs(d)))
  const step = W / diff.length
  const bars = diff.map((d, i) => {
    const h = (Math.abs(d) / max) * (H / 2 - 6)
    return {
      x: i * step + 2,
      w: Math.max(2, step - 4),
      y: d >= 0 ? H / 2 - h : H / 2,
      h,
      blue: d >= 0,
    }
  })
  const minutes = Math.floor((detail.value!.duration ?? 0) / 60)
  const ticks = [0, 10, 20, 30, 40, 50].filter((t) => t <= minutes)
  const marks = (detail.value?.timeline?.objectives ?? [])
    .filter((o) => ['dragon', 'baron', 'herald'].includes(o.kind))
    .map((o) => ({
      x: (o.t / Math.max(1, detail.value!.duration)) * 100,
      kind: o.kind as 'dragon' | 'baron' | 'herald',
      blue: o.team === 100,
    }))
  return { W, H, bars, ticks, marks }
})

const STATS = computed(() => {
  const b = blue.value
  const r = red.value
  if (!b || !r) return []
  const vision = (id: number) => sideOf(id).reduce((s, p) => s + p.vision, 0)
  return [
    { label: 'Kills', icon: 'riotKda', a: b.kills, b: r.kills, f: n },
    { label: 'Gold', icon: 'riotGold', a: b.gold, b: r.gold, f: k },
    { label: 'Damage to champions', icon: 'riotDamage', a: b.damage, b: r.damage, f: k },
    { label: 'Towers', icon: 'riotTower', a: b.towers, b: r.towers, f: n },
    { label: 'Dragons', icon: 'riotDragon', a: b.dragons, b: r.dragons, f: n },
    { label: 'Barons', icon: 'riotBaron', a: b.barons, b: r.barons, f: n },
    { label: 'Vision score', icon: 'riotVision', a: vision(100), b: vision(200), f: n },
  ] as const
})

/** The shared views keep the score on 0–10; the dial reads 0–100. */
const score100 = (p: Player) => (p.score === null ? null : Math.round(p.score * 10))
const placeWord = (rank: number) =>
  rank ? ordinal(rank) : ''
const best = computed(() => detail.value?.players.find((p) => p.rank === 1) ?? null)
const teamDamage = (p: Player) => sideOf(p.teamId).reduce((s, o) => s + o.damage, 0)
const maxDamage = computed(() =>
  Math.max(1, ...(detail.value?.players.map((p) => p.damage) ?? [1]))
)
const kdaRatio = (p: Player) => ((p.kills + p.assists) / Math.max(1, p.deaths)).toFixed(2)
/** The Statistics tab: one sorter for both sides, lane order until a head picks a figure. */
const statSort = useSort(() => detail.value?.players ?? [], {
  kda: (p) => (p.kills + p.assists) / Math.max(1, p.deaths),
  kp: (p) => p.kp,
  damage: (p) => p.damage,
  taken: (p) => p.damageTaken,
  cs: (p) => p.cs,
  csMin: (p) => p.csMin,
  wards: (p) => p.wardsPlaced,
  vision: (p) => p.vision,
})
const sortedSide = (teamId: number) => statSort.rows.filter((p) => p.teamId === teamId)
const playerHref = (p: Player) => (p.gameName ? profilePath(p.gameName, p.tagLine) : null)

const LANES = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'] as const
const LANE_WORD: Record<string, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MID: 'Mid',
  ADC: 'Bot',
  SUPPORT: 'Support',
}
const lanes = computed(() => {
  if (!detail.value?.timeline || (detail.value.duration ?? 0) < 900) return []
  const out = []
  for (const lane of LANES) {
    const a = sideOf(100).find((p) => p.position === lane)
    const b = sideOf(200).find((p) => p.position === lane)
    if (!a || !b || a.gold15 === null) continue
    out.push({ lane, a, b, diff: a.gold15 })
  }
  const max = Math.max(1, ...out.map((l) => Math.abs(l.diff)))
  return out.map((l) => ({ ...l, width: Math.max(2, (Math.abs(l.diff) / max) * 48) }))
})

const DRAGON: Record<string, string> = {
  AIR_DRAGON: 'Cloud dragon',
  WATER_DRAGON: 'Ocean dragon',
  FIRE_DRAGON: 'Infernal dragon',
  EARTH_DRAGON: 'Mountain dragon',
  HEXTECH_DRAGON: 'Hextech dragon',
  CHEMTECH_DRAGON: 'Chemtech dragon',
  ELDER_DRAGON: 'Elder dragon',
}
const TOWER: Record<string, string> = {
  OUTER_TURRET: 'outer tower',
  INNER_TURRET: 'inner tower',
  BASE_TURRET: 'base tower',
  NEXUS_TURRET: 'nexus tower',
}
const LANE_NAME: Record<string, string> = { TOP_LANE: 'Top', MID_LANE: 'Mid', BOT_LANE: 'Bot' }
const word = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replaceAll('_', ' ')
/** Objectives in order, with the first blood first. */
const events = computed(() => {
  const tl = detail.value?.timeline
  if (!tl) return []
  const out: {
    t: number
    icon: 'tower' | 'inhib' | 'dragon' | 'baron' | 'herald' | 'grubs' | 'flame'
    team: number
    text: string
  }[] = []
  const first = tl.kills[0]
  const players = detail.value!.players
  if (first) {
    const killer = players.find((p) => p.participantId === first.killer)
    const victim = players.find((p) => p.participantId === first.victim)
    if (killer)
      out.push({
        t: first.t,
        icon: 'flame',
        team: killer.teamId,
        text: `First blood, ${championName(killer.championId)}${victim ? ` on ${championName(victim.championId)}` : ''}`,
      })
  }
  for (const o of tl.objectives) {
    const icon =
      o.kind === 'tower'
        ? 'tower'
        : o.kind === 'inhibitor'
          ? 'inhib'
          : o.kind === 'monster'
            ? 'flame'
            : o.kind
    let text = word(o.kind)
    if (o.kind === 'dragon') text = DRAGON[o.sub] ?? 'Dragon'
    else if (o.kind === 'tower')
      text = `${LANE_NAME[o.lane] ?? ''} ${TOWER[o.sub] ?? 'tower'}`.trim()
    else if (o.kind === 'inhibitor') text = `${LANE_NAME[o.lane] ?? ''} inhibitor`.trim()
    else if (o.kind === 'grubs') text = 'Voidgrubs'
    else if (o.kind === 'herald') text = 'Rift Herald'
    else if (o.kind === 'baron') text = 'Baron Nashor'
    else if (o.kind === 'monster') text = word(o.sub || 'Monster')
    out.push({
      t: o.t,
      icon: icon as 'tower',
      team: o.team,
      text: text.charAt(0).toUpperCase() + text.slice(1),
    })
  }
  return out.sort((a, b) => a.t - b.t)
})

const copied = ref(false)
async function copy() {
  try {
    await navigator.clipboard.writeText(location.href)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    /* the address stays selectable */
  }
}
</script>

<template>
  <Head :title="`${parsed.gameName} | match`" />
  <SiteLayout>
    <div class="wrap pg-mx">
      <div class="mast" style="padding-bottom: 16px">
        <nav class="crumbs" aria-label="Breadcrumb">
          <Link :href="profilePath(parsed.gameName, parsed.tagLine)">{{ parsed.gameName }}</Link
          ><Icon name="chevr" />
          <span class="t1">{{ detail ? `${queue}, ${shortDay}` : 'Match' }}</span>
        </nav>
      </div>

      <template v-if="isLoading">
        <div class="card" style="padding: 20px"><Skeleton :height="210" /></div>
        <div class="card" style="padding: 20px; margin-top: 24px"><Skeleton :rows="8" pic /></div>
      </template>

      <EmptyState v-else-if="error" icon="search" :title="error">
        <Link class="btn" :href="profilePath(parsed.gameName, parsed.tagLine)"
          >Back to the profile</Link
        >
      </EmptyState>

      <EmptyState
        v-else-if="pending"
        icon="clock"
        title="This game just ended"
        line="It will be ready in a moment: this page opens it as soon as it is stored."
      />

      <template v-else-if="match && detail && blue && red">
        <h1 class="vh">{{ parsed.gameName }}'s match</h1>
        <section class="card mx2">
          <div class="mx2-top">
            <Link class="btn sm" :href="profilePath(parsed.gameName, parsed.tagLine)"
              ><Icon name="back" />Match history</Link
            >
            <span class="h4" style="margin: 0 auto"
              >{{ queue }} <span class="meta">{{ when }}</span></span
            >
            <button class="btn sm" type="button" @click="copy">
              <Icon name="share" />{{ copied ? 'Copied' : 'Copy link' }}
            </button>
          </div>
          <div class="mx2-sc">
            <template v-for="t in [blue, null, red]" :key="t?.teamId ?? 'mid'">
              <div v-if="t" class="side3" :class="{ r: t.teamId === 200 }">
                <span class="h3 row" style="gap: 8px">
                  <template v-if="t.teamId === 100"
                    ><span class="dotb"></span>Blue side<span class="meta">{{
                      t.win ? 'Victory' : 'Defeat'
                    }}</span></template
                  >
                  <template v-else
                    ><span class="meta">{{ t.win ? 'Victory' : 'Defeat' }}</span
                    >Red side<span class="dotr"></span
                  ></template>
                </span>
                <div class="cs2">
                  <Frame
                    v-for="p in sideOf(t.teamId)"
                    :key="p.participantId"
                    :src="champIcon(p.championId)"
                    size="s"
                    :alt="championName(p.championId)"
                  />
                </div>
                <div v-if="rift" class="ob2">
                  <span v-for="o in OBJ" :key="o.key" :title="o.label"
                    ><ObjectiveIcon :name="o.icon" :size="15" />{{ t[o.key] ?? 0 }}</span
                  >
                </div>
              </div>
              <div v-else class="mx2-mid">
                <span class="fg-xl">{{ blue.kills }} – {{ red.kills }}</span>
                <span class="meta" style="display: block; margin-top: 8px"
                  >{{ detail.remake ? 'Remake' : `${winner} side won` }} in
                  {{ clock(detail.duration) }}</span
                >
              </div>
            </template>
          </div>
          <nav class="tabs" style="border: 0" aria-label="Sections">
            <a
              v-for="item in TABS"
              :key="item.id"
              :href="`#${item.id}`"
              :class="{ on: tab === item.id }"
              @click.prevent="show(item.id)"
              >{{ item.label }}</a
            >
          </nav>
        </section>

        <!-- Overview -->
        <section v-if="tab === 'overview'" class="sec side2" style="padding-top: 24px">
          <div class="stk">
            <div v-if="gold" class="card">
              <CardHead title="Gold lead" icon="chart" meta="Blue above the line" />
              <div class="gold mx-gold">
                <span
                  v-for="(m, i) in gold.marks"
                  :key="i"
                  class="mk"
                  :class="m.blue ? 'b' : 'r'"
                  :style="{ left: `${m.x}%` }"
                  ><ObjectiveIcon :name="m.kind" :size="12"
                /></span>
                <svg
                  :viewBox="`0 0 ${gold.W} ${gold.H}`"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <line
                    x1="0"
                    :x2="gold.W"
                    :y1="gold.H / 2"
                    :y2="gold.H / 2"
                    stroke="rgba(190,180,255,.22)"
                    stroke-dasharray="3 4"
                  />
                  <rect
                    v-for="(b, i) in gold.bars"
                    :key="i"
                    :x="b.x"
                    :y="b.y"
                    :width="b.w"
                    :height="b.h"
                    rx="2"
                    :fill="b.blue ? 'var(--win)' : 'var(--loss)'"
                  />
                </svg>
              </div>
              <div class="row meta" style="justify-content: space-between; padding: 8px 20px 16px">
                <span v-for="t in gold.ticks" :key="t">{{ t ? `${t} min` : '0' }}</span>
              </div>
            </div>

            <div class="card">
              <CardHead title="Team stats" icon="sliders" />
              <div v-for="s in STATS" :key="s.label" class="cmp3">
                <span class="fg-xs num">{{ s.f(s.a) }}</span>
                <span class="m4"
                  ><span class="m4-l"><Icon :name="s.icon" :size="14" />{{ s.label }}</span
                  ><span class="sp3"
                    ><i :style="{ flex: s.a || 0.001 }"></i
                    ><i :style="{ flex: s.b || 0.001 }"></i></span
                ></span>
                <span class="fg-xs num" style="text-align: right">{{ s.f(s.b) }}</span>
              </div>
              <div style="height: 10px"></div>
            </div>

            <div v-for="t in [blue, red]" :key="t.teamId" class="card">
              <div class="card-h">
                <span :class="t.teamId === 100 ? 'dotb' : 'dotr'"></span>
                <span class="h3">{{ t.teamId === 100 ? 'Blue side' : 'Red side' }}</span>
                <span class="meta">{{ t.win ? 'Victory' : 'Defeat' }}</span>
              </div>
              <div class="sbh">
                <span></span><span>Player</span
                ><span class="sbh-s"><Icon name="riotKda" :size="13" />K / D / A</span
                ><span class="sbh-s"><Icon name="riotDamage" :size="13" />Damage</span
                ><!-- The narrow figures keep Riot's glyph alone, the name in a tooltip. --><span
                  class="sbh-s r"
                  title="CS"
                  ><Icon name="riotCs" :size="14" /><span class="vh">CS</span></span
                ><span class="sbh-s r" title="Gold"
                  ><Icon name="riotGold" :size="14" /><span class="vh">Gold</span></span
                ><span class="sbh-s r" title="Vision score"
                  ><Icon name="riotVision" :size="14" /><span class="vh">Vision score</span></span
                >
                <span>Items</span><span>Score</span>
              </div>
              <component
                :is="playerHref(p) ? Link : 'div'"
                v-for="p in sideOf(t.teamId)"
                :key="p.participantId"
                class="sbr"
                :class="{ me: p.puuid === ownerPuuid }"
                :href="playerHref(p) ?? undefined"
              >
                <span class="chq2"
                  ><Frame :src="champIcon(p.championId)" size="s" /><b>{{ p.level }}</b></span
                >
                <span class="col" style="min-width: 0">
                  <span class="h5 ell"
                    >{{ p.gameName || championName(p.championId)
                    }}<span v-if="p.rank === 1" class="tagm">MVP</span></span
                  >
                  <span class="row" style="gap: 3px; margin-top: 4px">
                    <img
                      v-if="p.perks[0]"
                      class="ico-s"
                      :src="assetUrl('rune', p.perks[0])"
                      alt=""
                      style="width: 18px; height: 18px; border-radius: 50%"
                    />
                    <img
                      v-for="s in p.spells"
                      :key="s"
                      class="ico-s"
                      :src="assetUrl('spell', s)"
                      alt=""
                      style="width: 18px; height: 18px"
                    />
                  </span>
                </span>
                <span class="col">
                  <span class="kda" style="font-size: 14.5px"
                    >{{ p.kills }}<span class="sl">/</span><span class="d">{{ p.deaths }}</span
                    ><span class="sl">/</span>{{ p.assists }}</span
                  >
                  <span class="meta">{{ kdaRatio(p) }}, {{ Math.round(p.kp * 100) }}%</span>
                </span>
                <span class="col" style="gap: 5px">
                  <span class="num" style="font-size: 13px">{{ n(p.damage) }}</span>
                  <span class="bar"
                    ><i :style="{ width: `${(p.damage / maxDamage) * 100}%` }"></i
                  ></span>
                </span>
                <span class="n2">{{ p.cs }}</span>
                <span class="n2">{{ k(p.gold) }}</span>
                <span class="n2">{{ p.vision }}</span>
                <span class="itz"
                  ><img
                    v-for="(it, i) in p.items.filter(Boolean).slice(0, 6)"
                    :key="i"
                    :src="assetUrl('item', it)"
                    alt=""
                /></span>
                <ScoreDial :value="score100(p)" size="sm" :place="placeWord(p.rank)" />
              </component>
            </div>

            <div v-if="lanes.length" class="card">
              <CardHead title="Lanes at 15 minutes" icon="swords" />
              <div v-for="l in lanes" :key="l.lane" class="lane3">
                <Frame :src="champIcon(l.a.championId)" size="s" />
                <span class="h5">{{ championName(l.a.championId) }}</span>
                <span class="col" style="gap: 6px">
                  <span class="dv2"
                    ><i
                      :style="
                        l.diff >= 0
                          ? { left: '50%', width: `${l.width}%`, background: 'var(--win)' }
                          : {
                              left: `${50 - l.width}%`,
                              width: `${l.width}%`,
                              background: 'var(--loss)',
                            }
                      "
                    ></i
                  ></span>
                  <span class="row meta" style="justify-content: space-between"
                    ><span>{{ LANE_WORD[l.lane] }}</span
                    ><span class="t1"
                      >{{ l.diff > 0 ? '+' : l.diff < 0 ? '−' : ''
                      }}{{ n(Math.abs(l.diff)) }} gold</span
                    ></span
                  >
                </span>
                <span class="h5" style="text-align: right">{{ championName(l.b.championId) }}</span>
                <Frame :src="champIcon(l.b.championId)" size="s" />
              </div>
            </div>
          </div>

          <div class="stk">
            <div v-if="best" class="card">
              <CardHead title="Best in the game" icon="star" />
              <div style="padding: 0 16px 16px">
                <Frame
                  size="l"
                  :src="championSplash(best.championId)"
                  style="height: 150px"
                  position="50% 20%"
                />
                <div class="row" style="gap: 14px; margin-top: 14px">
                  <ScoreDial :value="score100(best)" size="lg" place="MVP" />
                  <span class="col" style="min-width: 0">
                    <component
                      :is="playerHref(best) ? Link : 'span'"
                      :href="playerHref(best) ?? undefined"
                      class="h3 ell"
                      >{{ best.gameName }}</component
                    >
                    <span class="meta"
                      >{{ championName(best.championId) }}, {{ best.kills }} / {{ best.deaths }} /
                      {{ best.assists }},
                      {{ Math.round((best.damage / Math.max(1, teamDamage(best))) * 100) }}% of the
                      team's damage</span
                    >
                  </span>
                </div>
              </div>
            </div>
            <div v-if="events.length" class="card">
              <CardHead title="Objectives" icon="riotTower" />
              <div v-for="(e, i) in events" :key="i" class="ev2">
                <span class="meta">{{ clock(e.t) }}</span>
                <Icon v-if="e.icon === 'flame'" name="blood" />
                <ObjectiveIcon v-else :name="e.icon" :size="16" />
                <span><span :class="e.team === 100 ? 'dotb' : 'dotr'"></span> {{ e.text }}</span>
              </div>
              <div style="height: 10px"></div>
            </div>
            <div v-if="blue.bans.length || red.bans.length" class="card">
              <CardHead title="Bans" icon="ban" />
              <div class="col" style="gap: 10px; padding: 0 20px 18px">
                <div v-for="t in [blue, red]" :key="t.teamId" class="row" style="gap: 6px">
                  <Frame
                    v-for="(b, i) in t.bans.filter((x) => x > 0)"
                    :key="i"
                    :src="champIcon(b)"
                    :width="34"
                    size="xs"
                    style="filter: grayscale(0.7); opacity: 0.75"
                    :alt="championName(b)"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Scoreboard: every figure of every player. -->
        <section v-else-if="tab === 'scoreboard'" class="sec stk" style="padding-top: 24px">
          <div
            v-for="t in [blue, red]"
            :key="t.teamId"
            class="card tbl mx-sb"
            style="--cols: 220px 96px 60px 90px 90px 70px 70px 90px 76px minmax(0, 1fr)"
          >
            <div class="card-h">
              <span :class="t.teamId === 100 ? 'dotb' : 'dotr'"></span>
              <span class="h3">{{ t.teamId === 100 ? 'Blue side' : 'Red side' }}</span>
              <span class="meta"
                >{{ t.win ? 'Victory' : 'Defeat' }}, {{ t.kills }} kills, {{ k(t.gold) }} gold</span
              >
            </div>
            <div class="tbl-scroll">
              <div class="tbl-h">
                <span>Player</span>
                <SortHead :sorter="statSort" col="kda" label="K / D / A" title="KDA" />
                <SortHead :sorter="statSort" col="kp" label="KP" class="n" title="Kill participation" />
                <SortHead :sorter="statSort" col="damage" label="Damage" class="n" />
                <SortHead :sorter="statSort" col="taken" label="Taken" class="n" title="Damage taken" />
                <SortHead :sorter="statSort" col="cs" label="CS" class="n" />
                <SortHead :sorter="statSort" col="csMin" label="CS/min" class="n" />
                <SortHead :sorter="statSort" col="wards" label="Wards" class="n" title="Wards placed" />
                <SortHead :sorter="statSort" col="vision" label="Vision" class="n" />
                <span>Items</span>
              </div>
              <component
                :is="playerHref(p) ? Link : 'div'"
                v-for="p in sortedSide(t.teamId)"
                :key="p.participantId"
                class="tbl-r"
                :class="{ me: p.puuid === ownerPuuid }"
                :href="playerHref(p) ?? undefined"
              >
                <span class="who"
                  ><Frame :src="champIcon(p.championId)" :width="32" size="xs" /><span
                    class="col"
                    style="min-width: 0"
                    ><span class="h5 ell">{{ p.gameName || championName(p.championId) }}</span
                    ><span class="meta"
                      >{{ championName(p.championId) }}, level {{ p.level }}</span
                    ></span
                  ></span
                >
                <span class="kda" style="font-size: 14px"
                  >{{ p.kills }}<span class="sl">/</span><span class="d">{{ p.deaths }}</span
                  ><span class="sl">/</span>{{ p.assists }}</span
                >
                <span class="n">{{ Math.round(p.kp * 100) }}%</span>
                <span class="n">{{ n(p.damage) }}</span>
                <span class="n">{{ n(p.damageTaken) }}</span>
                <span class="n">{{ p.cs }}</span>
                <span class="n">{{ p.csMin.toFixed(1) }}</span>
                <span class="n">{{ p.wardsPlaced }} / {{ p.wardsKilled }}</span>
                <span class="n">{{ p.vision }}</span>
                <span class="itz"
                  ><img
                    v-for="(it, i) in p.items.filter(Boolean)"
                    :key="i"
                    :src="assetUrl('item', it)"
                    alt=""
                /></span>
              </component>
            </div>
          </div>
        </section>

        <section
          v-else-if="tab === 'chart' && detail.timeline"
          class="sec"
          style="padding-top: 24px"
        >
          <div class="card mx-shared">
            <MatchChart
              :detail="detail"
              :timeline="detail.timeline"
              :selected="selected"
              :me="me"
            />
          </div>
        </section>

        <section v-else-if="tab === 'builds'" class="sec" style="padding-top: 24px">
          <div class="card mx-shared">
            <BuildTab :detail="detail" :selected="selected" :me="me" @select="selected = $event" />
          </div>
        </section>

        <section
          v-else-if="tab === 'timeline' && detail.timeline"
          class="sec stk"
          style="padding-top: 24px"
        >
          <div class="card mx-shared">
            <Timeline
              :detail="detail"
              :timeline="detail.timeline"
              :selected="selected"
              :me="me"
              @select="selected = $event"
            />
          </div>
        </section>
      </template>
    </div>
  </SiteLayout>
</template>
