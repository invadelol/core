<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { Head, Link, router, usePage } from '@inertiajs/vue3'
import { ChevronRight, Search } from 'lucide-vue-next'
import { ChampIcon, RoleIcon } from '@invadelol/ui'
import AppHeader from '../../components/AppHeader.vue'
import SiteFooter from '../../components/SiteFooter.vue'
import Crumbs from '../../components/champions/Crumbs.vue'
import Logo from '../../components/champions/Logo.vue'
import Crest from '../../components/champions/Crest.vue'
import ProPhoto from '../../components/champions/ProPhoto.vue'
import SortHead from '../../components/champions/SortHead.vue'
import Select from '../../components/ui/Select.vue'
import {
  PRO_ROLES,
  SERVER,
  ariaSort,
  countryName,
  proRole,
  rankText,
  signed,
  sortRows,
  thousands,
  tierColor,
  type Sort,
} from '../../lib/board.js'
import { afterPaint } from '../../lib/after_paint.js'
import '../../css/champions.css'

interface LeagueRef {
  slug: string
  code: string
  name: string
}
interface TeamRef {
  id: string
  slug: string
  name: string
  shortName: string | null
}
interface Best {
  platform: string
  tier: string
  division: number | null
  lp: number
}
interface Player {
  slug: string
  name: string
  role: string | null
  country: string | null
  starter: boolean
  team: TeamRef | null
  best: Best | null
  move: { places: number | null; lp: number } | null
  record: { games: number; wins: number } | null
  champions: { champion: number; games: number }[]
}
interface LadderRow {
  place: number
  pro: {
    slug: string
    name: string
    role: string | null
    country: string | null
    team: TeamRef | null
  }
  league: LeagueRef | null
  account: {
    gameName: string
    tagLine: string
    platform: string
    tier: string
    division: number | null
    lp: number
  }
  move: { places: number | null; lp: number } | null
}

/** `/pros`: a league's teams and players, every team by league, or the ladder of every pro. */
const props = defineProps<{
  view: 'league' | 'teams' | 'ladder'
  leagues: LeagueRef[]
  data?: {
    league: LeagueRef
    teams: (TeamRef & { players: number; lp: number | null })[]
    players: Player[]
    counts: { teams: number; players: number; accounts: number }
  }
  groups?: { league: LeagueRef; teams: (TeamRef & { players: number; lp: number | null })[] }[]
  ladder?: LadderRow[]
  total?: number
  page?: number
  pageSize?: number
  filters?: { server: string | null; role: string | null }
}>()

const inertia = usePage()
const title = computed(
  () => (inertia.props.social as { title?: string } | undefined)?.title ?? 'Pros'
)

/* ── League view ─────────────────────────────────────────────── */
const role = ref<string | null>(null)
const server = ref<string>('ALL')
const query = ref('')
type Key = 'rank' | 'name' | 'team' | 'move' | 'record'
const sort = shallowRef<Sort<Key>>({ key: 'rank', dir: 'asc' })
const SORTS = [
  { value: 'rank', label: 'Highest LP' },
  { value: 'move', label: 'Last 24 h' },
  { value: 'record', label: 'Games, 30 days' },
  { value: 'name', label: 'Name' },
] as const
const sortModel = computed({
  get: () => sort.value.key,
  set: (key: Key) => (sort.value = { key, dir: key === 'name' || key === 'rank' ? 'asc' : 'desc' }),
})
const servers = computed(() => {
  const set = new Set((props.data?.players ?? []).flatMap((p) => (p.best ? [p.best.platform] : [])))
  return ['ALL', ...['EUW1', 'NA1', 'BR1'].filter((s) => set.has(s))]
})
const place = computed(() => new Map((props.data?.players ?? []).map((p, i) => [p.slug, i + 1])))
const players = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = (props.data?.players ?? []).filter(
    (p) =>
      (!role.value || p.role === role.value) &&
      (server.value === 'ALL' || p.best?.platform === server.value) &&
      (!q || p.name.toLowerCase().includes(q) || (p.team?.name ?? '').toLowerCase().includes(q))
  )
  const { key, dir } = sort.value
  if (key === 'rank') return dir === 'asc' ? list : [...list].reverse()
  return sortRows(
    list,
    (p) =>
      key === 'name'
        ? p.name
        : key === 'team'
          ? (p.team?.name ?? null)
          : key === 'move'
            ? (p.move?.lp ?? null)
            : (p.record?.games ?? null),
    dir
  )
})
const teamsShown = computed(() => {
  const q = query.value.trim().toLowerCase()
  return (props.data?.teams ?? []).filter((t) => !q || t.name.toLowerCase().includes(q))
})
const FIRST = 50
const more = ref(false)
const shownPlayers = computed(() => (more.value ? players.value : players.value.slice(0, FIRST)))
function by(key: Key) {
  const was = sort.value
  afterPaint(() => {
    sort.value = {
      key,
      dir:
        was.key === key
          ? was.dir === 'asc'
            ? 'desc'
            : 'asc'
          : key === 'name' || key === 'rank'
            ? 'asc'
            : 'desc',
    }
  })
}
const moved = computed(() => (props.data?.players ?? []).some((p) => p.move))

/* ── Ladder view ─────────────────────────────────────────────── */
const ladderHref = (c: { server?: string | null; role?: string | null }) => {
  const q = new URLSearchParams({ view: 'ladder' })
  const s = c.server === undefined ? props.filters?.server : c.server
  const r = c.role === undefined ? props.filters?.role : c.role
  if (s) q.set('server', s)
  if (r) q.set('role', r)
  return `/pros?${q}`
}
const loading = ref(false)
function loadMore() {
  if (loading.value) return
  loading.value = true
  router.reload({
    data: { page: (props.page ?? 1) + 1 },
    only: ['ladder', 'page'],
    preserveUrl: true,
    onFinish: () => (loading.value = false),
  })
}
const ladderMoved = computed(() => (props.ladder ?? []).some((p) => p.move))

const placesText = (m: { places: number | null } | null) =>
  !m || m.places === null
    ? ''
    : m.places > 0
      ? `▲ ${m.places}`
      : m.places < 0
        ? `▼ ${-m.places}`
        : '='
const placesCls = (m: { places: number | null } | null) =>
  !m || !m.places ? 'qq' : m.places > 0 ? 'up' : 'down'
const lpText = (m: { lp: number } | null) => (m ? `${signed(m.lp)} LP` : '-')
const roleLabel = (r: string | null) => proRole(r)?.label ?? ''
const leagueHref = (slug: string) =>
  slug === props.leagues[0]?.slug ? '/pros' : `/pros?league=${slug}`
const crumbs = computed(() => {
  if (props.view === 'ladder') return [{ label: 'Pros', href: '/pros' }, { label: 'Ladder' }]
  if (props.view === 'teams') return [{ label: 'Pros', href: '/pros' }, { label: 'Teams' }]
  return [{ label: 'Pros', href: '/pros' }, { label: props.data?.league.code ?? '' }]
})
</script>

<template>
  <Head :title="title" />
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <main class="nb nb-page flex-1">
      <Crumbs :items="crumbs">
        <template #end><span>Ranks refresh through the day</span></template>
      </Crumbs>

      <div class="nb-layout">
        <aside class="nb-filt" aria-label="Filters">
          <div class="grp wide">
            <span class="nb-label">League</span>
            <nav class="opts" aria-label="League">
              <Link
                v-for="l in leagues"
                :key="l.slug"
                :href="leagueHref(l.slug)"
                class="opt"
                :class="{ on: view === 'league' && data?.league.slug === l.slug }"
                :aria-current="
                  view === 'league' && data?.league.slug === l.slug ? 'page' : undefined
                "
                prefetch="hover"
                ><Logo :league="l" :size="20" eager />{{ l.code }}</Link
              >
              <Link
                href="/pros?view=teams"
                class="opt"
                :class="{ on: view === 'teams' }"
                :aria-current="view === 'teams' ? 'page' : undefined"
                prefetch="hover"
                >Every team<span class="ic" style="margin-left: auto"
                  ><ChevronRight :size="13" aria-hidden="true" /></span
              ></Link>
              <Link
                href="/pros?view=ladder"
                class="opt"
                :class="{ on: view === 'ladder' }"
                :aria-current="view === 'ladder' ? 'page' : undefined"
                prefetch="hover"
                >Ladder<span class="ic" style="margin-left: auto"
                  ><ChevronRight :size="13" aria-hidden="true" /></span
              ></Link>
            </nav>
          </div>
          <div v-if="view !== 'teams'" class="grp wide">
            <span class="nb-label">Role</span>
            <div v-if="view === 'league'" class="opts" role="radiogroup" aria-label="Role">
              <button
                type="button"
                class="opt"
                :class="{ on: !role }"
                role="radio"
                :aria-checked="!role"
                @click="role = null"
              >
                Every role
              </button>
              <button
                v-for="r in PRO_ROLES"
                :key="r.role"
                type="button"
                class="opt"
                :class="{ on: role === r.role }"
                role="radio"
                :aria-checked="role === r.role"
                @click="role = r.role"
              >
                <span class="ic"><RoleIcon :lane="r.lane" :size="15" /></span>{{ r.label }}
              </button>
            </div>
            <nav v-else class="opts" aria-label="Role">
              <Link
                :href="ladderHref({ role: null })"
                class="opt"
                :class="{ on: !filters?.role }"
                preserve-scroll
                >Every role</Link
              >
              <Link
                v-for="r in PRO_ROLES"
                :key="r.role"
                :href="ladderHref({ role: r.slug })"
                class="opt"
                :class="{ on: filters?.role === r.slug }"
                preserve-scroll
              >
                <span class="ic"><RoleIcon :lane="r.lane" :size="15" /></span>{{ r.label }}
              </Link>
            </nav>
          </div>
          <div v-if="view !== 'teams'" class="grp">
            <span class="nb-label">Server</span>
            <div
              v-if="view === 'league'"
              class="nb-seg"
              role="group"
              aria-label="Server"
              style="margin-left: 8px"
            >
              <button
                v-for="s in servers"
                :key="s"
                type="button"
                :class="{ on: server === s }"
                :aria-pressed="server === s"
                @click="server = s"
              >
                {{ s === 'ALL' ? 'All' : SERVER[s] }}
              </button>
            </div>
            <nav v-else class="nb-seg" aria-label="Server" style="margin-left: 8px">
              <Link
                :href="ladderHref({ server: null })"
                :class="{ on: !filters?.server }"
                preserve-scroll
                >All</Link
              >
              <Link
                v-for="s in ['euw', 'na', 'br']"
                :key="s"
                :href="ladderHref({ server: s })"
                :class="{ on: filters?.server === s }"
                preserve-scroll
                >{{ s.toUpperCase() }}</Link
              >
            </nav>
          </div>
        </aside>

        <div class="min-w-0">
          <!-- A league -->
          <template v-if="view === 'league' && data">
            <div class="nb-title">
              <div style="display: flex; align-items: center; gap: 16px; min-width: 0">
                <Logo :league="data.league" :size="56" eager />
                <div class="min-w-0">
                  <h1>{{ data.league.code }}</h1>
                  <p class="nb-meta num">
                    {{ data.league.name }}, {{ data.counts.teams }} teams,
                    {{ data.counts.players }} players, {{ thousands(data.counts.accounts) }} ranked
                    accounts
                  </p>
                </div>
              </div>
              <div class="end">
                <label class="nb-search">
                  <Search :size="14" aria-hidden="true" /><span class="nb-sr"
                    >Find a pro or a team</span
                  >
                  <input v-model="query" type="search" placeholder="Find a pro or a team" />
                </label>
                <Select
                  v-model="sortModel"
                  :options="SORTS"
                  label="Sort"
                  width="12rem"
                  align="right"
                />
              </div>
            </div>

            <section class="nb-panel" style="margin-bottom: 12px">
              <div class="nb-ph">
                <h2>Teams</h2>
                <span class="nb-meta">Average LP of the starters in Master and above</span>
              </div>
              <div class="nb-pb" style="padding: 6px">
                <div v-if="teamsShown.length" class="pr-teams">
                  <Link
                    v-for="t in teamsShown"
                    :key="t.id"
                    :href="`/team/${t.slug}`"
                    prefetch="hover"
                  >
                    <Logo :team="t" :size="32" eager />
                    <span class="min-w-0"
                      ><b>{{ t.name }}</b
                      ><small class="num">{{
                        t.lp !== null ? `${thousands(t.lp)} LP` : `${t.players} players`
                      }}</small></span
                    >
                  </Link>
                </div>
                <p v-else class="nb-empty">No team matches “{{ query }}”.</p>
              </div>
            </section>

            <div class="nb-panel nb-table" role="table" :aria-label="`${data.league.code} players`">
              <div class="nb-tr th pr-cols" role="row">
                <span role="columnheader" :aria-sort="ariaSort(sort, 'rank')"
                  ><SortHead
                    label="#"
                    title="By best account"
                    :active="sort.key === 'rank'"
                    :dir="sort.dir"
                    @sort="by('rank')"
                /></span>
                <span role="columnheader" :aria-sort="ariaSort(sort, 'name')"
                  ><SortHead
                    label="Player"
                    :active="sort.key === 'name'"
                    :dir="sort.dir"
                    @sort="by('name')"
                /></span>
                <span role="columnheader" class="hm" :aria-sort="ariaSort(sort, 'team')"
                  ><SortHead
                    label="Team"
                    :active="sort.key === 'team'"
                    :dir="sort.dir"
                    @sort="by('team')"
                /></span>
                <span role="columnheader" class="hm ht">Role</span>
                <span role="columnheader">Best account</span>
                <span role="columnheader" class="r" :aria-sort="ariaSort(sort, 'move')"
                  ><SortHead
                    label="Last 24 h"
                    title="Places on this list and LP"
                    :active="sort.key === 'move'"
                    :dir="sort.dir"
                    @sort="by('move')"
                /></span>
                <span role="columnheader" class="r hm ht" :aria-sort="ariaSort(sort, 'record')"
                  ><SortHead
                    label="30 days"
                    title="Ranked solo games, every account"
                    :active="sort.key === 'record'"
                    :dir="sort.dir"
                    @sort="by('record')"
                /></span>
                <span role="columnheader" class="r hm">Plays</span>
              </div>
              <p v-if="!players.length" class="nb-empty">No player matches these filters.</p>
              <div
                v-for="p in shownPlayers"
                :key="p.slug"
                class="nb-tr link pr-cols"
                role="row"
                style="min-height: 52px"
              >
                <span class="rk num" role="cell">{{ place.get(p.slug) }}</span>
                <span class="c" role="cell">
                  <ProPhoto :width="36" :height="36" />
                  <span class="min-w-0"
                    ><Link :href="`/pro/${p.slug}`" class="stretch" prefetch="hover"
                      ><b>{{ p.name }}</b></Link
                    ><small>{{
                      countryName(p.country) || (p.starter ? 'Starter' : 'Sub')
                    }}</small></span
                  >
                </span>
                <span class="c hm" role="cell" style="gap: 8px"
                  ><template v-if="p.team"
                    ><Logo :team="p.team" :size="20" /><span
                      class="t"
                      style="color: var(--text-2)"
                      >{{ p.team.name }}</span
                    ></template
                  ></span
                >
                <span class="c hm ht" role="cell" style="gap: 6px; color: var(--text-2)"
                  ><template v-if="proRole(p.role)"
                    ><RoleIcon :lane="proRole(p.role)!.lane" :size="14" />{{
                      roleLabel(p.role)
                    }}</template
                  ></span
                >
                <span class="c" role="cell" style="gap: 8px"
                  ><Crest :tier="p.best?.tier ?? null" :size="18" /><span
                    class="num t"
                    style="font-weight: 600"
                    :style="tierColor(p.best?.tier)"
                    >{{
                      p.best ? rankText(p.best.tier, p.best.division, p.best.lp) : 'Unranked'
                    }}</span
                  ></span
                >
                <span class="pr-mv num" role="cell"
                  ><template v-if="p.move"
                    ><b :class="placesCls(p.move)">{{ placesText(p.move) }}</b
                    ><small>{{ lpText(p.move) }}</small></template
                  ><small v-else>-</small></span
                >
                <span class="r num hm ht" role="cell">{{
                  p.record ? `${p.record.wins}W ${p.record.games - p.record.wins}L` : '-'
                }}</span>
                <span class="hm plays" role="cell"
                  ><ChampIcon
                    v-for="c in p.champions"
                    :key="c.champion"
                    :id="c.champion"
                    :size="22"
                /></span>
              </div>
              <div v-if="!more && players.length > FIRST" class="nb-foot">
                <button type="button" class="iv-btn sm" @click="more = true">
                  Show {{ players.length - FIRST }} more
                </button>
              </div>
            </div>
            <p v-if="!moved" class="nb-data">
              Moves of the last 24 hours show once a day of ranks is kept.
            </p>
          </template>

          <!-- Every team -->
          <template v-else-if="view === 'teams'">
            <div class="nb-title">
              <div>
                <h1>Teams</h1>
                <p class="nb-meta num">
                  {{ (groups ?? []).reduce((n, g) => n + g.teams.length, 0) }} teams in
                  {{ (groups ?? []).length }} leagues
                </p>
              </div>
            </div>
            <section
              v-for="g in groups"
              :key="g.league.slug"
              class="nb-panel"
              style="margin-bottom: 12px"
            >
              <div class="nb-ph">
                <Logo :league="g.league" :size="24" />
                <h2>{{ g.league.code }}</h2>
                <span class="nb-meta">{{ g.league.name }}</span>
                <span class="end"
                  ><Link :href="leagueHref(g.league.slug)"
                    >Players<ChevronRight :size="12" aria-hidden="true" /></Link
                ></span>
              </div>
              <div class="nb-pb" style="padding: 6px">
                <div class="pr-teams">
                  <Link v-for="t in g.teams" :key="t.id" :href="`/team/${t.slug}`" prefetch="hover">
                    <Logo :team="t" :size="32" />
                    <span class="min-w-0"
                      ><b>{{ t.name }}</b
                      ><small class="num">{{
                        t.lp !== null ? `${thousands(t.lp)} LP` : `${t.players} players`
                      }}</small></span
                    >
                  </Link>
                </div>
              </div>
            </section>
          </template>

          <!-- The ladder -->
          <template v-else-if="view === 'ladder'">
            <div class="nb-title">
              <div>
                <h1>Pro ladder</h1>
                <p class="nb-meta num">
                  {{ thousands(total ?? 0) }} pros in Master and above on EUW, NA and BR, by LP
                </p>
              </div>
            </div>
            <div class="nb-panel nb-table" role="table" aria-label="Pro ladder">
              <div class="nb-tr th ld-cols" role="row">
                <span role="columnheader">#</span><span role="columnheader">Player</span
                ><span role="columnheader" class="hm">Team</span
                ><span role="columnheader" class="hm">Server</span
                ><span role="columnheader">Rank</span
                ><span role="columnheader" class="r">Last 24 h</span>
              </div>
              <p v-if="!ladder?.length" class="nb-empty">
                No pro in Master and above with these filters.
              </p>
              <div
                v-for="r in ladder"
                :key="r.pro.slug"
                class="nb-tr link ld-cols"
                role="row"
                style="min-height: 48px"
              >
                <span class="rk num" role="cell">{{ r.place }}</span>
                <span class="c" role="cell">
                  <ProPhoto :width="30" :height="30" />
                  <span class="min-w-0"
                    ><Link :href="`/pro/${r.pro.slug}`" class="stretch" prefetch="hover"
                      ><b>{{ r.pro.name }}</b></Link
                    ><small>{{ roleLabel(r.pro.role) || countryName(r.pro.country) }}</small></span
                  >
                </span>
                <span class="c hm" role="cell" style="gap: 8px"
                  ><template v-if="r.pro.team"
                    ><Logo :team="r.pro.team" :size="20" /><span
                      class="t"
                      style="color: var(--text-2)"
                      >{{ r.pro.team.name }}</span
                    ><Logo v-if="r.league" :league="r.league" :size="16" /></template
                  ><span v-else class="q">No team</span></span
                >
                <span class="hm num" role="cell">{{
                  SERVER[r.account.platform] ?? r.account.platform
                }}</span>
                <span class="c" role="cell" style="gap: 8px"
                  ><Crest :tier="r.account.tier" :size="18" /><span
                    class="num t"
                    style="font-weight: 600"
                    :style="tierColor(r.account.tier)"
                    >{{ rankText(r.account.tier, r.account.division, r.account.lp) }}</span
                  ></span
                >
                <span class="pr-mv num" role="cell"
                  ><template v-if="r.move"
                    ><b :class="placesCls(r.move)">{{ placesText(r.move) }}</b
                    ><small>{{ lpText(r.move) }}</small></template
                  ><small v-else>-</small></span
                >
              </div>
              <div v-if="(ladder?.length ?? 0) < (total ?? 0)" class="nb-foot">
                <button type="button" class="iv-btn sm" :disabled="loading" @click="loadMore">
                  Show {{ Math.min(pageSize ?? 100, (total ?? 0) - (ladder?.length ?? 0)) }} more
                </button>
              </div>
            </div>
            <p v-if="!ladderMoved" class="nb-data">
              Moves of the last 24 hours show once a day of ranks is kept.
            </p>
          </template>
        </div>
      </div>
    </main>
    <SiteFooter />
  </div>
</template>
