<script setup lang="ts">
import { computed, ref } from 'vue'
import { Deferred, Head, usePage } from '@inertiajs/vue3'
import '../../css/stats.css'
import SiteLayout from '../../components/SiteLayout.vue'
import Masthead from '../../components/ui/Masthead.vue'
import Icon from '../../components/ui/Icon.vue'
import Skeleton from '../../components/ui/Skeleton.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import StatFilters from '../../components/champions/StatFilters.vue'
import RoleSeg from '../../components/champions/RoleSeg.vue'
import StudioHub, { type Leader } from '../../components/stats/StudioHub.vue'
import StudioNav from '../../components/stats/StudioNav.vue'
import StatTable, { type StatRow } from '../../components/stats/StatTable.vue'
import { type Filter } from '../../lib/champions.js'
import { patchName } from '../../lib/patches.js'
import { thousands } from '../../lib/tier_lists.js'
import {
  METRICS,
  STATS,
  fmtMetric,
  statOf,
  type MetricKey,
  type Metrics,
  type StatDef,
} from '../../lib/studio.js'

interface Row {
  champion: number
  games: number
  win: number
  pick: number
  ban: number
  position: string
  before: { win: number; pick: number; ban: number } | null
}
interface Block {
  champions: Record<string, Metrics>
  all: Metrics
}

/** `/stats` and `/stats/<stat>`: the stats studio's hub, or every champion ranked by one figure. */
const props = defineProps<{
  stat: string | null
  position: string | null
  patches: { patch: string; games: number }[]
  filter: Filter | null
  rows: Row[]
  champions: { id: number; name: string; slug: string }[]
  games?: number
  roleGames?: number
  previousPatch?: string | null
  game?: Block
  lane?: Block
}>()
const page = usePage()

const ROLES: Record<string, { slug: string; label: string; lane: string }> = {
  TOP: { slug: 'top', label: 'Top', lane: 'TOP' },
  JUNGLE: { slug: 'jungle', label: 'Jungle', lane: 'JUNGLE' },
  MIDDLE: { slug: 'mid', label: 'Mid', lane: 'MID' },
  BOTTOM: { slug: 'bot', label: 'Bot', lane: 'ADC' },
  UTILITY: { slug: 'support', label: 'Support', lane: 'SUPPORT' },
}
const role = computed(() => (props.position ? ROLES[props.position] : null))
const def = computed(() => statOf(props.stat))
/** The page's filters as they are in its address, for the links to the other statistics. */
const query = computed(() => page.url.split('?')[1] ?? '')

const champs = computed(() => new Map(props.champions.map((c) => [c.id, c])))
const byId = computed(() => new Map(props.rows.map((r) => [r.champion, r])))

function value(champion: number, key: MetricKey): number | null | undefined {
  const source = METRICS[key].source
  if (source === 'role') {
    const r = byId.value.get(champion)
    if (!r) return null
    if (key === 'change') return r.before ? (r.win - r.before.win) * 100 : null
    return r[key as 'games' | 'win' | 'pick' | 'ban']
  }
  const block = source === 'game' ? props.game : props.lane
  return block ? (block.champions[champion]?.[key] ?? null) : undefined
}
const roleWin = computed(() => {
  const games = props.rows.reduce((n, r) => n + r.games, 0)
  return games ? props.rows.reduce((n, r) => n + r.win * r.games, 0) / games : null
})
function average(key: MetricKey) {
  const source = METRICS[key].source
  if (source === 'role') return key === 'win' ? roleWin.value : null
  return (source === 'game' ? props.game : props.lane)?.all[key] ?? null
}

/** A champion leads a statistic of the hub from this many games (0.4 % of the list's). */
const minGames = computed(() => Math.max(100, Math.round((props.roleGames ?? 0) * 0.004)))
/** The champion at the top of a statistic's list (from `minGames`); undefined while it loads. */
function leader(s: StatDef): Leader | null | undefined {
  const source = METRICS[s.key].source
  if (source !== 'role' && !(source === 'game' ? props.game : props.lane)) return undefined
  let best: Leader | null = null
  for (const r of props.rows) {
    if (r.games < minGames.value) continue
    const v = value(r.champion, s.key)
    if (typeof v !== 'number' || Number.isNaN(v) || (best && v <= best.value)) continue
    best = { champion: r.champion, name: champs.value.get(r.champion)?.name ?? '', value: v }
  }
  return best
}

const tableRows = computed<StatRow[]>(() =>
  props.rows.flatMap((r) => {
    const c = champs.value.get(r.champion)
    if (!c) return []
    const slug = (role.value ?? ROLES[r.position])?.slug
    return [
      {
        champion: r.champion,
        name: c.name,
        href: `/champions/${c.slug}${slug ? `?role=${slug}` : ''}`,
        lane: role.value ? null : (ROLES[r.position]?.lane ?? null),
      },
    ]
  })
)
const heads = computed(() =>
  props.previousPatch ? { change: `Since ${patchName(props.previousPatch)}` } : {}
)
/** The blocks the page's figures come from, to wait for on a first load. */
const needs = computed(() => {
  const keys = def.value ? [def.value.key, ...def.value.cols] : (['kda', 'gd10'] as MetricKey[])
  return [...new Set(keys.map((k) => METRICS[k].source).filter((s) => s !== 'role'))]
})

const find = ref('')

const where = computed(() => (role.value ? role.value.label : 'Every role'))
const title = computed(() =>
  def.value ? def.value.label : role.value ? `${role.value.label} stats` : 'Champion stats'
)
const metaLine = computed(() => {
  if (!props.filter) return 'No ranked games stored yet'
  const counts = `${props.rows.length} champions, ${thousands(props.games ?? 0)} games`
  if (!def.value) return `${STATS.length} statistics, ${counts}`
  const avg = METRICS[def.value.key].signed || def.value.wide ? null : average(def.value.key)
  const avgText = typeof avg === 'number' ? `Average ${fmtMetric(def.value.key, avg)}. ` : ''
  return `${def.value.about ? `${def.value.about} ` : ''}${avgText}${counts}`
})
</script>

<template>
  <Head :title="def ? `${def.label} by champion, ${where.toLowerCase()}` : title" />
  <SiteLayout>
    <div class="wrap st-page">
      <Masthead
        :title="title"
        :crumbs="
          def
            ? [
                { label: 'Tools' },
                { label: 'Stats', href: `/stats${query ? `?${query}` : ''}` },
                { label: def.label },
              ]
            : [{ label: 'Tools' }, { label: 'Stats' }]
        "
        :meta="metaLine"
      >
        <template #end>
          <StatFilters :filter="filter" :patches="patches" :region="false" />
        </template>
        <div class="st-tools">
          <RoleSeg :value="position" all="All roles" />
          <label v-if="def" class="field st-find">
            <Icon name="search" />
            <input
              v-model="find"
              type="text"
              placeholder="Find a champion"
              aria-label="Find a champion"
            />
          </label>
        </div>
      </Masthead>

      <EmptyState
        v-if="!rows.length"
        title="No champions for this filter"
        line="Too few games are stored for this patch and rank."
      />
      <StudioHub v-else-if="!def" :leader="leader" :query="query" />
      <div v-else class="st-body">
        <StudioNav :stat="def" :query="query" />
        <Deferred v-if="needs.length" :data="needs">
          <template #fallback>
            <div class="card st-card"><Skeleton :rows="12" pic /></div>
          </template>
          <article class="card st-card">
            <StatTable
              :key="def.slug"
              :stat="def"
              :rows="tableRows"
              :value="value"
              :average="average"
              :heads="heads"
              :find="find"
            />
          </article>
        </Deferred>
        <article v-else class="card st-card">
          <StatTable
            :key="def.slug"
            :stat="def"
            :rows="tableRows"
            :value="value"
            :average="average"
            :heads="heads"
            :find="find"
          />
        </article>
      </div>
    </div>
  </SiteLayout>
</template>
