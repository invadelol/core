<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { Head, Link, router, usePage } from '@inertiajs/vue3'
import { Check, Search } from 'lucide-vue-next'
import { ChampIcon, RoleIcon } from '@invadelol/ui'
import AppHeader from '../../components/AppHeader.vue'
import SiteFooter from '../../components/SiteFooter.vue'
import Crumbs from '../../components/champions/Crumbs.vue'
import TierMark from '../../components/champions/TierMark.vue'
import Crest from '../../components/champions/Crest.vue'
import SortHead from '../../components/champions/SortHead.vue'
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
import '../../css/champions.css'

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

/** `/tier-list?role=bot`: one role's champions ranked, grouped by tier. */
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
}>()

/** A champion counts as played in the role from this share of its games ("Main role only"). */
const MAIN_SHARE = 0.25

const page = usePage()
const latest = computed(() => props.patches[0]?.patch)
const rank = computed(() => props.filter?.bracket ?? 'emerald_plus')
const patch = computed(() => props.filter?.patch ?? latest.value ?? '')
const role = computed(() => roleOf(props.position))
const byId = computed(() => new Map(props.champions.map((c) => [c.id, c])))
const mainOnly = ref(true)
const query = ref('')
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
const groups = computed(() => {
  const { key, dir } = sort.value
  return TIERS.map((label, tier) => {
    const list = listed.value.filter((r) => r.tier === tier)
    const sorted =
      key === 'rank'
        ? dir === 'asc'
          ? list
          : [...list].reverse()
        : sortRows(list, (r) => (key === 'moved' ? moved(r) : r[key]), dir)
    const avg = list.length ? list.reduce((n, r) => n + r.win, 0) / list.length : 0
    return { label, tier, rows: sorted, avg }
  }).filter((g) => g.rows.length)
})
const highest = computed(() => listed.value[0] ?? null)
const climbed = computed(
  () =>
    [...listed.value].filter((r) => (moved(r) ?? 0) > 0).sort((a, b) => moved(b)! - moved(a)!)[0] ??
    null
)
const banned = computed(() => [...listed.value].sort((a, b) => b.ban - a.ban)[0] ?? null)

function by(key: Key) {
  const was = sort.value
  afterPaint(() => {
    sort.value = {
      key,
      dir: was.key === key ? (was.dir === 'asc' ? 'desc' : 'asc') : key === 'rank' ? 'asc' : 'desc',
    }
  })
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

const RANKS = ['all', 'emerald_plus', 'diamond_plus', 'master_plus'] as const
const singleRanks = BRACKETS.filter((b) => !(RANKS as readonly string[]).includes(b.value)).map(
  (b) => ({
    value: b.value,
    label: b.label,
  })
)
const visit = (url: string) => router.visit(url, { preserveScroll: true })
const singleModel = computed({
  get: () => ((RANKS as readonly string[]).includes(rank.value) ? '' : rank.value),
  set: (v: string) => v && visit(href({ rank: v })),
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
  props.patches.map((p) => ({ value: p.patch, label: `Patch ${p.patch}` }))
)
const RANK_TEXT: Record<string, string> = {
  all: 'All ranks',
  emerald_plus: 'Emerald and above',
  diamond_plus: 'Diamond and above',
  master_plus: 'Master and above',
}
const CREST: Record<string, string | null> = {
  all: null,
  emerald_plus: 'EMERALD',
  diamond_plus: 'DIAMOND',
  master_plus: 'MASTER',
}
const rankText = computed(() => RANK_TEXT[rank.value] ?? bracketOf(rank.value).label)
const regionText = computed(() =>
  props.filter?.region
    ? REGIONS.find((r) => r.value === props.filter!.region)?.label
    : 'all regions'
)
const title = computed(
  () =>
    (page.props.social as { title?: string } | undefined)?.title ?? `${role.value.label} tier list`
)
</script>

<template>
  <Head :title="title" />
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <main class="nb nb-page flex-1">
      <Crumbs :items="[{ label: 'Champions', href: '/champions' }, { label: 'Tier list' }]">
        <template #end
          ><span class="num"
            >{{ thousands(games) }} games<template v-if="filter"
              >, patch {{ filter.patch }}</template
            ></span
          ></template
        >
      </Crumbs>

      <div class="nb-layout">
        <aside class="nb-filt" aria-label="Filters">
          <div class="grp wide">
            <span class="nb-label">Role</span>
            <nav class="opts" aria-label="Role">
              <Link
                v-for="r in ROLES"
                :key="r.position"
                :href="href({ role: r.slug })"
                class="opt"
                :class="{ on: r.position === position }"
                :aria-current="r.position === position ? 'page' : undefined"
                preserve-scroll
                prefetch="hover"
                cache-for="30s"
                ><span class="ic"><RoleIcon :lane="r.lane" :size="15" /></span>{{ r.label
                }}<small v-if="ranked" class="num">{{ ranked[r.position] }}</small></Link
              >
            </nav>
          </div>
          <div class="grp wide">
            <span class="nb-label">Rank</span>
            <nav class="opts" aria-label="Rank">
              <Link
                v-for="k in RANKS"
                :key="k"
                :href="href({ rank: k })"
                class="opt"
                :class="{ on: rank === k }"
                :aria-current="rank === k ? 'page' : undefined"
                preserve-scroll
                ><span class="ic"><Crest :tier="CREST[k]" :size="16" /></span
                >{{ RANK_TEXT[k] }}</Link
              >
            </nav>
          </div>
          <div class="grp">
            <span class="nb-label">Region and patch</span>
            <div class="sels">
              <Select
                v-model="singleModel"
                :options="singleRanks"
                label="One rank"
                placeholder="Any"
                width="12rem"
              />
              <Select v-model="regionModel" :options="regionOptions" label="Region" width="12rem" />
              <Select
                v-if="patchOptions.length"
                v-model="patchModel"
                :options="patchOptions"
                label="Patch"
                width="12rem"
              />
            </div>
          </div>
          <div class="grp">
            <span class="nb-label">Show</span>
            <div class="opts" role="radiogroup" aria-label="Show">
              <button
                type="button"
                class="opt"
                role="radio"
                :aria-checked="mainOnly"
                @click="mainOnly = true"
              >
                <span class="box"><Check v-if="mainOnly" :size="11" aria-hidden="true" /></span>Main
                role only
              </button>
              <button
                type="button"
                class="opt"
                role="radio"
                :aria-checked="!mainOnly"
                @click="mainOnly = false"
              >
                <span class="box"><Check v-if="!mainOnly" :size="11" aria-hidden="true" /></span
                >Off-role picks too
              </button>
            </div>
          </div>
        </aside>

        <div class="min-w-0">
          <div class="nb-title">
            <div>
              <h1>{{ role.label }} tier list</h1>
              <p class="nb-meta num">
                {{ rankText }}, {{ regionText
                }}<template v-if="filter">, patch {{ filter.patch }}</template>
              </p>
            </div>
            <div class="end">
              <label class="nb-search">
                <Search :size="14" aria-hidden="true" /><span class="nb-sr">Filter champions</span>
                <input v-model="query" type="search" placeholder="Filter champions" />
              </label>
            </div>
          </div>

          <p v-if="!rows.length" class="nb-panel nb-empty">
            Not enough games for this role with these filters yet.
          </p>
          <template v-else>
            <div class="tl-cards">
              <Link
                v-if="highest"
                :href="champHref(highest.champion)"
                class="nb-panel tl-card"
                prefetch="hover"
              >
                <span class="nb-pic"><ChampIcon :id="highest.champion" :size="36" /></span>
                <span class="min-w-0 flex-1"
                  ><span class="nb-k">Highest tier</span><b>{{ name(highest.champion) }}</b></span
                >
                <TierMark :tier="highest.tier" large />
              </Link>
              <Link
                v-if="climbed"
                :href="champHref(climbed.champion)"
                class="nb-panel tl-card"
                prefetch="hover"
              >
                <span class="nb-pic"><ChampIcon :id="climbed.champion" :size="36" /></span>
                <span class="min-w-0 flex-1"
                  ><span class="nb-k">Climbed the most</span
                  ><b>{{ name(climbed.champion) }}</b></span
                >
                <span class="up num" style="font-weight: 600"
                  >#{{ climbed.rank! + moved(climbed)! }} to #{{ climbed.rank }}</span
                >
              </Link>
              <Link
                v-if="banned"
                :href="champHref(banned.champion)"
                class="nb-panel tl-card"
                prefetch="hover"
              >
                <span class="nb-pic"><ChampIcon :id="banned.champion" :size="36" /></span>
                <span class="min-w-0 flex-1"
                  ><span class="nb-k">Most banned</span><b>{{ name(banned.champion) }}</b></span
                >
                <span class="num" style="font-weight: 600; color: var(--text-1)">{{
                  pct(banned.ban)
                }}</span>
              </Link>
            </div>

            <div class="nb-panel nb-table" role="table" :aria-label="`${role.label} tier list`">
              <div class="nb-tr th tl-cols" role="row">
                <span role="columnheader" :aria-sort="ariaSort(sort, 'rank')"
                  ><SortHead
                    label="#"
                    :active="sort.key === 'rank'"
                    :dir="sort.dir"
                    title="Place in the role"
                    @sort="by('rank')"
                /></span>
                <span role="columnheader">Champion</span>
                <span role="columnheader" class="r" :aria-sort="ariaSort(sort, 'win')"
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
                <span role="columnheader" class="r hm" :aria-sort="ariaSort(sort, 'ban')"
                  ><SortHead
                    label="Ban"
                    :active="sort.key === 'ban'"
                    :dir="sort.dir"
                    @sort="by('ban')"
                /></span>
                <span role="columnheader" class="r hm" :aria-sort="ariaSort(sort, 'games')"
                  ><SortHead
                    label="Games"
                    :active="sort.key === 'games'"
                    :dir="sort.dir"
                    @sort="by('games')"
                /></span>
                <span role="columnheader" class="hm" :aria-sort="ariaSort(sort, 'roleShare')"
                  ><SortHead
                    :label="`Played ${role.label.toLowerCase()}`"
                    :active="sort.key === 'roleShare'"
                    :dir="sort.dir"
                    @sort="by('roleShare')"
                /></span>
                <span role="columnheader" class="r" :aria-sort="ariaSort(sort, 'moved')"
                  ><SortHead
                    :label="previousPatch ? `Since ${previousPatch}` : 'Move'"
                    :active="sort.key === 'moved'"
                    :dir="sort.dir"
                    @sort="by('moved')"
                /></span>
              </div>
              <div v-if="!groups.length" class="nb-empty">No champion matches “{{ query }}”.</div>
              <div v-for="g in groups" :key="g.tier" role="rowgroup">
                <div class="nb-tgroup" role="row">
                  <span role="cell"><TierMark :tier="g.tier" large /></span>
                  <span class="nb-meta num" role="cell"
                    >{{ g.rows.length }} {{ g.rows.length === 1 ? 'champion' : 'champions' }}</span
                  >
                  <span class="avg num hm" role="cell">Average win rate {{ pct(g.avg) }}</span>
                </div>
                <div
                  v-for="r in g.rows"
                  :key="r.champion"
                  class="nb-tr link tl-cols"
                  role="row"
                  style="min-height: 40px"
                >
                  <span class="rk num" role="cell">{{ place.get(r.champion) }}</span>
                  <span class="c" role="cell"
                    ><span class="pic"><ChampIcon :id="r.champion" :size="26" /></span
                    ><Link
                      :href="champHref(r.champion)"
                      class="stretch"
                      prefetch="hover"
                      cache-for="30s"
                      ><b>{{ name(r.champion) }}</b></Link
                    ></span
                  >
                  <span class="r b num" role="cell">{{ pct(r.win) }}</span>
                  <span class="r num" role="cell">{{ pct(r.pick) }}</span>
                  <span class="r num hm" role="cell">{{ pct(r.ban) }}</span>
                  <span class="r num hm" role="cell">{{ thousands(r.games) }}</span>
                  <span class="hm share" role="cell"
                    ><span class="nb-bar" style="flex: 1"
                      ><i :style="{ width: `${r.roleShare * 100}%` }" /></span
                    ><span class="num q" style="width: 34px; text-align: right">{{
                      pct(r.roleShare, 0)
                    }}</span></span
                  >
                  <span
                    class="r num nb-mv"
                    role="cell"
                    :class="moved(r) ? (moved(r)! > 0 ? 'up' : 'down') : 'qq'"
                    >{{
                      moved(r) === null
                        ? '-'
                        : moved(r)! > 0
                          ? `▲ ${moved(r)}`
                          : moved(r)! < 0
                            ? `▼ ${-moved(r)!}`
                            : '='
                    }}<span v-if="moved(r)" class="nb-sr">{{
                      moved(r)! > 0 ? 'places up' : 'places down'
                    }}</span></span
                  >
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </main>
    <SiteFooter />
  </div>
</template>
