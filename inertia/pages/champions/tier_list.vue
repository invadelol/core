<script setup lang="ts">
import { computed, ref } from 'vue'
import { Deferred, Head, Link } from '@inertiajs/vue3'
import '../../css/tier-lists.css'
import SiteLayout from '../../components/SiteLayout.vue'
import Masthead from '../../components/ui/Masthead.vue'
import CardHead from '../../components/ui/CardHead.vue'
import Icon from '../../components/ui/Icon.vue'
import TierChip from '../../components/ui/TierChip.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import StatFilters from '../../components/champions/StatFilters.vue'
import RoleSeg from '../../components/champions/RoleSeg.vue'
import MovedCard, { type Moved } from '../../components/champions/MovedCard.vue'
import Fig from '../../components/champions/Fig.vue'
import { BRACKETS, TIERS, champIconUrl, roleOf } from '../../lib/champions.js'
import { patchName } from '../../lib/patches.js'
import { barWidth, movers, p1, sparkPaths, thousands } from '../../lib/tier_lists.js'

type Position = 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY'

interface Row {
  champion: number
  position: Position
  games: number
  win: number
  pick: number
  ban: number
  roleShare: number
  tier: number | null
  rank: number | null
  /** Its place in the role on the patch before; null when it was not ranked then. */
  before: number | null
}

const props = defineProps<{
  champions: { id: number; name: string; slug: string }[]
  rows: Row[]
  previousPatch: string | null
  ranked: Record<Position, number> | null
  games: number
  position: Position | null
  patches: { patch: string; games: number }[]
  filter: { patch: string; patches: string[]; bracket: string; region: string | null } | null
  trends?: Partial<
    Record<Position, { days: string[]; lines: Record<string, (number | null)[]> } | null>
  > | null
}>()

const names = computed(() => new Map(props.champions.map((c) => [c.id, c])))
const nameOf = (id: number) => names.value.get(id)?.name ?? ''
const role = computed(() => (props.position ? roleOf(props.position) : null))
const roleWord = (p: Position) => roleOf(p).label
const href = (r: Row) => {
  const c = names.value.get(r.champion)
  return c ? `/champions/${c.slug}?role=${roleOf(r.position).slug}` : '#'
}

const title = computed(() => (role.value ? `${role.value.label} tier list` : 'Tier list'))
const rankText = computed(() => {
  const b = BRACKETS.find((x) => x.value === props.filter?.bracket)
  if (!b || b.value === 'all') return 'every rank'
  return b.label.endsWith('+') ? `${b.label.slice(0, -1)} and above` : b.label
})
const metaLine = computed(() =>
  props.filter
    ? `Patch ${patchName(props.filter.patch)}, ${rankText.value}, ${thousands(props.games)} ranked solo games`
    : 'No ranked games stored yet'
)

/* ── Filters ─────────────────────────────────────────────────── */
const mainOnly = ref(false)
const query = ref('')
const best = computed(() => {
  // Each champion's most played role among the rows, for "Main role only".
  const out = new Map<number, Row>()
  for (const r of props.rows) {
    const was = out.get(r.champion)
    if (!was || r.roleShare > was.roleShare) out.set(r.champion, r)
  }
  return out
})
const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  return props.rows.filter(
    (r) =>
      (!mainOnly.value || best.value.get(r.champion) === r) &&
      (!q || nameOf(r.champion).toLowerCase().includes(q))
  )
})

/* ── Win rate against pick rate ──────────────────────────────── */
const plot = computed(() => {
  const top = [...shown.value].sort((a, b) => b.pick - a.pick).slice(0, 20)
  if (top.length < 3) return null
  const picks = top.map((r) => r.pick * 100)
  const wins = top.map((r) => r.win * 100)
  const xlo = Math.log(Math.max(0.2, Math.min(...picks) * 0.8))
  const xhi = Math.log(Math.max(...picks) * 1.15)
  const ylo = Math.floor(Math.min(...wins) - 0.4)
  const yhi = Math.ceil(Math.max(...wins) + 0.4)
  const x = (p: number) => ((Math.log(Math.max(p, 0.2)) - xlo) / (xhi - xlo)) * 100
  const y = (w: number) => 100 - ((w - ylo) / (yhi - ylo)) * 100
  const step = yhi - ylo > 6 ? 2 : 1
  const gy = []
  for (let v = Math.ceil(ylo); v <= yhi; v += step) {
    gy.push({ y: y(v), t: `${v}%`, mid: v === 50 })
  }
  const gx = [0.5, 1, 2, 3, 5, 7, 10, 15, 20, 30]
    .filter((v) => x(v) > 4 && x(v) < 96)
    .map((v) => ({ x: x(v), t: `${v}%` }))
  // Labelled: the three most picked, the two best and the worst win rates.
  const byWin = [...top].sort((a, b) => b.win - a.win)
  const labelled = new Set([...top.slice(0, 3), ...byWin.slice(0, 2), byWin[byWin.length - 1]])
  const pts = top.map((r) => ({
    r,
    x: x(r.pick * 100),
    y: y(r.win * 100),
    label: labelled.has(r),
  }))
  return { gy, gx, pts }
})

/* ── Moved since the patch before ────────────────────────────── */
const moved = computed(() => {
  const m = movers(props.rows, (r) => (r.before && r.rank ? r.before - r.rank : null))
  const toRow = ({ r, d }: { r: Row; d: number }): Moved => ({
    key: `${r.champion}:${r.position}`,
    name: props.position ? nameOf(r.champion) : `${nameOf(r.champion)} ${roleWord(r.position).toLowerCase()}`,
    d,
    href: href(r),
    img: champIconUrl(r.champion),
  })
  return { up: m.up.map(toRow), down: m.down.map(toRow) }
})

/* ── The table, grouped by tier ──────────────────────────────── */
const FIRST = 20
const all = ref(false)
const groups = computed(() => {
  let left = all.value ? Infinity : FIRST
  return TIERS.map((label, t) => {
    const list = shown.value.filter((r) => r.tier === t)
    const rows = list.slice(0, Math.max(0, left))
    left -= rows.length
    return { t, label, total: list.length, rows }
  }).filter((g) => g.total > 0 && (g.rows.length > 0 || all.value))
})
const hidden = computed(() => (all.value ? 0 : Math.max(0, shown.value.length - FIRST)))
const groupMeta = (g: { total: number; rows: Row[] }) =>
  g.rows.length === g.total
    ? `${g.total} champion${g.total === 1 ? '' : 's'}`
    : `Showing ${g.rows.length} of ${g.total}`

const winScale = computed(() => {
  const w = shown.value.map((r) => r.win)
  return { lo: Math.min(0.46, ...w), hi: Math.max(0.54, ...w) }
})
const pickMax = computed(() => Math.max(0.05, ...shown.value.map((r) => r.pick)))
const banMax = computed(() => Math.max(0.05, ...shown.value.map((r) => r.ban)))

const spark = (r: Row) => {
  const line = props.trends?.[r.position]?.lines?.[r.champion]
  return line ? sparkPaths(line) : null
}
const since = (r: Row) => {
  if (!props.previousPatch) return { cls: 'eq', text: '–' }
  if (!r.before || !r.rank) return { cls: 'eq', text: 'New' }
  const d = r.before - r.rank
  if (d === 0) return { cls: 'eq', text: 'Same' }
  const n = Math.abs(d)
  return { cls: d > 0 ? 'up' : 'dn', text: `${n} place${n === 1 ? '' : 's'}` }
}
</script>

<template>
  <Head :title="title" />
  <SiteLayout>
    <div class="wrap">
      <Masthead
        :title="title"
        :crumbs="[{ label: 'Tier list', href: '/tier-list' }, { label: 'Champions' }]"
        :meta="metaLine"
      >
        <template #end>
          <StatFilters :filter="filter" :patches="patches" />
        </template>
        <div class="tl-filters">
          <RoleSeg :value="position" all="All roles" />
          <label class="chk" @click.prevent="mainOnly = !mainOnly">
            <span class="switch" :class="{ on: mainOnly }" role="switch" :aria-checked="mainOnly" />
            Main role only
          </label>
          <label class="field tx-q">
            <Icon name="search" />
            <input v-model="query" type="text" placeholder="Filter champions" aria-label="Filter champions" />
          </label>
        </div>
      </Masthead>

      <EmptyState
        v-if="!rows.length"
        title="No ranked champions for this filter"
        line="Too few games are stored for this patch, rank and region. A wider rank or every region has more."
      />
      <template v-else>
        <section class="g12" style="align-items: stretch">
          <article class="card" style="grid-column: span 8">
            <CardHead
              title="Win rate against pick rate"
              icon="chart"
              :meta="`The top ${Math.min(20, shown.length)} of ${role ? role.label.toLowerCase() : 'every role'}`"
            />
            <template v-if="plot">
              <div class="tl-plot">
                <div v-for="g in plot.gy" :key="`y${g.t}`" class="gy" :class="{ mid: g.mid }" :style="{ top: `${g.y}%` }">
                  <span>{{ g.t }}</span>
                </div>
                <div v-for="g in plot.gx" :key="`x${g.t}`" class="gx" :style="{ left: `${g.x}%` }">
                  <span>{{ g.t }}</span>
                </div>
                <Link
                  v-for="p in plot.pts"
                  :key="`p${p.r.champion}${p.r.position}`"
                  class="tl-pt"
                  :href="href(p.r)"
                  :style="{ left: `${p.x}%`, top: `${p.y}%` }"
                  :aria-label="nameOf(p.r.champion)"
                  :title="`${nameOf(p.r.champion)}: ${p1(p.r.win)}% win, ${p1(p.r.pick)}% pick`"
                  ><img :src="champIconUrl(p.r.champion)" alt="" loading="lazy"
                /></Link>
                <span
                  v-for="p in plot.pts.filter((q) => q.label)"
                  :key="`l${p.r.champion}${p.r.position}`"
                  class="tl-lab"
                  :style="{ left: `${p.x}%`, top: `${p.y}%` }"
                  >{{ nameOf(p.r.champion) }}</span
                >
              </div>
              <div class="tl-axis">
                <span>Picked less</span><span>Pick rate</span><span>Picked more</span>
              </div>
            </template>
          </article>
          <MovedCard
            style="grid-column: span 4"
            :title="previousPatch ? `Moved since ${patchName(previousPatch)}` : 'Moved since last patch'"
            :meta="role ? `Place in ${role.label.toLowerCase()}` : 'Place in their role'"
            :up="moved.up"
            :down="moved.down"
            :digits="0"
            row-class="tl-mv"
          />
        </section>

        <section class="sec" style="padding-top: 24px">
          <article class="card" style="overflow: hidden">
            <div class="tl-head">
              <span>Champion</span>
              <span>Win rate</span>
              <span>Pick rate</span>
              <span>Ban rate</span>
              <span class="r">Games</span>
              <span>Win rate, 14 days</span>
              <span>{{ previousPatch ? `Since ${patchName(previousPatch)}` : 'Since' }}</span>
            </div>
            <template v-for="g in groups" :key="g.t">
              <div class="tl-grp">
                <TierChip :tier="g.t" large />
                <span class="h4">{{ g.label }} tier</span>
                <span class="meta">{{ groupMeta(g) }}</span>
              </div>
              <Link
                v-for="r in g.rows"
                :key="`${r.champion}:${r.position}`"
                class="tl-row"
                :href="href(r)"
              >
                <div class="tl-champ">
                  <div class="fr s visor"><img :src="champIconUrl(r.champion)" alt="" loading="lazy" /></div>
                  <div class="col" style="gap: 3px; min-width: 0">
                    <span class="h4 ell">{{ nameOf(r.champion) }}</span>
                    <span class="meta ell">{{ roleWord(r.position) }} in {{ Math.round(r.roleShare * 100) }}% of games</span>
                  </div>
                </div>
                <Fig :value="p1(r.win)" :width="barWidth(r.win, winScale.lo, winScale.hi)" big mid class="tl-fig" />
                <Fig :value="p1(r.pick)" :width="barWidth(r.pick, 0, pickMax)" class="tl-fig" />
                <Fig :value="p1(r.ban)" :width="barWidth(r.ban, 0, banMax)" class="tl-fig" />
                <span class="fg-xs t2" style="text-align: right">{{ thousands(r.games) }}</span>
                <Deferred data="trends">
                  <template #fallback><span class="spark" /></template>
                  <div v-if="spark(r)" class="chart spark">
                    <svg class="fade" viewBox="0 0 160 30" preserveAspectRatio="none" aria-hidden="true">
                      <path class="area" :d="spark(r)!.area" />
                    </svg>
                    <svg viewBox="0 0 160 30" preserveAspectRatio="none" aria-hidden="true">
                      <path class="dash" :d="`M0 ${spark(r)!.pivot} H160`" />
                      <path class="ln" :d="spark(r)!.line" />
                    </svg>
                  </div>
                  <span v-else class="spark" />
                </Deferred>
                <span class="tl-plc" :class="since(r).cls"
                  ><Icon v-if="since(r).cls !== 'eq'" name="arrow" :size="14" />{{ since(r).text }}</span
                >
              </Link>
            </template>
            <div v-if="hidden" class="tl-grp tx-more">
              <button class="btn sm" type="button" @click="all = true">
                Show {{ hidden }} more {{ role ? `${role.label.toLowerCase()} ` : '' }}champions<Icon name="chev" />
              </button>
            </div>
          </article>
        </section>
      </template>
    </div>
  </SiteLayout>
</template>
