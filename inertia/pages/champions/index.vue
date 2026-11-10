<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import { Search } from 'lucide-vue-next'
import { ChampIcon, RoleIcon } from '@invadelol/ui'
import AppHeader from '../../components/AppHeader.vue'
import SiteFooter from '../../components/SiteFooter.vue'
import Crumbs from '../../components/champions/Crumbs.vue'
import SortHead from '../../components/champions/SortHead.vue'
import Select from '../../components/ui/Select.vue'
import { BRACKETS, ROLES, filterQuery, roleOf, type Filter } from '../../lib/champions.js'
import { ariaSort, pct, sortRows, thousands, type Sort } from '../../lib/board.js'
import { afterPaint } from '../../lib/after_paint.js'
import { patchName } from '../../lib/patch.js'
import '../../css/champions.css'
import '../../css/rd-discover.css'

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
const FIRST = 48
const TIER_KEYS = ['S+', 'S', 'A', 'B', 'C', 'D']

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
  { value: 'name', label: 'A to Z' },
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
  props.patches.map((p) => ({ value: p.patch, label: `Patch ${patchName(p.patch)}` }))
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
/** The roles a champion is really played in: a tenth of its games or more, three at most. */
function rolesOf(id: number) {
  const list = statsOf.value.get(id) ?? []
  const total = list.reduce((n, r) => n + r.games, 0)
  return list.filter((r) => total && r.games / total >= 0.1).slice(0, 3)
}
const tierClass = (tier: number | null | undefined) => (tier ? `t${Math.min(tier, 5)}` : '')
const RANK_TEXT: Record<string, string> = {
  all: 'all ranks',
  emerald_plus: 'Emerald and above',
  diamond_plus: 'Diamond and above',
  master_plus: 'Master and above',
}
const rankText = computed(
  () => RANK_TEXT[rank.value] ?? BRACKETS.find((b) => b.value === rank.value)?.label ?? ''
)
</script>

<template>
  <Head :title="($page.props.social as { title?: string } | undefined)?.title ?? 'Champions'" />
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <main id="main" class="page cx flex-1">
      <Crumbs :items="[{ label: 'Champions' }]" />

      <div class="rd-ph cx-ph">
        <div>
          <h1>{{ tab ? `${TAB_TITLE[tab]}: pick a champion` : 'Champions' }}</h1>
          <p class="num">
            <b>{{ champions.length }} champions</b
            ><template v-if="filter"
              >, patch {{ patchName(filter.patch) }}, {{ rankText }}</template
            >
          </p>
        </div>
        <div class="cx-end">
          <div class="rd-seg" role="group" aria-label="Sort">
            <button
              v-for="o in SORTS"
              :key="o.value"
              type="button"
              :class="{ on: sort.key === o.value }"
              :aria-pressed="sort.key === o.value"
              @click="sortChoice = o.value"
            >
              {{ o.label }}
            </button>
          </div>
        </div>
      </div>

      <label class="cx-find dv-bigfield">
        <Search :size="18" aria-hidden="true" />
        <span class="dv-sr">Find a champion</span>
        <input v-model="query" type="search" placeholder="Find a champion" />
      </label>

      <div class="cx-bar">
        <div class="rd-seg cx-roles" role="radiogroup" aria-label="Role">
          <button
            type="button"
            :class="{ on: role === 'ALL' }"
            role="radio"
            :aria-checked="role === 'ALL'"
            @click="role = 'ALL'"
          >
            All roles
          </button>
          <button
            v-for="r in ROLES"
            :key="r.position"
            type="button"
            :class="{ on: role === r.position }"
            role="radio"
            :aria-checked="role === r.position"
            :title="`${counts[r.position]} champions`"
            @click="role = r.position"
          >
            <RoleIcon :lane="r.lane" :size="15" />{{ r.label }}
          </button>
        </div>
        <span class="grow" />
        <div class="cx-cls" role="group" aria-label="Class">
          <button
            type="button"
            class="cx-cl"
            :class="{ on: !classes.length }"
            :aria-pressed="!classes.length"
            @click="classes = []"
          >
            Every class
          </button>
          <button
            v-for="k in CLASSES"
            :key="k"
            type="button"
            class="cx-cl"
            :class="{ on: classes.includes(k) }"
            :aria-pressed="classes.includes(k)"
            @click="toggleClass(k)"
          >
            {{ k.charAt(0).toUpperCase() + k.slice(1) }}
          </button>
        </div>
      </div>

      <div class="cx-bar2">
        <div class="dv-sels dv-sel">
          <Select v-model="rankModel" :options="rankOptions" label="Rank" width="13rem" />
          <Select
            v-if="patchOptions.length"
            v-model="patchModel"
            :options="patchOptions"
            label="Patch"
            width="13rem"
          />
        </div>
        <span class="cx-count num">{{ rows.length }} shown</span>
        <span class="grow" />
        <div class="rd-seg" role="group" aria-label="View">
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

      <p v-if="!rows.length" class="rd-card dv-empty">No champion matches these filters.</p>

      <div v-else-if="view === 'grid'" class="cx-grid">
        <Link
          v-for="x in shown"
          :key="x.c.id"
          :href="href(x.c.slug, x.main?.position)"
          class="cx-t"
          :class="{ top: x.main?.tier === 0 }"
          prefetch="hover"
          cache-for="30s"
        >
          <span class="pic"><ChampIcon :id="x.c.id" :size="84" /></span>
          <b>{{ x.c.name }}</b>
          <span class="rs">
            <span v-for="r in rolesOf(x.c.id)" :key="r.position" :title="roleName(r.position)"
              ><RoleIcon :lane="roleOf(r.position).lane" :size="14"
            /></span>
          </span>
          <span class="ft"
            ><template v-if="x.main"
              ><span v-if="x.main.tier !== null" class="rd-tier" :class="tierClass(x.main.tier)">{{
                TIER_KEYS[x.main.tier]
              }}</span
              ><span class="num">{{ pct(x.main.win) }}</span></template
            ><span v-else class="none">No games</span></span
          >
        </Link>
      </div>

      <div v-else class="rd-card dv-scroll">
        <div class="dv-tb cx-tb" role="table" aria-label="Champions">
          <div class="dv-tr h cx-cols" role="row">
            <span role="columnheader" :aria-sort="ariaSort(sort, 'name')"
              ><SortHead
                label="Champion"
                :active="sort.key === 'name'"
                :dir="sort.dir"
                @sort="by('name')"
            /></span>
            <span role="columnheader">Role</span>
            <span role="columnheader" :aria-sort="ariaSort(sort, 'tier')"
              ><SortHead
                label="Tier"
                :active="sort.key === 'tier'"
                :dir="sort.dir"
                @sort="by('tier')"
            /></span>
            <span role="columnheader" class="r" :aria-sort="ariaSort(sort, 'win')"
              ><SortHead label="Win" :active="sort.key === 'win'" :dir="sort.dir" @sort="by('win')"
            /></span>
            <span role="columnheader" class="r" :aria-sort="ariaSort(sort, 'pick')"
              ><SortHead
                label="Pick"
                :active="sort.key === 'pick'"
                :dir="sort.dir"
                @sort="by('pick')"
            /></span>
            <span role="columnheader" class="r" :aria-sort="ariaSort(sort, 'ban')"
              ><SortHead label="Ban" :active="sort.key === 'ban'" :dir="sort.dir" @sort="by('ban')"
            /></span>
            <span role="columnheader" class="r" :aria-sort="ariaSort(sort, 'games')"
              ><SortHead
                label="Games"
                :active="sort.key === 'games'"
                :dir="sort.dir"
                @sort="by('games')"
            /></span>
          </div>
          <div v-for="x in shown" :key="x.c.id" class="dv-tr cx-cols" role="row">
            <span class="dv-nm" role="cell"
              ><span class="dv-pic"><ChampIcon :id="x.c.id" :size="32" /></span
              ><Link
                :href="href(x.c.slug, x.main?.position)"
                class="dv-stretch"
                prefetch="hover"
                cache-for="30s"
                >{{ x.c.name }}</Link
              ></span
            >
            <span class="dv-role" role="cell"
              ><template v-if="x.main"
                ><RoleIcon :lane="roleOf(x.main.position).lane" :size="14" />{{
                  roleName(x.main.position)
                }}</template
              ></span
            >
            <span role="cell"
              ><span
                v-if="x.main && x.main.tier !== null"
                class="rd-tier"
                :class="tierClass(x.main.tier)"
                >{{ TIER_KEYS[x.main.tier] }}</span
              ><template v-else>-</template></span
            >
            <b class="r num" role="cell">{{ pct(x.main?.win) }}</b>
            <span class="r num" role="cell">{{ pct(x.main?.pick) }}</span>
            <span class="r num" role="cell">{{ pct(x.main?.ban) }}</span>
            <span class="r num" role="cell">{{ x.main ? thousands(x.main.games) : '-' }}</span>
          </div>
        </div>
      </div>

      <div v-if="view === 'grid' && !all && !query && rows.length > FIRST" class="cx-more">
        <button type="button" class="iv-btn" @click="all = true">Show all {{ rows.length }}</button>
      </div>
    </main>
    <SiteFooter />
  </div>
</template>

<style scoped>
.cx-ph {
  padding-top: 8px;
}

.cx-find {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 56px;
  padding: 0 18px;
  color: var(--text-3);
}

.cx-find input {
  flex: 1;
  min-width: 0;
  height: 100%;
  font: 400 16px var(--font);
  color: var(--text-1);
  background: none;
  border: 0;
  outline: 0;
}

.cx-find input::placeholder {
  color: var(--text-3);
}

.cx-find:focus-within {
  box-shadow:
    inset 0 0 0 1px var(--rd-violet),
    0 0 0 4px rgb(123 109 255 / 0.18);
}

.cx-bar,
.cx-bar2 {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.cx-bar {
  margin: 16px 0 12px;
}

.cx-bar2 {
  margin: 0 0 20px;
}

.grow {
  flex: 1;
}

.cx-roles :deep(svg) {
  flex: none;
}

.cx-cls {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cx-cl {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  font: 500 13px var(--font);
  color: var(--text-2);
  background: var(--rd-card);
  border-radius: 7px;
  box-shadow: inset 0 0 0 1px var(--rd-line);
  cursor: pointer;
}

.cx-cl:hover {
  color: var(--text-1);
}

.cx-cl.on {
  color: var(--text-1);
  background: var(--rd-violet-a);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--rd-violet) 60%, transparent);
}

.cx-cl:focus-visible {
  box-shadow: var(--focus);
}

.cx-count {
  font-size: 13px;
  color: var(--text-3);
}

.cx-grid {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 12px;
}

.cx-t {
  position: relative;
  display: block;
  min-width: 0;
  padding: 14px 10px 12px;
  text-align: center;
  background: var(--rd-card);
  border-radius: 10px;
  box-shadow: inset 0 0 0 1px var(--rd-line);
  transition: background-color var(--t-fast) var(--ease);
}

.cx-t:hover {
  background: var(--rd-card-2);
}

.cx-t:focus-visible {
  outline: none;
  box-shadow:
    inset 0 0 0 1px var(--rd-line),
    var(--focus);
}

.cx-t.top {
  background: linear-gradient(180deg, var(--rd-violet-a), var(--rd-card) 60%);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--rd-violet) 50%, transparent);
}

.cx-t .pic {
  display: inline-flex;
  overflow: hidden;
  border-radius: 16px;
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 0.1),
    0 8px 18px -8px rgb(0 0 0 / 0.8);
}

.cx-t .pic :deep(.iv-champ) {
  border-radius: 16px;
}

.cx-t b {
  display: block;
  margin-top: 10px;
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text-1);
}

.cx-t .rs {
  display: flex;
  justify-content: center;
  gap: 5px;
  height: 14px;
  margin-top: 5px;
  color: var(--text-3);
}

.cx-t .ft {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 13px;
  font-weight: 650;
  color: var(--text-1);
}

.cx-t .ft .rd-tier {
  min-width: 26px;
  height: 20px;
  font-size: 11px;
}

.cx-t .none {
  font-weight: 500;
  color: var(--text-3);
}

.cx-tb {
  min-width: 720px;
}

.cx-cols {
  grid-template-columns: minmax(200px, 2fr) 120px 70px repeat(4, minmax(64px, 1fr));
}

.cx-cols :deep(button) {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font: inherit;
  color: inherit;
}

.cx-more {
  margin-top: 20px;
  text-align: center;
}

@media (max-width: 75rem) {
  .cx-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

@media (max-width: 62.5rem) {
  .cx-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 47.99rem) {
  .cx-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .cx-t {
    padding: 12px 6px 10px;
  }

  .cx-t .pic :deep(.iv-champ) {
    width: 64px !important;
    height: 64px !important;
  }

  .cx-end,
  .cx-roles,
  .cx-cls {
    max-width: 100%;
    overflow-x: auto;
  }

  .cx-cls {
    flex-wrap: nowrap;
  }

  .cx-cl {
    flex: none;
  }
}
</style>
