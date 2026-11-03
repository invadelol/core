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
import { leagueData } from '../../lib/pro_pages.js'
import { matchList, type ProMatch } from '../../lib/pro_matches.js'
import MatchCard from '../../components/pros/MatchCard.vue'
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
  photo?: string
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
    photo?: string
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
  /** The ladder's servers (every one with a pro in Master and above), and where it ranks. */
  servers?: { slug: string; label: string; pros: number }[]
  on?: string
  /** The league's next games, and the international events running now. */
  matches?: {
    league: ProMatch[]
    international: { next: ProMatch[]; results: ProMatch[] }
  }
}>()

const inertia = usePage()
const leagueView = computed(() => leagueData(props.data))
const teamGroups = computed(() =>
  (Array.isArray(props.groups) ? props.groups : [])
    .filter((g) => g?.league)
    .map((g) => ({ ...g, teams: Array.isArray(g.teams) ? g.teams : [] }))
)
const leagueGames = computed(() => matchList(props.matches?.league))
const intlNext = computed(() => matchList(props.matches?.international?.next))
const intlGames = computed(() =>
  intlNext.value.length ? intlNext.value : matchList(props.matches?.international?.results)
)
/** The international event's name when one runs, else "International". */
const intlLeague = computed(() => {
  const leagues = new Set(intlGames.value.map((m) => m.league?.slug))
  return leagues.size === 1 ? (intlGames.value[0]?.league ?? null) : null
})
const ladderRows = computed(() =>
  (Array.isArray(props.ladder) ? props.ladder : []).filter((r) => r?.pro && r.account)
)
const title = computed(
  () => (inertia.props.social as { title?: string } | undefined)?.title ?? 'Pros'
)

/* ── League view ─────────────────────────────────────────────── */
const role = ref<string | null>(null)
const server = ref<string>('')
const query = ref('')
type Key = 'rank' | 'name' | 'team' | 'move' | 'record'
const sort = shallowRef<Sort<Key>>({ key: 'rank', dir: 'asc' })
const SORTS = [
  { value: 'rank', label: 'Highest LP' },
  { value: 'move', label: 'Last 24 h' },
  { value: 'record', label: 'Games, 30 days' },
  { value: 'name', label: 'Name' },
] as const
const sortOptions = computed(() =>
  leagueMoved.value ? SORTS : SORTS.filter((o) => o.value !== 'move')
)
const sortModel = computed({
  get: () => sort.value.key,
  set: (key: Key) => (sort.value = { key, dir: key === 'name' || key === 'rank' ? 'asc' : 'desc' }),
})
/** Every server a player's best account is on, with how many players. */
const serverOptions = computed(() => {
  const count = new Map<string, number>()
  for (const p of leagueView.value?.players ?? []) {
    if (p.best) count.set(p.best.platform, (count.get(p.best.platform) ?? 0) + 1)
  }
  const known = Object.keys(SERVER).filter((s) => count.has(s))
  const other = [...count.keys()].filter((s) => !SERVER[s]).sort()
  return [
    { value: '', label: 'All servers' },
    ...[...known, ...other].map((s) => ({
      value: s,
      label: SERVER[s] ?? s,
      meta: String(count.get(s)),
    })),
  ]
})
const place = computed(
  () => new Map((leagueView.value?.players ?? []).map((p, i) => [p.slug, i + 1]))
)
const players = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = (leagueView.value?.players ?? []).filter(
    (p) =>
      (!role.value || p.role === role.value) &&
      (!server.value || p.best?.platform === server.value) &&
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
  return (leagueView.value?.teams ?? []).filter((t) => !q || t.name.toLowerCase().includes(q))
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
const moved = computed(() => (leagueView.value?.players ?? []).some((p) => p.move))

/* ── Ladder view ─────────────────────────────────────────────── */
const ladderHref = (c: { server?: string | null; role?: string | null }) => {
  const q = new URLSearchParams({ view: 'ladder' })
  const s = c.server === undefined ? props.filters?.server : c.server
  const r = c.role === undefined ? props.filters?.role : c.role
  if (s) q.set('server', s)
  if (r) q.set('role', r)
  return `/pros?${q}`
}
const ladderServers = computed(() => {
  const list = (Array.isArray(props.servers) ? props.servers : []).map((s) => ({
    value: s.slug,
    label: s.label,
    meta: thousands(s.pros),
  }))
  // A server asked for that has no pro with this role stays readable as the choice.
  const asked = props.filters?.server
  if (asked && !list.some((s) => s.value === asked)) {
    list.push({ value: asked, label: asked.toUpperCase(), meta: '0' })
  }
  return [{ value: '', label: 'All servers' }, ...list]
})
const ladderServer = computed({
  get: () => props.filters?.server ?? '',
  set: (v: string) => router.visit(ladderHref({ server: v || null }), { preserveScroll: true }),
})
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
const ladderMoved = computed(() => ladderRows.value.some((p) => p.move))
/** The 24-hour column waits for a day of rank history; until then it is left out. */
const leagueMoved = computed(() => players.value.some((p) => p.move))

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
  slug === props.leagues?.[0]?.slug ? '/pros' : `/pros?league=${slug}`
const crumbs = computed(() => {
  if (props.view === 'ladder') return [{ label: 'Pros', href: '/pros' }, { label: 'Ladder' }]
  if (props.view === 'teams') return [{ label: 'Pros', href: '/pros' }, { label: 'Teams' }]
  return [{ label: 'Pros', href: '/pros' }, { label: leagueView.value?.league.code ?? '' }]
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
                :class="{ on: view === 'league' && leagueView?.league.slug === l.slug }"
                :aria-current="
                  view === 'league' && leagueView?.league.slug === l.slug ? 'page' : undefined
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
          <div v-if="view === 'league' && serverOptions.length > 2" class="grp">
            <span class="nb-label">Server</span>
            <div class="sels">
              <Select v-model="server" :options="serverOptions" label="Server" width="12rem" />
            </div>
          </div>
          <div v-else-if="view === 'ladder' && ladderServers.length > 2" class="grp">
            <span class="nb-label">Server</span>
            <div class="sels">
              <Select
                v-model="ladderServer"
                :options="ladderServers"
                label="Server"
                width="12rem"
              />
            </div>
          </div>
        </aside>

        <div class="min-w-0">
          <!-- A league -->
          <template v-if="view === 'league' && leagueView">
            <div class="nb-title">
              <div style="display: flex; align-items: center; gap: 16px; min-width: 0">
                <Logo :league="leagueView.league" :size="56" eager />
                <div class="min-w-0">
                  <h1>{{ leagueView.league.code }}</h1>
                  <p class="nb-meta num">
                    {{ leagueView.league.name }}, {{ leagueView.counts.teams }} teams,
                    {{ leagueView.counts.players }} players,
                    {{ thousands(leagueView.counts.accounts) }} ranked accounts
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
                  :options="sortOptions"
                  label="Sort"
                  width="12rem"
                  align="right"
                />
              </div>
            </div>

            <section v-if="intlGames.length" class="nb-panel pm-strip" aria-labelledby="h-intl">
              <div class="nb-ph">
                <Logo v-if="intlLeague" :league="intlLeague" :size="20" />
                <h2 id="h-intl">{{ intlLeague?.name ?? 'International' }}</h2>
                <span class="nb-meta">{{ intlNext.length ? 'Next games' : 'Latest results' }}</span>
                <span v-if="intlGames[0]?.tournament" class="end nb-meta">{{
                  intlGames[0].tournament
                }}</span>
              </div>
              <div class="nb-pb">
                <div class="pm-grid">
                  <MatchCard
                    v-for="mt in intlGames"
                    :key="mt.id"
                    :match="mt"
                    :show-league="!intlLeague"
                  />
                </div>
              </div>
            </section>
            <section v-if="leagueGames.length" class="nb-panel pm-strip" aria-labelledby="h-next">
              <div class="nb-ph">
                <h2 id="h-next">Next games</h2>
                <span class="nb-meta">{{ leagueView.league.code }}</span>
              </div>
              <div class="nb-pb">
                <div class="pm-grid">
                  <MatchCard v-for="mt in leagueGames" :key="mt.id" :match="mt" />
                </div>
              </div>
            </section>

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

            <div
              class="nb-panel nb-table"
              role="table"
              :aria-label="`${leagueView.league.code} players`"
            >
              <div class="nb-tr th pr-cols" :class="{ 'no-mv': !leagueMoved }" role="row">
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
                <span
                  v-if="leagueMoved"
                  role="columnheader"
                  class="r"
                  :aria-sort="ariaSort(sort, 'move')"
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
                :class="{ 'no-mv': !leagueMoved }"
                role="row"
                style="min-height: 52px"
              >
                <span class="rk num" role="cell">{{ place.get(p.slug) }}</span>
                <span class="c" role="cell">
                  <ProPhoto :slug="p.slug" :photo="p.photo" :width="36" :height="36" />
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
                <span v-if="leagueMoved" class="pr-mv num" role="cell"
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
                  {{ teamGroups.reduce((n, g) => n + g.teams.length, 0) }} teams in
                  {{ teamGroups.length }} leagues
                </p>
              </div>
            </div>
            <section
              v-for="g in teamGroups"
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
                  {{ thousands(total ?? 0) }} {{ total === 1 ? 'pro' : 'pros' }} in Master and above
                  on {{ on ?? 'every server' }}, by LP
                </p>
              </div>
            </div>
            <div class="nb-panel nb-table" role="table" aria-label="Pro ladder">
              <div class="nb-tr th ld-cols" :class="{ 'no-mv': !ladderMoved }" role="row">
                <span role="columnheader">#</span><span role="columnheader">Player</span
                ><span role="columnheader" class="hm">Team</span
                ><span role="columnheader" class="hm">Server</span
                ><span role="columnheader">Rank</span
                ><span v-if="ladderMoved" role="columnheader" class="r">Last 24 h</span>
              </div>
              <p v-if="!ladderRows.length" class="nb-empty">
                No pro in Master and above with these filters.
              </p>
              <div
                v-for="r in ladderRows"
                :key="r.pro.slug"
                class="nb-tr link ld-cols"
                :class="{ 'no-mv': !ladderMoved }"
                role="row"
                style="min-height: 48px"
              >
                <span class="rk num" role="cell">{{ r.place }}</span>
                <span class="c" role="cell">
                  <ProPhoto :slug="r.pro.slug" :photo="r.pro.photo" :width="30" :height="30" />
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
                <span v-if="ladderMoved" class="pr-mv num" role="cell"
                  ><template v-if="r.move"
                    ><b :class="placesCls(r.move)">{{ placesText(r.move) }}</b
                    ><small>{{ lpText(r.move) }}</small></template
                  ><small v-else>-</small></span
                >
              </div>
              <div v-if="ladderRows.length < (total ?? 0)" class="nb-foot">
                <button type="button" class="iv-btn sm" :disabled="loading" @click="loadMore">
                  Show {{ Math.min(pageSize ?? 100, (total ?? 0) - ladderRows.length) }} more
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
