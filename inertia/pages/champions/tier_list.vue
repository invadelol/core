<script setup lang="ts">
import { computed, nextTick, ref, shallowRef } from 'vue'
import { Head, Link, router, usePage } from '@inertiajs/vue3'
import { Search } from 'lucide-vue-next'
import { ChampIcon, Icon, RoleIcon } from '@invadelol/ui'
import AppHeader from '../../components/AppHeader.vue'
import SiteFooter from '../../components/SiteFooter.vue'
import Crumbs from '../../components/champions/Crumbs.vue'
import SortHead from '../../components/champions/SortHead.vue'
import TierPlot from '../../components/champions/TierPlot.vue'
import Select from '../../components/ui/Select.vue'
import {
  BRACKETS,
  REGIONS,
  ROLES,
  TIERS,
  bracketOf,
  filterQuery,
  roleOf,
  type Filter,
} from '../../lib/champions.js'
import { ariaSort, pct, sortRows, thousands, type Sort } from '../../lib/board.js'
import { afterPaint } from '../../lib/after_paint.js'
import { patchName } from '../../lib/patch.js'
import '../../css/champions.css'
import '../../css/rd-discover.css'

interface Row {
  champion: number
  games: number
  win: number
  pick: number
  ban: number
  roleShare: number
  tier: number | null
  rank: number | null
}

/**
 * `/tier-list?role=bot`: one role's champions ranked. The field of win rate against pick rate,
 * who climbed and fell since the patch before, the board by tier, and the numbers: every
 * champion with its trend over two weeks and the lane opponents it does worst against.
 */
const props = defineProps<{
  champions: { id: number; name: string; slug: string }[]
  rows: Row[]
  previousRanks: Record<string, number> | null
  previousPatch: string | null
  ranked: Record<string, number> | null
  games: number
  position: string
  patches: { patch: string; games: number }[]
  filter: Filter | null
  /** Deferred: each champion's daily win rate over the last two weeks. */
  trends?: { days: string[]; lines: Record<string, (number | null)[]> } | null
  /** Deferred: each champion's worst lane opponents. */
  counters?: Record<string, number[]> | null
}>()

/** A champion counts as played in the role from this share of its games ("Main role only"). */
const MAIN_SHARE = 0.25
/** Rows of the numbers before "Show all". */
const FIRST_ROWS = 12

const page = usePage()
const latest = computed(() => props.patches[0]?.patch)
const rank = computed(() => props.filter?.bracket ?? 'emerald_plus')
const patch = computed(() => props.filter?.patch ?? latest.value ?? '')
const role = computed(() => roleOf(props.position))
const byId = computed(() => new Map(props.champions.map((c) => [c.id, c])))
const mainOnly = ref(true)
const query = ref('')
const view = ref<'board' | 'table'>('board')
const allRows = ref(false)
type Key = 'rank' | 'win' | 'pick' | 'ban' | 'games' | 'roleShare' | 'moved'
const sort = shallowRef<Sort<Key>>({ key: 'rank', dir: 'asc' })

const moved = (r: Row) => {
  const was = props.previousRanks?.[r.champion]
  return was && r.rank ? was - r.rank : null
}
const listed = computed(() => {
  const q = query.value.trim().toLowerCase()
  return props.rows.filter(
    (r) =>
      (!mainOnly.value || r.roleShare >= MAIN_SHARE) &&
      (!q || (byId.value.get(r.champion)?.name ?? '').toLowerCase().includes(q))
  )
})
/** Each row's place in the list shown. */
const place = computed(() => new Map(listed.value.map((r, i) => [r.champion, i + 1])))
const sorted = computed(() => {
  const { key, dir } = sort.value
  if (key === 'rank') return dir === 'asc' ? listed.value : [...listed.value].reverse()
  return sortRows(listed.value, (r) => (key === 'moved' ? moved(r) : r[key]), dir)
})
/** The full table, grouped by tier as the board is. */
const groups = computed(() =>
  TIERS.map((label, tier) => {
    const list = sorted.value.filter((r) => r.tier === tier)
    const avg = list.length ? list.reduce((n, r) => n + r.win, 0) / list.length : 0
    return { label, tier, rows: list, avg }
  }).filter((g) => g.rows.length)
)
const board = computed(() =>
  TIERS.map((label, tier) => ({
    label,
    tier,
    rows: listed.value.filter((r) => r.tier === tier),
  })).filter((g) => g.rows.length)
)
const numbers = computed(() => (allRows.value ? sorted.value : sorted.value.slice(0, FIRST_ROWS)))

/** Places won and lost since the patch before, four each. */
const movers = computed(() => {
  const withMove = listed.value.flatMap((r) => {
    const m = moved(r)
    return m ? [{ r, m }] : []
  })
  return {
    up: withMove
      .filter((x) => x.m > 0)
      .sort((a, b) => b.m - a.m)
      .slice(0, 4),
    down: withMove
      .filter((x) => x.m < 0)
      .sort((a, b) => a.m - b.m)
      .slice(0, 4),
  }
})
const hasMoves = computed(() => movers.value.up.length + movers.value.down.length > 0)

const plotPoints = computed(() =>
  listed.value.map((r) => ({
    champion: r.champion,
    name: name(r.champion),
    href: champHref(r.champion),
    win: r.win,
    pick: r.pick,
    tier: r.tier,
  }))
)

function by(key: Key) {
  const was = sort.value
  afterPaint(() => {
    sort.value = {
      key,
      dir: was.key === key ? (was.dir === 'asc' ? 'desc' : 'asc') : key === 'rank' ? 'asc' : 'desc',
    }
  })
}

const tableTop = ref<HTMLElement>()
function openTable() {
  view.value = 'table'
  void nextTick(() => tableTop.value?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
}

const href = (c: { rank?: string; patch?: string; role?: string; region?: string | null }) =>
  `/tier-list${filterQuery(
    {
      role: c.role ?? role.value.slug,
      rank: c.rank ?? rank.value,
      patch: c.patch ?? patch.value,
      region: c.region === undefined ? props.filter?.region : c.region,
    },
    latest.value
  )}`
const champHref = (id: number) =>
  `/champions/${byId.value.get(id)?.slug ?? id}${filterQuery({ role: role.value.slug, rank: rank.value, patch: patch.value }, latest.value)}`
const name = (id: number) => byId.value.get(id)?.name ?? ''

const visit = (url: string) => router.visit(url, { preserveScroll: true })
/** Every rank group of the menus: the groups first, then one rank at a time. */
const RANK_FIRST = ['emerald_plus', 'diamond_plus', 'master_plus', 'all']
const rankOptions = [
  ...RANK_FIRST.map((v) => BRACKETS.find((b) => b.value === v)!),
  ...BRACKETS.filter((b) => !RANK_FIRST.includes(b.value)),
].map((b) => ({ value: b.value as string, label: b.label }))
const rankModel = computed({
  get: () => rank.value as string,
  set: (v: string) => visit(href({ rank: v })),
})
const regionModel = computed({
  get: () => props.filter?.region ?? '',
  set: (v: string) => visit(href({ region: v || null })),
})
const patchModel = computed({
  get: () => patch.value,
  set: (v: string) => visit(href({ patch: v })),
})
const regionOptions = REGIONS.map((r) => ({ value: r.value, label: r.label }))
const patchOptions = computed(() =>
  props.patches.map((p) => ({ value: p.patch, label: `Patch ${patchName(p.patch)}` }))
)
const RANK_TEXT: Record<string, string> = {
  all: 'all ranks',
  emerald_plus: 'Emerald and above',
  diamond_plus: 'Diamond and above',
  master_plus: 'Master and above',
}
const rankText = computed(() => RANK_TEXT[rank.value] ?? bracketOf(rank.value).label)
const regionText = computed(() =>
  props.filter?.region
    ? REGIONS.find((r) => r.value === props.filter!.region)?.label
    : 'all regions'
)
const LANES = new Set(['TOP', 'MIDDLE', 'BOTTOM'])
const heading = computed(
  () => `${role.value.label}${LANES.has(props.position) ? ' lane' : ''} tier list`
)
const title = computed(
  () =>
    (page.props.social as { title?: string } | undefined)?.title ?? `${role.value.label} tier list`
)
const tierClass = (tier: number | null) => (tier ? `t${Math.min(tier, 5)}` : '')
const moveText = (m: number | null) =>
  m === null ? '-' : m > 0 ? `▲ ${m}` : m < 0 ? `▼ ${-m}` : '='

/** A row's trend as a path in a 100 × 24 box: 47% to 56% win rate, the days with games. */
function spark(id: number) {
  const line = props.trends?.lines[id]
  if (!line || line.filter((v) => v !== null).length < 2) return null
  const n = line.length - 1
  const y = (v: number) => 22 - ((Math.min(0.56, Math.max(0.47, v)) - 0.47) / 0.09) * 20
  let d = ''
  line.forEach((v, i) => {
    if (v === null) return
    d += `${d ? 'L' : 'M'}${((i / n) * 100).toFixed(1)} ${y(v).toFixed(1)}`
  })
  return { d, mid: y(0.5).toFixed(1) }
}
const sparkText = (id: number) => {
  const line = props.trends?.lines[id]?.filter((v): v is number => v !== null) ?? []
  return line.length
    ? `Win rate over the last 14 days, from ${pct(line[0])} to ${pct(line[line.length - 1])}`
    : ''
}
</script>

<template>
  <Head :title="title" />
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <main id="main" class="page tl flex-1">
      <Crumbs :items="[{ label: 'Champions', href: '/champions' }, { label: 'Tier list' }]" />

      <div class="rd-ph tl-ph">
        <div>
          <h1>{{ heading }}</h1>
          <p class="num">
            <template v-if="filter">Patch {{ patchName(filter.patch) }}, </template
            ><b>{{ thousands(games) }} games</b> in {{ rankText }}, {{ regionText }}
          </p>
        </div>
        <div class="dv-sels dv-sel">
          <Select v-model="rankModel" :options="rankOptions" label="Rank" width="13rem" />
          <Select v-model="regionModel" :options="regionOptions" label="Region" width="12rem" />
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

      <div class="tl-ctrl">
        <nav class="rd-seg tl-roles" aria-label="Role">
          <Link
            v-for="r in ROLES"
            :key="r.position"
            :href="href({ role: r.slug })"
            :class="{ on: r.position === position }"
            :aria-current="r.position === position ? 'page' : undefined"
            preserve-scroll
            prefetch="hover"
            cache-for="30s"
            ><RoleIcon :lane="r.lane" :size="15" />{{ r.label
            }}<small v-if="ranked" class="num">{{ ranked[r.position] }}</small></Link
          >
        </nav>
        <span class="grow" />
        <label class="dv-check"><input v-model="mainOnly" type="checkbox" />Main role only</label>
        <label class="dv-find">
          <Search :size="15" aria-hidden="true" /><span class="dv-sr">Filter champions</span>
          <input v-model="query" type="search" placeholder="Filter champions" />
        </label>
      </div>

      <p v-if="!rows.length" class="rd-card dv-empty">
        Not enough games for this role with these filters yet.
      </p>
      <template v-else>
        <div class="tl-top" :class="{ solo: !hasMoves }">
          <section class="rd-card" aria-labelledby="tl-plot">
            <div class="rd-head">
              <h2 id="tl-plot">
                Strong or just popular<span class="rd-meta num"
                  >Win rate against pick rate, {{ listed.length }} champions</span
                >
              </h2>
              <span class="rd-tag v">Ringed: S+</span>
            </div>
            <TierPlot v-if="listed.length" :points="plotPoints" />
            <p v-else class="dv-empty">No champion matches “{{ query }}”.</p>
          </section>
          <section v-if="hasMoves" class="rd-card tl-moves" aria-labelledby="tl-since">
            <div class="rd-head">
              <h2 id="tl-since">
                Since {{ previousPatch ? patchName(previousPatch) : 'last patch' }}
              </h2>
            </div>
            <template v-for="side in ['up', 'down'] as const" :key="side">
              <div v-if="movers[side].length" class="mvh">
                {{ side === 'up' ? 'Climbing' : 'Falling' }}
              </div>
              <Link
                v-for="x in movers[side]"
                :key="x.r.champion"
                :href="champHref(x.r.champion)"
                class="mvr"
                prefetch="hover"
              >
                <span class="dv-pic"><ChampIcon :id="x.r.champion" :size="30" /></span>
                <span class="dv-who"
                  ><b>{{ name(x.r.champion) }}</b
                  ><small class="num"
                    >{{ x.r.rank! + x.m }} to {{ x.r.rank }}, {{ pct(x.r.win) }}</small
                  ></span
                >
                <span class="d num" :class="x.m > 0 ? 'rd-up' : 'rd-dn'"
                  >{{ moveText(x.m)
                  }}<span class="dv-sr">{{ x.m > 0 ? 'places up' : 'places down' }}</span></span
                >
              </Link>
            </template>
          </section>
        </div>

        <div ref="tableTop" class="tl-fil">
          <h2>All {{ listed.length }} {{ listed.length === 1 ? 'champion' : 'champions' }}</h2>
          <div class="rd-seg" role="group" aria-label="View">
            <button
              type="button"
              :class="{ on: view === 'board' }"
              :aria-pressed="view === 'board'"
              @click="view = 'board'"
            >
              Board
            </button>
            <button
              type="button"
              :class="{ on: view === 'table' }"
              :aria-pressed="view === 'table'"
              @click="view = 'table'"
            >
              Table
            </button>
          </div>
        </div>

        <!-- The board: each tier a row of portraits. -->
        <template v-if="view === 'board'">
          <section class="rd-card tl-board" :aria-label="`${role.label} champions by tier`">
            <p v-if="!board.length" class="dv-empty">No champion matches “{{ query }}”.</p>
            <div v-for="g in board" :key="g.tier" class="brow" :class="`t${g.tier}`">
              <span class="bt" :class="`t${g.tier}`">{{ g.label }}</span>
              <span class="bc">
                <Link
                  v-for="r in g.rows"
                  :key="r.champion"
                  :href="champHref(r.champion)"
                  :title="`${name(r.champion)}, ${pct(r.win)} win rate`"
                  prefetch="hover"
                  class="dv-pic"
                  ><ChampIcon
                    :id="r.champion"
                    :size="g.tier >= 4 ? 34 : 42"
                    :title="name(r.champion)"
                /></Link>
              </span>
            </div>
          </section>

          <div class="tl-fil">
            <h2>
              The numbers<span>Top {{ Math.min(FIRST_ROWS, listed.length) }} by tier</span>
            </h2>
            <button type="button" class="dv-more" @click="openTable">
              Open the full table<Icon name="right" :size="14" />
            </button>
          </div>
        </template>

        <!-- The numbers: the first rows under the board, every row grouped by tier in the table. -->
        <section class="rd-card dv-scroll" :aria-label="`${role.label} tier list`">
          <div class="dv-tb tl-tb" role="table" :aria-label="`${role.label} tier list`">
            <div class="dv-tr h tl-cols" role="row">
              <span role="columnheader" :aria-sort="ariaSort(sort, 'rank')"
                ><SortHead
                  label="#"
                  :active="sort.key === 'rank'"
                  :dir="sort.dir"
                  title="Place in the role"
                  @sort="by('rank')"
              /></span>
              <span role="columnheader">Champion</span>
              <span role="columnheader" :aria-sort="ariaSort(sort, 'win')"
                ><SortHead
                  label="Win rate"
                  :active="sort.key === 'win'"
                  :dir="sort.dir"
                  @sort="by('win')"
              /></span>
              <span role="columnheader" class="r" :aria-sort="ariaSort(sort, 'pick')"
                ><SortHead
                  label="Pick"
                  :active="sort.key === 'pick'"
                  :dir="sort.dir"
                  @sort="by('pick')"
              /></span>
              <span role="columnheader" class="r" :aria-sort="ariaSort(sort, 'ban')"
                ><SortHead
                  label="Ban"
                  :active="sort.key === 'ban'"
                  :dir="sort.dir"
                  @sort="by('ban')"
              /></span>
              <span role="columnheader" class="r" :aria-sort="ariaSort(sort, 'games')"
                ><SortHead
                  label="Games"
                  :active="sort.key === 'games'"
                  :dir="sort.dir"
                  @sort="by('games')"
              /></span>
              <span role="columnheader">Last 14 days</span>
              <span role="columnheader">Weak against</span>
              <span role="columnheader" class="r" :aria-sort="ariaSort(sort, 'moved')"
                ><SortHead
                  :label="previousPatch ? 'Change' : 'Move'"
                  :title="previousPatch ? `Places since ${patchName(previousPatch)}` : undefined"
                  :active="sort.key === 'moved'"
                  :dir="sort.dir"
                  @sort="by('moved')"
              /></span>
            </div>
            <div v-if="!listed.length" class="dv-empty">No champion matches “{{ query }}”.</div>
            <template
              v-for="g in view === 'table'
                ? groups
                : [{ tier: -1, label: '', rows: numbers, avg: 0 }]"
              :key="g.tier"
            >
              <div v-if="g.tier >= 0" class="dv-tr g tl-group" role="row">
                <span role="cell" class="tl-gk"
                  ><span class="rd-tier" :class="tierClass(g.tier)">{{ g.label }}</span
                  >{{ g.rows.length }} {{ g.rows.length === 1 ? 'champion' : 'champions' }}</span
                >
                <span role="cell" class="r num">Average win rate {{ pct(g.avg) }}</span>
              </div>
              <div v-for="r in g.rows" :key="r.champion" class="dv-tr tl-cols" role="row">
                <span class="idx num" role="cell">{{ place.get(r.champion) }}</span>
                <span class="dv-nm" role="cell"
                  ><span class="dv-pic"><ChampIcon :id="r.champion" :size="36" /></span
                  ><span
                    ><Link
                      :href="champHref(r.champion)"
                      class="dv-stretch"
                      prefetch="hover"
                      cache-for="30s"
                      >{{ name(r.champion) }}</Link
                    ><small class="num"
                      >{{ pct(r.roleShare, 0) }} of their games
                      {{ role.label.toLowerCase() }}</small
                    ></span
                  ><span v-if="r.tier !== null" class="rd-tier tl-key" :class="tierClass(r.tier)">{{
                    TIERS[r.tier]
                  }}</span></span
                >
                <span class="tl-wb" role="cell"
                  ><b class="num">{{ pct(r.win) }}</b
                  ><span class="rd-bar" :class="{ quiet: r.tier !== 0 }"
                    ><i
                      :style="{
                        width: `${Math.max(2, Math.min(100, ((r.win - 0.45) / 0.1) * 100))}%`,
                      }" /></span
                ></span>
                <span class="r num" role="cell">{{ pct(r.pick) }}</span>
                <span class="r num" role="cell">{{ pct(r.ban) }}</span>
                <span class="r num q" role="cell">{{ thousands(r.games) }}</span>
                <span class="tl-spark" role="cell">
                  <svg
                    v-if="spark(r.champion)"
                    viewBox="0 0 100 24"
                    preserveAspectRatio="none"
                    role="img"
                    :aria-label="sparkText(r.champion)"
                  >
                    <line
                      x1="0"
                      x2="100"
                      :y1="spark(r.champion)!.mid"
                      :y2="spark(r.champion)!.mid"
                      class="ref"
                      vector-effect="non-scaling-stroke"
                    />
                    <path :d="spark(r.champion)!.d" class="ln" vector-effect="non-scaling-stroke" />
                  </svg>
                  <span v-else-if="trends !== undefined" class="q">-</span>
                  <span v-else class="tl-wait" aria-hidden="true" />
                </span>
                <span class="tl-cps" role="cell">
                  <template v-if="counters?.[r.champion]?.length">
                    <ChampIcon
                      v-for="o in counters[r.champion]"
                      :key="o"
                      :id="o"
                      :size="26"
                      :title="name(o) || undefined"
                    />
                  </template>
                  <span v-else-if="counters !== undefined" class="q">-</span>
                  <span v-else class="tl-wait" aria-hidden="true" />
                </span>
                <span
                  class="r num tl-mv"
                  role="cell"
                  :class="moved(r) ? (moved(r)! > 0 ? 'rd-up' : 'rd-dn') : 'rd-flat'"
                  >{{ moveText(moved(r))
                  }}<span v-if="moved(r)" class="dv-sr">{{
                    moved(r)! > 0 ? 'places up' : 'places down'
                  }}</span></span
                >
              </div>
            </template>
          </div>
          <div v-if="view === 'board' && !allRows && listed.length > FIRST_ROWS" class="tl-all">
            <button type="button" class="iv-btn" @click="openTable">
              Show all {{ listed.length }}
            </button>
          </div>
        </section>
      </template>
    </main>
    <SiteFooter />
  </div>
</template>

<style scoped>
.tl :deep(.nb-crumbs) {
  min-height: 52px;
}

.tl-ph {
  padding-top: 8px;
}

.tl-ctrl {
  position: sticky;
  top: 60px;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
  margin-bottom: 6px;
  padding: 0 0 12px;
  background: linear-gradient(180deg, var(--ink-1) 75%, transparent);
}

.tl-ctrl .grow {
  flex: 1;
}

.tl-roles :deep(svg) {
  flex: none;
}

.tl-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 16px;
  align-items: start;
}

.tl-top.solo {
  grid-template-columns: minmax(0, 1fr);
}

.tl-top h2 {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
}

.mvh {
  padding: 10px 16px 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}

.mvh:not(:nth-child(2)) {
  margin-top: 4px;
  padding-top: 12px;
  box-shadow: inset 0 1px 0 var(--rd-line);
}

.mvr {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  padding: 0 16px;
}

.mvr + .mvr {
  box-shadow: inset 0 1px 0 var(--rd-line);
}

.mvr:hover {
  background: var(--surface-1);
}

.mvr .dv-who b {
  font-size: 13px;
}

.mvr .dv-who small {
  font-size: 11px;
}

.mvr .d {
  font-size: 13px;
  font-weight: 650;
  text-align: right;
}

.tl-fil {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 28px 0 12px;
  scroll-margin-top: 130px;
}

.tl-fil h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  color: var(--text-1);
}

.tl-fil h2 span {
  margin-left: 8px;
  font-size: 13px;
  font-weight: 400;
  color: var(--text-3);
}

.tl-fil button.dv-more {
  background: none;
  border: 0;
  cursor: pointer;
}

/* The board: a tier key down the left, its champions across. */
.brow {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  min-height: 68px;
}

.brow + .brow {
  box-shadow: inset 0 1px 0 var(--rd-line);
}

.bt {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  font-stretch: 92%;
}

.bt.t0 {
  color: #fff;
  background: var(--rd-violet);
}

.bt.t1 {
  color: var(--text-1);
  background: color-mix(in srgb, var(--rd-violet) 30%, transparent);
}

.bt.t2 {
  color: var(--rd-violet-hi);
  background: var(--rd-violet-a);
}

.bt.t3 {
  color: var(--text-2);
  background: var(--surface-2);
}

.bt.t4 {
  color: var(--text-3);
  background: var(--surface-1);
}

.bt.t5 {
  color: var(--text-4);
}

.bc {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 12px 14px;
}

.bc .dv-pic {
  border-radius: 8px;
  transition: transform var(--t-fast) var(--ease);
}

.bc .dv-pic:hover {
  transform: translateY(-2px);
}

.bc .dv-pic:focus-visible {
  box-shadow: var(--focus);
}

.brow.t4 .bc .dv-pic,
.brow.t5 .bc .dv-pic {
  opacity: 0.75;
}

/* The numbers. */
.tl-tb {
  min-width: 1000px;
}

.tl-cols {
  grid-template-columns:
    28px minmax(200px, 1.4fr) 150px 60px 60px 76px minmax(90px, 104px)
    108px 64px;
  gap: 16px;
}

.tl-cols :deep(button) {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font: inherit;
  color: inherit;
}

.tl-cols .idx {
  font-weight: 600;
  color: var(--text-4);
}

.tl-cols .q {
  color: var(--text-3);
}

.tl-cols .dv-pic {
  border-radius: 8px;
}

.tl-key {
  margin-left: auto;
}

.tl-wb {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tl-wb b {
  width: 48px;
}

.tl-wb .rd-bar {
  flex: 1;
}

.tl-spark svg {
  display: block;
  width: 100%;
  height: 24px;
  overflow: visible;
}

.tl-spark .ref {
  stroke: var(--rd-track);
  stroke-dasharray: 2 3;
}

.tl-spark .ln {
  fill: none;
  stroke: var(--rd-violet-hi);
  stroke-width: 1.5;
  stroke-linejoin: round;
}

.tl-cps {
  display: flex;
  gap: 4px;
}

.tl-cps :deep(.iv-champ),
.tl-cps > :deep(*) {
  border-radius: 6px;
}

.tl-wait {
  display: block;
  width: 70%;
  height: 8px;
  border-radius: 4px;
  background: var(--surface-2);
}

.tl-mv {
  font-weight: 600;
}

.tl-group {
  grid-template-columns: minmax(0, 1fr) auto;
}

.tl-gk {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tl-all {
  display: flex;
  justify-content: center;
  padding: 14px;
  box-shadow: inset 0 1px 0 var(--rd-line);
}

@media (max-width: 62.5rem) {
  .tl-top {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 47.99rem) {
  .tl-ctrl {
    position: static;
  }

  .tl-roles {
    max-width: 100%;
    overflow-x: auto;
  }

  .tl-roles small {
    display: none;
  }

  .dv-find {
    width: 100%;
  }
}
</style>
