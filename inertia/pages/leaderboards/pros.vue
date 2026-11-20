<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import SiteLayout from '../../components/SiteLayout.vue'
import Icon from '../../components/ui/Icon.vue'
import Frame from '../../components/ui/Frame.vue'
import Select from '../../components/ui/Select.vue'
import RankEmblem from '../../components/ui/RankEmblem.vue'
import WinRate from '../../components/ui/WinRate.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import CardHead from '../../components/ui/CardHead.vue'
import MatchLine from '../../components/esports/MatchLine.vue'
import SortHead from '../../components/ui/SortHead.vue'
import { linkSort, type SortDir } from '../../components/ui/sort.js'
import RoleFilter from '../../components/leaderboards/RoleFilter.vue'
import LadderPager from '../../components/leaderboards/LadderPager.vue'
import Logo from '../../components/pros/Logo.vue'
import ProPic from '../../components/pros/ProPic.vue'
import Flag from '../../components/pros/Flag.vue'
import { champIcon, championName } from '../../lib/assets.js'
import { leagueLogo, teamLogo } from '../../lib/board.js'
import { useTheme } from '../../lib/theme.js'
import { laneOf, n, rankWords, roleLabel, signedN, since, withQuery } from '../../lib/ladders.js'
import { matchList, type ProMatch } from '../../lib/pro_matches.js'
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
  /** A league's substitute; null on every league's board. */
  sub: boolean | null
  league: { slug: string; code: string } | null
  /** Their best account; null for a league's player without a rank. */
  account: {
    platform: string
    tier: string
    division: number | null
    lp: number
    wins: number | null
    losses: number | null
  } | null
  move: { places: number | null; lp: number } | null
  record: { games: number; wins: number } | null
  champions: { champion: number; games: number }[]
}

/**
 * `/leaderboards/pros`, the pros' page: pros ranked by their best solo queue account (app/services/
 * pro_ladder_service.ts). A league (the first by default, as the board opens) lists all its
 * players, subs and the unranked included, with its next games; `league=all` every pro in Master
 * and above. The leader and the next two beside the apex tiers, the filters and the table.
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
  /** Whether the leader's photo is a cutout, which rises above their stage. */
  leaderCutout: boolean
  rows: Row[]
  total: number
  pros: number
  /** A league's board: its teams and its players' solo queue accounts. */
  counts: { teams: number; players: number; accounts: number } | null
  next: ProMatch[]
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
/** The selects draw one logo each: the copy for the theme in use. */
const { resolved } = useTheme()
const leagueOptions = computed(() => [
  ...props.leagues.map((l) => ({
    value: l.slug,
    label: l.code,
    icon: leagueLogo(l.slug, 40, resolved.value),
  })),
  { value: 'all', label: 'Every league' },
])
const team = ref(props.filters.team ?? '')
watch(team, (slug) => router.visit(href({ team: slug || null }), { preserveScroll: true }))
const teamOptions = computed(() => [
  { value: '', label: 'All teams' },
  ...props.teams.map((t) => ({
    value: t.slug,
    label: t.name,
    icon: teamLogo(t.id, 40, resolved.value),
  })),
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
const next = computed(() => matchList(props.next))
/** "st", "nd", "rd", "th" after a place. */
const ord = (place: number) =>
  place % 100 >= 11 && place % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][place % 10] ?? 'th')
/** The leader's LP lead on the second, and every other's gap to the leader. */
const gapLine = (r: Row) => {
  const [first, second] = props.podium
  if (!r.account || !first?.account) return ''
  if (r === first) {
    return second?.account ? `${n(first.account.lp - second.account.lp)} LP ahead` : ''
  }
  return `${n(first.account.lp - r.account.lp)} LP behind`
}
const APEX = ['CHALLENGER', 'GRANDMASTER', 'MASTER'] as const
const short = (r: Row) =>
  [r.pro.team?.shortName ?? r.pro.team?.name, roleLabel(r.pro.role).toLowerCase()]
    .filter(Boolean)
    .join(', ')
</script>

<template>
  <Head :title="leagueCode ? `${leagueCode} pros in soloqueue` : 'Pro soloqueue ladder'" />
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
              <template v-if="leagueCode && counts"
                >{{ n(counts.players) }} {{ leagueCode }} players in {{ counts.teams }} teams,
                ranked by their best solo queue account</template
              ><template v-else>{{ n(pros) }} pros ranked by their best account</template
              ><template v-if="on">, {{ on }}</template
              ><template v-if="updatedAt">, updated {{ since(updatedAt) }}</template>
            </p>
          </div>
        </div>
      </section>

      <EmptyState
        v-if="!podium.length"
        icon="pro"
        title="No pro in Master and above here"
        line="Pros appear once one of their accounts reaches Master."
      />

      <!-- The leader, the next two under them, the apex tiers beside, in one sheet. -->
      <div v-else class="pl-top">
        <div>
          <Link
            v-for="r in podium.slice(0, 1)"
            :key="r.place"
            class="pl-lead"
            :href="`/pro/${r.pro.slug}`"
          >
            <span class="pl-no"
              >{{ r.place }}<sup>{{ ord(r.place) }}</sup></span
            >
            <span class="pl-cut" :class="{ flat: r.pro.photo && !leaderCutout }"
              ><ProPic :slug="r.pro.slug" :photo="r.pro.photo" :team="r.pro.team" :size="240" eager
            /></span>
            <span class="col" style="min-width: 0">
              <span class="pl-nm ell">{{ r.pro.name }}</span>
              <span class="meta row" style="gap: 6px; margin-top: 4px; min-width: 0"
                ><Logo
                  v-if="r.pro.team"
                  :team="r.pro.team.id"
                  :size="16"
                  style="width: 15px; height: 15px; object-fit: contain" /><span class="ell">{{
                  [r.pro.team?.name ?? 'No team', roleLabel(r.pro.role).toLowerCase()]
                    .filter(Boolean)
                    .join(', ')
                }}</span
                ><Flag
                  v-if="r.pro.country"
                  :code="r.pro.country"
                  :size="16"
                  style="margin-left: 4px"
                  :title="r.pro.countryName ?? undefined"
              /></span>
            </span>
            <span v-if="r.account" class="pl-lp">
              <span class="row" style="gap: 8px; justify-content: flex-end"
                ><RankEmblem :tier="r.account.tier" :size="30" /><span class="fg-l"
                  >{{ n(r.account.lp) }}<span class="u">LP</span></span
                ></span
              >
              <span class="meta">{{ gapLine(r) }}</span>
            </span>
          </Link>
          <Link
            v-for="r in podium.slice(1)"
            :key="r.place"
            class="pl-ln"
            :href="`/pro/${r.pro.slug}`"
          >
            <span class="pl-no sm"
              >{{ r.place }}<sup>{{ ord(r.place) }}</sup></span
            >
            <span class="ppic"
              ><ProPic :slug="r.pro.slug" :photo="r.pro.photo" :team="r.pro.team" :size="40"
            /></span>
            <span class="col" style="min-width: 0">
              <span class="h4 ell">{{ r.pro.name }}</span>
              <span class="meta row" style="gap: 5px; min-width: 0"
                ><Logo
                  v-if="r.pro.team"
                  :team="r.pro.team.id"
                  :size="14"
                  style="width: 14px; height: 14px; object-fit: contain"
                /><span class="ell">{{ short(r) }}</span></span
              >
            </span>
            <span v-if="r.account" class="h5 num">{{ n(r.account.lp) }} LP</span>
            <span v-else></span>
            <span class="meta pl-gap">{{ gapLine(r) }}</span>
          </Link>
        </div>
        <div class="pl-tiers">
          <span class="lab">Apex tiers</span>
          <div v-for="t in APEX" :key="t" class="pl-tier">
            <RankEmblem :tier="t" :size="26" />
            <span class="h5 grow">{{ rankWords(t) }}</span>
            <span class="fg-xs">{{ apex[t] }}</span>
            <span class="meta">pros</span>
          </div>
        </div>
      </div>

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
          <input
            v-model="search"
            type="text"
            placeholder="Find a pro or a team"
            aria-label="Find a pro or a team"
          />
        </label>
      </div>

      <section class="card">
        <div class="lt3h">
          <span style="text-align: center">#</span>
          <SortHead :sorter="sort" col="name" label="Pro" />
          <span>Role</span>
          <SortHead :sorter="sort" col="country" label="Country" />
          <SortHead :sorter="sort" col="rank" label="Rank" />
          <SortHead :sorter="sort" col="move" label="24 hours" title="LP won or lost in 24 hours" />
          <SortHead
            v-if="counts"
            :sorter="sort"
            col="recent"
            label="Recent games"
            title="Win rate of their ranked games of 30 days"
          />
          <span v-else>Recent games</span>
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
              ><ProPic :slug="r.pro.slug" :photo="r.pro.photo" :team="r.pro.team" :size="38"
            /></span>
            <span class="col" style="min-width: 0">
              <span class="h4 ell"
                >{{ r.pro.name }}<span v-if="r.sub" class="lb-tag">Sub</span></span
              >
              <span v-if="r.pro.team" class="meta row" style="gap: 5px"
                ><Logo
                  :team="r.pro.team.id"
                  :size="14"
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
          <span class="row meta" style="gap: 7px; min-width: 0"
            ><Flag :code="r.pro.country" :size="18" /><span class="ell">{{
              r.pro.countryName ?? '–'
            }}</span></span
          >
          <span v-if="r.account" class="row" style="gap: 8px">
            <RankEmblem :tier="r.account.tier" :size="26" />
            <span class="col">
              <span class="h5 num">{{ n(r.account.lp) }} LP</span>
              <span class="meta">{{ rankWords(r.account.tier, r.account.division) }}</span>
            </span>
          </span>
          <span v-else class="meta">Unranked</span>
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
          <WinRate
            v-if="r.record && r.record.games"
            :wins="r.record.wins"
            :games="r.record.games"
            :width="150"
          />
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

      <section v-if="next.length && leagueCode" class="sec" style="padding-top: 24px">
        <div class="card">
          <CardHead
            :title="`${leagueCode}, next games`"
            icon="clock"
            :more="{ label: `${leagueCode} page`, href: `/league/${filters.league}` }"
          />
          <MatchLine v-for="m in next" :key="m.id" :match="m" />
        </div>
      </section>
      <p class="meta lb-note">
        Rank: each pro's best account. 24 hours: LP and places since the same time yesterday. Recent
        games: their stored ranked games of the last 30 days, every account.
      </p>
    </div>
  </SiteLayout>
</template>
