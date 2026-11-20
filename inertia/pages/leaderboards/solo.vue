<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import SiteLayout from '../../components/SiteLayout.vue'
import Icon from '../../components/ui/Icon.vue'
import Frame from '../../components/ui/Frame.vue'
import ProPic from '../../components/pros/ProPic.vue'
import Select from '../../components/ui/Select.vue'
import ScoreDial from '../../components/ui/ScoreDial.vue'
import RankEmblem from '../../components/ui/RankEmblem.vue'
import WinRate from '../../components/ui/WinRate.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import SortHead from '../../components/ui/SortHead.vue'
import { linkSort, type SortDir } from '../../components/ui/sort.js'
import RoleFilter from '../../components/leaderboards/RoleFilter.vue'
import LadderPager from '../../components/leaderboards/LadderPager.vue'
import LadderPlayer from '../../components/leaderboards/LadderPlayer.vue'
import { champIcon, championName, championSplash, profileIcon } from '../../lib/assets.js'
import {
  dayMonth,
  laneOf,
  n,
  playerPath,
  roleLabel,
  signedN,
  since,
  tierWord,
  winPct,
  withQuery,
} from '../../lib/ladders.js'
import { regionFlag } from '../../lib/flags.js'
import '../../css/leaderboards.css'

interface Row {
  place: number
  gameName: string | null
  tagLine: string | null
  icon: number | null
  level: number | null
  tier: string
  lp: number
  wins: number
  losses: number
  hotStreak: boolean
  role: string | null
  champions: { champion: number; games: number; wins: number }[]
  games: number
  pro: {
    slug: string
    name: string
    photo?: string
    team: { id: string; slug: string; name: string; shortName: string | null } | null
  } | null
  move: { lp: number; places: number } | null
  score: number | null
  scoreGames: number
}
/** One of the ladder's first three, for the head of the page. */
type Leader = Omit<Row, 'score' | 'scoreGames'>

/**
 * `/leaderboards/solo`: a server's Challenger, Grandmaster and Master, as the crawler last read
 * each league whole (app/services/ladder_service.ts). One sheet at the top: #1 on a short banner,
 * #2 and #3 in a line each, and what Challenger and Grandmaster take beside them; then the role
 * filter with each role's share, and the table.
 */
const props = defineProps<{
  region: { slug: string; label: string; platform: string }
  regions: { slug: string; label: string }[]
  filters: {
    role: string | null
    tier: string | null
    pros: boolean
    q: string | null
    sort: string | null
    dir: SortDir | null
  }
  podium: Leader[]
  cutoffs: {
    tier: 'CHALLENGER' | 'GRANDMASTER'
    lp: number | null
    players: number
    at: number | null
    change: number | null
  }[]
  movesSince: number | null
  roles: { role: string; players: number; share: number }[]
  updatedAt: number | null
  rows: Row[]
  total: number
  players: number
  page: number
  pages: number
  pageSize: number
  rule: { windowDays: number; scoreGames: number }
  description: string
}>()

const query = computed(() => ({
  region: props.region.slug === 'euw' ? null : props.region.slug,
  role: props.filters.role,
  tier: props.filters.tier,
  pros: props.filters.pros,
  q: props.filters.q,
  sort: props.filters.sort,
  dir: props.filters.dir,
}))
const href = (changes: Record<string, string | number | boolean | null>) =>
  withQuery('/leaderboards/solo', query.value, changes)
/** The heads sort the whole ladder on the server (`?sort=&dir=`), the first page again. */
const sort = computed(() =>
  linkSort(
    { key: props.filters.sort, dir: props.filters.dir ?? 'desc' },
    (key, dir) => href({ sort: key, dir }),
    { key: 'rank' }
  )
)

const regionSlug = ref(props.region.slug)
watch(regionSlug, (slug) => router.visit(href({ region: slug === 'euw' ? null : slug })))
const tier = ref(props.filters.tier ?? 'all')
watch(tier, (t) => router.visit(href({ tier: t === 'all' ? null : t }), { preserveScroll: true }))
const tierOptions = [
  { value: 'all', label: 'Every apex tier' },
  { value: 'challenger', label: 'Challenger' },
  { value: 'grandmaster', label: 'Grandmaster' },
  { value: 'master', label: 'Master' },
]

const search = ref(props.filters.q ?? '')
let typing: ReturnType<typeof setTimeout> | null = null
watch(search, (q) => {
  if (typing) clearTimeout(typing)
  typing = setTimeout(
    () =>
      router.visit(href({ q: q.trim() || null }), { preserveScroll: true, preserveState: true }),
    350
  )
})

const shares = computed(() =>
  Object.fromEntries(props.roles.map((r) => [laneOf(r.role)!, r.share]))
)
const updated = computed(() => since(props.updatedAt))
/** "24 hours" when the moves read a day back, else the day they read from. */
const movesHead = computed(() => {
  if (!props.movesSince || !props.updatedAt) return null
  const h = (props.updatedAt - props.movesSince) / 3_600_000
  return h <= 30 ? '24 hours' : `Since ${dayMonth(props.movesSince)}`
})

/**
 * The UTC midnight the cutoffs move at, as "in 6 h 12 min" from now (the browser's clock), set once
 * the page is mounted so the server's HTML and the first client render agree.
 */
const nextReset = ref('')
let resetTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  const tick = () => {
    const now = new Date()
    const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    const min = Math.round((next - now.getTime()) / 60_000)
    nextReset.value = `in ${Math.floor(min / 60)} h ${min % 60} min`
  }
  tick()
  resetTimer = setInterval(tick, 60_000)
})
onBeforeUnmount(() => clearInterval(resetTimer))

/* ── The leaders: #1 with the art of the champion they play most, then #2 and #3 ── */
const leader = computed(() => props.podium[0] ?? null)
const chasers = computed(() => props.podium.slice(1, 3))
/** How far #1 is ahead of #2, in LP. */
const lead = computed(() => {
  const [a, b] = props.podium
  return a && b ? a.lp - b.lp : null
})
/** LP behind #1. */
const behind = (r: Leader) => (leader.value ? leader.value.lp - r.lp : 0)
const topChampion = (r: Leader) => r.champions[0] ?? null
const whereTo = (r: Leader) =>
  (r.pro ? `/pro/${r.pro.slug}` : playerPath(r.gameName, r.tagLine)) ?? '#'
const nameOf = (r: Leader) => r.pro?.name ?? r.gameName ?? 'Unknown player'
const tagOf = (r: Leader) =>
  r.pro ? (r.pro.team?.name ?? null) : r.tagLine ? `#${r.tagLine}` : null
const record = (r: Leader) =>
  `${winPct(r.wins, r.wins + r.losses)} of ${n(r.wins + r.losses)} games`

/** "2nd", "3rd", "4th": the place as words read. */
const ordinal = (place: number) => {
  const t = place % 100
  if (t >= 11 && t <= 13) return 'th'
  return ['th', 'st', 'nd', 'rd'][place % 10] ?? 'th'
}
</script>

<template>
  <Head :title="`Solo/Duo ladder, ${region.label}`" />
  <SiteLayout>
    <div class="wrap">
      <section class="mast">
        <nav class="crumbs" aria-label="Breadcrumb">
          <Link href="/leaderboards/solo">Leaderboards</Link><Icon name="chevr" />
          <span class="t1">Solo/Duo</span>
        </nav>
        <div class="lb-mt">
          <div class="col" style="gap: 8px">
            <h1 class="h1">Solo/Duo ladder</h1>
            <span class="meta"
              >{{ region.label }}, ranked solo and duo<template v-if="updated"
                >, updated {{ updated }}</template
              ></span
            >
          </div>
          <div class="row" style="gap: 8px; margin-left: auto">
            <Select
              v-model="regionSlug"
              label="Region"
              :options="
                regions.map((r) => ({ value: r.slug, label: r.label, icon: regionFlag(r.slug) }))
              "
              width="11rem"
              align="right"
            />
          </div>
        </div>
      </section>

      <EmptyState
        v-if="!players"
        icon="chart"
        :title="`No ${region.label} ladder stored yet`"
        line="The ladder appears once its Challenger, Grandmaster and Master leagues have been read."
      />

      <template v-else>
        <!-- The leaders and what each apex tier takes, on one sheet -->
        <section v-if="leader" class="card lit sl">
          <div class="sl-lead">
            <Link class="sl-one" :href="whereTo(leader)">
              <span v-if="topChampion(leader)" class="sl-art"
                ><img
                  :src="championSplash(topChampion(leader)!.champion)"
                  alt=""
                  fetchpriority="high"
              /></span>
              <span class="sl-no hi">1<span class="sl-ord">st</span></span>
              <span v-if="leader.pro" class="lb-pp sl-pic"
                ><ProPic
                  :slug="leader.pro.slug"
                  :photo="leader.pro.photo"
                  :team="leader.pro.team"
                  :size="64"
                  position="50% 8%"
                  eager
              /></span>
              <Frame v-else class="sl-pic" :src="profileIcon(leader.icon)" eager />
              <span class="col sl-who">
                <span class="sl-nm ell"
                  >{{ nameOf(leader)
                  }}<span v-if="tagOf(leader)" class="lb-tag">{{ tagOf(leader) }}</span></span
                >
                <span class="meta row sl-mt"
                  ><RoleIcon v-if="laneOf(leader.role)" :lane="laneOf(leader.role)!" :size="13" />
                  <span class="ell"
                    ><template v-if="topChampion(leader)"
                      >{{ championName(topChampion(leader)!.champion) }}, </template
                    >{{ record(leader) }}</span
                  ></span
                >
              </span>
              <span class="col sl-lp">
                <span class="row" style="gap: 8px"
                  ><RankEmblem :tier="leader.tier" :size="28" /><span class="fg-l num"
                    >{{ n(leader.lp) }}<span class="u">LP</span></span
                  ></span
                >
                <span v-if="lead !== null" class="meta">{{ n(lead) }} LP ahead</span>
              </span>
            </Link>
            <Link v-for="p in chasers" :key="p.place" class="sl-r" :href="whereTo(p)">
              <span class="sl-no"
                >{{ p.place }}<span class="sl-ord">{{ ordinal(p.place) }}</span></span
              >
              <span v-if="p.pro" class="lb-pp sl-sp"
                ><ProPic
                  :slug="p.pro.slug"
                  :photo="p.pro.photo"
                  :team="p.pro.team"
                  :size="32"
                  position="50% 8%"
              /></span>
              <Frame v-else :src="profileIcon(p.icon)" :width="32" size="xs" />
              <span class="h5 ell"
                >{{ nameOf(p) }}<span v-if="tagOf(p)" class="lb-tag">{{ tagOf(p) }}</span></span
              >
              <span class="meta row sl-rl"
                ><RoleIcon v-if="laneOf(p.role)" :lane="laneOf(p.role)!" :size="13" />{{
                  winPct(p.wins, p.wins + p.losses)
                }}</span
              >
              <span class="h5 num sl-rv">{{ n(p.lp) }} LP</span>
              <span class="meta num sl-rv sl-gap">{{ n(behind(p)) }} behind</span>
            </Link>
          </div>
          <div class="sl-cut">
            <span class="lab">What it takes</span>
            <span v-for="c in cutoffs" :key="c.tier" class="sl-t">
              <RankEmblem :tier="c.tier" :size="30" />
              <span class="col" style="gap: 2px; min-width: 0">
                <span class="h5">{{ tierWord(c.tier) }}</span>
                <span class="meta">{{
                  c.at === null
                    ? 'Not read yet'
                    : `${n(c.players)} ${c.players === 1 ? 'player' : 'players'}`
                }}</span>
              </span>
              <span class="col sl-tv">
                <span class="fg-s num"
                  >{{ c.lp === null ? '–' : n(c.lp)
                  }}<span v-if="c.lp !== null" class="u">LP</span></span
                >
                <span v-if="c.change !== null && movesHead" class="meta"
                  ><span :class="{ vi: c.change > 0 }">{{ signedN(c.change) }}</span>
                  {{ movesHead === '24 hours' ? 'today' : movesHead.toLowerCase() }}</span
                >
              </span>
            </span>
            <span class="meta sl-nx"
              >Moves at 00:00 UTC<template v-if="nextReset">, {{ nextReset }}</template></span
            >
          </div>
        </section>

        <div class="lb-filt">
          <RoleFilter :active="filters.role" :shares="shares" :href="(role) => href({ role })" />
          <Select v-model="tier" :options="tierOptions" width="13rem" />
          <Link
            class="chk"
            :href="href({ pros: !filters.pros })"
            preserve-scroll
            role="switch"
            :aria-checked="filters.pros"
            ><span class="switch" :class="{ on: filters.pros }"></span>Pros only</Link
          >
          <label class="field" style="margin-left: auto; width: 280px">
            <Icon name="search" />
            <input
              v-model="search"
              type="text"
              placeholder="Find a player"
              aria-label="Find a player"
            />
          </label>
        </div>

        <section class="card">
          <div class="lb-h lb-so">
            <span class="lb-n" style="font-weight: 650">#</span>
            <span>Player</span>
            <span>Role</span>
            <SortHead :sorter="sort" col="rank" label="Rank" />
            <SortHead
              :sorter="sort"
              col="move"
              :label="movesHead ?? 'Last read'"
              title="LP won or lost"
            />
            <SortHead :sorter="sort" col="wr" label="Win rate, season" />
            <span>Score</span>
            <span>Most played</span>
          </div>
          <EmptyState
            v-if="!rows.length"
            compact
            icon="search"
            title="No player matches these filters"
          />
          <Link
            v-for="r in rows"
            :key="r.place"
            class="lb-r lb-so"
            :href="(r.pro ? `/pro/${r.pro.slug}` : playerPath(r.gameName, r.tagLine)) ?? '#'"
          >
            <span class="lb-n">{{ r.place }}</span>
            <LadderPlayer
              :game-name="r.gameName"
              :tag-line="r.tagLine"
              :icon="r.icon"
              :level="r.level"
              :pro="r.pro"
            />
            <span class="meta lb-role"
              ><RoleIcon v-if="laneOf(r.role)" :lane="laneOf(r.role)!" :size="15" />{{
                roleLabel(r.role) || '–'
              }}</span
            >
            <span class="row" style="gap: 9px">
              <RankEmblem :tier="r.tier" :size="26" />
              <span class="col">
                <span class="h5 num">{{ n(r.lp) }} LP</span>
                <span class="meta">{{ tierWord(r.tier) }}</span>
              </span>
            </span>
            <span>
              <template v-if="r.move">
                <span class="h5 num" :class="r.move.lp > 0 ? 'wn' : r.move.lp < 0 ? 'ls' : ''">{{
                  r.move.lp ? `${signedN(r.move.lp)} LP` : '–'
                }}</span>
                <span v-if="r.move.places" class="meta lb-mv"
                  >{{ r.move.places > 0 ? '▲' : '▼' }} {{ Math.abs(r.move.places) }}
                  {{ Math.abs(r.move.places) === 1 ? 'place' : 'places' }}</span
                >
              </template>
              <span v-else class="t3">–</span>
            </span>
            <WinRate :wins="r.wins" :losses="r.losses" :width="130" />
            <span><ScoreDial :value="r.score" size="sm" /></span>
            <span class="row" style="gap: 4px">
              <Frame
                v-for="c in r.champions"
                :key="c.champion"
                :src="champIcon(c.champion)"
                :width="30"
                size="xs"
                :alt="championName(c.champion)"
              />
            </span>
          </Link>
          <LadderPager
            :page="page"
            :pages="pages"
            :total="total"
            :page-size="pageSize"
            :noun="
              filters.role || filters.tier || filters.pros || filters.q ? 'players' : 'apex players'
            "
            :href="
              (p) => withQuery('/leaderboards/solo', { ...query, page: undefined }, { page: p })
            "
          />
        </section>
        <p class="meta lb-note">
          Score: the average Invade score of a player's last {{ rule.scoreGames }} stored games.
          Role and most played: their stored ranked games of the last {{ rule.windowDays }} days.
          Win rate: the whole season, as Riot's ladder counts it.
        </p>
      </template>
    </div>
  </SiteLayout>
</template>
