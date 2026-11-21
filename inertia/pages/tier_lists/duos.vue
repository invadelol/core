<script setup lang="ts">
import { computed, ref } from 'vue'
import { Deferred, Head, Link, usePage } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import '../../css/tier-lists.css'
import SiteLayout from '../../components/SiteLayout.vue'
import Masthead from '../../components/ui/Masthead.vue'
import CardHead from '../../components/ui/CardHead.vue'
import Icon from '../../components/ui/Icon.vue'
import TierChip from '../../components/ui/TierChip.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import Skeleton from '../../components/ui/Skeleton.vue'
import SortHead from '../../components/ui/SortHead.vue'
import { useSort } from '../../components/ui/sort.js'
import StatFilters from '../../components/champions/StatFilters.vue'
import MovedCard, { type Moved } from '../../components/champions/MovedCard.vue'
import Fig from '../../components/champions/Fig.vue'
import SinceCell from '../../components/champions/SinceCell.vue'
import Computing from '../../components/champions/Computing.vue'
import { BRACKETS, TIERS, champIconUrl } from '../../lib/champions.js'
import { patchName } from '../../lib/patches.js'
import { barWidth, movers, p1, sgn, thousands, withQuery } from '../../lib/tier_lists.js'
import {
  ROLE_PEOPLE,
  duoLane,
  duoRoles,
  duoTitle,
  type DuoLane,
  type DuoRole,
} from '../../lib/duos.js'

interface Row {
  a: number
  b: number
  games: number
  win: number
  synergy: number | null
  aWin: number | null
  bWin: number | null
  share: number
  tier: number
  delta: number | null
}
interface List {
  computing?: boolean
  ahead?: number | null
  games: number
  rows: Row[]
  grid: { a: number[]; b: number[]; cells: ({ win: number; games: number } | null)[][] }
  minGames: number
  minCellGames: number
  patch: string
  previousPatch: string | null
  champions: { id: number; name: string; slug: string }[]
}

const props = defineProps<{
  list?: List | null
  lane: DuoLane
  filter: { patch: string; bracket: string; region: string | null } | null
  patches: { patch: string; games: number }[]
}>()

/** The duo's two roles, the one the list is read from first. */
const roles = computed(() => duoRoles(props.lane))
const L = computed(() => {
  const [a, b] = roles.value
  return { title: duoTitle(props.lane), a: ROLE_PEOPLE[a], b: ROLE_PEOPLE[b], pa: a, pb: b }
})
/**
 * The filter: the role the list is read from, then the one it is played with, each a glyph. A
 * first role that is the partner's swaps the two.
 */
const ROLE_LIST = [
  { slug: 'top', lane: 'TOP', label: 'Top' },
  { slug: 'jungle', lane: 'JUNGLE', label: 'Jungle' },
  { slug: 'mid', lane: 'MID', label: 'Mid' },
  { slug: 'bot', lane: 'ADC', label: 'Bot' },
  { slug: 'support', lane: 'SUPPORT', label: 'Support' },
] as const
const page = usePage()
const laneHref = (a: DuoRole, b: DuoRole) => {
  const lane = duoLane(a, b)
  return withQuery(page.url, { lane: lane === 'bot' ? null : lane })
}
const firstHref = (r: DuoRole) =>
  laneHref(r, r === roles.value[1] ? roles.value[0] : roles.value[1])
const ready = computed(() => (props.list && !props.list.computing ? props.list : null))
const rankText = computed(() => {
  const b = BRACKETS.find((x) => x.value === props.filter?.bracket)
  if (!b || b.value === 'all') return 'every rank'
  return b.label.endsWith('+') ? `${b.label.slice(0, -1)} and above` : b.label
})
const metaLine = computed(() =>
  props.filter
    ? `Patch ${patchName(props.filter.patch)}, ${rankText.value}${ready.value ? `, ${ready.value.rows.length} pairs played together at least ${thousands(ready.value.minGames)} times` : ''}`
    : 'No ranked games stored yet'
)
const champs = computed(() => new Map((ready.value?.champions ?? []).map((c) => [c.id, c])))
const nm = (id: number) => champs.value.get(id)?.name ?? ''
const champHref = (id: number, role: string) => {
  const c = champs.value.get(id)
  return c ? `/champions/${c.slug}?role=${role}` : '#'
}

/* ── Filters ─────────────────────────────────────────────────── */
const query = ref('')
const nice = (n: number) => {
  const mag = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(n, 1))) - 1)
  return Math.ceil(n / mag) * mag
}
const hideUnder = computed(() => nice((ready.value?.minGames ?? 0) * 2.5))
const hideFew = ref(false)
const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  return (ready.value?.rows ?? []).filter(
    (r) =>
      (!hideFew.value || r.games >= hideUnder.value) &&
      (!q || nm(r.a).toLowerCase().includes(q) || nm(r.b).toLowerCase().includes(q))
  )
})

/* ── Win rate together ──────────────────────────────────────── */
const LO = 0.47
const HI = 0.56
const cellStyle = (win: number) => {
  const t = Math.max(0, Math.min(1, (win - LO) / (HI - LO)))
  return { background: `rgb(var(--v-rgb) / ${(0.05 + t * 0.5).toFixed(2)})` }
}
const isLow = (win: number) => (win - LO) / (HI - LO) < 0.35

/* ── Moved since the patch before ───────────────────────────── */
const moved = computed(() => {
  const m = movers(ready.value?.rows ?? [], (r) => r.delta)
  const toRow = ({ r, d }: { r: Row; d: number }): Moved & { a: number; b: number } => ({
    key: `${r.a}:${r.b}`,
    name: `${nm(r.a)} + ${nm(r.b)}`,
    d: d * 100,
    a: r.a,
    b: r.b,
  })
  return { up: m.up.map(toRow), down: m.down.map(toRow) }
})

/* ── Table ──────────────────────────────────────────────────── */
const FIRST = [6, 6, 5]
const all = ref(false)
const sort = useSort(shown, {
  name: (r) => `${nm(r.a)} ${nm(r.b)}`,
  win: (r) => r.win,
  synergy: (r) => r.synergy,
  share: (r) => r.share,
  games: (r) => r.games,
  since: (r) => r.delta,
}, { first: { name: 'asc' } })
const groups = computed(() => {
  if (sort.key) {
    const rows = all.value ? sort.rows : sort.rows.slice(0, FIRST.reduce((a, b) => a + b, 0))
    return [{ t: null as number | null, label: '', total: sort.rows.length, rows }]
  }
  return TIERS.map((label, t) => {
    const list = shown.value.filter((r) => r.tier === t).sort((a, b) => b.win - a.win)
    const rows = all.value ? list : list.slice(0, FIRST[t] ?? 0)
    return { t: t as number | null, label, total: list.length, rows }
  }).filter((g) => g.rows.length)
})
const hidden = computed(() => shown.value.length - groups.value.reduce((n, g) => n + g.rows.length, 0))
const synWidth = (s: number) => `${Math.min(50, (Math.abs(s * 100) / 6) * 50).toFixed(1)}%`
const shareMax = computed(() => Math.max(0.2, ...shown.value.map((r) => r.share)))
</script>

<template>
  <Head :title="L.title" />
  <SiteLayout>
    <div class="wrap">
      <Masthead
        :title="L.title"
        :crumbs="[{ label: 'Tier list', href: '/tier-list' }, { label: 'Duos' }]"
        :meta="metaLine"
      >
        <template #end>
          <StatFilters :filter="filter" :patches="patches" />
        </template>
        <div class="tx-filters">
          <div class="du-pick" role="group" aria-label="Duo">
            <nav class="seg role-seg role-seg-ic" aria-label="Role">
              <Link
                v-for="r in ROLE_LIST"
                :key="r.slug"
                :href="firstHref(r.slug)"
                :class="{ on: roles[0] === r.slug }"
                :aria-current="roles[0] === r.slug ? 'page' : undefined"
                :aria-label="r.label"
                :title="r.label"
                preserve-scroll
                ><RoleIcon :lane="r.lane" :size="18"
              /></Link>
            </nav>
            <span class="du-with">with</span>
            <nav class="seg role-seg role-seg-ic" aria-label="Played with">
              <template v-for="r in ROLE_LIST" :key="r.slug">
                <span v-if="r.slug === roles[0]" class="off" aria-hidden="true"
                  ><RoleIcon :lane="r.lane" :size="18"
                /></span>
                <Link
                  v-else
                  :href="laneHref(roles[0], r.slug)"
                  :class="{ on: roles[1] === r.slug }"
                  :aria-current="roles[1] === r.slug ? 'page' : undefined"
                  :aria-label="`With ${r.label.toLowerCase()}`"
                  :title="`With ${r.label.toLowerCase()}`"
                  preserve-scroll
                  ><RoleIcon :lane="r.lane" :size="18"
                /></Link>
              </template>
            </nav>
          </div>
          <label v-if="ready" class="chk" @click.prevent="hideFew = !hideFew">
            <span class="switch" :class="{ on: hideFew }" role="switch" :aria-checked="hideFew" />
            Hide pairs under {{ thousands(hideUnder) }} games
          </label>
          <label class="field tx-q">
            <Icon name="search" />
            <input v-model="query" type="text" placeholder="Filter champions" aria-label="Filter champions" />
          </label>
        </div>
      </Masthead>

      <Deferred data="list">
        <template #fallback>
          <article class="card computing"><Skeleton :rows="8" pic /></article>
        </template>
        <Computing v-if="list?.computing" :ahead="list.ahead" />
        <EmptyState
          v-else-if="!ready || !ready.rows.length"
          title="No pairs for this filter"
          line="Too few games are stored for this patch, rank and region. A wider rank or every region has more."
        />
        <template v-else>
          <section class="g12" style="align-items: stretch">
            <article class="card du-grid" style="grid-column: span 8">
              <CardHead title="Win rate together" icon="grid" :meta="`The eight most played ${L.a.many} and ${L.b.many}`" />
              <div class="du-mx" :style="{ gridTemplateColumns: `132px repeat(${ready.grid.b.length}, minmax(0, 1fr))` }">
                <span />
                <Link v-for="b in ready.grid.b" :key="`h${b}`" class="ch" :href="champHref(b, L.pb)"
                  ><span class="fr xs"><img :src="champIconUrl(b)" alt="" /></span><span class="ell">{{ nm(b) }}</span></Link
                >
                <template v-for="(a, i) in ready.grid.a" :key="`r${a}`">
                  <Link class="rh" :href="champHref(a, L.pa)"
                    ><span class="fr xs"><img :src="champIconUrl(a)" alt="" /></span><span class="ell">{{ nm(a) }}</span></Link
                  >
                  <template v-for="(c, j) in ready.grid.cells[i]" :key="`c${a}:${j}`">
                    <span v-if="c" class="c" :class="{ lo: isLow(c.win) }" :style="cellStyle(c.win)" :title="`${thousands(c.games)} games`">{{ p1(c.win) }}</span>
                    <span v-else class="c na">&#8211;</span>
                  </template>
                </template>
              </div>
              <div class="du-key">
                <span>{{ Math.round(LO * 100) }}%</span>
                <span class="g"><i v-for="t in [0, 0.25, 0.5, 0.75, 1]" :key="t" :style="{ background: `rgb(var(--v-rgb) / ${(0.05 + t * 0.5).toFixed(2)})` }" /></span>
                <span>{{ Math.round(HI * 100) }}%</span>
                <span style="margin-left: auto">A dash: under {{ thousands(ready.minCellGames) }} games together</span>
              </div>
            </article>
            <MovedCard
              style="grid-column: span 4"
              :title="ready.previousPatch ? `Moved since ${patchName(ready.previousPatch)}` : 'Moved since last patch'"
              meta="Win rate together"
              :up="moved.up"
              :down="moved.down"
              row-class="tx-mv du-mv"
            >
              <template #face="{ m }">
                <span class="du-two"
                  ><span class="fr xs"><img :src="champIconUrl((m as any).a)" alt="" /></span
                  ><span class="fr xs"><img :src="champIconUrl((m as any).b)" alt="" /></span
                ></span>
              </template>
            </MovedCard>
          </section>

          <section class="sec" style="padding-top: 24px">
            <article class="card" style="overflow: hidden">
              <div class="tx-head du-head">
                <SortHead :sorter="sort" col="name" label="Duo" />
                <SortHead :sorter="sort" col="win" label="Win rate" class="c" />
                <SortHead :sorter="sort" col="synergy" label="Synergy" class="c" />
                <SortHead :sorter="sort" col="share" :label="`Of the ${L.a.one}’s duo games`" class="c" />
                <SortHead :sorter="sort" col="games" label="Games" class="c" />
                <SortHead
                  :sorter="sort"
                  col="since"
                  class="c"
                  :label="ready.previousPatch ? `Since ${patchName(ready.previousPatch)}` : 'Since'"
                  title="Win rate change since the patch before"
                />
              </div>
              <template v-for="g in groups" :key="g.t ?? 'sorted'">
                <div v-if="g.t !== null" class="tx-grp">
                  <TierChip :tier="g.t" large />
                  <span class="h4">{{ g.label }} tier</span>
                  <span class="meta">{{ g.rows.length === g.total ? `${g.total} duo${g.total === 1 ? '' : 's'}` : `Showing ${g.rows.length} of ${g.total}` }}</span>
                </div>
                <div v-for="r in g.rows" :key="`${r.a}:${r.b}`" class="tx-row du-row">
                  <div class="tx-name">
                    <TierChip v-if="g.t === null" :tier="r.tier" class="tx-tc" />
                    <span class="du-pair"
                      ><Link class="fr s" :href="champHref(r.a, L.pa)"><img :src="champIconUrl(r.a)" alt="" loading="lazy" /></Link
                      ><Link class="fr s" :href="champHref(r.b, L.pb)"><img :src="champIconUrl(r.b)" alt="" loading="lazy" /></Link
                    ></span>
                    <div class="col">
                      <span class="h4 ell">{{ nm(r.a) }} and {{ nm(r.b) }}</span>
                      <span class="meta ell"
                        >{{ nm(r.a) }} {{ p1(r.aWin) }}%<i class="tx-dot" />{{ nm(r.b) }} {{ p1(r.bWin) }}% overall</span
                      >
                    </div>
                  </div>
                  <Fig :value="p1(r.win)" :width="barWidth(r.win, 0.44, 0.56)" big mid class="c" />
                  <div class="du-syn c">
                    <template v-if="r.synergy !== null">
                      <span class="fg-xs" :class="r.synergy > 0 ? 'vi' : 't3'">{{ sgn(r.synergy * 100) }}<span class="u">pts</span></span>
                      <span class="tk"
                        ><i
                          :class="{ dn: r.synergy < 0 }"
                          :style="r.synergy > 0 ? { left: '50%', width: synWidth(r.synergy) } : { right: '50%', width: synWidth(r.synergy) }"
                      /></span>
                    </template>
                    <span v-else class="fg-xs t3">&#8211;</span>
                  </div>
                  <Fig :value="p1(r.share)" :width="barWidth(r.share, 0, shareMax)" class="c" />
                  <span class="fg-xs t2 c">{{ thousands(r.games) }}</span>
                  <SinceCell :d="r.delta === null ? null : r.delta * 100" class="c" />
                </div>
              </template>
              <div class="tx-foot">
                <span class="meta"
                  >Synergy is the win rate together minus the average of both champions’ win rates in their role, every
                  partner. Pairs with {{ thousands(ready.minGames) }} games or more; a dash in Since: under
                  {{ thousands(ready.minCellGames) }} games on the patch before.</span
                >
                <button v-if="hidden > 0" class="btn sm" type="button" @click="all = true">
                  Show {{ hidden }} more duos<Icon name="chev" />
                </button>
              </div>
            </article>
          </section>
        </template>
      </Deferred>
    </div>
  </SiteLayout>
</template>
