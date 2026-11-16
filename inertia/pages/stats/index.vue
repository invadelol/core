<script setup lang="ts">
import { computed, watch } from 'vue'
import { Deferred, Head, Link, usePage } from '@inertiajs/vue3'
import '../../css/tier-lists.css'
import '../../css/stats.css'
import SiteLayout from '../../components/SiteLayout.vue'
import Masthead from '../../components/ui/Masthead.vue'
import CardHead from '../../components/ui/CardHead.vue'
import Icon from '../../components/ui/Icon.vue'
import Skeleton from '../../components/ui/Skeleton.vue'
import SortHead from '../../components/ui/SortHead.vue'
import { useSort } from '../../components/ui/sort.js'
import EmptyState from '../../components/ui/EmptyState.vue'
import StatFilters from '../../components/champions/StatFilters.vue'
import RoleSeg from '../../components/champions/RoleSeg.vue'
import { champIconUrl, roleOf, type Filter } from '../../lib/champions.js'
import { patchName } from '../../lib/patches.js'
import { thousands, withQuery } from '../../lib/tier_lists.js'
import type { IconName } from '../../lib/icons.js'

type View = 'overview' | 'table' | 'early' | 'length' | 'firstblood' | 'items' | 'regions' | 'patch'
interface Row {
  champion: number
  games: number
  win: number
  pick: number
  ban: number
  roleShare: number
  tier: number | null
  rank: number | null
  before: { win: number; pick: number; ban: number; rank: number | null } | null
}
interface At {
  cs: number
  gold: number
  xp: number
  csDiff: number
  goldDiff: number
  xpDiff: number
}

/** `/stats?role=mid`: every champion of a role, its best at each figure, and the tables behind them. */
const props = defineProps<{
  view: View
  position: string
  patches: { patch: string; games: number }[]
  filter: Filter | null
  lengths: [number, number][]
  rows: Row[]
  champions: { id: number; name: string; slug: string }[]
  games?: number
  roleGames?: number
  previousPatch?: string | null
  averages?: Record<string, any>
  events?: Record<string, { gold: number | null; cs: number | null; ahead: number | null; aheadWin: number | null; fb: number | null }>
  early?: Record<string, { games: number; at10: At; at15: At; ahead: number; aheadWin: number | null }>
}>()
const page = usePage()

const role = computed(() => roleOf(props.position))
const champs = computed(() => new Map(props.champions.map((c) => [c.id, c])))
const nm = (id: number) => champs.value.get(id)?.name ?? ''
const href = (id: number) => {
  const c = champs.value.get(id)
  return c ? `/champions/${c.slug}?role=${role.value.slug}` : '#'
}
const viewHref = (view: string | null, sort?: string) => withQuery(page.url, { view: view === 'overview' ? null : view, sort: sort ?? null })
const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'table', label: 'Table' },
  { key: 'early', label: 'Early game' },
  { key: 'length', label: 'Late game' },
] as const

/** A champion appears in the cards from this many games in the role (`share` of the role's). */
const minGames = computed(() => Math.max(100, Math.round((props.roleGames ?? 0) * 0.0075)))
const pool = computed(() => props.rows.filter((r) => r.games >= minGames.value))
const av = (id: number) => props.averages?.[id] as Record<string, number | null> | undefined
const ev = (id: number) => props.events?.[id]

const pct2 = (v: number) => `${(v * 100).toFixed(2)}%`
const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`
const sg = (v: number, d = 2) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}`

interface CardDef {
  title: string
  icon: IconName
  sort: string
  value: (r: Row) => number | null | undefined
  text: (v: number) => string
  low?: boolean
  needs?: 'averages' | 'events'
}
const prev = computed(() => (props.previousPatch ? patchName(props.previousPatch) : null))
const sections = computed<{ title: string; cards: CardDef[] }[]>(() => [
  {
    title: 'Results',
    cards: [
      { title: 'Win rate', icon: 'trophy', sort: 'win', value: (r) => r.win, text: pct2 },
      { title: 'Pick rate', icon: 'users', sort: 'pick', value: (r) => r.pick, text: pct1 },
      { title: 'Ban rate', icon: 'ban', sort: 'ban', value: (r) => r.ban, text: pct1 },
      { title: prev.value ? `Rising since ${prev.value}` : 'Rising since last patch', icon: 'route', sort: 'change', value: (r) => (r.before ? (r.win - r.before.win) * 100 : null), text: (v) => sg(v) },
      { title: prev.value ? `Falling since ${prev.value}` : 'Falling since last patch', icon: 'chart', sort: 'change', value: (r) => (r.before ? (r.win - r.before.win) * 100 : null), text: (v) => sg(v), low: true },
      { title: 'KDA', icon: 'swords', sort: 'kda', value: (r) => av(r.champion)?.kda, text: (v) => v.toFixed(2), needs: 'averages' },
    ],
  },
  {
    title: 'Laning and fights',
    cards: [
      { title: 'Gold ahead at 10 minutes', icon: 'coin', sort: 'gold', value: (r) => ev(r.champion)?.gold, text: (v) => sg(v, 0), needs: 'events' },
      { title: 'Ahead at 10 minutes', icon: 'flag', sort: 'ahead', value: (r) => ev(r.champion)?.ahead, text: pct1, needs: 'events' },
      { title: 'First blood', icon: 'flame', sort: 'fb', value: (r) => ev(r.champion)?.fb, text: pct1, needs: 'events' },
      { title: 'CS per minute', icon: 'target', sort: 'cs', value: (r) => av(r.champion)?.csPerMin, text: (v) => v.toFixed(2), needs: 'averages' },
      { title: 'Damage to champions', icon: 'spark', sort: 'dmg', value: (r) => av(r.champion)?.damage, text: (v) => thousands(v), needs: 'averages' },
      { title: 'Win rate when ahead at 10', icon: 'star', sort: 'aheadWin', value: (r) => ev(r.champion)?.aheadWin, text: pct1, needs: 'events' },
    ],
  },
  {
    title: 'Game length',
    cards: [
      { title: 'Games under 25 minutes', icon: 'clock', sort: 'under25', value: (r) => av(r.champion)?.under25, text: pct1, needs: 'averages' },
      { title: 'Games over 25 minutes', icon: 'clock', sort: 'over25', value: (r) => av(r.champion)?.over25, text: pct1, needs: 'averages' },
      { title: 'Most games', icon: 'layers', sort: 'games', value: (r) => r.games, text: (v) => thousands(v) },
    ],
  },
])
const top5 = (c: CardDef) =>
  pool.value
    .map((r) => ({ r, v: c.value(r) }))
    .filter((x): x is { r: Row; v: number } => x.v !== null && x.v !== undefined && (!c.title.startsWith('Rising') || x.v > 0) && (!c.low || x.v < 0))
    .sort((a, b) => (c.low ? a.v - b.v : b.v - a.v))
    .slice(0, 5)
const waitingFor = (c: CardDef) => (c.needs === 'averages' ? props.averages === undefined : c.needs === 'events' ? props.events === undefined : false)

/* ── Tables ─────────────────────────────────────────────────── */
interface Col {
  key: string
  label: string
  value: (r: Row) => number | null | undefined
  text: (v: number) => string
  hm?: boolean
}
const columns = computed<Col[]>(() => {
  if (props.view === 'early') {
    const e = (r: Row) => props.early?.[r.champion]
    return [
      { key: 'games', label: 'Games', value: (r) => r.games, text: thousands, hm: true },
      { key: 'gold10', label: 'Gold at 10', value: (r) => e(r)?.at10.goldDiff, text: (v) => sg(v, 0) },
      { key: 'cs10', label: 'CS at 10', value: (r) => e(r)?.at10.csDiff, text: (v) => sg(v, 1), hm: true },
      { key: 'xp10', label: 'XP at 10', value: (r) => e(r)?.at10.xpDiff, text: (v) => sg(v, 0), hm: true },
      { key: 'gold15', label: 'Gold at 15', value: (r) => e(r)?.at15.goldDiff, text: (v) => sg(v, 0) },
      { key: 'ahead', label: 'Ahead at 10', value: (r) => e(r)?.ahead, text: pct1, hm: true },
      { key: 'aheadWin', label: 'Wins when ahead', value: (r) => e(r)?.aheadWin, text: pct1, hm: true },
    ]
  }
  if (props.view === 'length') {
    const a = (r: Row) => av(r.champion)
    return [
      { key: 'games', label: 'Games', value: (r) => r.games, text: thousands, hm: true },
      { key: 'length', label: 'Average game', value: (r) => a(r)?.length, text: (v) => `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}` },
      ...props.lengths.map(([from, to], i) => ({
        key: `len${i}`,
        label: to >= 999 ? `${from}+ min` : `${from}–${to} min`,
        value: (r: Row) => (a(r)?.byLength as unknown as (number | null)[] | undefined)?.[i] ?? null,
        text: pct1,
        hm: i !== props.lengths.length - 1 && i !== 0,
      })),
    ]
  }
  return [
    { key: 'games', label: 'Games', value: (r) => r.games, text: thousands, hm: true },
    { key: 'win', label: 'Win rate', value: (r) => r.win, text: pct2 },
    { key: 'pick', label: 'Pick rate', value: (r) => r.pick, text: pct1, hm: true },
    { key: 'ban', label: 'Ban rate', value: (r) => r.ban, text: pct1, hm: true },
    { key: 'change', label: prev.value ? `Since ${prev.value}` : 'Since', value: (r) => (r.before ? (r.win - r.before.win) * 100 : null), text: (v) => sg(v), hm: true },
    { key: 'kda', label: 'KDA', value: (r) => av(r.champion)?.kda, text: (v) => v.toFixed(2), hm: true },
    { key: 'cs', label: 'CS/min', value: (r) => av(r.champion)?.csPerMin, text: (v) => v.toFixed(2), hm: true },
    { key: 'dmg', label: 'Damage', value: (r) => av(r.champion)?.damage, text: thousands, hm: true },
    { key: 'gold', label: 'Gold at 10', value: (r) => ev(r.champion)?.gold, text: (v) => sg(v, 0), hm: true },
    { key: 'ahead', label: 'Ahead at 10', value: (r) => ev(r.champion)?.ahead, text: pct1, hm: true },
    { key: 'aheadWin', label: 'Wins ahead', value: (r) => ev(r.champion)?.aheadWin, text: pct1, hm: true },
    { key: 'fb', label: 'First blood', value: (r) => ev(r.champion)?.fb, text: pct1, hm: true },
    { key: 'under25', label: 'Under 25', value: (r) => av(r.champion)?.under25, text: pct1, hm: true },
    { key: 'over25', label: 'Over 25', value: (r) => av(r.champion)?.over25, text: pct1, hm: true },
  ]
})
// A card's "every champion" link opens the table sorted by its figure (`?sort=`).
const asked = new URLSearchParams(page.url.split('?')[1] ?? '').get('sort')
const sort = useSort(
  () => props.rows,
  () => Object.fromEntries(columns.value.map((c) => [c.key, c.value])),
  { key: asked ?? 'win' }
)
// Another view has other columns: follow its first figure when the one sorted is not among them.
watch(columns, (cols) => {
  if (sort.key && !cols.some((c) => c.key === sort.key)) {
    sort.key = cols[1]?.key ?? cols[0]?.key ?? null
    sort.dir = 'desc'
  }
}, { immediate: true })
const tableCols = computed(() => `minmax(180px, 1fr) repeat(${columns.value.length}, minmax(76px, 96px))`)
const title = computed(() => `${role.value.label} stats`)
const metaLine = computed(() =>
  props.filter
    ? `${props.rows.length} champions, ${thousands(props.roleGames ?? 0)} games${props.view === 'overview' ? `, at least ${thousands(minGames.value)} games to appear` : ''}`
    : 'No ranked games stored yet'
)
</script>

<template>
  <Head :title="title" />
  <SiteLayout>
    <div class="wrap">
      <Masthead :title="title" :crumbs="[{ label: 'Tools' }, { label: 'Stats' }]" :meta="metaLine">
        <template #end>
          <StatFilters :filter="filter" :patches="patches" :region="false" />
        </template>
        <div class="st-bar">
          <RoleSeg :value="position" />
          <nav class="tabs st-tabs" aria-label="View">
            <Link
              v-for="t in TABS"
              :key="t.key"
              :href="viewHref(t.key)"
              :class="{ on: view === t.key || (t.key === 'table' && !TABS.some((x) => x.key === view)) }"
              preserve-scroll
              >{{ t.label }}</Link
            >
          </nav>
        </div>
      </Masthead>

      <EmptyState v-if="!rows.length" title="No champions for this filter" line="Too few games are stored for this patch and rank." />
      <template v-else-if="view === 'overview'">
        <section v-for="(s, i) in sections" :key="s.title" class="sec" :style="{ paddingTop: i ? '40px' : '8px' }">
          <div class="sec-h"><h2 class="h2">{{ s.title }}</h2></div>
          <div class="grid3">
            <div v-for="c in s.cards" :key="c.title" class="card">
              <CardHead :title="c.title" :icon="c.icon"><Link class="more" :href="viewHref('table', c.sort)" :aria-label="`${c.title}, every champion`"><Icon name="chevr" /></Link></CardHead>
              <Skeleton v-if="waitingFor(c)" :rows="5" pic />
              <template v-else>
                <Link v-for="(x, k) in top5(c)" :key="x.r.champion" class="lrow" :href="href(x.r.champion)" style="min-height: 52px">
                  <span class="rk">{{ k + 1 }}</span>
                  <span class="fr s" style="width: 34px; height: 34px"><img :src="champIconUrl(x.r.champion)" alt="" loading="lazy" /></span>
                  <span class="h4 grow ell">{{ nm(x.r.champion) }}</span>
                  <span v-if="k === 0" class="vtop">{{ c.text(x.v) }}</span>
                  <span v-else class="fg-xs num">{{ c.text(x.v) }}</span>
                </Link>
                <p v-if="!top5(c).length" class="meta st-none">Not counted for this filter yet.</p>
              </template>
            </div>
          </div>
        </section>
      </template>
      <section v-else class="sec" style="padding-top: 8px">
        <article class="card st-card">
          <Deferred :data="view === 'early' ? 'early' : 'averages'">
            <template #fallback><Skeleton :rows="10" pic /></template>
            <div class="tbl st-tbl" :style="{ '--cols': tableCols }">
              <div class="tbl-h">
                <span>Champion</span>
                <SortHead v-for="c in columns" :key="c.key" :sorter="sort" :col="c.key" :label="c.label" class="n" :class="{ hm: c.hm }" />
              </div>
              <Link v-for="r in sort.rows" :key="r.champion" class="tbl-r" :href="href(r.champion)">
                <span class="who"><img class="pic sm" :src="champIconUrl(r.champion)" alt="" loading="lazy" /><span class="h5 ell">{{ nm(r.champion) }}</span></span>
                <span v-for="c in columns" :key="c.key" class="n num" :class="{ hm: c.hm }">{{
                  c.value(r) === null || c.value(r) === undefined ? '–' : c.text(c.value(r)!)
                }}</span>
              </Link>
            </div>
          </Deferred>
        </article>
      </section>
    </div>
  </SiteLayout>
</template>
