<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowRef,
  watch,
} from 'vue'
import { Head, Link, router, usePage } from '@inertiajs/vue3'
import { ChevronRight } from 'lucide-vue-next'
import { ChampIcon, RoleIcon, TrendLine } from '@invadelol/ui'
import AppHeader from '../../components/AppHeader.vue'
import SiteFooter from '../../components/SiteFooter.vue'
import Crumbs from '../../components/champions/Crumbs.vue'
import TierMark from '../../components/champions/TierMark.vue'
import GameImg from '../../components/champions/GameImg.vue'
import RuneTree from '../../components/champions/RuneTree.vue'
import LineChart from '../../components/champions/LineChart.vue'
import Logo from '../../components/champions/Logo.vue'
import Crest from '../../components/champions/Crest.vue'
import ProPhoto from '../../components/champions/ProPhoto.vue'
import ShareButton from '../../components/champions/ShareButton.vue'
import SortHead from '../../components/champions/SortHead.vue'
import DataLine from '../../components/champions/DataLine.vue'
import Select from '../../components/ui/Select.vue'
import { nameOf } from '../../lib/assets.js'
import {
  BRACKETS,
  RANK_GROUPS,
  REGIONS,
  ROLES,
  TIERS,
  filterQuery,
  roleOf,
  type BuildStats,
  type ChampionEntry,
  type ChampionTab,
  type Filter,
  type Matchup,
  type ProGame,
  type ProTag,
  type RoleStat,
  type RuneStats,
  type RuneTrees,
  type Skills,
  type SpellStats,
  type Teammates,
} from '../../lib/champions.js'
import {
  ago,
  ariaSort,
  clock,
  gapClass,
  pct,
  points,
  short,
  signed,
  sortRows,
  thousands,
  type Sort,
} from '../../lib/board.js'
import { afterPaint } from '../../lib/after_paint.js'
import { patchName } from '../../lib/patch.js'
import '../../css/champions.css'
import '../../css/rd-discover.css'
import '../../css/rd-discover-champion.css'

type Labels = Record<'item' | 'rune' | 'spell', Record<string, string>>
interface Early {
  minute: number
  games: number
  cs: number
  gold: number
  xp: number
  csDiff: number
  goldDiff: number
  xpDiff: number
  ahead: number
  aheadWin: number | null
  behindWin: number | null
}
interface Profile {
  length: { minutes: number; games: number; win: number }[]
  averages: {
    games: number
    kills: number
    deaths: number
    assists: number
    kda: number
    csPerMin: number
    gold: number
    damage: number
    vision: number
    length: number
  } | null
}
interface Details {
  games: number
  damageTaken: number
  damageToTurrets: number
  damageToObjectives: number
  wardsPlaced: number
  wardsCleared: number
  controlWards: number
  level: number
  jungleMonsters: number
  damageSplit: { physical: number; magic: number; true: number }
}
interface FirstBlood {
  games: number
  kill: number
  assist: number
  victim: number
  involvedWin: number | null
}
type Trend = { day: string; games: number; win: number | null; pick: number; ban: number }[]
type ByRank = {
  group: string
  games: number
  win: number | null
  pick: number
  tier: number | null
}[]
type ProGames = {
  games: (ProGame & { league: { slug: string; code: string; name: string } | null })[]
  players: { pro: ProTag; games: number; wins: number }[]
}

/** `/champions/:slug`: one champion in one role, every section on one page. */
const props = defineProps<{
  champion: ChampionEntry
  section: ChampionTab | null
  position: string
  main: string | null
  roles: { position: string; games: number; roleShare: number }[]
  stat: RoleStat | null
  before: { win: number; pick: number; rank: number | null } | null
  previousPatch: string | null
  ranked: number
  games: number
  patches: { patch: string; games: number }[]
  filter: Filter | null
  data: Record<string, any> | null
  labels: Labels | null
  names: Record<number, [string, string]>
  updatedAt?: number | null
  now?: number
  build?: BuildStats | null
  runes?: RuneStats | null
  spells?: SpellStats | null
  skills?: Skills | null
  matchups?: Matchup[] | null
  teammates?: Teammates | null
  trees?: RuneTrees | null
  profile?: Profile | null
  trend?: Trend | null
  early?: Early[] | null
  firstBlood?: FirstBlood | null
  byRank?: ByRank | null
  details?: Details | null
  pros?: ProGames | null
}>()

type Block =
  | 'build'
  | 'runes'
  | 'spells'
  | 'skills'
  | 'matchups'
  | 'teammates'
  | 'trees'
  | 'profile'
  | 'trend'
  | 'early'
  | 'firstBlood'
  | 'byRank'
  | 'details'
  | 'pros'
/** A block: sent with the page, arrived since, or still on its way (undefined). */
const block = (key: Block): any =>
  props.data && key in props.data ? props.data[key] : (props as Record<string, any>)[key]
/** Whether a block is still on its way: its panel holds its place meanwhile. */
const waiting = (...keys: Block[]) => !!props.filter && keys.some((k) => block(k) === undefined)

const build = computed(() => block('build') as BuildStats | null | undefined)
const runes = computed(() => block('runes') as RuneStats | null | undefined)
const spells = computed(() => block('spells') as SpellStats | null | undefined)
const skills = computed(() => block('skills') as Skills | null | undefined)
const trees = computed(() => block('trees') as RuneTrees | null | undefined)
const matchups = computed(() => (block('matchups') ?? []) as Matchup[])
const teammates = computed(() => block('teammates') as Teammates | null | undefined)
const profile = computed(() => block('profile') as Profile | null | undefined)
const trend = computed(() => (block('trend') ?? []) as Trend)
const early = computed(() => (block('early') ?? []) as Early[])
const firstBlood = computed(() => block('firstBlood') as FirstBlood | null | undefined)
const byRank = computed(() => (block('byRank') ?? []) as ByRank)
const details = computed(() => block('details') as Details | null | undefined)
const pros = computed(() => block('pros') as ProGames | null | undefined)

const page = usePage()
const latest = computed(() => props.patches[0]?.patch)
const role = computed(() => roleOf(props.position))
const rank = computed(() => props.filter?.bracket ?? 'emerald_plus')
const patch = computed(() => props.filter?.patch ?? latest.value ?? '')
const canonical = computed(
  () => (page.props.social as { canonical?: string } | undefined)?.canonical ?? ''
)

const champName = (id: number) => props.names[id]?.[0] ?? nameOf('champion', id) ?? ''
const champSlug = (id: number) => props.names[id]?.[1] ?? String(id)
const label = (kind: 'item' | 'rune' | 'spell', id: number) =>
  props.labels?.[kind]?.[id] ?? nameOf(kind, id) ?? ''

function href(
  change: { role?: string; rank?: string; patch?: string; region?: string | null } = {}
) {
  const q = filterQuery(
    {
      role: change.role ?? role.value.slug,
      rank: change.rank ?? rank.value,
      patch: change.patch ?? patch.value,
      region: change.region === undefined ? props.filter?.region : change.region,
    },
    latest.value
  )
  return `/champions/${props.champion.slug}${q}`
}
const championHref = (id: number, position?: string) =>
  `/champions/${champSlug(id)}${filterQuery({ role: position ? roleOf(position).slug : undefined, rank: rank.value, patch: patch.value }, latest.value)}`
const tierHref = computed(() => `/tier-list?role=${role.value.slug}`)

/* ── Filters ─────────────────────────────────────────────────── */
const roleChoices = computed(() =>
  [...props.roles]
    .sort((a, b) => b.games - a.games)
    .map((r) => ({
      position: r.position,
      meta: roleOf(r.position),
      share: pct(r.roleShare, 0),
      on: r.position === props.position,
    }))
)
const visit = (url: string) => router.visit(url, { preserveScroll: true })
const rankModel = computed({ get: () => rank.value, set: (v: string) => visit(href({ rank: v })) })
const patchModel = computed({
  get: () => patch.value,
  set: (v: string) => visit(href({ patch: v })),
})
const regionModel = computed({
  get: () => props.filter?.region ?? '',
  set: (v: string) => visit(href({ region: v || null })),
})
const rankOptions = BRACKETS.map((b) => ({ value: b.value, label: b.label }))
const patchOptions = computed(() =>
  props.patches.map((p) => ({ value: p.patch, label: `Patch ${patchName(p.patch)}` }))
)
const regionOptions = REGIONS.map((r) => ({ value: r.value, label: r.label }))

/* ── Identity ────────────────────────────────────────────────── */
const classes = computed(() =>
  props.champion.roles.map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')
)
const moved = computed(() =>
  props.stat?.rank && props.before?.rank ? props.before.rank - props.stat.rank : null
)
const share = computed(() => props.roles.find((r) => r.position === props.position)?.roleShare)
const tierClass = (tier: number | null | undefined) => (tier ? `t${Math.min(tier, 5)}` : '')
/** Blue up, red down: a change read for the champion. */
const deltaClass = (x: number) => (Math.abs(x) < 0.0005 ? 'rd-flat' : x > 0 ? 'rd-up' : 'rd-dn')
const ordinal = (n: number) => {
  const t = n % 100
  const s = t >= 11 && t <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')
  return `${n}${s}`
}
/** The tier box's two lines: "Best top pick", "1st of 67, up from 2nd". */
const tierTitle = computed(() => {
  const r = role.value.label.toLowerCase()
  if (!props.stat?.rank) return `Not ranked in ${r}`
  return props.stat.rank === 1
    ? `Best ${r} pick`
    : `${TIERS[props.stat.tier ?? 5] ?? ''} tier ${r} pick`
})
const tierLine = computed(() => {
  const rk = props.stat?.rank
  if (!rk) return props.stat ? `${thousands(props.stat.games)} games` : ''
  const of = props.ranked ? ` of ${props.ranked}` : ''
  const was = props.before?.rank
  const from = was && was !== rk ? `, ${was > rk ? 'up' : 'down'} from ${ordinal(was)}` : ''
  return `${ordinal(rk)}${of}${from}`
})

/* ── Build ───────────────────────────────────────────────────── */
const starter = computed(() => build.value?.starters[0] ?? null)
const boots = computed(() => build.value?.boots ?? [])
const core = computed(() => build.value?.cores[0] ?? null)
const otherCores = computed(() => build.value?.cores.slice(1, 5) ?? [])
const SLOT = ['Fourth', 'Fifth', 'Sixth']

/* ── Runes ───────────────────────────────────────────────────── */
const topPage = computed(() => runes.value?.pages[0] ?? null)
const secondary = computed(() => {
  const map = new Map<number, { games: number; wins: number }>()
  for (const p of runes.value?.pages ?? []) {
    const s = map.get(p.page.secondaryStyle) ?? { games: 0, wins: 0 }
    s.games += p.games
    s.wins += p.games * p.win
    map.set(p.page.secondaryStyle, s)
  }
  const total = [...map.values()].reduce((n, s) => n + s.games, 0)
  return [...map]
    .map(([style, s]) => ({ style, games: s.games, win: s.wins / s.games, share: s.games / total }))
    .sort((a, b) => b.games - a.games)
})
const styleName = (id: number) => trees.value?.styles[id]?.name ?? nameOf('runeStyle', id) ?? ''

/* ── Skills ──────────────────────────────────────────────────── */
const order = computed(() => skills.value?.orders[0] ?? null)
const KEYS = ['Q', 'W', 'E', 'R'] as const

/* ── Matchups ────────────────────────────────────────────────── */
const ownWin = computed(() => props.stat?.win ?? 0.5)
/** Opponents with enough games to be compared: 2 % of the champion's games, 30 at least. */
const reliable = computed(() => {
  const total = matchups.value.reduce((n, m) => n + m.games, 0)
  return matchups.value.filter((m) => m.games >= Math.max(30, total * 0.02))
})
const matchTab = ref<'hard' | 'easy'>('hard')
const matchList = computed(() =>
  [...reliable.value]
    .sort((a, b) => (matchTab.value === 'hard' ? a.win - b.win : b.win - a.win))
    .slice(0, 6)
)
const at10 = computed(() => early.value.find((e) => e.minute === 10) ?? null)
const at15 = computed(() => early.value.find((e) => e.minute === 15) ?? null)
/** The best teammate in each other role, among those with enough games together. */
const mates = computed(() =>
  ROLES.filter((r) => r.position !== props.position).flatMap((r) => {
    const list = (teammates.value?.[r.position as keyof Teammates] ?? []).filter(
      (m) => m.games >= 30
    )
    const best = [...list].sort((a, b) => b.win - a.win)[0]
    return best ? [{ ...best, position: r.position }] : []
  })
)
const matchSort = shallowRef<Sort<'games' | 'win' | 'gap' | 'name'>>({ key: 'games', dir: 'desc' })
const opponents = computed(() => {
  const list = matchups.value.filter((m) => m.games >= 10)
  const { key, dir } = matchSort.value
  return sortRows(
    list,
    (m) => (key === 'name' ? champName(m.champion) : key === 'gap' ? m.win - ownWin.value : m[key]),
    dir
  )
})
function sortMatchups(key: 'games' | 'win' | 'gap' | 'name') {
  const was = matchSort.value
  afterPaint(() => {
    matchSort.value = {
      key,
      dir: was.key === key ? (was.dir === 'asc' ? 'desc' : 'asc') : key === 'name' ? 'asc' : 'desc',
    }
  })
}

/* ── Items ───────────────────────────────────────────────────── */
const itemSort = shallowRef<Sort<'share' | 'win' | 'games'>>({ key: 'share', dir: 'desc' })
const everyItem = computed(() =>
  sortRows(build.value?.items ?? [], (o) => o[itemSort.value.key], itemSort.value.dir)
)
function sortItems(key: 'share' | 'win' | 'games') {
  const was = itemSort.value
  afterPaint(() => {
    itemSort.value = { key, dir: was.key === key && was.dir === 'desc' ? 'asc' : 'desc' }
  })
}

/* ── Statistics ──────────────────────────────────────────────── */
const length = computed(() => profile.value?.length ?? [])
const averages = computed(() => profile.value?.averages ?? null)
const peak = computed(() => {
  const l = length.value
  if (!l.length) return null
  return [...l].sort((a, b) => b.win - a.win)[0]
})
const dayLabel = (d?: string) =>
  d
    ? new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : ''

/* ── Pros ────────────────────────────────────────────────────── */
const proGames = computed(() => pros.value?.games ?? [])
const proRows = ref(8)
const proCore = computed(() => {
  const counts = new Map<number, number>()
  for (const g of proGames.value)
    for (const id of new Set(g.items)) if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
  const finished = new Set(build.value?.items.map((i) => i.item) ?? [])
  return [...counts]
    .filter(([id]) => !finished.size || finished.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
})
const now = ref(props.now ?? Date.now())
/** Long tables show their first rows until asked for all. */
const all = reactive({ items: false, pages: false, opponents: false })

/* ── Sections ────────────────────────────────────────────────── */
const SECTIONS = [
  { id: 'build', label: 'Build' },
  { id: 'items', label: 'Items' },
  { id: 'runes', label: 'Runes' },
  { id: 'matchups', label: 'Matchups' },
  { id: 'statistics', label: 'Statistics' },
  { id: 'pros', label: 'Pros' },
] as const
const current = ref<string>(props.section ?? 'build')
let spy: IntersectionObserver | null = null
/** An old tab address lands on its section, again once the blocks above it have arrived. */
let scrolled = false
const stop = () => (scrolled = true)
const land = () => {
  if (props.section && !scrolled) document.getElementById(props.section)?.scrollIntoView()
}
watch(
  () => [props.byRank, props.details, props.pros, props.matchups, props.build, props.runes],
  () => nextTick(land)
)
onMounted(() => {
  land()
  for (const e of ['wheel', 'touchstart', 'keydown'])
    addEventListener(e, stop, { once: true, passive: true })
  spy = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) current.value = e.target.id
    },
    { rootMargin: '-45% 0px -50% 0px' }
  )
  for (const s of SECTIONS) {
    const el = document.getElementById(s.id)
    if (el) spy.observe(el)
  }
})
onBeforeUnmount(() => {
  spy?.disconnect()
  for (const e of ['wheel', 'touchstart', 'keydown']) removeEventListener(e, stop)
})
</script>

<template>
  <Head
    :title="
      (page.props.social as { title?: string } | undefined)?.title ??
      `${champion.name} ${role.label.toLowerCase()} build`
    "
  />
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <main id="main" class="nb page cp flex-1">
      <Crumbs
        :back="{ label: `${role.label} tier list`, href: tierHref }"
        :items="[
          { label: 'Champions', href: '/champions' },
          { label: `${role.label} tier list`, href: tierHref },
          { label: champion.name },
        ]"
      >
        <template #end
          ><ShareButton :title="`${champion.name} ${role.label}`" :url="canonical"
        /></template>
      </Crumbs>

      <section class="cp-hero" :aria-label="champion.name">
        <img
          class="art"
          :src="`/cdn/centered/${champion.id}.jpg`"
          alt=""
          width="1280"
          height="720"
          decoding="async"
          fetchpriority="high"
        />
        <div class="top">
          <span class="face"
            ><ChampIcon :id="champion.id" :size="88" :title="champion.name"
          /></span>
          <div class="min-w-0">
            <h1>{{ champion.name }}</h1>
            <div class="sub">
              <span class="pill"><RoleIcon :lane="role.lane" :size="13" />{{ role.label }}</span
              ><span v-if="classes">{{ classes }}</span>
            </div>
            <div class="kit">
              <span v-for="k in ['p', 'q', 'w', 'e', 'r']" :key="k" class="ab"
                ><GameImg
                  kind="ability"
                  :id="`${champion.id}-${k}`"
                  :size="30"
                  :name="k === 'p' ? 'Passive' : k.toUpperCase()"
                  eager
                /><i aria-hidden="true">{{ k.toUpperCase() }}</i></span
              >
            </div>
          </div>
        </div>
        <div class="strip">
          <div class="st tierbox">
            <span class="tbig" :class="tierClass(stat?.tier)">{{
              stat?.tier !== null && stat?.tier !== undefined ? TIERS[stat.tier] : '-'
            }}</span>
            <span class="min-w-0"
              ><b>{{ tierTitle }}</b
              ><small class="num">{{ tierLine }}</small></span
            >
          </div>
          <div class="st">
            <span class="lbl">Win rate</span>
            <b class="rd-fig num">{{ pct(stat?.win) }}</b>
            <small class="num"
              ><template v-if="before && stat && previousPatch"
                ><span :class="deltaClass(stat.win - before.win)">{{
                  points(stat.win - before.win)
                }}</span>
                since {{ patchName(previousPatch) }}</template
              ><template v-else-if="stat">{{ thousands(stat.games) }} games</template></small
            >
          </div>
          <div class="st">
            <span class="lbl">Pick rate</span>
            <b class="rd-fig num">{{ pct(stat?.pick) }}</b>
            <small class="num"
              ><template v-if="before && stat && previousPatch"
                ><span :class="deltaClass(stat.pick - before.pick)">{{
                  points(stat.pick - before.pick)
                }}</span>
                since {{ patchName(previousPatch) }}</template
              ><template v-else>of {{ role.label.toLowerCase() }} games</template></small
            >
          </div>
          <div class="st">
            <span class="lbl">Ban rate</span>
            <b class="rd-fig num">{{ pct(stat?.ban) }}</b>
            <small>of games</small>
          </div>
          <div class="st">
            <span class="lbl">Games</span>
            <b class="rd-fig num">{{ stat ? thousands(stat.games) : '-' }}</b>
            <small v-if="share !== undefined" class="num"
              >{{ pct(share, 0) }} of {{ champion.name }} games</small
            >
          </div>
        </div>
      </section>

      <div class="cp-ctrl">
        <nav v-if="roleChoices.length" class="rd-seg cp-roles" aria-label="Role">
          <Link
            v-for="r in roleChoices"
            :key="r.position"
            :href="href({ role: r.meta.slug })"
            :class="{ on: r.on }"
            :aria-current="r.on ? 'page' : undefined"
            preserve-scroll
            prefetch="hover"
            cache-for="30s"
            ><RoleIcon :lane="r.meta.lane" :size="13" />{{ r.meta.label
            }}<small class="num">{{ r.share }}</small></Link
          >
        </nav>
        <nav class="rd-tabs cp-tabs" aria-label="Sections">
          <a
            v-for="s in SECTIONS"
            :key="s.id"
            :href="`#${s.id}`"
            :class="{ on: current === s.id }"
            :aria-current="current === s.id ? 'true' : undefined"
            >{{ s.label }}</a
          >
        </nav>
        <span class="grow" />
        <div class="dv-sels dv-sel">
          <Select
            v-model="rankModel"
            :options="rankOptions"
            label="Rank"
            width="13rem"
            align="right"
          />
          <Select
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
        </div>
      </div>

      <p v-if="!filter || !stat" class="nb-panel nb-empty">
        Not enough games for {{ champion.name }} {{ role.label.toLowerCase() }} with these filters
        yet.
      </p>

      <template v-else>
        <!-- Overview: the recommended build, then the matchups and the lane beside it. -->
        <div id="build" class="cp-main nb-sec" style="margin-top: 0">
          <div class="cp-col">
            <section class="rd-card rd-lit cp-rec" aria-labelledby="h-rec">
              <div class="rd-head">
                <h2 id="h-rec">
                  Recommended build<span v-if="build" class="rd-meta num"
                    >Most played core, {{ thousands(build.games) }} games</span
                  >
                </h2>
                <span v-if="core" class="cp-big num"
                  ><b class="rd-fig">{{ pct(core.win) }}</b
                  ><small>win rate</small></span
                >
              </div>
              <div class="cp-rec-in">
                <div class="half">
                  <div class="k">
                    <span>Runes</span
                    ><span v-if="topPage" class="rd-vio num"
                      >{{ pct(topPage.win) }} win, {{ pct(topPage.share, 0) }} of games</span
                    >
                  </div>
                  <template v-if="topPage">
                    <div class="ks">
                      <span class="ksi"
                        ><GameImg
                          kind="rune"
                          :id="topPage.page.keystone"
                          :size="56"
                          round
                          eager
                          :name="label('rune', topPage.page.keystone)"
                      /></span>
                      <span class="min-w-0"
                        ><b>{{ label('rune', topPage.page.keystone) }}</b
                        ><small
                          >{{ styleName(topPage.page.primaryStyle) }}, then
                          {{ styleName(topPage.page.secondaryStyle) }}</small
                        ></span
                      >
                    </div>
                    <div class="rp">
                      <GameImg
                        v-for="id in topPage.page.primary"
                        :key="id"
                        kind="rune"
                        :id="id"
                        :size="28"
                        round
                        :name="label('rune', id)"
                      />
                      <span class="gap" />
                      <GameImg
                        v-for="id in topPage.page.secondary"
                        :key="id"
                        kind="rune"
                        :id="id"
                        :size="28"
                        round
                        :name="label('rune', id)"
                      />
                      <span class="gap" />
                      <GameImg
                        v-for="(id, i) in topPage.page.shards"
                        :key="`s${i}`"
                        kind="rune"
                        :id="id"
                        :size="18"
                        round
                        :name="label('rune', id)"
                      />
                    </div>
                    <div class="kss">
                      <div v-for="k in runes!.keystones.slice(0, 3)" :key="k.keystone" class="rw">
                        <GameImg
                          kind="rune"
                          :id="k.keystone"
                          :size="22"
                          round
                          :name="label('rune', k.keystone)"
                        />
                        <span class="n">{{ label('rune', k.keystone) }}</span>
                        <span class="q num">{{ pct(k.share, 0) }}</span
                        ><b class="num">{{ pct(k.win) }}</b>
                      </div>
                    </div>
                  </template>
                  <span v-else-if="waiting('runes')" class="nb-skel" style="height: 190px" />
                  <p v-else class="dv-empty">Not enough games yet.</p>
                </div>
                <div class="half">
                  <div class="k">
                    <span>Spells and start</span
                    ><span v-if="spells && (spells as any).flashOnD !== undefined" class="q num"
                      >Flash on D {{ pct((spells as any).flashOnD, 0) }}</span
                    >
                  </div>
                  <div
                    v-for="p in spells?.pairs.slice(0, 2) ?? []"
                    :key="p.spells.join()"
                    class="rw"
                  >
                    <span class="i"
                      ><GameImg
                        v-for="s in p.spells"
                        :key="s"
                        kind="spell"
                        :id="s"
                        :size="30"
                        :name="label('spell', s)"
                    /></span>
                    <span class="n">{{ p.spells.map((s) => label('spell', s)).join(', ') }}</span>
                    <span class="q num">{{ pct(p.share, 0) }}</span
                    ><b class="num">{{ pct(p.win) }}</b>
                  </div>
                  <span
                    v-if="!spells?.pairs.length && waiting('spells')"
                    class="nb-skel"
                    style="height: 70px"
                  />
                  <div v-if="starter" class="rw">
                    <span class="i"
                      ><GameImg
                        v-for="(id, i) in starter.items"
                        :key="`s${i}`"
                        kind="item"
                        :id="id"
                        :size="30"
                        :name="label('item', id)"
                    /></span>
                    <span class="n">{{
                      starter.items.map((i) => label('item', i)).join(', ')
                    }}</span>
                    <span class="q num">{{ pct(starter.share, 0) }}</span
                    ><b class="num">{{ pct(starter.win) }}</b>
                  </div>
                  <div v-for="o in boots.slice(0, 2)" :key="o.items.join()" class="rw">
                    <span class="i"
                      ><GameImg
                        kind="item"
                        :id="o.items[0]"
                        :size="30"
                        :name="label('item', o.items[0])"
                    /></span>
                    <span class="n">{{ label('item', o.items[0]) }}</span>
                    <span class="q num">{{ pct(o.share, 0) }}</span
                    ><b class="num">{{ pct(o.win) }}</b>
                  </div>
                  <span v-if="!build && waiting('build')" class="nb-skel" style="height: 100px" />
                </div>
              </div>
              <div v-if="core" class="cp-core">
                <div class="k">
                  <span>Core, then</span
                  ><span class="rd-vio num">{{ pct(core.share, 0) }} of games build it</span>
                </div>
                <div class="row">
                  <span class="items">
                    <template v-for="(id, i) in core.items" :key="id">
                      <span v-if="i" class="ar" aria-hidden="true"
                        ><ChevronRight :size="14"
                      /></span>
                      <GameImg kind="item" :id="id" :size="48" :name="label('item', id)" eager />
                    </template>
                  </span>
                  <div v-for="(slot, i) in build!.slots.slice(0, 3)" :key="i" class="slot">
                    <span class="sk">{{ SLOT[i] }}</span>
                    <div v-for="o in slot.slice(0, 3)" :key="o.item" class="so">
                      <GameImg kind="item" :id="o.item" :size="26" :name="label('item', o.item)" />
                      <span class="num"
                        ><b>{{ pct(o.win) }}</b
                        ><small>{{ pct(o.share, 0) }}</small></span
                      >
                    </div>
                  </div>
                </div>
                <template v-if="otherCores.length">
                  <div class="k" style="margin-top: 18px">
                    <span>Other cores</span><span class="q">Share of games, win rate</span>
                  </div>
                  <div v-for="c in otherCores" :key="c.items.join()" class="rw">
                    <span class="i"
                      ><GameImg
                        v-for="id in c.items"
                        :key="id"
                        kind="item"
                        :id="id"
                        :size="26"
                        :name="label('item', id)"
                    /></span>
                    <span class="n quiet">{{
                      c.items.map((i) => label('item', i)).join(', ')
                    }}</span>
                    <span class="q num">{{ pct(c.share, 0) }}</span
                    ><b class="num">{{ pct(c.win) }}</b>
                  </div>
                </template>
                <a href="#items" class="dv-more cp-every"
                  >Every item<ChevronRight :size="13" aria-hidden="true"
                /></a>
              </div>
              <div v-else-if="waiting('build')" class="cp-core">
                <span class="nb-skel" style="height: 120px" />
              </div>
              <p v-else class="dv-empty">Not enough games with a full build yet.</p>
            </section>

            <section class="rd-card" aria-labelledby="h-skills">
              <div class="rd-head">
                <h2 id="h-skills">
                  Skill order<span v-if="skills?.max.length" class="rd-meta"
                    >Max {{ skills.max.join(', then ') }}</span
                  >
                </h2>
                <span v-if="order" class="rd-meta num"
                  >{{ pct(order.win) }} win, {{ pct(order.share, 0) }} of games</span
                >
              </div>
              <div v-if="order" class="cp-skills">
                <div
                  class="nb-skills"
                  role="table"
                  :aria-label="`Skill order of ${champion.name}`"
                  :style="{
                    gridTemplateColumns: `30px repeat(${order.order.length}, minmax(0, 1fr))`,
                  }"
                >
                  <template v-for="k in KEYS" :key="k">
                    <span class="l" role="rowheader"
                      ><GameImg
                        kind="ability"
                        :id="`${champion.id}-${k.toLowerCase()}`"
                        :size="22"
                        :name="k"
                    /></span>
                    <i
                      v-for="(o, i) in order.order"
                      :key="i"
                      :class="{ on: o === k, ult: o === k && k === 'R' }"
                      >{{ o === k ? i + 1 : '' }}</i
                    >
                  </template>
                </div>
              </div>
              <div v-else-if="waiting('skills')" class="cp-skills" aria-busy="true">
                <span class="nb-skel" style="height: 100px" />
              </div>
              <p v-else class="dv-empty">Not enough games with a skill order yet.</p>
            </section>
          </div>

          <aside class="cp-col">
            <section class="rd-card" aria-labelledby="h-mu">
              <div class="rd-head">
                <h2 id="h-mu">
                  Matchups<span class="rd-meta">{{ champion.name }}'s win rate</span>
                </h2>
              </div>
              <div class="cp-segrow">
                <span class="rd-seg" role="group" aria-label="Matchups">
                  <button
                    type="button"
                    :class="{ on: matchTab === 'hard' }"
                    :aria-pressed="matchTab === 'hard'"
                    @click="matchTab = 'hard'"
                  >
                    Hardest
                  </button>
                  <button
                    type="button"
                    :class="{ on: matchTab === 'easy' }"
                    :aria-pressed="matchTab === 'easy'"
                    @click="matchTab = 'easy'"
                  >
                    Easiest
                  </button>
                </span>
              </div>
              <template v-if="matchList.length">
                <Link
                  v-for="m in matchList"
                  :key="m.champion"
                  :href="championHref(m.champion, position)"
                  class="dv-row cp-row"
                  prefetch="hover"
                  cache-for="30s"
                >
                  <span class="dv-pic"><ChampIcon :id="m.champion" :size="30" /></span>
                  <span class="dv-who"
                    ><b>{{ champName(m.champion) }}</b
                    ><small class="num">{{ thousands(m.games) }} games</small></span
                  >
                  <span class="dv-val"
                    ><span class="rd-fig num" :class="deltaClass(m.win - ownWin)">{{
                      pct(m.win)
                    }}</span
                    ><small class="gp num">{{ points(m.win - ownWin) }}</small></span
                  >
                </Link>
              </template>
              <div v-else-if="waiting('matchups')" class="cp-pad" aria-busy="true">
                <span class="nb-skel" style="height: 250px" />
              </div>
              <p v-else class="dv-empty">Not enough games against one opponent yet.</p>
            </section>

            <section class="rd-card" aria-labelledby="h-mates">
              <div class="rd-head">
                <h2 id="h-mates">Best with</h2>
                <span class="rd-meta">Win rate together</span>
              </div>
              <template v-if="mates.length">
                <Link
                  v-for="m in mates"
                  :key="m.position"
                  :href="championHref(m.champion, m.position)"
                  class="dv-row cp-row"
                  prefetch="hover"
                  cache-for="30s"
                >
                  <span class="dv-pic"><ChampIcon :id="m.champion" :size="30" /></span>
                  <span class="dv-who"
                    ><b>{{ champName(m.champion) }}</b
                    ><small class="num"
                      >{{ roleOf(m.position).label }}, {{ thousands(m.games) }} games</small
                    ></span
                  >
                  <span class="dv-val"
                    ><span class="rd-fig num">{{ pct(m.win) }}</span></span
                  >
                </Link>
              </template>
              <div v-else-if="waiting('teammates')" class="cp-pad" aria-busy="true">
                <span class="nb-skel" style="height: 170px" />
              </div>
              <p v-else class="dv-empty">Not enough games together yet.</p>
            </section>

            <section class="rd-card" aria-labelledby="h-lane">
              <div class="rd-head">
                <h2 id="h-lane">Lane at 10 min</h2>
                <span class="rd-meta">Against the other {{ role.label.toLowerCase() }}</span>
              </div>
              <div v-if="at10" class="cp-kv">
                <div>
                  <span>Gold</span
                  ><b class="rd-fig num" :class="at10.goldDiff > 0 ? 'rd-gold' : ''">{{
                    signed(at10.goldDiff)
                  }}</b>
                </div>
                <div>
                  <span>Ahead in</span><b class="rd-fig num">{{ pct(at10.ahead, 0) }}</b>
                </div>
                <div>
                  <span>Then wins</span><b class="rd-fig num">{{ pct(at10.aheadWin) }}</b>
                </div>
              </div>
              <div v-else-if="waiting('early')" class="cp-pad" aria-busy="true">
                <span class="nb-skel" style="height: 40px" />
              </div>
              <p v-else class="dv-empty">Not enough games with a timeline yet.</p>
            </section>
          </aside>
        </div>

        <section class="nb-strip" style="margin-top: 12px" aria-label="Figures">
          <div class="nb-panel nb-tile">
            <div class="t">
              <span>Win rate</span
              ><span class="num">{{ trend.length ? `${trend.length} days` : '' }}</span>
            </div>
            <b class="f iv-fig num"
              >{{ pct(stat.win)
              }}<small v-if="before" :class="gapClass(stat.win - before.win)">{{
                points(stat.win - before.win)
              }}</small></b
            >
            <div class="chart">
              <TrendLine
                v-if="trend.length > 1"
                :values="trend.map((d) => (d.win ?? 0) * 100)"
                :height="30"
                area
                :span="4"
              />
            </div>
          </div>
          <div class="nb-panel nb-tile">
            <div class="t">
              <span>Pick rate</span
              ><span class="num">{{ trend.length ? `${trend.length} days` : '' }}</span>
            </div>
            <b class="f iv-fig num"
              >{{ pct(stat.pick)
              }}<small v-if="before" :class="gapClass(stat.pick - before.pick)">{{
                points(stat.pick - before.pick)
              }}</small></b
            >
            <div class="chart">
              <TrendLine
                v-if="trend.length > 1"
                :values="trend.map((d) => d.pick * 100)"
                :height="30"
                area
                :span="2"
              />
            </div>
          </div>
          <div class="nb-panel nb-tile">
            <div class="t">
              <span>Win by length</span
              ><span v-if="length.length" class="num"
                >{{ length[0].minutes }} to {{ length[length.length - 1].minutes + 5 }} min</span
              >
            </div>
            <b class="f iv-fig num"
              >{{ peak ? pct(peak.win) : '-'
              }}<small v-if="peak" class="q">at {{ peak.minutes }} min</small></b
            >
            <div class="chart">
              <TrendLine
                v-if="length.length > 1"
                :values="length.map((l) => l.win * 100)"
                :height="30"
                area
                :span="6"
              />
            </div>
          </div>
          <div class="nb-panel nb-tile">
            <div class="t">
              <span>Per game</span
              ><span v-if="averages" class="num">{{ clock(averages.length) }}</span>
            </div>
            <b class="f iv-fig num">{{
              averages ? `${averages.kills} / ${averages.deaths} / ${averages.assists}` : '-'
            }}</b>
            <div v-if="averages" class="foot num">
              {{ averages.csPerMin }} CS/min, {{ short(averages.damage) }} damage,
              {{ averages.vision }} vision
            </div>
          </div>
          <div class="nb-panel nb-tile">
            <div class="t"><span>Damage</span></div>
            <template v-if="details">
              <b class="f iv-fig num"
                >{{
                  pct(
                    Math.max(
                      details.damageSplit.physical,
                      details.damageSplit.magic,
                      details.damageSplit.true
                    ),
                    0
                  )
                }}
                {{
                  details.damageSplit.magic >= details.damageSplit.physical &&
                  details.damageSplit.magic >= details.damageSplit.true
                    ? 'magic'
                    : details.damageSplit.physical >= details.damageSplit.true
                      ? 'physical'
                      : 'true'
                }}</b
              >
              <div class="foot num">
                {{ pct(details.damageSplit.physical, 0) }} physical,
                {{ pct(details.damageSplit.magic, 0) }} magic,
                {{ pct(details.damageSplit.true, 0) }} true
              </div>
            </template>
            <span
              v-else-if="waiting('details')"
              class="nb-skel"
              style="height: 34px; margin-top: 8px"
            />
            <b v-else class="f iv-fig num">-</b>
          </div>
          <div class="nb-panel nb-tile">
            <div class="t"><span>First blood</span></div>
            <template v-if="firstBlood">
              <b class="f iv-fig num"
                >{{ pct(firstBlood.kill + firstBlood.assist) }}<small class="q">in on it</small></b
              >
              <div class="foot num">
                Wins <span>{{ pct(firstBlood.involvedWin) }}</span> of those games
              </div>
            </template>
            <span
              v-else-if="waiting('firstBlood')"
              class="nb-skel"
              style="height: 34px; margin-top: 8px"
            />
            <b v-else class="f iv-fig num">-</b>
          </div>
        </section>
        <p class="nb-data">
          <DataLine
            :games="stat.games"
            :bracket="filter.bracket"
            :region="filter.region"
            :patch="filter.patch"
            :updated-at="updatedAt"
            :now="now"
          />
        </p>

        <!-- Items -->
        <section id="items" class="nb-sec" aria-labelledby="h-items">
          <h2 id="h-items">
            Items<span class="nb-meta">What {{ champion.name }} buys and how those games end</span>
          </h2>
          <template v-if="build">
            <div class="nb-cols c3 stack">
              <section
                v-for="[title, list, isCore] in [
                  ['Starting items', build.starters, false],
                  ['Boots', build.boots, false],
                  ['Core builds', build.cores, true],
                ] as const"
                :key="title"
                class="nb-panel"
              >
                <div class="nb-ph">
                  <h3 class="nb-h3">{{ title }}</h3>
                </div>
                <div class="nb-pb rows">
                  <div
                    v-for="o in list.slice(0, 8)"
                    :key="o.items.join()"
                    class="nb-row"
                    :class="{ 'opacity-60': o.level < 1 }"
                  >
                    <span class="i">
                      <template
                        v-for="(id, i) in isCore ? o.items : [...new Set(o.items)].slice(0, 3)"
                        :key="i"
                        ><ChevronRight
                          v-if="isCore && i"
                          :size="10"
                          class="qq"
                          aria-hidden="true" /><GameImg
                          kind="item"
                          :id="id"
                          :size="24"
                          :name="label('item', id)"
                      /></template>
                    </span>
                    <span class="n"
                      >{{ isCore ? '' : label('item', o.items[0])
                      }}<small class="num">{{ thousands(o.games) }} games</small></span
                    >
                    <span class="v q num">{{ pct(o.share, 0) }}</span
                    ><span class="v num">{{ pct(o.win) }}</span>
                  </div>
                </div>
              </section>
            </div>
            <div class="nb-cols side" style="margin-top: 12px">
              <section class="nb-panel nb-table" role="table" aria-label="Every item">
                <div class="nb-ph">
                  <h3 class="nb-h3">Every item</h3>
                  <span class="nb-meta"
                    >Finished items, how often they are bought and how those games end</span
                  >
                </div>
                <div class="nb-tr th item-cols" role="row">
                  <span role="columnheader">Item</span>
                  <span role="columnheader" class="r" :aria-sort="ariaSort(itemSort, 'share')"
                    ><SortHead
                      label="Bought in"
                      :active="itemSort.key === 'share'"
                      :dir="itemSort.dir"
                      @sort="sortItems('share')"
                  /></span>
                  <span role="columnheader" class="hm" />
                  <span role="columnheader" class="r" :aria-sort="ariaSort(itemSort, 'win')"
                    ><SortHead
                      label="Win rate"
                      :active="itemSort.key === 'win'"
                      :dir="itemSort.dir"
                      @sort="sortItems('win')"
                  /></span>
                  <span role="columnheader" class="r hm" :aria-sort="ariaSort(itemSort, 'games')"
                    ><SortHead
                      label="Games"
                      :active="itemSort.key === 'games'"
                      :dir="itemSort.dir"
                      @sort="sortItems('games')"
                  /></span>
                </div>
                <div
                  v-for="o in everyItem.slice(0, all.items ? undefined : 12)"
                  :key="o.item"
                  class="nb-tr item-cols"
                  role="row"
                >
                  <span class="c" role="cell"
                    ><GameImg
                      kind="item"
                      :id="o.item"
                      :size="24"
                      :name="label('item', o.item)"
                    /><b>{{ label('item', o.item) }}</b></span
                  >
                  <span class="r num" role="cell">{{ pct(o.share, 0) }}</span>
                  <span class="hm" role="cell"
                    ><span class="nb-bar"><i :style="{ width: `${o.share * 100}%` }" /></span
                  ></span>
                  <span class="r b num" role="cell">{{ pct(o.win) }}</span>
                  <span class="r num hm" role="cell">{{ thousands(o.games) }}</span>
                </div>
                <div v-if="!all.items && everyItem.length > 12" class="nb-foot">
                  <button type="button" class="iv-btn sm" @click="all.items = true">
                    Show all {{ everyItem.length }} items
                  </button>
                </div>
              </section>
              <section class="nb-panel">
                <div class="nb-ph">
                  <h3 class="nb-h3">After the core</h3>
                  <span class="nb-meta">Most bought first</span>
                </div>
                <div class="nb-pb">
                  <div v-for="(slot, i) in build.slots" :key="i" style="margin-bottom: 8px">
                    <span class="nb-k">{{ SLOT[i] }} item</span>
                    <div v-for="o in slot.slice(0, 5)" :key="o.item" class="nb-slot">
                      <GameImg kind="item" :id="o.item" :size="24" :name="label('item', o.item)" />
                      <span class="n">{{ label('item', o.item) }}</span>
                      <span class="v num"
                        >{{ pct(o.win) }}<small>{{ pct(o.share, 0) }}</small></span
                      >
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </template>
          <span
            v-else-if="waiting('build')"
            class="nb-skel"
            style="height: 420px"
            aria-busy="true"
          />
          <p v-else class="nb-panel nb-empty">Not enough games yet.</p>
        </section>

        <!-- Runes -->
        <section id="runes" class="nb-sec" aria-labelledby="h-runes">
          <h2 id="h-runes">
            Runes<span v-if="runes" class="nb-meta num"
              >{{ runes.pages.length }} pages with enough games</span
            >
          </h2>
          <div v-if="runes?.pages.length && trees" class="nb-cols side">
            <div class="nb-stack">
              <section class="nb-panel">
                <div class="nb-ph">
                  <h3 class="nb-h3">Most played page</h3>
                  <span class="nb-meta"
                    >{{ label('rune', runes.pages[0].page.keystone) }} with
                    {{ styleName(runes.pages[0].page.secondaryStyle) }}</span
                  >
                </div>
                <div class="nb-pb">
                  <RuneTree :page="runes.pages[0].page" :trees="trees" big />
                  <div class="nb-kv" style="margin-top: 18px">
                    <div>
                      <span>Win rate</span><b class="iv-fig num">{{ pct(runes.pages[0].win) }}</b>
                    </div>
                    <div>
                      <span>Played</span
                      ><b class="iv-fig num">{{ pct(runes.pages[0].share, 0) }}</b>
                    </div>
                    <div>
                      <span>Games</span
                      ><b class="iv-fig num">{{ thousands(runes.pages[0].games) }}</b>
                    </div>
                  </div>
                </div>
              </section>
              <section class="nb-panel">
                <div class="nb-ph"><h3 class="nb-h3">Every page</h3></div>
                <div class="nb-pb rows">
                  <div
                    v-for="p in runes.pages.slice(0, all.pages ? undefined : 6)"
                    :key="JSON.stringify(p.page)"
                    class="nb-row"
                    style="min-height: 46px"
                  >
                    <span class="i"
                      ><GameImg
                        kind="rune"
                        :id="p.page.keystone"
                        :size="26"
                        round
                        :name="label('rune', p.page.keystone)" /><GameImg
                        kind="runeStyle"
                        :id="p.page.secondaryStyle"
                        :size="18"
                        :name="styleName(p.page.secondaryStyle)"
                    /></span>
                    <span class="n"
                      >{{ label('rune', p.page.keystone)
                      }}<small>{{
                        [...p.page.primary, ...p.page.secondary]
                          .map((r) => label('rune', r))
                          .join(', ')
                      }}</small></span
                    >
                    <span class="v q num">{{ pct(p.share, 0) }}</span
                    ><span class="v num">{{ pct(p.win) }}</span>
                  </div>
                </div>
                <div v-if="!all.pages && runes.pages.length > 6" class="nb-foot">
                  <button type="button" class="iv-btn sm" @click="all.pages = true">
                    Show all {{ runes.pages.length }} pages
                  </button>
                </div>
              </section>
            </div>
            <div class="nb-stack">
              <section class="nb-panel">
                <div class="nb-ph"><h3 class="nb-h3">Keystones</h3></div>
                <div class="nb-pb rows">
                  <div v-for="k in runes.keystones" :key="k.keystone" class="nb-row">
                    <GameImg
                      kind="rune"
                      :id="k.keystone"
                      :size="24"
                      round
                      :name="label('rune', k.keystone)"
                    />
                    <span class="n"
                      >{{ label('rune', k.keystone)
                      }}<small class="num">{{ thousands(k.games) }} games</small></span
                    >
                    <span class="v q num">{{ pct(k.share, 0) }}</span
                    ><span class="v num">{{ pct(k.win) }}</span>
                  </div>
                </div>
              </section>
              <section class="nb-panel">
                <div class="nb-ph"><h3 class="nb-h3">Secondary tree</h3></div>
                <div class="nb-pb rows">
                  <div v-for="s in secondary" :key="s.style" class="nb-row">
                    <GameImg kind="runeStyle" :id="s.style" :size="22" :name="styleName(s.style)" />
                    <span class="n"
                      >{{ styleName(s.style)
                      }}<small class="num">{{ thousands(s.games) }} games</small></span
                    >
                    <span class="v q num">{{ pct(s.share, 0) }}</span
                    ><span class="v num">{{ pct(s.win) }}</span>
                  </div>
                </div>
              </section>
            </div>
          </div>
          <span
            v-else-if="waiting('runes', 'trees')"
            class="nb-skel"
            style="height: 420px"
            aria-busy="true"
          />
          <p v-else class="nb-panel nb-empty">Not enough games yet.</p>
        </section>

        <!-- Matchups -->
        <section id="matchups" class="nb-sec" aria-labelledby="h-matchups">
          <h2 id="h-matchups">
            Matchups<span class="nb-meta"
              >{{ champion.name }}'s win rate against each
              {{ role.label.toLowerCase() }} laner</span
            >
          </h2>
          <div v-if="matchups.length" class="nb-cols side">
            <section class="nb-panel nb-table" role="table" aria-label="Lane opponents">
              <div class="nb-tr th mu-cols" role="row">
                <span role="columnheader" :aria-sort="ariaSort(matchSort, 'name')"
                  ><SortHead
                    label="Opponent"
                    :active="matchSort.key === 'name'"
                    :dir="matchSort.dir"
                    @sort="sortMatchups('name')"
                /></span>
                <span role="columnheader" class="r" :aria-sort="ariaSort(matchSort, 'games')"
                  ><SortHead
                    label="Games"
                    :active="matchSort.key === 'games'"
                    :dir="matchSort.dir"
                    @sort="sortMatchups('games')"
                /></span>
                <span role="columnheader" class="r hm" :aria-sort="ariaSort(matchSort, 'gap')"
                  ><SortHead
                    :label="`Against ${pct(ownWin)}`"
                    :active="matchSort.key === 'gap'"
                    :dir="matchSort.dir"
                    @sort="sortMatchups('gap')"
                /></span>
                <span role="columnheader" class="r" :aria-sort="ariaSort(matchSort, 'win')"
                  ><SortHead
                    label="Win rate"
                    :active="matchSort.key === 'win'"
                    :dir="matchSort.dir"
                    @sort="sortMatchups('win')"
                /></span>
              </div>
              <div
                v-for="m in opponents.slice(0, all.opponents ? undefined : 15)"
                :key="m.champion"
                class="nb-tr link mu-cols"
                :class="{ 'opacity-60': m.level < 1 }"
                role="row"
              >
                <span class="c" role="cell"
                  ><span class="pic"><ChampIcon :id="m.champion" :size="26" /></span
                  ><Link
                    :href="championHref(m.champion, position)"
                    class="stretch"
                    prefetch="hover"
                    cache-for="30s"
                    ><b>{{ champName(m.champion) }}</b></Link
                  ></span
                >
                <span class="r num" role="cell">{{ thousands(m.games) }}</span>
                <span class="r num hm" role="cell" :class="gapClass(m.win - ownWin)">{{
                  points(m.win - ownWin)
                }}</span>
                <span class="r b num" role="cell">{{ pct(m.win) }}</span>
              </div>
              <div v-if="!all.opponents && opponents.length > 15" class="nb-foot">
                <button type="button" class="iv-btn sm" @click="all.opponents = true">
                  Show all {{ opponents.length }} opponents
                </button>
              </div>
            </section>
            <div class="nb-stack">
              <section
                v-for="r in ROLES.filter((x) => x.position !== position)"
                :key="r.position"
                class="nb-panel"
              >
                <div class="nb-ph">
                  <h3 class="nb-h3">Best {{ r.label.toLowerCase() }}</h3>
                  <span class="end nb-meta">Win rate together</span>
                </div>
                <div class="nb-pb rows">
                  <Link
                    v-for="m in [...(teammates?.[r.position] ?? [])]
                      .filter((x) => x.games >= 30)
                      .sort((a, b) => b.win - a.win)
                      .slice(0, 5)"
                    :key="m.champion"
                    :href="championHref(m.champion, r.position)"
                    class="nb-row"
                    prefetch="hover"
                    cache-for="30s"
                  >
                    <span class="pic"><ChampIcon :id="m.champion" :size="24" /></span>
                    <span class="n"
                      >{{ champName(m.champion)
                      }}<small class="num">{{ thousands(m.games) }} games together</small></span
                    >
                    <span class="v num">{{ pct(m.win) }}</span>
                  </Link>
                </div>
              </section>
            </div>
          </div>
          <span
            v-else-if="waiting('matchups', 'teammates')"
            class="nb-skel"
            style="height: 420px"
            aria-busy="true"
          />
          <p v-else class="nb-panel nb-empty">Not enough games against one opponent yet.</p>
        </section>

        <!-- Statistics -->
        <section id="statistics" class="nb-sec" aria-labelledby="h-stats">
          <h2 id="h-stats">
            Statistics<span class="nb-meta num">Patch {{ patchName(patch) }}</span>
          </h2>
          <section class="nb-panel">
            <div class="nb-ph">
              <h3 class="nb-h3">By rank</h3>
              <span class="nb-meta">Tier, win rate and pick rate at each rank</span>
            </div>
            <div v-if="byRank.length" class="nb-pb nb-ranks">
              <div v-for="(r, i) in byRank" :key="r.group">
                <Crest :tier="RANK_GROUPS[i].crest" :size="28" />
                <span class="n">{{ RANK_GROUPS[i].label }}</span>
                <TierMark :tier="r.tier" />
                <span class="w num">{{ pct(r.win) }}</span>
                <small class="num"
                  >{{ pct(r.pick, 0) }} picked<br />{{ thousands(r.games) }} games</small
                >
              </div>
            </div>
            <div v-else-if="waiting('byRank')" class="nb-pb" aria-busy="true">
              <span class="nb-skel" style="height: 124px" />
            </div>
            <p v-else class="nb-empty">Not enough games yet.</p>
          </section>
          <div v-if="trend.length > 1" class="nb-cols c3" style="margin-top: 12px">
            <section
              v-for="[title, key, value] in [
                ['Win rate', 'win', stat.win],
                ['Pick rate', 'pick', stat.pick],
                ['Ban rate', 'ban', stat.ban],
              ] as const"
              :key="key"
              class="nb-panel"
            >
              <div class="nb-ph">
                <h3 class="nb-h3">{{ title }}</h3>
                <span class="nb-meta num">{{ trend.length }} days</span
                ><b class="end iv-fig num" style="font-size: 18px">{{ pct(value) }}</b>
              </div>
              <div class="nb-pb">
                <LineChart
                  :values="trend.map((d) => (d[key] ?? 0) as number)"
                  :labels="[dayLabel(trend[0]?.day), dayLabel(trend[trend.length - 1]?.day)]"
                  :height="90"
                />
              </div>
            </section>
          </div>
          <div class="nb-cols side" style="margin-top: 12px">
            <div class="nb-stack">
              <section v-if="length.length > 1" class="nb-panel">
                <div class="nb-ph"><h3 class="nb-h3">Win rate by game length</h3></div>
                <div class="nb-pb">
                  <LineChart
                    :values="length.map((l) => l.win)"
                    :labels="length.map((l, i) => `${l.minutes}${i === 0 ? ' min' : ''}`)"
                    :guides="[0.45, 0.5, 0.55]"
                    :bench="0.5"
                    :height="170"
                  />
                </div>
              </section>
              <section class="nb-panel">
                <div class="nb-ph">
                  <h3 class="nb-h3">Early game</h3>
                  <span class="nb-meta"
                    >Against the other {{ role.label.toLowerCase() }}, from games with a
                    timeline</span
                  >
                </div>
                <div v-if="at10 || at15" class="nb-table" role="table" aria-label="Early game">
                  <div class="nb-tr th early-cols" role="row">
                    <span role="columnheader">Minute</span
                    ><span role="columnheader" class="r">CS</span
                    ><span role="columnheader" class="r">Gold</span
                    ><span role="columnheader" class="r hm">XP</span
                    ><span role="columnheader" class="r">Ahead in gold</span
                    ><span role="columnheader" class="r hm">Win when ahead</span>
                  </div>
                  <div
                    v-for="e in [at10, at15].filter(Boolean) as Early[]"
                    :key="e.minute"
                    class="nb-tr early-cols"
                    role="row"
                  >
                    <span class="b num" role="cell">{{ e.minute }}:00</span>
                    <span class="r num" role="cell"
                      >{{ e.cs }}
                      <small :class="gapClass(e.csDiff)">{{ signed(e.csDiff, 1) }}</small></span
                    >
                    <span class="r num" role="cell"
                      >{{ thousands(e.gold) }}
                      <small :class="gapClass(e.goldDiff)">{{ signed(e.goldDiff) }}</small></span
                    >
                    <span class="r num hm" role="cell"
                      >{{ thousands(e.xp) }}
                      <small :class="gapClass(e.xpDiff)">{{ signed(e.xpDiff) }}</small></span
                    >
                    <span class="r num" role="cell">{{ pct(e.ahead, 0) }}</span>
                    <span class="r num hm" role="cell">{{ pct(e.aheadWin) }}</span>
                  </div>
                </div>
                <span
                  v-else-if="waiting('early')"
                  class="nb-skel"
                  style="height: 120px; margin: 12px 14px"
                />
                <p v-else class="nb-empty">Not enough games with a timeline yet.</p>
              </section>
            </div>
            <div class="nb-stack">
              <section class="nb-panel">
                <div class="nb-ph"><h3 class="nb-h3">Roles</h3></div>
                <div class="nb-pb rows">
                  <div
                    v-for="r in [...roles].sort((a, b) => b.roleShare - a.roleShare)"
                    :key="r.position"
                    class="nb-row"
                  >
                    <span style="display: inline-flex; width: 18px; color: var(--text-2)"
                      ><RoleIcon :lane="roleOf(r.position).lane" :size="15"
                    /></span>
                    <span class="n"
                      >{{ roleOf(r.position).label
                      }}<small class="num">{{ thousands(r.games) }} games</small></span
                    >
                    <span class="nb-bar" style="width: 90px"
                      ><i :style="{ width: `${r.roleShare * 100}%` }"
                    /></span>
                    <span class="v num">{{ pct(r.roleShare, 0) }}</span>
                  </div>
                </div>
              </section>
              <section v-if="averages" class="nb-panel">
                <div class="nb-ph">
                  <h3 class="nb-h3">Per game</h3>
                  <span class="end nb-meta num">{{ thousands(averages.games) }} games</span>
                </div>
                <div class="nb-pb nb-kv">
                  <div>
                    <span>KDA</span><b class="iv-fig num">{{ averages.kda }}</b>
                  </div>
                  <div>
                    <span>Kills</span><b class="iv-fig num">{{ averages.kills }}</b>
                  </div>
                  <div>
                    <span>Damage</span><b class="iv-fig num">{{ short(averages.damage) }}</b>
                  </div>
                  <div>
                    <span>CS a minute</span><b class="iv-fig num">{{ averages.csPerMin }}</b>
                  </div>
                  <div>
                    <span>Gold</span><b class="iv-fig num">{{ short(averages.gold) }}</b>
                  </div>
                  <div>
                    <span>Game length</span><b class="iv-fig num">{{ clock(averages.length) }}</b>
                  </div>
                </div>
              </section>
              <span
                v-if="waiting('details')"
                class="nb-skel"
                style="height: 176px"
                aria-busy="true"
              />
              <section v-else-if="details" class="nb-panel">
                <div class="nb-ph"><h3 class="nb-h3">More per game</h3></div>
                <div class="nb-pb nb-kv">
                  <div>
                    <span>Damage taken</span
                    ><b class="iv-fig num">{{ short(details.damageTaken) }}</b>
                  </div>
                  <div>
                    <span>To turrets</span
                    ><b class="iv-fig num">{{ short(details.damageToTurrets) }}</b>
                  </div>
                  <div>
                    <span>Wards placed</span><b class="iv-fig num">{{ details.wardsPlaced }}</b>
                  </div>
                  <div>
                    <span>Wards cleared</span><b class="iv-fig num">{{ details.wardsCleared }}</b>
                  </div>
                  <div>
                    <span>Control wards</span><b class="iv-fig num">{{ details.controlWards }}</b>
                  </div>
                  <div>
                    <span>Level</span><b class="iv-fig num">{{ details.level }}</b>
                  </div>
                </div>
              </section>
              <section v-if="firstBlood" class="nb-panel">
                <div class="nb-ph">
                  <h3 class="nb-h3">First blood</h3>
                  <span class="end nb-meta num">{{ thousands(firstBlood.games) }} games</span>
                </div>
                <div class="nb-pb nb-kv">
                  <div>
                    <span>Takes it</span><b class="iv-fig num">{{ pct(firstBlood.kill) }}</b>
                  </div>
                  <div>
                    <span>Helps</span><b class="iv-fig num">{{ pct(firstBlood.assist) }}</b>
                  </div>
                  <div>
                    <span>Gives it</span><b class="iv-fig num">{{ pct(firstBlood.victim) }}</b>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </section>

        <!-- Pros -->
        <section id="pros" class="nb-sec" aria-labelledby="h-pros">
          <h2 id="h-pros">
            Pros on {{ champion.name
            }}<span class="nb-meta">{{ role.label }}, ranked solo queue, last 14 days</span>
          </h2>
          <div v-if="proGames.length" class="nb-cols side">
            <section
              class="nb-panel nb-table"
              role="table"
              :aria-label="`Pro games on ${champion.name}`"
            >
              <div class="nb-tr th pro-cols" role="row">
                <span role="columnheader">Pro</span><span role="columnheader">Result</span
                ><span role="columnheader" class="r hm">KDA</span
                ><span role="columnheader" class="hm">Items</span
                ><span role="columnheader" class="hm">Against</span
                ><span role="columnheader" class="r">When</span>
              </div>
              <div
                v-for="g in proGames.slice(0, proRows)"
                :key="g.matchId"
                class="nb-tr pro-cols"
                role="row"
                style="min-height: 48px"
              >
                <span class="c" role="cell">
                  <ProPhoto :slug="g.pro?.slug" :photo="g.pro?.photo" :width="30" :height="30" />
                  <span class="min-w-0"
                    ><Link v-if="g.pro" :href="`/pro/${g.pro.slug}`"
                      ><b>{{ g.pro.name }}</b></Link
                    ><small>{{ g.pro?.team?.name ?? 'No team' }}</small></span
                  >
                  <Logo v-if="g.league" :league="g.league" :size="20" />
                </span>
                <span role="cell" :class="g.win ? 'up' : 'down'" style="font-weight: 600">{{
                  g.win ? 'Win' : 'Loss'
                }}</span>
                <span class="r b num hm" role="cell"
                  >{{ g.kills }} / {{ g.deaths }} / {{ g.assists }}</span
                >
                <span class="nb-icons hm" role="cell"
                  ><GameImg
                    v-for="(id, i) in g.items.filter(Boolean)"
                    :key="i"
                    kind="item"
                    :id="id"
                    :size="22"
                /></span>
                <span class="c hm" role="cell" style="gap: 8px; color: var(--text-2)"
                  ><template v-if="g.opponent"
                    ><ChampIcon :id="g.opponent" :size="22" /><Link
                      :href="championHref(g.opponent, position)"
                      class="t"
                      >{{ champName(g.opponent) }}</Link
                    ></template
                  ></span
                >
                <span class="r num q" role="cell">{{ ago(g.startMs, now) }}</span>
              </div>
              <div v-if="proGames.length > proRows" class="nb-foot">
                <button type="button" class="iv-btn sm" @click="proRows += 16">
                  Show {{ Math.min(16, proGames.length - proRows) }} more
                </button>
              </div>
            </section>
            <div class="nb-stack">
              <section class="nb-panel">
                <div class="nb-ph">
                  <h3 class="nb-h3">Most built by pros</h3>
                  <span class="end nb-meta">Games</span>
                </div>
                <div class="nb-pb rows">
                  <div v-for="[id, n] in proCore" :key="id" class="nb-row">
                    <GameImg kind="item" :id="id" :size="24" />
                    <span class="n">{{ label('item', id) }}</span
                    ><span class="v num">{{ n }}</span>
                  </div>
                </div>
              </section>
              <section class="nb-panel">
                <div class="nb-ph"><h3 class="nb-h3">Played by</h3></div>
                <div class="nb-pb rows">
                  <Link
                    v-for="p in pros!.players"
                    :key="p.pro.slug"
                    :href="`/pro/${p.pro.slug}`"
                    class="nb-row"
                    prefetch="hover"
                  >
                    <ProPhoto :slug="p.pro.slug" :photo="p.pro.photo" :width="26" :height="26" />
                    <span class="n"
                      >{{ p.pro.name }}<small>{{ p.pro.team?.name ?? 'No team' }}</small></span
                    >
                    <span class="v q num">{{ p.games }} games</span
                    ><span class="v num">{{ pct(p.wins / p.games, 0) }}</span>
                  </Link>
                </div>
              </section>
            </div>
          </div>
          <span
            v-else-if="waiting('pros')"
            class="nb-skel"
            style="height: 260px"
            aria-busy="true"
          />
          <p v-else class="nb-panel nb-empty">
            No pro has played {{ champion.name }} {{ role.label.toLowerCase() }} in ranked lately.
          </p>
        </section>
      </template>
    </main>
    <SiteFooter />
  </div>
</template>
