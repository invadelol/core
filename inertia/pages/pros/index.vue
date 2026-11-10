<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { Head, Link, router, usePage } from '@inertiajs/vue3'
import { ChevronRight, Search } from 'lucide-vue-next'
import { ChampIcon, RoleIcon } from '@invadelol/ui'
import AppHeader from '../../components/AppHeader.vue'
import SiteFooter from '../../components/SiteFooter.vue'
import Logo from '../../components/champions/Logo.vue'
import SortHead from '../../components/champions/SortHead.vue'
import ProFace from '../../components/pros/ProFace.vue'
import ProPhoto from '../../components/champions/ProPhoto.vue'
import FormStrip from '../../components/ui/FormStrip.vue'
import WinLoss from '../../components/ui/WinLoss.vue'
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
import { matchList, tournamentPart, type ProMatch } from '../../lib/pro_matches.js'
import MatchCard from '../../components/pros/MatchCard.vue'
import '../../css/champions.css'
import '../../css/rd-players.css'

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
    wins?: number | null
    losses?: number | null
  }
  move: { places: number | null; lp: number } | null
  /** Ten newest ranked solo results, newest first. */
  form?: boolean[]
  champions?: { champion: number; games: number }[]
}
type LadderPro = LadderRow['pro']

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
  filters?: { server: string | null; role: string | null; league?: string | null }
  /** The best pro of each role on this ladder. */
  best?: {
    role: string
    place: number | null
    pro: LadderPro
    account: { platform: string; lp: number; tier: string }
  }[]
  /** The top 50's biggest climbers of the last 24 hours. */
  climbing?: { place: number; pro: LadderPro; move: { places: number | null; lp: number } }[]
  /** How many of the top 50 play each role. */
  split?: { role: string; pros: number }[]
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
const ladderHref = (c: {
  server?: string | null
  role?: string | null
  league?: string | null
}) => {
  const q = new URLSearchParams({ view: 'ladder' })
  const s = c.server === undefined ? props.filters?.server : c.server
  const r = c.role === undefined ? props.filters?.role : c.role
  const l = c.league === undefined ? props.filters?.league : c.league
  if (l) q.set('league', l)
  if (s) q.set('server', s)
  if (r) q.set('role', r)
  return `/pros?${q}`
}
const bestRows = computed(() => (Array.isArray(props.best) ? props.best : []).filter(Boolean))
/** The highest of the best: lit violet. */
const leader = computed(
  () => [...bestRows.value].sort((a, b) => (a.place ?? 1e9) - (b.place ?? 1e9))[0]?.pro.slug ?? null
)
const climbing = computed(() => (Array.isArray(props.climbing) ? props.climbing : []))
const split = computed(() => {
  const list = Array.isArray(props.split) ? props.split : []
  const most = Math.max(1, ...list.map((s) => s.pros))
  return list.map((s) => ({ ...s, width: `${(s.pros / most) * 100}%` }))
})
const record = (a: { wins?: number | null; losses?: number | null }) =>
  a.wins != null && a.losses != null && a.wins + a.losses > 0
    ? { wins: a.wins, losses: a.losses }
    : null
/** Oldest first for the strip. */
const formOf = (r: { form?: boolean[] }) => [...(r.form ?? [])].reverse()
const VIEWS = computed(() => [
  {
    id: 'league',
    label: 'Leagues',
    href: '/pros',
  },
  { id: 'teams', label: 'Teams', href: '/pros?view=teams' },
  { id: 'ladder', label: 'Ladder', href: '/pros?view=ladder' },
])
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
</script>

<template>
  <Head :title="title" />
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <main class="page pros flex-1">
      <div class="rd-ph">
        <div v-if="view === 'league' && leagueView" class="ph-lg">
          <Logo :league="leagueView.league" :size="56" eager />
          <div class="min-w-0">
            <h1>{{ leagueView.league.code }}</h1>
            <p class="num">
              <b>{{ leagueView.league.name }}</b
              >, {{ leagueView.counts.teams }} teams, {{ leagueView.counts.players }} players,
              {{ thousands(leagueView.counts.accounts) }} ranked accounts
            </p>
          </div>
        </div>
        <div v-else-if="view === 'teams'">
          <h1>Teams</h1>
          <p class="num">
            <b>{{ teamGroups.reduce((n, g) => n + g.teams.length, 0) }} teams</b> in
            {{ teamGroups.length }} leagues
          </p>
        </div>
        <div v-else>
          <h1>Pro ladder</h1>
          <p class="num">
            <b>{{ thousands(total ?? 0) }} {{ total === 1 ? 'pro' : 'pros' }}</b> in Master and
            above on {{ on ?? 'every server' }}, ranked by LP
          </p>
        </div>
        <nav class="rd-seg" aria-label="Pro pages">
          <Link
            v-for="v in VIEWS"
            :key="v.id"
            :href="v.href"
            :class="{ on: view === v.id }"
            :aria-current="view === v.id ? 'page' : undefined"
            prefetch="hover"
            >{{ v.label }}</Link
          >
        </nav>
      </div>

      <!-- ── The ladder ─────────────────────────────────────────── -->
      <template v-if="view === 'ladder'">
        <div v-if="bestRows.length" class="best">
          <Link
            v-for="b in bestRows"
            :key="b.role"
            :href="`/pro/${b.pro.slug}`"
            class="bp"
            :class="{ first: b.pro.slug === leader }"
            prefetch="hover"
          >
            <ProPhoto
              v-if="b.pro.photo"
              class="ph2"
              :slug="b.pro.slug"
              :photo="b.pro.photo"
              :width="170"
              :height="170"
              fluid
              eager
            />
            <span v-else-if="proRole(b.role)" class="gl"
              ><RoleIcon :lane="proRole(b.role)!.lane" :size="84"
            /></span>
            <span class="ro"
              ><RoleIcon v-if="proRole(b.role)" :lane="proRole(b.role)!.lane" :size="14" />Best
              {{ roleLabel(b.role).toLowerCase() }}</span
            >
            <b>{{ b.pro.name }}</b>
            <small
              >{{ b.pro.team?.name ?? 'Free agent' }},
              {{ SERVER[b.account.platform] ?? b.account.platform }}</small
            >
            <span class="lp"
              ><span class="rd-fig num">{{ thousands(b.account.lp) }}</span
              ><small class="num"
                >LP<template v-if="b.place">, #{{ b.place }} overall</template></small
              ></span
            >
          </Link>
        </div>

        <div class="fbar">
          <nav class="lgs" aria-label="League">
            <Link
              :href="ladderHref({ league: null })"
              class="lg2"
              :class="{ on: !filters?.league }"
              preserve-scroll
              >Every league</Link
            >
            <Link
              v-for="l in leagues"
              :key="l.slug"
              :href="ladderHref({ league: l.slug })"
              class="lg2"
              :class="{ on: filters?.league === l.slug }"
              preserve-scroll
              ><Logo :league="l" :size="16" />{{ l.code }}</Link
            >
          </nav>
          <span class="grow" />
          <nav class="rd-seg" aria-label="Role">
            <Link :href="ladderHref({ role: null })" :class="{ on: !filters?.role }" preserve-scroll
              >All</Link
            >
            <Link
              v-for="r in PRO_ROLES"
              :key="r.role"
              :href="ladderHref({ role: r.slug })"
              :class="{ on: filters?.role === r.slug }"
              :aria-label="r.label"
              :title="r.label"
              preserve-scroll
              ><RoleIcon :lane="r.lane" :size="15"
            /></Link>
          </nav>
          <Select
            v-if="ladderServers.length > 2"
            v-model="ladderServer"
            :options="ladderServers"
            label="Server"
            width="12rem"
            align="right"
          />
        </div>

        <div class="lay">
          <section class="rd-card tbw">
            <div class="pt lad" role="table" aria-label="Pro ladder">
              <div class="tr h" role="row">
                <span role="columnheader">#</span><span role="columnheader">Player</span
                ><span role="columnheader">Team</span><span role="columnheader">Rank</span
                ><span role="columnheader">Season</span><span role="columnheader">Last 10</span
                ><span role="columnheader">Most played</span
                ><span role="columnheader" class="r">Last 24 h</span>
              </div>
              <p v-if="!ladderRows.length" class="nb-empty">
                No pro in Master and above with these filters.
              </p>
              <div v-for="r in ladderRows" :key="r.pro.slug" class="tr link" role="row">
                <span class="idx num" role="cell">{{ r.place }}</span>
                <span class="nm" role="cell">
                  <ProFace :slug="r.pro.slug" :photo="r.pro.photo" :role="r.pro.role" />
                  <span class="min-w-0"
                    ><Link :href="`/pro/${r.pro.slug}`" class="stretch" prefetch="hover"
                      ><b>{{ r.pro.name }}</b></Link
                    ><small
                      ><RoleIcon
                        v-if="proRole(r.pro.role)"
                        :lane="proRole(r.pro.role)!.lane"
                        :size="13"
                      />{{ roleLabel(r.pro.role) || countryName(r.pro.country)
                      }}<template v-if="roleLabel(r.pro.role) || countryName(r.pro.country)"
                        >, </template
                      >{{ SERVER[r.account.platform] ?? r.account.platform }}</small
                    ></span
                  >
                </span>
                <span class="tm" :class="{ fa: !r.pro.team }" role="cell"
                  ><Logo v-if="r.pro.team" :team="r.pro.team" :size="20" /><span>{{
                    r.pro.team?.name ?? 'Free agent'
                  }}</span></span
                >
                <span class="lpc" role="cell"
                  ><b class="num">{{ thousands(r.account.lp) }} LP</b
                  ><small :style="tierColor(r.account.tier)">{{
                    rankText(r.account.tier, r.account.division).replace(/ \d.*$/, '')
                  }}</small></span
                >
                <span role="cell"
                  ><WinLoss
                    v-if="record(r.account)"
                    :wins="record(r.account)!.wins"
                    :losses="record(r.account)!.losses"
                  /><small v-else class="q">-</small></span
                >
                <span role="cell"
                  ><FormStrip v-if="r.form?.length" :results="formOf(r)" /><small v-else class="q"
                    >No games</small
                  ></span
                >
                <span class="cps" role="cell"
                  ><ChampIcon
                    v-for="c in r.champions ?? []"
                    :key="c.champion"
                    :id="c.champion"
                    :size="23"
                /></span>
                <span class="mv num r" role="cell"
                  ><template v-if="r.move"
                    ><b :class="placesCls(r.move)">{{ placesText(r.move) }}</b
                    ><small :class="r.move.lp > 0 ? 'rd-up' : r.move.lp < 0 ? 'rd-dn' : ''">{{
                      lpText(r.move)
                    }}</small></template
                  ><small v-else class="q">-</small></span
                >
              </div>
              <div v-if="ladderRows.length < (total ?? 0)" class="nb-foot">
                <button type="button" class="iv-btn sm" :disabled="loading" @click="loadMore">
                  Show {{ Math.min(pageSize ?? 100, (total ?? 0) - ladderRows.length) }} more
                </button>
              </div>
            </div>
          </section>

          <div class="rd-col">
            <section v-if="climbing.length" class="rd-card">
              <div class="rd-head">
                <h3>Climbing today</h3>
                <span class="rd-hm">Top 50</span>
              </div>
              <Link
                v-for="m in climbing"
                :key="m.pro.slug"
                :href="`/pro/${m.pro.slug}`"
                class="mv2"
                prefetch="hover"
              >
                <ProFace :slug="m.pro.slug" :photo="m.pro.photo" :role="m.pro.role" :size="40" />
                <span class="min-w-0"
                  ><b class="truncate">{{ m.pro.name }}</b
                  ><small class="num"
                    >Now #{{ m.place
                    }}<template v-if="roleLabel(m.pro.role)"
                      >, {{ roleLabel(m.pro.role) }}</template
                    ></small
                  ></span
                >
                <span class="d rd-up num"
                  >{{ lpText(m.move)
                  }}<small v-if="m.move.places">{{ placesText(m.move) }} places</small></span
                >
              </Link>
            </section>
            <section v-if="split.length" class="rd-card">
              <div class="rd-head"><h3>Top 50 by role</h3></div>
              <div class="split">
                <div v-for="sp in split" :key="sp.role" class="sp">
                  <span>{{ roleLabel(sp.role) }}</span>
                  <span class="rd-bar"><i :style="{ width: sp.width }" /></span>
                  <span class="num">{{ sp.pros }}</span>
                </div>
              </div>
            </section>
          </div>
        </div>
        <p v-if="!ladderMoved" class="nb-data">
          Moves of the last 24 hours show once a day of ranks is kept.
        </p>
      </template>

      <!-- ── A league ───────────────────────────────────────────── -->
      <template v-else-if="view === 'league' && leagueView">
        <div class="fbar">
          <nav class="lgs" aria-label="League">
            <Link
              v-for="l in leagues"
              :key="l.slug"
              :href="leagueHref(l.slug)"
              class="lg2"
              :class="{ on: leagueView.league.slug === l.slug }"
              :aria-current="leagueView.league.slug === l.slug ? 'page' : undefined"
              prefetch="hover"
              ><Logo :league="l" :size="16" eager />{{ l.code }}</Link
            >
          </nav>
          <span class="grow" />
          <div class="rd-seg" role="radiogroup" aria-label="Role">
            <button
              type="button"
              :class="{ on: !role }"
              role="radio"
              :aria-checked="!role"
              @click="role = null"
            >
              All
            </button>
            <button
              v-for="r in PRO_ROLES"
              :key="r.role"
              type="button"
              :class="{ on: role === r.role }"
              role="radio"
              :aria-checked="role === r.role"
              :aria-label="r.label"
              :title="r.label"
              @click="role = r.role"
            >
              <RoleIcon :lane="r.lane" :size="15" />
            </button>
          </div>
          <Select
            v-if="serverOptions.length > 2"
            v-model="server"
            :options="serverOptions"
            label="Server"
            width="12rem"
            align="right"
          />
        </div>

        <section v-if="intlGames.length" class="rd-card strip" aria-labelledby="h-intl">
          <div class="rd-head">
            <h2 id="h-intl" class="flex items-center gap-2">
              <Logo v-if="intlLeague" :league="intlLeague" :size="20" />{{
                intlLeague?.name ?? 'International'
              }}<span class="rd-meta">{{ intlNext.length ? 'Next games' : 'Latest results' }}</span>
            </h2>
            <span v-if="intlGames[0]?.tournament" class="rd-hm">{{
              tournamentPart(intlGames[0])
            }}</span>
          </div>
          <div class="pm-grid">
            <MatchCard
              v-for="mt in intlGames"
              :key="mt.id"
              :match="mt"
              :show-league="!intlLeague"
            />
          </div>
        </section>
        <section v-if="leagueGames.length" class="rd-card strip" aria-labelledby="h-next">
          <div class="rd-head">
            <h2 id="h-next">
              Next games<span class="rd-meta">{{ leagueView.league.code }}</span>
            </h2>
          </div>
          <div class="pm-grid">
            <MatchCard v-for="mt in leagueGames" :key="mt.id" :match="mt" />
          </div>
        </section>

        <section class="rd-card strip">
          <div class="rd-head">
            <h2>
              Teams<span class="rd-meta">Average LP of the starters in Master and above</span>
            </h2>
            <label class="nb-search srch">
              <Search :size="14" aria-hidden="true" /><span class="nb-sr"
                >Find a pro or a team</span
              >
              <input v-model="query" type="search" placeholder="Find a pro or a team" />
            </label>
          </div>
          <div v-if="teamsShown.length" class="tgrid">
            <Link v-for="t in teamsShown" :key="t.id" :href="`/team/${t.slug}`" prefetch="hover">
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
        </section>

        <section class="rd-card tbw">
          <div class="rd-head">
            <h2>Players</h2>
            <Select
              v-model="sortModel"
              :options="sortOptions"
              label="Sort"
              width="12rem"
              align="right"
            />
          </div>
          <div class="pt lea" role="table" :aria-label="`${leagueView.league.code} players`">
            <div class="tr h" role="row">
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
              <span role="columnheader" :aria-sort="ariaSort(sort, 'team')"
                ><SortHead
                  label="Team"
                  :active="sort.key === 'team'"
                  :dir="sort.dir"
                  @sort="by('team')"
              /></span>
              <span role="columnheader">Best account</span>
              <span role="columnheader" :aria-sort="ariaSort(sort, 'record')"
                ><SortHead
                  label="30 days"
                  title="Ranked solo games, every account"
                  :active="sort.key === 'record'"
                  :dir="sort.dir"
                  @sort="by('record')"
              /></span>
              <span role="columnheader">Plays</span>
              <span role="columnheader" class="r" :aria-sort="ariaSort(sort, 'move')"
                ><SortHead
                  v-if="leagueMoved"
                  label="Last 24 h"
                  title="Places on this list and LP"
                  :active="sort.key === 'move'"
                  :dir="sort.dir"
                  @sort="by('move')"
              /></span>
            </div>
            <p v-if="!players.length" class="nb-empty">No player matches these filters.</p>
            <div v-for="pl in shownPlayers" :key="pl.slug" class="tr link" role="row">
              <span class="idx num" role="cell">{{ place.get(pl.slug) }}</span>
              <span class="nm" role="cell">
                <ProFace :slug="pl.slug" :photo="pl.photo" :role="pl.role" />
                <span class="min-w-0"
                  ><Link :href="`/pro/${pl.slug}`" class="stretch" prefetch="hover"
                    ><b>{{ pl.name }}</b></Link
                  ><small
                    ><RoleIcon
                      v-if="proRole(pl.role)"
                      :lane="proRole(pl.role)!.lane"
                      :size="13"
                    />{{ roleLabel(pl.role) || countryName(pl.country)
                    }}<template v-if="!pl.starter">, sub</template></small
                  ></span
                >
              </span>
              <span class="tm" :class="{ fa: !pl.team }" role="cell"
                ><Logo v-if="pl.team" :team="pl.team" :size="20" /><span>{{
                  pl.team?.name ?? 'Free agent'
                }}</span></span
              >
              <span class="lpc" role="cell"
                ><template v-if="pl.best"
                  ><b class="num" :style="tierColor(pl.best.tier)">{{
                    rankText(pl.best.tier, pl.best.division, pl.best.lp)
                  }}</b
                  ><small class="num">{{
                    SERVER[pl.best.platform] ?? pl.best.platform
                  }}</small></template
                ><small v-else class="q">Unranked</small></span
              >
              <span role="cell"
                ><WinLoss
                  v-if="pl.record?.games"
                  :wins="pl.record.wins"
                  :losses="pl.record.games - pl.record.wins"
                /><small v-else class="q">No games</small></span
              >
              <span class="cps" role="cell"
                ><ChampIcon v-for="c in pl.champions" :key="c.champion" :id="c.champion" :size="23"
              /></span>
              <span class="mv num r" role="cell"
                ><template v-if="pl.move"
                  ><b :class="placesCls(pl.move)">{{ placesText(pl.move) }}</b
                  ><small :class="pl.move.lp > 0 ? 'rd-up' : pl.move.lp < 0 ? 'rd-dn' : ''">{{
                    lpText(pl.move)
                  }}</small></template
                ><small v-else class="q">-</small></span
              >
            </div>
            <div v-if="!more && players.length > FIRST" class="nb-foot">
              <button type="button" class="iv-btn sm" @click="more = true">
                Show {{ players.length - FIRST }} more
              </button>
            </div>
          </div>
        </section>
        <p v-if="!moved" class="nb-data">
          Moves of the last 24 hours show once a day of ranks is kept.
        </p>
      </template>

      <!-- ── Every team ─────────────────────────────────────────── -->
      <template v-else-if="view === 'teams'">
        <section v-for="g in teamGroups" :key="g.league.slug" class="rd-card strip">
          <div class="rd-head">
            <h2 class="flex items-center gap-2">
              <Logo :league="g.league" :size="24" />{{ g.league.code
              }}<span class="rd-meta">{{ g.league.name }}</span>
            </h2>
            <Link :href="leagueHref(g.league.slug)" class="rd-more"
              >Players<ChevronRight :size="13" aria-hidden="true"
            /></Link>
          </div>
          <div class="tgrid">
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
        </section>
      </template>

      <p class="note">Ranks refresh through the day.</p>
    </main>
    <SiteFooter />
  </div>
</template>

<style scoped>
.pros .rd-ph .ph-lg {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}
.pros .rd-seg > a {
  text-decoration: none;
}
.best {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}
.bp {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 190px;
  padding: 14px 16px;
  overflow: hidden;
  border-radius: 10px;
  color: inherit;
  text-decoration: none;
  background: linear-gradient(180deg, var(--rd-card-2), var(--rd-card));
  box-shadow: inset 0 0 0 1px var(--rd-line);
}
.bp.first {
  background: linear-gradient(180deg, rgb(123 109 255 / 0.22), var(--rd-card) 88%);
  box-shadow: inset 0 0 0 1px rgb(123 109 255 / 0.4);
}
.bp:hover {
  box-shadow: inset 0 0 0 1px var(--line-3, rgb(255 255 255 / 0.2));
}
.bp:focus-visible,
.lg2:focus-visible,
.mv2:focus-visible,
.tgrid a:focus-visible {
  outline: 2px solid var(--rd-violet);
  outline-offset: 2px;
}
.bp :deep(.ph2) {
  position: absolute;
  right: -18px;
  bottom: 0;
  width: 170px;
  height: 170px;
  background: none;
  box-shadow: none;
  -webkit-mask-image: linear-gradient(180deg, #000 72%, transparent);
  mask-image: linear-gradient(180deg, #000 72%, transparent);
}
.bp :deep(.ph2 img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 0;
}
.bp .gl {
  position: absolute;
  right: 18px;
  bottom: 22px;
  opacity: 0.12;
}
.bp > *:not(.ph2):not(.gl) {
  position: relative;
  z-index: 1;
}
.bp .ro {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}
.bp > b {
  display: block;
  margin-top: 6px;
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--text-1);
  text-shadow: 0 1px 6px rgb(0 0 0 / 0.6);
}
.bp small {
  font-size: 12px;
  color: var(--text-3);
}
.bp .lp {
  margin-top: auto;
}
.bp .lp .rd-fig {
  display: block;
  font-size: 24px;
  color: var(--gold-c);
  text-shadow: 0 1px 6px rgb(0 0 0 / 0.6);
}
.fbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin: 24px 0 12px;
}
.fbar .grow {
  flex: 1;
}
.lgs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.lg2 {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  padding: 0 11px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  text-decoration: none;
  background: var(--rd-card);
  box-shadow: inset 0 0 0 1px var(--rd-line);
}
.lg2:hover {
  color: var(--text-1);
}
.lg2.on {
  color: var(--text-1);
  background: var(--rd-violet-a);
  box-shadow: inset 0 0 0 1px rgb(123 109 255 / 0.5);
}
.lay {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 288px;
  gap: 16px;
  align-items: start;
}
.tbw {
  overflow-x: auto;
}
.pt {
  min-width: 940px;
}
.pt .tr {
  position: relative;
  display: grid;
  align-items: center;
  gap: 14px;
  min-height: 58px;
  padding: 0 18px;
  font-size: 13px;
}
.pt.lad .tr {
  grid-template-columns:
    26px minmax(160px, 1.25fr) minmax(104px, 1fr) 96px 118px 82px 104px
    74px;
}
.pt.lea .tr {
  grid-template-columns: 26px minmax(160px, 1.3fr) minmax(104px, 1fr) 140px 118px 84px 74px;
}
.pt .tr + .tr {
  box-shadow: inset 0 1px 0 var(--rd-line);
}
.pt .tr.h {
  min-height: 38px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
  box-shadow: inset 0 -1px 0 var(--rd-line);
}
.pt .tr.link:hover {
  background: var(--surface-1);
}
.pt .r {
  text-align: right;
  justify-content: flex-end;
}
.idx {
  font-weight: 600;
  color: var(--text-3);
}
.nm {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.nm b {
  display: block;
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text-1);
}
.nm small {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-3);
}
.stretch {
  color: inherit;
  text-decoration: none;
}
.stretch::after {
  content: '';
  position: absolute;
  inset: 0;
}
.stretch:focus-visible {
  outline: none;
}
.stretch:focus-visible::after {
  outline: 2px solid var(--rd-violet);
  outline-offset: -2px;
}
.tm {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--text-2);
}
.tm span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.tm.fa {
  color: var(--text-4);
}
.lpc b {
  display: block;
  font-size: 15px;
  font-weight: 650;
  color: var(--text-1);
}
.lpc small {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}
.q {
  font-size: 12px;
  color: var(--text-4);
}
.cps {
  display: flex;
  gap: 4px;
}
.cps :deep(.iv-champ) {
  border-radius: 6px;
}
.mv {
  display: grid;
  justify-items: end;
  font-size: 12px;
  font-weight: 600;
}
.mv b.up {
  color: var(--win);
}
.mv b.down {
  color: var(--loss);
}
.mv b.qq {
  color: var(--text-3);
}
.mv small {
  font-weight: 500;
}
.mv2 {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  height: 60px;
  padding: 0 16px;
  color: inherit;
  text-decoration: none;
}
.mv2 + .mv2 {
  box-shadow: inset 0 1px 0 var(--rd-line);
}
.mv2:hover {
  background: var(--surface-1);
}
.mv2 b {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}
.mv2 small {
  font-size: 12px;
  color: var(--text-3);
}
.mv2 .d {
  font-size: 13px;
  font-weight: 650;
  text-align: right;
}
.mv2 .d small {
  display: block;
  font-weight: 500;
}
.split {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
}
.sp {
  display: grid;
  grid-template-columns: 56px 1fr 28px;
  gap: 10px;
  align-items: center;
  font-size: 12px;
  color: var(--text-2);
}
.sp .rd-bar {
  height: 6px;
}
.sp span:last-child {
  text-align: right;
  color: var(--text-3);
}
.strip {
  margin-bottom: 12px;
}
.strip .pm-grid {
  padding: 12px;
}
.tgrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 4px;
  padding: 8px;
}
.tgrid a {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 6px 10px;
  border-radius: 8px;
  color: inherit;
  text-decoration: none;
}
.tgrid a:hover {
  background: var(--surface-1);
}
.tgrid b {
  display: block;
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text-1);
}
.tgrid small {
  font-size: 12px;
  color: var(--text-3);
}
.srch {
  width: 240px;
}
.note {
  margin: 16px 2px 0;
  font-size: 12px;
  color: var(--text-4);
}
@media (max-width: 1100px) {
  .best {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .lay {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 640px) {
  .best {
    grid-template-columns: minmax(0, 1fr);
  }
  .bp {
    height: 150px;
  }
  .fbar {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 4px;
  }
  .fbar > * {
    flex: none;
  }
  .lgs {
    flex-wrap: nowrap;
  }
  .srch {
    width: 100%;
  }
}
</style>
