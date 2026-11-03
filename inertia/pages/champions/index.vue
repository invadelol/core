<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import { Check, LayoutGrid, Search } from 'lucide-vue-next'
import { ChampIcon, RoleIcon } from '@invadelol/ui'
import AppHeader from '../../components/AppHeader.vue'
import SiteFooter from '../../components/SiteFooter.vue'
import Crumbs from '../../components/champions/Crumbs.vue'
import TierMark from '../../components/champions/TierMark.vue'
import SortHead from '../../components/champions/SortHead.vue'
import Select from '../../components/ui/Select.vue'
import { BRACKETS, ROLES, filterQuery, roleOf, type Filter } from '../../lib/champions.js'
import { ariaSort, pct, sortRows, thousands, type Sort } from '../../lib/board.js'
import { afterPaint } from '../../lib/after_paint.js'
import '../../css/champions.css'

interface Stat {
  champion: number
  position: string
  games: number
  win: number
  pick: number
  ban: number
  tier: number | null
  rank: number | null
}
interface Champion {
  id: number
  name: string
  slug: string
  roles: string[]
}

/** `/champions`: every champion, its main role, tier and win rate; a role, a class, a name. */
const props = defineProps<{
  /** [id, name, slug, classes] */
  champions: [number, string, string, string[]][]
  /** [champion, role (index in ROLES), games, win, pick, ban, tier, rank] */
  stats: [number, number, number, number, number, number, number | null, number | null][]
  games: number
  patches: { patch: string; games: number }[]
  filter: Filter | null
  tab: 'matchups' | 'items' | 'runes' | 'pros' | null
}>()

const TAB_TITLE = { matchups: 'Matchups', items: 'Items', runes: 'Runes', pros: 'Pro builds' }
const CLASSES = ['assassin', 'fighter', 'mage', 'marksman', 'support', 'tank'] as const
const FIRST = 60

const latest = computed(() => props.patches[0]?.patch)
const rank = computed(() => props.filter?.bracket ?? 'emerald_plus')
const patch = computed(() => props.filter?.patch ?? latest.value ?? '')
const role = ref<string>('ALL')
const classes = ref<string[]>([])
const query = ref('')
const view = ref<'grid' | 'table'>('grid')
const sort = shallowRef<Sort<'name' | 'tier' | 'win' | 'pick' | 'ban' | 'games'>>({
  key: 'name',
  dir: 'asc',
})
const all = ref(false)

const champions = computed<Champion[]>(() =>
  props.champions.map(([id, name, slug, roles]) => ({ id, name, slug, roles }))
)
/** Each champion's roles, its main one first. */
const statsOf = computed(() => {
  const map = new Map<number, Stat[]>()
  for (const [champion, p, games, win, pick, ban, tier, rank] of props.stats) {
    const r: Stat = {
      champion,
      position: ROLES[p]?.position ?? 'TOP',
      games,
      win,
      pick,
      ban,
      tier,
      rank,
    }
    const list = map.get(r.champion)
    if (list) list.push(r)
    else map.set(r.champion, [r])
  }
  for (const list of map.values()) list.sort((a, b) => b.games - a.games)
  return map
})
const counts = computed(() =>
  Object.fromEntries(
    ROLES.map((r) => [
      r.position,
      champions.value.filter((c) => statsOf.value.get(c.id)?.some((s) => s.position === r.position))
        .length,
    ])
  )
)

const rows = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = champions.value
    .map((c) => {
      const mine = statsOf.value.get(c.id) ?? []
      const main = role.value === 'ALL' ? mine[0] : mine.find((r) => r.position === role.value)
      return { c, main: main ?? null }
    })
    .filter(
      (x) =>
        (role.value === 'ALL' || x.main) &&
        (!classes.value.length || classes.value.some((k) => x.c.roles.includes(k))) &&
        (!q || x.c.name.toLowerCase().includes(q))
    )
  const { key, dir } = sort.value
  if (key === 'name') return sortRows(list, (x) => x.c.name, dir)
  if (key === 'tier')
    return sortRows(
      list,
      (x) => ((x.main?.tier ?? null) === null ? null : x.main!.tier! * 1000 + (x.main!.rank ?? 0)),
      dir
    )
  return sortRows(list, (x) => (x.main ? x.main[key] : null), dir)
})
const shown = computed(() =>
  all.value || query.value || view.value === 'table' ? rows.value : rows.value.slice(0, FIRST)
)

function by(key: Sort<'name'>['key'] | 'tier' | 'win' | 'pick' | 'ban' | 'games') {
  const was = sort.value
  afterPaint(() => {
    sort.value = {
      key: key as never,
      dir:
        was.key === key
          ? was.dir === 'asc'
            ? 'desc'
            : 'asc'
          : key === 'name' || key === 'tier'
            ? 'asc'
            : 'desc',
    }
  })
}
const sortChoice = computed({
  get: () => sort.value.key,
  set: (key) => (sort.value = { key, dir: key === 'name' || key === 'tier' ? 'asc' : 'desc' }),
})
const SORTS = [
  { value: 'name', label: 'Name' },
  { value: 'tier', label: 'Tier' },
  { value: 'win', label: 'Win rate' },
  { value: 'pick', label: 'Pick rate' },
  { value: 'ban', label: 'Ban rate' },
] as const

function toggleClass(k: string) {
  classes.value = classes.value.includes(k)
    ? classes.value.filter((x) => x !== k)
    : [...classes.value, k]
}

function go(c: { rank?: string; patch?: string }) {
  const q = filterQuery({ rank: c.rank ?? rank.value, patch: c.patch ?? patch.value }, latest.value)
  const tab = props.tab ? `${q ? '&' : '?'}tab=${props.tab}` : ''
  router.visit(`/champions${q}${tab}`, { preserveScroll: true })
}
const rankModel = computed({ get: () => rank.value, set: (v: string) => go({ rank: v }) })
const patchModel = computed({ get: () => patch.value, set: (v: string) => go({ patch: v }) })
const rankOptions = BRACKETS.map((b) => ({ value: b.value, label: b.label }))
const patchOptions = computed(() =>
  props.patches.map((p) => ({ value: p.patch, label: `Patch ${p.patch}` }))
)

const href = (slug: string, position?: string | null) =>
  `/champions/${slug}${props.tab ? `/${props.tab}` : ''}${filterQuery(
    {
      role: position ? roleOf(position).slug : undefined,
      rank: rank.value,
      patch: patch.value,
    },
    latest.value
  )}`
const roleName = (position?: string | null) => (position ? roleOf(position).label : '')
</script>

<template>
  <Head :title="tab ? TAB_TITLE[tab] : 'Champions'" />
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <main class="nb nb-page flex-1">
      <Crumbs :items="[{ label: 'Champions' }]">
        <template #end
          ><span class="num"
            >{{ champions.length }} champions<template v-if="filter"
              >, patch {{ filter.patch }}</template
            ></span
          ></template
        >
      </Crumbs>

      <div class="nb-layout">
        <aside class="nb-filt" aria-label="Filters">
          <div class="grp wide">
            <span class="nb-label">Role</span>
            <div class="opts" role="radiogroup" aria-label="Role">
              <button
                type="button"
                class="opt"
                :class="{ on: role === 'ALL' }"
                role="radio"
                :aria-checked="role === 'ALL'"
                @click="role = 'ALL'"
              >
                <span class="ic"><LayoutGrid :size="15" aria-hidden="true" /></span>All roles<small
                  class="num"
                  >{{ champions.length }}</small
                >
              </button>
              <button
                v-for="r in ROLES"
                :key="r.position"
                type="button"
                class="opt"
                :class="{ on: role === r.position }"
                role="radio"
                :aria-checked="role === r.position"
                @click="role = r.position"
              >
                <span class="ic"><RoleIcon :lane="r.lane" :size="15" /></span>{{ r.label
                }}<small class="num">{{ counts[r.position] }}</small>
              </button>
            </div>
          </div>
          <div class="grp wide">
            <span class="nb-label">Class</span>
            <div class="opts" role="group" aria-label="Class">
              <button
                v-for="k in CLASSES"
                :key="k"
                type="button"
                class="opt"
                :aria-pressed="classes.includes(k)"
                @click="toggleClass(k)"
              >
                <span class="box"
                  ><Check v-if="classes.includes(k)" :size="11" aria-hidden="true" /></span
                >{{ k.charAt(0).toUpperCase() + k.slice(1) }}
              </button>
            </div>
          </div>
          <div class="grp">
            <span class="nb-label">Stats from</span>
            <div class="sels">
              <Select v-model="rankModel" :options="rankOptions" label="Rank" width="13rem" />
              <Select
                v-if="patchOptions.length"
                v-model="patchModel"
                :options="patchOptions"
                label="Patch"
                width="13rem"
              />
            </div>
          </div>
        </aside>

        <div class="min-w-0">
          <div class="nb-title">
            <div>
              <h1>{{ tab ? `${TAB_TITLE[tab]}: pick a champion` : 'Champions' }}</h1>
              <p class="nb-meta">
                Builds, runes, matchups and stats for each one, in its main role
              </p>
            </div>
            <div class="end">
              <label class="nb-search">
                <Search :size="14" aria-hidden="true" />
                <span class="nb-sr">Search a champion</span>
                <input v-model="query" type="search" placeholder="Search a champion" />
              </label>
              <Select
                v-model="sortChoice"
                :options="SORTS"
                label="Sort"
                width="11rem"
                align="right"
              />
              <div class="nb-seg" role="group" aria-label="View">
                <button
                  type="button"
                  :class="{ on: view === 'grid' }"
                  :aria-pressed="view === 'grid'"
                  @click="view = 'grid'"
                >
                  Grid
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
          </div>

          <p v-if="!rows.length" class="nb-panel nb-empty">No champion matches these filters.</p>

          <div v-else-if="view === 'grid'" class="nv-tiles">
            <Link
              v-for="x in shown"
              :key="x.c.id"
              :href="href(x.c.slug, x.main?.position)"
              class="nv-tile"
              prefetch="hover"
              cache-for="30s"
            >
              <span v-if="x.main" class="rl" :title="roleName(x.main.position)"
                ><RoleIcon :lane="roleOf(x.main.position).lane" :size="12"
              /></span>
              <span class="pic"><ChampIcon :id="x.c.id" :size="52" :title="x.c.name" /></span>
              <b>{{ x.c.name }}</b>
              <span class="m"
                ><template v-if="x.main"
                  ><TierMark :tier="x.main.tier" /><span class="num">{{
                    pct(x.main.win)
                  }}</span></template
                ><template v-else>No games</template></span
              >
            </Link>
          </div>

          <div v-else class="nb-panel nb-table" role="table" aria-label="Champions">
            <div class="nb-tr th dir-cols" role="row">
              <span role="columnheader" :aria-sort="ariaSort(sort, 'name')"
                ><SortHead
                  label="Champion"
                  :active="sort.key === 'name'"
                  :dir="sort.dir"
                  @sort="by('name')"
              /></span>
              <span role="columnheader" class="hm">Role</span>
              <span role="columnheader" :aria-sort="ariaSort(sort, 'tier')"
                ><SortHead
                  label="Tier"
                  :active="sort.key === 'tier'"
                  :dir="sort.dir"
                  @sort="by('tier')"
              /></span>
              <span role="columnheader" class="r" :aria-sort="ariaSort(sort, 'win')"
                ><SortHead
                  label="Win"
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
            </div>
            <div v-for="x in shown" :key="x.c.id" class="nb-tr link dir-cols" role="row">
              <span class="c" role="cell"
                ><span class="pic"><ChampIcon :id="x.c.id" :size="26" /></span
                ><Link
                  :href="href(x.c.slug, x.main?.position)"
                  class="stretch"
                  prefetch="hover"
                  cache-for="30s"
                  ><b>{{ x.c.name }}</b></Link
                ></span
              >
              <span class="c hm" role="cell"
                ><template v-if="x.main"
                  ><RoleIcon :lane="roleOf(x.main.position).lane" :size="14" />{{
                    roleName(x.main.position)
                  }}</template
                ></span
              >
              <span role="cell"><TierMark :tier="x.main?.tier" /></span>
              <span class="r b num" role="cell">{{ pct(x.main?.win) }}</span>
              <span class="r num" role="cell">{{ pct(x.main?.pick) }}</span>
              <span class="r num hm" role="cell">{{ pct(x.main?.ban) }}</span>
              <span class="r num hm" role="cell">{{ x.main ? thousands(x.main.games) : '-' }}</span>
            </div>
          </div>

          <div
            v-if="view === 'grid' && !all && !query && rows.length > FIRST"
            class="nb-foot"
            style="border: 0"
          >
            <button type="button" class="iv-btn" @click="all = true">
              Show the other {{ rows.length - FIRST }}
            </button>
          </div>
        </div>
      </div>
    </main>
    <SiteFooter />
  </div>
</template>
