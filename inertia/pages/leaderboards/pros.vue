<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import SiteLayout from '../../components/SiteLayout.vue'
import Icon from '../../components/ui/Icon.vue'
import Frame from '../../components/ui/Frame.vue'
import Select from '../../components/ui/Select.vue'
import RankEmblem from '../../components/ui/RankEmblem.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import SortHead from '../../components/ui/SortHead.vue'
import { linkSort, type SortDir } from '../../components/ui/sort.js'
import RoleFilter from '../../components/leaderboards/RoleFilter.vue'
import LadderPager from '../../components/leaderboards/LadderPager.vue'
import { champIcon, championName } from '../../lib/assets.js'
import { leagueLogo } from '../../lib/board.js'
import {
  laneOf,
  n,
  rankWords,
  roleLabel,
  signedN,
  since,
  winPct,
  withQuery,
} from '../../lib/ladders.js'
import '../../css/leaderboards.css'
import '../../css/esports.css'

interface Team {
  id: string
  slug: string
  name: string
  shortName: string | null
}
interface Row {
  place: number
  pro: {
    slug: string
    name: string
    photo?: string
    role: string | null
    country: string | null
    countryName: string | null
    team: Team | null
  }
  league: { slug: string; code: string } | null
  account: {
    platform: string
    tier: string
    division: number | null
    lp: number
    wins: number | null
    losses: number | null
  }
  move: { places: number | null; lp: number } | null
  record: { games: number; wins: number } | null
  champions: { champion: number; games: number }[]
}

/**
 * `/leaderboards/pros`: pros ranked by their best solo queue account (app/services/
 * pro_ladder_service.ts), the first league by default as the board opens, every pro with
 * `league=all`. The podium, the apex tiers, the filters and the table.
 */
const props = defineProps<{
  leagues: { slug: string; code: string; name: string; region: string | null }[]
  servers: { slug: string; label: string; pros: number }[]
  teams: Team[]
  filters: {
    server: string | null
    role: string | null
    league: string
    team: string | null
    q: string | null
    sort: string | null
    dir: SortDir | null
  }
  apex: Record<'CHALLENGER' | 'GRANDMASTER' | 'MASTER', number>
  podium: Row[]
  rows: Row[]
  total: number
  pros: number
  page: number
  pages: number
  pageSize: number
  updatedAt: number | null
  on: string
  description: string
}>()

const query = computed(() => ({
  role: props.filters.role,
  league: props.filters.league === (props.leagues[0]?.slug ?? '') ? null : props.filters.league,
  team: props.filters.team,
  server: props.filters.server,
  q: props.filters.q,
  sort: props.filters.sort,
  dir: props.filters.dir,
}))
const href = (changes: Record<string, string | number | boolean | null>) =>
  withQuery('/leaderboards/pros', query.value, changes)
/** The heads sort every listed pro on the server (`?sort=&dir=`), the first page again. */
const sort = computed(() =>
  linkSort(
    { key: props.filters.sort, dir: props.filters.dir ?? 'desc' },
    (key, dir) => href({ sort: key, dir }),
    { key: 'rank' }
  )
)

const league = ref(props.filters.league)
watch(league, (slug) =>
  router.visit(href({ league: slug === props.leagues[0]?.slug ? null : slug, team: null }))
)
const leagueOptions = computed(() => [
  ...props.leagues.map((l) => ({ value: l.slug, label: l.code, icon: leagueLogo(l.slug, 40) })),
  { value: 'all', label: 'Every league' },
])
const team = ref(props.filters.team ?? '')
watch(team, (slug) => router.visit(href({ team: slug || null }), { preserveScroll: true }))
const teamOptions = computed(() => [
  { value: '', label: 'All teams' },
  ...props.teams.map((t) => ({ value: t.slug, label: t.name, icon: `/cdn/team/${t.id}?s=40` })),
])
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

const leagueCode = computed(() => props.leagues.find((l) => l.slug === props.filters.league)?.code)
const photo = (p: Row['pro'], size: number) =>
  p.photo ? `/cdn/pro/${p.slug}?s=${size}&v=${p.photo}` : null
const short = (r: Row) =>
  [r.pro.team?.shortName ?? r.pro.team?.name, roleLabel(r.pro.role).toLowerCase()]
    .filter(Boolean)
    .join(', ')
</script>

<template>
  <Head title="Pro ladder">
    <meta name="description" :content="description" />
  </Head>
  <SiteLayout>
    <div class="wrap pg-es">
      <section class="mast">
        <nav class="crumbs" aria-label="Breadcrumb">
          <Link href="/leaderboards/solo">Leaderboards</Link><Icon name="chevr" />
          <span class="t1">Pros</span>
        </nav>
        <div class="mast-r">
          <div class="col mast-t">
            <h1 class="h1">Solo queue ladder</h1>
            <p class="meta">
              {{ n(pros) }} {{ leagueCode ? `${leagueCode} ` : '' }}pros ranked by their best
              account<template v-if="on">, {{ on }}</template
              ><template v-if="updatedAt">, updated {{ since(updatedAt) }}</template>
            </p>
          </div>
        </div>
      </section>

      <EmptyState
        v-if="!pros"
        icon="pro"
        title="No pro in Master and above here"
        line="Pros appear once one of their accounts reaches Master."
      />

      <template v-else>
        <div class="pod3">
          <Link v-for="r in podium" :key="r.place" class="podc" :href="`/pro/${r.pro.slug}`">
            <span class="no3 lab">#{{ r.place }}</span>
            <Frame :src="photo(r.pro, 240)" stage eager />
            <span class="col">
              <span class="h2">{{ r.pro.name }}</span>
              <span class="meta row" style="gap: 6px; margin-top: 3px"
                ><img
                  v-if="r.pro.team"
                  :src="`/cdn/team/${r.pro.team.id}?s=32`"
                  alt=""
                  style="width: 15px; height: 15px; object-fit: contain"
                />{{ short(r) }}</span
              >
              <span class="row" style="gap: 6px; margin-top: 12px">
                <RankEmblem :tier="r.account.tier" :size="24" />
                <span class="fg-s">{{ n(r.account.lp) }}<span class="u">LP</span></span>
              </span>
            </span>
          </Link>
          <div class="card">
            <div class="card-h"><span class="h3">Apex tiers</span></div>
            <div
              v-for="t in ['CHALLENGER', 'GRANDMASTER', 'MASTER'] as const"
              :key="t"
              class="lrow"
              style="min-height: 46px"
            >
              <RankEmblem :tier="t" :size="26" />
              <span class="h5 grow">{{ rankWords(t) }}</span>
              <span class="fg-xs">{{ apex[t] }}</span>
              <span class="meta">pros</span>
            </div>
          </div>
        </div>
      </template>

      <div class="bar-f" style="margin: 24px 0 16px">
        <RoleFilter :active="filters.role" :href="(role) => href({ role })" />
        <Select v-model="league" :options="leagueOptions" width="12rem" />
        <Select
          v-if="teams.length"
          v-model="team"
          :options="teamOptions"
          searchable
          width="15rem"
        />
        <label class="field" style="flex: 1; max-width: 320px; margin-left: auto">
          <Icon name="search" />
          <input v-model="search" type="text" placeholder="Find a pro" aria-label="Find a pro" />
        </label>
      </div>

      <section class="card">
        <div class="lt3h">
          <span style="text-align: center">#</span>
          <span>Pro</span>
          <span>Role</span>
          <span>Country</span>
          <SortHead :sorter="sort" col="rank" label="Rank" />
          <SortHead :sorter="sort" col="move" label="24 hours" title="LP won or lost in 24 hours" />
          <span>Recent games</span>
          <span>Most played</span>
        </div>
        <EmptyState
          v-if="!rows.length"
          compact
          icon="search"
          title="No pro matches these filters"
        />
        <Link v-for="r in rows" :key="r.pro.slug" class="lt3" :href="`/pro/${r.pro.slug}`">
          <span class="rk" style="text-align: center">{{ r.place }}</span>
          <span class="row" style="gap: 11px; min-width: 0">
            <span class="ppic"
              ><img v-if="r.pro.photo" :src="photo(r.pro, 48)!" alt="" loading="lazy"
            /></span>
            <span class="col" style="min-width: 0">
              <span class="h4 ell">{{ r.pro.name }}</span>
              <span v-if="r.pro.team" class="meta row" style="gap: 5px"
                ><img
                  :src="`/cdn/team/${r.pro.team.id}?s=32`"
                  alt=""
                  style="width: 14px; height: 14px; object-fit: contain"
                />{{ r.pro.team.name }}</span
              >
              <span v-else class="meta">No team</span>
            </span>
          </span>
          <span class="row meta" style="gap: 6px"
            ><RoleIcon
              v-if="laneOf(r.pro.role)"
              :lane="laneOf(r.pro.role)!"
              :size="15"
              style="opacity: 0.6"
            />{{ roleLabel(r.pro.role) || '–' }}</span
          >
          <span class="meta">{{ r.pro.countryName ?? '–' }}</span>
          <span class="row" style="gap: 8px">
            <RankEmblem :tier="r.account.tier" :size="26" />
            <span class="col">
              <span class="h5 num">{{ n(r.account.lp) }} LP</span>
              <span class="meta">{{ rankWords(r.account.tier, r.account.division) }}</span>
            </span>
          </span>
          <span>
            <template v-if="r.move && r.move.lp">
              <span class="h5" :class="r.move.lp > 0 ? 'wn' : 'ls'"
                >{{ signedN(r.move.lp) }} LP</span
              >
              <span v-if="r.move.places" class="meta" style="display: block"
                >{{ r.move.places > 0 ? '▲' : '▼' }} {{ Math.abs(r.move.places) }}
                {{ Math.abs(r.move.places) === 1 ? 'place' : 'places' }}</span
              >
            </template>
            <span v-else class="t3">–</span>
          </span>
          <span v-if="r.record && r.record.games" class="col" style="gap: 5px">
            <span class="h5"
              >{{ winPct(r.record.wins, r.record.games) }}
              <span class="meta"
                >{{ r.record.wins }}W {{ r.record.games - r.record.wins }}L</span
              ></span
            >
            <span class="split"
              ><i :style="{ width: winPct(r.record.wins, r.record.games) }"></i><b></b
            ></span>
          </span>
          <span v-else class="t3">–</span>
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
          noun="pros"
          :href="(p) => withQuery('/leaderboards/pros', query, { page: p })"
        />
      </section>
      <p class="meta lb-note">
        Rank: each pro's best account. 24 hours: LP and places since the same time yesterday. Recent
        games: their stored ranked games of the last 30 days, every account.
      </p>
    </div>
  </SiteLayout>
</template>
