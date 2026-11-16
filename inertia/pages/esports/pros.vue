<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import SiteLayout from '../../components/SiteLayout.vue'
import Masthead from '../../components/ui/Masthead.vue'
import Icon from '../../components/ui/Icon.vue'
import Frame from '../../components/ui/Frame.vue'
import Select from '../../components/ui/Select.vue'
import RankEmblem from '../../components/ui/RankEmblem.vue'
import WinRate from '../../components/ui/WinRate.vue'
import CardHead from '../../components/ui/CardHead.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import SortHead from '../../components/ui/SortHead.vue'
import { useSort } from '../../components/ui/sort.js'
import MatchLine from '../../components/esports/MatchLine.vue'
import { champIcon, championName } from '../../lib/assets.js'
import { countryName, leagueLogo } from '../../lib/board.js'
import { ROLES, laneOf, n, rankValue, rankWords, roleLabel, signedN } from '../../lib/ladders.js'
import { matchList, type ProMatch } from '../../lib/pro_matches.js'
import '../../css/esports.css'
import '../../css/leaderboards.css'

interface Player {
  slug: string
  name: string
  photo?: string
  role: string | null
  country: string | null
  starter: boolean
  team: { id: string; slug: string; name: string; shortName: string | null } | null
  best: { platform: string; tier: string; division: number | null; lp: number } | null
  move: { places: number | null; lp: number } | null
  record: { games: number; wins: number } | null
  champions: { champion: number; games: number }[]
}

/**
 * `/pros?league=lec`: a league's players (starters and subs), best solo queue account first, with
 * their last day, their stored games of 30 days and the champions they play; the league's next
 * games beside them.
 */
const props = defineProps<{
  leagues: { slug: string; code: string; name: string; region: string | null }[]
  data: {
    league: { slug: string; code: string; name: string; region: string | null }
    teams: { id: string; slug: string; name: string }[]
    players: Player[]
    counts: { teams: number; players: number; accounts: number }
  }
  matches: { league: ProMatch[]; international: { next: ProMatch[]; results: ProMatch[] } }
  description: string
}>()

const league = ref(props.data.league.slug)
watch(league, (slug) =>
  router.visit(slug === props.leagues[0]?.slug ? '/pros' : `/pros?league=${slug}`)
)
const role = ref<string | null>(null)
const find = ref('')
const shown = computed(() => {
  const q = find.value.trim().toLowerCase()
  return props.data.players.filter(
    (p) =>
      (!role.value || laneOf(p.role) === role.value) &&
      (!q || p.name.toLowerCase().includes(q) || p.team?.name.toLowerCase().includes(q))
  )
})
/** Best account first, as the league's list comes; the heads sort it in the browser. */
const sort = useSort(
  shown,
  {
    name: (p) => p.name,
    country: (p) => (p.country ? countryName(p.country) : null),
    rank: (p) => (p.best ? rankValue(p.best.tier, p.best.division, p.best.lp) : null),
    move: (p) => p.move?.lp ?? null,
    recent: (p) => (p.record?.games ? p.record.wins / p.record.games : null),
  },
  { key: 'rank', first: { name: 'asc', country: 'asc' } }
)
const next = computed(() => matchList(props.matches.league))
</script>

<template>
  <Head :title="`${data.league.code} pros`">
    <meta name="description" :content="description" />
  </Head>
  <SiteLayout>
    <div class="wrap pg-es">
      <Masthead
        title="Pros"
        :crumbs="[{ label: 'Esports', href: '/esports' }, { label: 'Pros' }]"
        :meta="`${n(data.counts.players)} ${data.league.code} players in ${data.counts.teams} teams, ${n(data.counts.accounts)} solo queue accounts`"
      >
        <template #end>
          <Select
            v-model="league"
            :options="
              leagues.map((l) => ({ value: l.slug, label: l.code, icon: leagueLogo(l.slug, 40) }))
            "
            width="12rem"
            align="right"
          />
        </template>
      </Masthead>

      <div class="bar-f" style="margin: 0 0 16px">
        <div class="seg" role="radiogroup" aria-label="Role">
          <button type="button" :class="{ on: !role }" @click="role = null">All roles</button>
          <button
            v-for="r in ROLES"
            :key="r.lane"
            type="button"
            :class="{ on: role === r.lane }"
            @click="role = r.lane"
          >
            <RoleIcon :lane="r.lane" :size="15" />{{ r.label }}
          </button>
        </div>
        <label class="field" style="flex: 1; max-width: 320px; margin-left: auto">
          <Icon name="search" />
          <input
            v-model="find"
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
          <SortHead :sorter="sort" col="recent" label="Recent games" title="Win rate of their ranked games of 30 days" />
          <span>Most played</span>
        </div>
        <EmptyState
          v-if="!shown.length"
          compact
          icon="search"
          title="No pro matches these filters"
        />
        <Link v-for="(p, i) in sort.rows" :key="p.slug" class="lt3" :href="`/pro/${p.slug}`">
          <span class="rk" style="text-align: center">{{ i + 1 }}</span>
          <span class="row" style="gap: 11px; min-width: 0">
            <span class="ppic"
              ><img
                v-if="p.photo"
                :src="`/cdn/pro/${p.slug}?s=48&v=${p.photo}`"
                alt=""
                loading="lazy"
            /></span>
            <span class="col" style="min-width: 0">
              <span class="h4 ell"
                >{{ p.name }}<span v-if="!p.starter" class="lb-tag">Sub</span></span
              >
              <span v-if="p.team" class="meta row" style="gap: 5px"
                ><img
                  :src="`/cdn/team/${p.team.id}?s=32`"
                  alt=""
                  style="width: 14px; height: 14px; object-fit: contain"
                />{{ p.team.name }}</span
              >
            </span>
          </span>
          <span class="row meta" style="gap: 6px"
            ><RoleIcon
              v-if="laneOf(p.role)"
              :lane="laneOf(p.role)!"
              :size="15"
              style="opacity: 0.6"
            />{{ roleLabel(p.role) || '–' }}</span
          >
          <span class="meta">{{ countryName(p.country) || '–' }}</span>
          <span v-if="p.best" class="row" style="gap: 8px">
            <RankEmblem :tier="p.best.tier" :size="26" />
            <span class="col">
              <span class="h5 num">{{ n(p.best.lp) }} LP</span>
              <span class="meta">{{ rankWords(p.best.tier, p.best.division) }}</span>
            </span>
          </span>
          <span v-else class="meta">Unranked</span>
          <span>
            <template v-if="p.move && p.move.lp">
              <span class="h5" :class="p.move.lp > 0 ? 'wn' : 'ls'"
                >{{ signedN(p.move.lp) }} LP</span
              >
              <span v-if="p.move.places" class="meta" style="display: block"
                >{{ p.move.places > 0 ? '▲' : '▼' }} {{ Math.abs(p.move.places) }}
                {{ Math.abs(p.move.places) === 1 ? 'place' : 'places' }}</span
              >
            </template>
            <span v-else class="t3">–</span>
          </span>
          <WinRate
            v-if="p.record && p.record.games"
            :wins="p.record.wins"
            :games="p.record.games"
            :width="150"
          />
          <span v-else class="t3">–</span>
          <span class="row" style="gap: 4px">
            <Frame
              v-for="c in p.champions"
              :key="c.champion"
              :src="champIcon(c.champion)"
              :width="30"
              size="xs"
              :alt="championName(c.champion)"
            />
          </span>
        </Link>
      </section>

      <section v-if="next.length" class="sec" style="padding-top: 24px">
        <div class="card">
          <CardHead
            :title="`${data.league.code}, next games`"
            icon="clock"
            :more="{ label: `${data.league.code} page`, href: `/league/${data.league.slug}` }"
          />
          <MatchLine v-for="m in next" :key="m.id" :match="m" />
        </div>
      </section>
      <p class="meta lb-note">
        Rank: each pro's best solo queue account. 24 hours: LP and places since the same time
        yesterday. Recent games: their stored ranked games of the last 30 days, every account.
      </p>
    </div>
  </SiteLayout>
</template>
