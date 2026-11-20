<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import SortHead from '../ui/SortHead.vue'
import { useSort, type SortValue } from '../ui/sort.js'
import { METRICS, fmtMetric, type MetricKey, type StatDef } from '../../lib/studio.js'

/**
 * One statistic of the studio as a table: every champion of the list, ranked by the figure,
 * drawn as one violet bar (from the middle for a gap that can be negative) with the role's own
 * figure as a faint dashed mark, then the figures beside it. Every head sorts; the search keeps
 * the champions whose name holds it.
 */
export interface StatRow {
  champion: number
  name: string
  href: string
  /** The lane of the role it is played in most, when the list is every role's. */
  lane: string | null
}

const props = defineProps<{
  stat: StatDef
  rows: StatRow[]
  value: (champion: number, key: MetricKey) => number | null | undefined
  /** The role's own figure of each key (its average), or null. */
  average: (key: MetricKey) => number | null | undefined
  /** Column heads that read differently on this filter (the change since a named patch). */
  heads?: Partial<Record<MetricKey, string>>
  find?: string
}>()

const cols = computed(() =>
  props.stat.wide ? [props.stat.key, ...props.stat.cols] : props.stat.cols
)
const main = computed(() => props.stat.key)
const signed = computed(() => Boolean(METRICS[main.value].signed))

const columns = computed(() => {
  const out: Record<string, (r: StatRow) => SortValue> = { name: (r) => r.name }
  for (const k of [main.value, ...props.stat.cols]) out[k] = (r) => props.value(r.champion, k)
  return out
})
const sort = useSort(() => props.rows, columns, { key: props.stat.key, first: { name: 'asc' } })

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
const shown = computed(() => {
  const q = norm(props.find ?? '')
  return q ? sort.rows.filter((r) => norm(r.name).includes(q)) : sort.rows
})

/** The bar's scale: from a little under the lowest figure (or 0) to the highest. */
const scale = computed(() => {
  const vs = props.rows
    .map((r) => props.value(r.champion, main.value))
    .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v))
  if (!vs.length) return { lo: 0, hi: 1, abs: 1 }
  const lo = Math.min(...vs)
  const hi = Math.max(...vs)
  return {
    lo: Math.max(0, lo - (hi - lo) * 0.5),
    hi,
    abs: Math.max(...vs.map((v) => Math.abs(v)), 1e-9),
  }
})
const pct = (v: number) =>
  Math.max(
    2,
    Math.min(100, ((v - scale.value.lo) / Math.max(scale.value.hi - scale.value.lo, 1e-9)) * 100)
  )
const barStyle = (v: number | null | undefined) => {
  if (typeof v !== 'number' || Number.isNaN(v)) return null
  if (!signed.value) return { width: `${pct(v)}%` }
  const w = Math.max(1, (Math.abs(v) / scale.value.abs) * 50)
  return v >= 0 ? { left: '50%', width: `${w}%` } : { left: `${50 - w}%`, width: `${w}%` }
}
const mark = computed(() => {
  if (signed.value) return null
  const a = props.average(main.value)
  return typeof a === 'number' && a > scale.value.lo ? `${pct(a)}%` : null
})

const head = (k: MetricKey) => props.heads?.[k] ?? METRICS[k].col
const grid = computed(() =>
  props.stat.wide
    ? `28px minmax(160px, 1fr) repeat(${cols.value.length}, minmax(72px, 92px))`
    : `28px minmax(150px, 1fr) minmax(200px, 1.3fr) repeat(${cols.value.length}, minmax(72px, 104px))`
)
</script>

<template>
  <div
    class="tbl st-tbl"
    :class="{ wide: stat.wide }"
    :style="{ '--st-cols': grid }"
    role="table"
    :aria-label="stat.label"
  >
    <div class="tbl-h" role="row">
      <span class="st-rk" role="columnheader">#</span>
      <SortHead :sorter="sort" col="name" label="Champion" class="st-who" />
      <SortHead
        v-if="!stat.wide"
        :sorter="sort"
        :col="main"
        :label="head(main)"
        :title="METRICS[main].title"
        class="n st-mainh"
      />
      <SortHead
        v-for="(k, i) in cols"
        :key="k"
        :sorter="sort"
        :col="k"
        :label="head(k)"
        :title="METRICS[k].title"
        class="n"
        :class="{ hm: !stat.wide || i > 1 }"
      />
    </div>
    <Link v-for="(r, i) in shown" :key="r.champion" class="tbl-r" :href="r.href" role="row">
      <span class="st-rk num">{{ i + 1 }}</span>
      <span class="who st-who">
        <img
          class="pic sm"
          loading="lazy"
          decoding="async"
          width="28"
          height="28"
          alt=""
          :src="`/cdn/champion/${r.champion}.png`"
        />
        <span class="h5 ell">{{ r.name }}</span>
        <RoleIcon v-if="r.lane" class="st-lane" :lane="r.lane" :size="14" />
      </span>
      <span v-if="!stat.wide" class="st-fig">
        <span class="bar st-bar" :class="{ mid: signed }">
          <i v-if="barStyle(value(r.champion, main))" :style="barStyle(value(r.champion, main))!" />
          <b v-if="mark" class="st-avg" :style="{ left: mark }" />
        </span>
        <span class="num t1">{{ fmtMetric(main, value(r.champion, main)) }}</span>
      </span>
      <span
        v-for="(k, i) in cols"
        :key="k"
        class="n num"
        :class="{ hm: !stat.wide || i > 1, t1: stat.wide && i === 0 }"
        >{{ fmtMetric(k, value(r.champion, k)) }}</span
      >
    </Link>
    <p v-if="!shown.length" class="meta st-none">No champion by that name in this list.</p>
  </div>
</template>
