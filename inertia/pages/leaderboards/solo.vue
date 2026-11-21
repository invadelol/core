<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import SiteLayout from '../../components/SiteLayout.vue'
import Icon from '../../components/ui/Icon.vue'
import Frame from '../../components/ui/Frame.vue'
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
import { champIcon, championName } from '../../lib/assets.js'
import {
  dayMonth,
  laneOf,
  n,
  playerPath,
  roleLabel,
  signedN,
  since,
  tierWord,
  withQuery,
} from '../../lib/ladders.js'
import { regionFlag } from '../../lib/flags.js'
import LadderPodium from '../../components/leaderboards/LadderPodium.vue'
import type { PodiumPlayer } from '../../components/leaderboards/podium.js'
import '../../css/leaderboards.css'
import '../../css/ladder-podium.css'

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
/** One of the ladder's first three, for the head of the page, a pro with whether their photo is a cutout. */
type Leader = Omit<Row, 'score' | 'scoreGames'> & { cutout: boolean }

/**
 * `/leaderboards/solo`: a server's Challenger, Grandmaster and Master, as the crawler last read
 * each league whole (app/services/ladder_service.ts). At the top, the first three as a podium (their
 * champions and record) and what Challenger and Grandmaster take in one line; then the role filter
 * with each role's share, and the table.
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

/* ── The head: the first three as a podium, with what they play and their record ── */
const podium = computed<PodiumPlayer[]>(() =>
  props.podium.map((r) => ({
    place: r.place,
    name: r.pro?.name ?? r.gameName ?? 'Unknown player',
    tag: r.pro ? null : r.tagLine ? `#${r.tagLine}` : null,
    riot: !r.pro,
    href: (r.pro ? `/pro/${r.pro.slug}` : playerPath(r.gameName, r.tagLine)) ?? '#',
    pro: r.pro ? { slug: r.pro.slug, photo: r.pro.photo, team: r.pro.team } : null,
    cutout: r.cutout,
    icon: r.icon,
    tier: r.tier,
    lp: r.lp,
    role: r.role,
    champions: r.champions,
    span: `in ${props.rule.windowDays} days`,
    record: { wins: r.wins, games: r.wins + r.losses, span: 'this season' },
    hot: r.hotStreak,
  }))
)
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
        <!-- The first three as a podium, then what each apex tier takes, in one line -->
        <template v-if="podium.length">
          <LadderPodium :players="podium" />
          <section class="card pod-cut" aria-label="What each apex tier takes">
            <span v-for="c in cutoffs" :key="c.tier"
              ><RankEmblem :tier="c.tier" :size="22" /><span class="h5">{{ tierWord(c.tier) }}</span
              ><span class="meta"
                >{{ c.lp === null ? 'not read yet' : `from ${n(c.lp)} LP` }}, {{ n(c.players) }}
                {{ c.players === 1 ? 'player' : 'players'
                }}<template v-if="c.change && movesHead"
                  >,
                  <span :class="{ vi: c.change > 0 }">{{ signedN(c.change) }}</span>
                  {{ movesHead === '24 hours' ? 'today' : movesHead.toLowerCase() }}</template
                ></span
              ></span
            >
            <span class="grow"></span>
            <span class="meta"
              >Moves at 00:00 UTC<template v-if="nextReset">, {{ nextReset }}</template></span
            >
          </section>
        </template>

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
