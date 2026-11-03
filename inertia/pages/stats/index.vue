<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { Head, Link, router, usePage } from '@inertiajs/vue3'
import { Download } from 'lucide-vue-next'
import { ChampIcon, RoleIcon } from '@invadelol/ui'
import AppHeader from '../../components/AppHeader.vue'
import SiteFooter from '../../components/SiteFooter.vue'
import Crumbs from '../../components/champions/Crumbs.vue'
import TierMark from '../../components/champions/TierMark.vue'
import SortHead from '../../components/champions/SortHead.vue'
import GameImg from '../../components/champions/GameImg.vue'
import DataLine from '../../components/champions/DataLine.vue'
import Select from '../../components/ui/Select.vue'
import {
  BRACKETS,
  ROLES,
  TIERS,
  bracketOf,
  filterQuery,
  roleOf,
  type Filter,
} from '../../lib/champions.js'
import {
  ariaSort,
  gapClass,
  pct,
  points,
  short,
  signed,
  sortRows,
  thousands,
  clock,
  type Sort,
} from '../../lib/board.js'
import { afterPaint } from '../../lib/after_paint.js'
import '../../css/champions.css'

type View = 'overview' | 'early' | 'length' | 'firstblood' | 'items' | 'regions' | 'patch'
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

/** `/stats?view=early&role=mid`: every champion of a role in one sortable table. */
const props = defineProps<{
  view: View
  position: string
  patches: { patch: string; games: number }[]
  filter: Filter | null
  lengths: [number, number][]
  regions: { value: string; label: string }[]
  rows: Row[]
  champions: { id: number; name: string; slug: string }[]
  games?: number
  roleGames?: number
  previousPatch?: string | null
  updatedAt?: number | null
  now?: number
  averages?: Record<string, any>
  events?: Record<
    string,
    {
      gold: number | null
      cs: number | null
      ahead: number | null
      aheadWin: number | null
      fb: number | null
    }
  >
  early?: Record<
    string,
    { games: number; at10: At; at15: At; ahead: number; aheadWin: number | null }
  >
  firstBlood?: Record<
    string,
    {
      games: number
      kill: number
      assist: number
      victim: number
      involved: number
      involvedWin: number | null
    }
  >
  byRegion?: Record<string, Record<string, [number, number]>>
  items?: { item: number; games: number; wins: number; name: string | null }[]
}>()

const VIEWS: { id: View; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'early', label: 'Early game' },
  { id: 'length', label: 'Game length' },
  { id: 'firstblood', label: 'First blood' },
  { id: 'items', label: 'Items' },
  { id: 'regions', label: 'Regions' },
  { id: 'patch', label: 'Patch changes' },
]
const TITLES: Record<View, string> = {
  overview: 'Champion stats',
  early: 'Early game',
  length: 'Game length',
  firstblood: 'First blood',
  items: 'Items',
  regions: 'Regions',
  patch: 'Patch changes',
}

const page = usePage()
const latest = computed(() => props.patches[0]?.patch)
const rank = computed(() => props.filter?.bracket ?? 'emerald_plus')
const patch = computed(() => props.filter?.patch ?? latest.value ?? '')
const role = computed(() => roleOf(props.position))
const byId = computed(() => new Map(props.champions.map((c) => [c.id, c])))
const name = (id: number) => byId.value.get(id)?.name ?? ''

const href = (c: {
  view?: View
  role?: string
  rank?: string
  patch?: string
  region?: string | null
}) => {
  const q = filterQuery(
    {
      role: c.role ?? (props.position === 'MIDDLE' ? undefined : role.value.slug),
      rank: c.rank ?? rank.value,
      patch: c.patch ?? patch.value,
      region: c.region === undefined ? props.filter?.region : c.region,
    },
    latest.value
  )
  const view = c.view ?? props.view
  const v = view === 'overview' ? '' : `view=${view}`
  return `/stats${q}${v ? `${q ? '&' : '?'}${v}` : ''}`
}
const champHref = (id: number) =>
  `/champions/${byId.value.get(id)?.slug ?? id}${filterQuery({ role: role.value.slug, rank: rank.value, patch: patch.value }, latest.value)}`

const visit = (url: string) => router.visit(url, { preserveScroll: true })
const rankModel = computed({ get: () => rank.value, set: (v: string) => visit(href({ rank: v })) })
const regionModel = computed({
  get: () => props.filter?.region ?? '',
  set: (v: string) => visit(href({ region: v || null })),
})
const patchModel = computed({
  get: () => patch.value,
  set: (v: string) => visit(href({ patch: v })),
})
const rankOptions = BRACKETS.map((b) => ({ value: b.value, label: b.label }))
const regionOptions = computed(() => [{ value: '', label: 'All regions' }, ...props.regions])
const patchOptions = computed(() =>
  props.patches.map((p) => ({ value: p.patch, label: `Patch ${p.patch}` }))
)
const SAMPLES = [
  { value: 0, label: 'Any sample' },
  { value: 100, label: '100+ games' },
  { value: 1000, label: '1,000+ games' },
  { value: 10000, label: '10,000+ games' },
]
const sample = ref(0)

/* ── Columns ─────────────────────────────────────────────────── */
interface Col<T> {
  key: string
  label: string
  title?: string
  group?: string
  value: (r: T) => number | string | null
  text: (r: T) => string
  cls?: (r: T) => string
  /** Hidden on phones. */
  hm?: boolean
  width?: string
}
type Champ = Row & { id: number }

const av = (r: Row) => props.averages?.[r.champion]
const ev = (r: Row) => props.events?.[r.champion]
const ea = (r: Row) => props.early?.[r.champion]
const fb = (r: Row) => props.firstBlood?.[r.champion]
const rg = (r: Row, region: string) => props.byRegion?.[r.champion]?.[region] ?? null
const lenLabel = (from: number, to: number) =>
  from === 0 ? `Under ${to}` : to >= 999 ? `${from} and up` : `${from} to ${to}`

const base: Col<Row>[] = [
  {
    key: 'tier',
    label: 'Tier',
    group: 'Overview',
    value: (r) => (r.tier === null ? null : -r.tier * 1000 - (999 - (r.rank ?? 999))),
    text: () => '',
    width: '44px',
  },
  {
    key: 'win',
    label: 'Win',
    group: 'Overview',
    value: (r) => r.win,
    text: (r) => pct(r.win),
    cls: () => 'b',
    width: '62px',
  },
  {
    key: 'pick',
    label: 'Pick',
    group: 'Overview',
    value: (r) => r.pick,
    text: (r) => pct(r.pick),
    width: '56px',
  },
  {
    key: 'ban',
    label: 'Ban',
    group: 'Overview',
    value: (r) => r.ban,
    text: (r) => pct(r.ban),
    hm: true,
    width: '56px',
  },
  {
    key: 'games',
    label: 'Games',
    group: 'Overview',
    value: (r) => r.games,
    text: (r) => short(r.games),
    hm: true,
    width: '60px',
  },
]
const at = (minute: 10 | 15, k: keyof At, label: string, signedDigits?: number): Col<Row> => ({
  key: `${k}${minute}`,
  label,
  group: `At ${minute} minutes`,
  value: (r) => ea(r)?.[`at${minute}`]?.[k] ?? null,
  text: (r) => {
    const v = ea(r)?.[`at${minute}`]?.[k]
    if (v === undefined || v === null || (!ea(r)?.games && minute === 10)) return '-'
    return signedDigits !== undefined
      ? signed(v, signedDigits)
      : k === 'cs'
        ? v.toFixed(1)
        : thousands(v)
  },
  cls: (r) => (signedDigits !== undefined ? gapClass(ea(r)?.[`at${minute}`]?.[k]) : ''),
  width: '64px',
})
const columns = computed<Col<Row>[]>(() => {
  switch (props.view) {
    case 'early':
      return [
        {
          key: 'games',
          label: 'Games',
          value: (r) => ea(r)?.games ?? null,
          text: (r) => (ea(r)?.games ? short(ea(r)!.games) : '-'),
          width: '60px',
        },
        at(10, 'cs', 'CS'),
        at(10, 'gold', 'Gold'),
        at(10, 'xp', 'XP'),
        at(10, 'csDiff', 'CS gap', 1),
        at(10, 'goldDiff', 'Gold gap', 0),
        at(10, 'xpDiff', 'XP gap', 0),
        at(15, 'cs', 'CS'),
        at(15, 'gold', 'Gold'),
        at(15, 'csDiff', 'CS gap', 1),
        at(15, 'goldDiff', 'Gold gap', 0),
        {
          key: 'ahead',
          label: 'Ahead',
          title: 'Ahead in gold at 10 minutes',
          group: 'Lane',
          value: (r) => ea(r)?.ahead ?? null,
          text: (r) => (ea(r)?.games ? pct(ea(r)!.ahead) : '-'),
          width: '60px',
        },
        {
          key: 'aheadWin',
          label: 'Then win',
          group: 'Lane',
          value: (r) => ea(r)?.aheadWin ?? null,
          text: (r) => pct(ea(r)?.aheadWin),
          width: '64px',
        },
      ]
    case 'length':
      return [
        {
          key: 'games',
          label: 'Games',
          value: (r) => av(r)?.games ?? null,
          text: (r) => (av(r) ? short(av(r).games) : '-'),
          width: '60px',
        },
        {
          key: 'length',
          label: 'Average',
          title: 'Average game length',
          value: (r) => av(r)?.length ?? null,
          text: (r) => (av(r) ? clock(av(r).length) : '-'),
          width: '64px',
        },
        ...props.lengths.map(
          ([from, to], i): Col<Row> => ({
            key: `len${i}`,
            label: lenLabel(from, to),
            group: 'Win rate by length, minutes',
            value: (r) => av(r)?.byLength?.[i] ?? null,
            text: (r) => pct(av(r)?.byLength?.[i]),
            width: '76px',
          })
        ),
      ]
    case 'firstblood':
      return [
        {
          key: 'games',
          label: 'Games',
          value: (r) => fb(r)?.games ?? null,
          text: (r) => (fb(r) ? short(fb(r)!.games) : '-'),
          width: '60px',
        },
        {
          key: 'kill',
          label: 'Takes it',
          value: (r) => fb(r)?.kill ?? null,
          text: (r) => pct(fb(r)?.kill),
          width: '70px',
        },
        {
          key: 'assist',
          label: 'Helps',
          value: (r) => fb(r)?.assist ?? null,
          text: (r) => pct(fb(r)?.assist),
          width: '64px',
        },
        {
          key: 'involved',
          label: 'In on it',
          value: (r) => fb(r)?.involved ?? null,
          text: (r) => pct(fb(r)?.involved),
          cls: () => 'b',
          width: '70px',
        },
        {
          key: 'victim',
          label: 'Gives it',
          value: (r) => fb(r)?.victim ?? null,
          text: (r) => pct(fb(r)?.victim),
          width: '70px',
        },
        {
          key: 'involvedWin',
          label: 'Win when in on it',
          value: (r) => fb(r)?.involvedWin ?? null,
          text: (r) => pct(fb(r)?.involvedWin),
          width: '120px',
        },
      ]
    case 'regions':
      return [
        {
          key: 'games',
          label: 'Games',
          value: (r) => r.games,
          text: (r) => short(r.games),
          width: '60px',
        },
        ...regionCols.value.map(
          (rgn): Col<Row> => ({
            key: `r-${rgn.value}`,
            label: rgn.label,
            group: 'Win rate by server',
            title: `Win rate on ${rgn.label}`,
            value: (r) => {
              const x = rg(r, rgn.value)
              return x && x[0] >= 30 ? x[1] / x[0] : null
            },
            text: (r) => {
              const x = rg(r, rgn.value)
              return x && x[0] >= 30 ? pct(x[1] / x[0]) : '-'
            },
            width: '64px',
          })
        ),
      ]
    case 'patch':
      return [
        { key: 'tier', label: 'Tier', value: base[0].value, text: () => '', width: '44px' },
        {
          key: 'win',
          label: 'Win',
          group: `Now, ${patch.value}`,
          value: (r) => r.win,
          text: (r) => pct(r.win),
          cls: () => 'b',
          width: '62px',
        },
        {
          key: 'dwin',
          label: 'Change',
          group: `Since ${props.previousPatch ?? ''}`,
          value: (r) => (r.before ? r.win - r.before.win : null),
          text: (r) => (r.before ? points(r.win - r.before.win) : 'New'),
          cls: (r) => (r.before ? gapClass(r.win - r.before.win) : 'q'),
          width: '64px',
        },
        {
          key: 'pick',
          label: 'Pick',
          group: `Now, ${patch.value}`,
          value: (r) => r.pick,
          text: (r) => pct(r.pick),
          width: '56px',
        },
        {
          key: 'dpick',
          label: 'Change',
          group: `Since ${props.previousPatch ?? ''}`,
          value: (r) => (r.before ? r.pick - r.before.pick : null),
          text: (r) => (r.before ? points(r.pick - r.before.pick) : '-'),
          width: '64px',
        },
        {
          key: 'dban',
          label: 'Ban change',
          group: `Since ${props.previousPatch ?? ''}`,
          value: (r) => (r.before ? r.ban - r.before.ban : null),
          text: (r) => (r.before ? points(r.ban - r.before.ban) : '-'),
          hm: true,
          width: '80px',
        },
        {
          key: 'move',
          label: 'Places',
          title: 'Places gained in the role since the previous patch',
          group: `Since ${props.previousPatch ?? ''}`,
          value: (r) => (r.before?.rank && r.rank ? r.before.rank - r.rank : null),
          text: (r) => {
            const d = r.before?.rank && r.rank ? r.before.rank - r.rank : null
            return d === null ? '-' : d > 0 ? `▲ ${d}` : d < 0 ? `▼ ${-d}` : '='
          },
          cls: (r) => {
            const d = r.before?.rank && r.rank ? r.before.rank - r.rank : 0
            return `b ${d > 0 ? 'up' : d < 0 ? 'down' : 'qq'}`
          },
          width: '64px',
        },
      ]
    default:
      return [
        ...base,
        {
          key: 'kda',
          label: 'KDA',
          group: 'Per game',
          value: (r) => av(r)?.kda ?? null,
          text: (r) => (av(r) ? av(r).kda.toFixed(2) : '-'),
          width: '48px',
        },
        {
          key: 'cs',
          label: 'CS/min',
          group: 'Per game',
          value: (r) => av(r)?.csPerMin ?? null,
          text: (r) => (av(r) ? av(r).csPerMin.toFixed(1) : '-'),
          width: '56px',
        },
        {
          key: 'dmg',
          label: 'Damage',
          group: 'Per game',
          value: (r) => av(r)?.damage ?? null,
          text: (r) => (av(r) ? short(av(r).damage) : '-'),
          width: '62px',
        },
        {
          key: 'gold10',
          label: 'Gold',
          title: 'Gold gap to the lane opponent at 10 minutes',
          group: 'Lane at 10 min',
          value: (r) => ev(r)?.gold ?? null,
          text: (r) => (ev(r)?.ahead ? signed(ev(r)!.gold) : '-'),
          cls: (r) => (ev(r)?.ahead ? gapClass(ev(r)!.gold) : 'q'),
          width: '56px',
        },
        {
          key: 'cs10',
          label: 'CS',
          title: 'CS gap to the lane opponent at 10 minutes',
          group: 'Lane at 10 min',
          value: (r) => ev(r)?.cs ?? null,
          text: (r) => (ev(r)?.ahead ? signed(ev(r)!.cs, 1) : '-'),
          cls: (r) => (ev(r)?.ahead ? gapClass(ev(r)!.cs) : 'q'),
          width: '52px',
        },
        {
          key: 'ahead',
          label: 'Ahead',
          title: 'Ahead in gold at 10 minutes',
          group: 'Lane at 10 min',
          value: (r) => ev(r)?.ahead || null,
          text: (r) => (ev(r)?.ahead ? pct(ev(r)!.ahead) : '-'),
          width: '58px',
        },
        {
          key: 'aheadWin',
          label: 'Then win',
          title: 'Win rate of the games ahead at 10 minutes',
          group: 'Lane at 10 min',
          value: (r) => ev(r)?.aheadWin ?? null,
          text: (r) => pct(ev(r)?.aheadWin),
          width: '64px',
        },
        {
          key: 'fb',
          label: 'In on FB',
          title: 'Takes or helps first blood',
          group: 'Fights',
          value: (r) => ev(r)?.fb ?? null,
          text: (r) => pct(ev(r)?.fb),
          width: '64px',
        },
        {
          key: 'early',
          label: 'Under 20',
          title: 'Win rate in games under 20 minutes',
          group: 'Win rate by length',
          value: (r) => av(r)?.early ?? null,
          text: (r) => pct(av(r)?.early),
          width: '64px',
        },
        {
          key: 'late',
          label: '35 and up',
          title: 'Win rate in games of 35 minutes and more',
          group: 'Win rate by length',
          value: (r) => av(r)?.late ?? null,
          text: (r) => pct(av(r)?.late),
          width: '68px',
        },
      ]
  }
})
/** The regions with games, most first. */
const regionCols = computed(() => {
  const totals = new Map<string, number>()
  for (const byR of Object.values(props.byRegion ?? {}))
    for (const [r, [g]] of Object.entries(byR)) totals.set(r, (totals.get(r) ?? 0) + g)
  return props.regions
    .filter((r) => (totals.get(r.value) ?? 0) > 0)
    .sort((a, b) => (totals.get(b.value) ?? 0) - (totals.get(a.value) ?? 0))
})
const groups = computed(() => {
  const out: { label: string; span: number }[] = []
  for (const c of columns.value) {
    const last = out[out.length - 1]
    if (last && last.label === (c.group ?? '')) last.span++
    else out.push({ label: c.group ?? '', span: 1 })
  }
  return out.some((g) => g.label) ? out : []
})
const template = computed(
  () => `24px minmax(150px, 1fr) ${columns.value.map((c) => c.width ?? '64px').join(' ')}`
)
const minWidth = computed(
  () => 24 + 170 + columns.value.reduce((n, c) => n + Number.parseInt(c.width ?? '64') + 10, 0) + 28
)

/* ── Rows and sort ───────────────────────────────────────────── */
const defaultSort = (): Sort<string> =>
  props.view === 'patch'
    ? { key: 'move', dir: 'desc' }
    : props.view === 'early'
      ? { key: 'goldDiff10', dir: 'desc' }
      : props.view === 'firstblood'
        ? { key: 'involved', dir: 'desc' }
        : { key: 'win', dir: 'desc' }
const sort = shallowRef<Sort<string>>(defaultSort())
watch(
  () => props.view,
  () => (sort.value = defaultSort())
)
const sorted = computed(() => {
  const col = columns.value.find((c) => c.key === sort.value.key) ?? columns.value[0]
  const list = props.rows.filter((r) => r.games >= sample.value)
  return sortRows(list, col.value, sort.value.dir)
})
function by(key: string) {
  const was = sort.value
  afterPaint(() => {
    sort.value = { key, dir: was.key === key && was.dir === 'desc' ? 'asc' : 'desc' }
  })
}

/* ── Items ───────────────────────────────────────────────────── */
const itemSort = shallowRef<Sort<'games' | 'win'>>({ key: 'games', dir: 'desc' })
const items = computed(() =>
  sortRows(
    props.items ?? [],
    (i) => (itemSort.value.key === 'win' ? i.wins / i.games : i.games),
    itemSort.value.dir
  )
)
function byItem(key: 'games' | 'win') {
  const was = itemSort.value
  afterPaint(
    () => (itemSort.value = { key, dir: was.key === key && was.dir === 'desc' ? 'asc' : 'desc' })
  )
}

/* ── CSV ─────────────────────────────────────────────────────── */
function csv() {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const lines =
    props.view === 'items'
      ? [
          ['Item', 'Games bought in', 'Buy rate', 'Win rate'],
          ...items.value.map((i) => [
            i.name ?? String(i.item),
            String(i.games),
            pct(i.games / (props.roleGames || 1)),
            pct(i.wins / i.games),
          ]),
        ]
      : [
          ['Champion', ...columns.value.map((c) => (c.group ? `${c.group}: ${c.label}` : c.label))],
          ...sorted.value.map((r) => [
            name(r.champion),
            ...columns.value.map((c) =>
              c.key === 'tier' ? (r.tier === null ? '' : TIERS[r.tier]) : c.text(r)
            ),
          ]),
        ]
  const blob = new Blob([lines.map((l) => l.map(esc).join(',')).join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `invade-${props.view}-${role.value.slug}-${patch.value}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

const title = computed(
  () => (page.props.social as { title?: string } | undefined)?.title ?? TITLES[props.view]
)
const crumbs = computed(() =>
  props.view === 'overview'
    ? [{ label: 'Stats', href: '/stats' }, { label: 'Champion stats' }]
    : [{ label: 'Stats', href: '/stats' }, { label: TITLES[props.view] }]
)
</script>

<template>
  <Head :title="title" />
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <main class="nb nb-page flex-1">
      <Crumbs :items="crumbs">
        <template v-if="filter" #end>
          <DataLine :updated-at="updatedAt" :now="now" />
        </template>
      </Crumbs>

      <div class="nb-title">
        <div>
          <h1>{{ TITLES[view] }}</h1>
          <p class="nb-meta num">
            {{ role.label
            }}<template v-if="filter"
              >, patch {{ filter.patch }}, {{ bracketOf(rank).label }},
              {{ thousands(games ?? 0) }} games</template
            >
          </p>
        </div>
        <div class="end">
          <button type="button" class="iv-btn" :disabled="!rows.length" @click="csv">
            <Download :size="14" aria-hidden="true" />CSV
          </button>
        </div>
      </div>

      <nav class="nb-sections" aria-label="Views" style="position: static; margin-bottom: 4px">
        <Link
          v-for="v in VIEWS"
          :key="v.id"
          :href="href({ view: v.id })"
          :class="{ on: view === v.id }"
          :aria-current="view === v.id ? 'page' : undefined"
          preserve-scroll
          prefetch="hover"
          >{{ v.label }}</Link
        >
      </nav>

      <div class="nb-filters">
        <nav class="nb-seg" aria-label="Role">
          <Link
            v-for="r in ROLES"
            :key="r.position"
            :href="href({ role: r.slug })"
            :class="{ on: r.position === position }"
            :aria-current="r.position === position ? 'page' : undefined"
            preserve-scroll
            prefetch="hover"
            ><RoleIcon :lane="r.lane" :size="13" />{{ r.label }}</Link
          >
        </nav>
        <div class="end">
          <Select
            v-model="rankModel"
            :options="rankOptions"
            label="Rank"
            width="13rem"
            align="right"
          />
          <Select
            v-if="view !== 'regions'"
            v-model="regionModel"
            :options="regionOptions"
            label="Region"
            width="12rem"
            align="right"
          />
          <Select
            v-if="patchOptions.length"
            v-model="patchModel"
            :options="patchOptions"
            label="Patch"
            width="12rem"
            align="right"
          />
          <Select
            v-if="view !== 'items'"
            v-model="sample"
            :options="SAMPLES"
            label="Sample"
            width="12rem"
            align="right"
          />
        </div>
      </div>

      <p v-if="!rows.length" class="nb-panel nb-empty">
        Not enough games for this role with these filters yet.
      </p>
      <p v-else-if="view === 'patch' && !previousPatch" class="nb-panel nb-empty">
        No earlier patch has enough games to compare with {{ patch }} yet.
      </p>

      <!-- Items: one row per finished item -->
      <section
        v-else-if="view === 'items'"
        class="nb-panel nb-table"
        role="table"
        :aria-label="`Items bought in ${role.label.toLowerCase()}`"
      >
        <div class="nb-tr th it-cols" role="row">
          <span role="columnheader">#</span>
          <span role="columnheader">Item</span>
          <span role="columnheader" class="r" :aria-sort="ariaSort(itemSort, 'games')"
            ><SortHead
              label="Bought in"
              title="Share of the role's games that bought it"
              :active="itemSort.key === 'games'"
              :dir="itemSort.dir"
              @sort="byItem('games')"
          /></span>
          <span role="columnheader" class="hm" />
          <span role="columnheader" class="r hm">Games</span>
          <span role="columnheader" class="r" :aria-sort="ariaSort(itemSort, 'win')"
            ><SortHead
              label="Win rate"
              :active="itemSort.key === 'win'"
              :dir="itemSort.dir"
              @sort="byItem('win')"
          /></span>
        </div>
        <p v-if="!items.length" class="nb-empty">No item data for this patch yet.</p>
        <div v-for="(i, k) in items" :key="i.item" class="nb-tr it-cols" role="row">
          <span class="rk num" role="cell">{{ k + 1 }}</span>
          <span class="c" role="cell"
            ><GameImg kind="item" :id="i.item" :size="24" :name="i.name" /><b>{{
              i.name ?? i.item
            }}</b></span
          >
          <span class="r num" role="cell">{{ pct(i.games / (roleGames || 1)) }}</span>
          <span class="hm" role="cell"
            ><span class="nb-bar"
              ><i
                :style="{ width: `${Math.min(100, (i.games / (roleGames || 1)) * 100)}%` }" /></span
          ></span>
          <span class="r num hm" role="cell">{{ thousands(i.games) }}</span>
          <span class="r b num" role="cell">{{ pct(i.wins / i.games) }}</span>
        </div>
      </section>

      <!-- Every other view: one row per champion -->
      <section v-else class="nb-panel nb-scroll" :aria-label="`${TITLES[view]}, ${role.label}`">
        <div
          class="nb-table st-table"
          role="table"
          :style="{ 'minWidth': `${minWidth}px`, '--st-cols': template }"
        >
          <div v-if="groups.length" class="st-grp nb-tr th" role="row">
            <span class="pin e" role="columnheader" />
            <span
              v-for="(g, i) in groups"
              :key="i"
              role="columnheader"
              :class="{ e: !g.label }"
              :style="{ gridColumn: `span ${g.span}` }"
              >{{ g.label }}</span
            >
          </div>
          <div class="nb-tr th" role="row">
            <span class="pin" role="columnheader"> <span>#</span><span>Champion</span> </span>
            <span
              v-for="c in columns"
              :key="c.key"
              role="columnheader"
              :class="{ r: c.key !== 'tier' }"
              :aria-sort="ariaSort(sort, c.key)"
            >
              <SortHead
                :label="c.label"
                :title="c.title"
                :active="sort.key === c.key"
                :dir="sort.dir"
                @sort="by(c.key)"
              />
            </span>
          </div>
          <div v-for="(r, i) in sorted" :key="r.champion" class="nb-tr link" role="row">
            <span class="pin" role="cell">
              <span class="rk num">{{ i + 1 }}</span>
              <span class="c"
                ><span class="pic"><ChampIcon :id="r.champion" :size="26" /></span
                ><Link :href="champHref(r.champion)" class="stretch" prefetch="hover"
                  ><b>{{ name(r.champion) }}</b></Link
                ></span
              >
            </span>
            <span
              v-for="c in columns"
              :key="c.key"
              role="cell"
              class="num"
              :class="[c.key === 'tier' ? '' : 'r', c.cls?.(r)]"
            >
              <TierMark v-if="c.key === 'tier'" :tier="r.tier" /><template v-else>{{
                c.text(r)
              }}</template>
            </span>
          </div>
        </div>
      </section>

      <p v-if="filter && rows.length" class="nb-data">
        <template v-if="view === 'overview' || view === 'early'"
          >Gold and CS against the opposing {{ role.label.toLowerCase() }}.
        </template>
        <DataLine
          :games="games"
          :bracket="filter.bracket"
          :region="filter.region"
          :patch="filter.patch"
        />
      </p>
    </main>
    <SiteFooter />
  </div>
</template>
