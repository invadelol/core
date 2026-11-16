<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import SiteLayout from '../../components/SiteLayout.vue'
import Icon from '../../components/ui/Icon.vue'
import Frame from '../../components/ui/Frame.vue'
import Select from '../../components/ui/Select.vue'
import RankEmblem from '../../components/ui/RankEmblem.vue'
import TierChip from '../../components/ui/TierChip.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import SortHead from '../../components/ui/SortHead.vue'
import { linkSort, useSort, type SortDir } from '../../components/ui/sort.js'
import RoleFilter from '../../components/leaderboards/RoleFilter.vue'
import LadderPager from '../../components/leaderboards/LadderPager.vue'
import LadderPlayer from '../../components/leaderboards/LadderPlayer.vue'
import { champIcon, profileIcon } from '../../lib/assets.js'
import { patchName } from '../../lib/patch.js'
import {
  ROLES,
  laneOf,
  n,
  playerPath,
  roleLabel,
  since,
  tierWord,
  withQuery,
} from '../../lib/ladders.js'
import { regionFlag } from '../../lib/flags.js'
import '../../css/leaderboards.css'

type Tier = 'CHALLENGER' | 'GRANDMASTER' | 'MASTER'
interface Trick {
  place: number
  gameName: string | null
  tagLine: string | null
  icon: number | null
  level: number | null
  tier: Tier
  lp: number
  pro: {
    slug: string
    name: string
    photo?: string
    team: { id: string; slug: string; name: string; shortName: string | null } | null
  } | null
  champion: number
  position: string | null
  games: number
  share: number
  wins: number
  winRate: number
  vsAverage: number | null
  kda: number
  last: number
  also: { champion: number; share: number } | null
}

/**
 * `/leaderboards/one-tricks`: the server's Master+ players who play one champion in at least half
 * of their stored ranked games of the last 30 days (app/services/ladder.ts), by champion: the
 * picker, the chosen champion's one-tricks, then each champion's best one-trick.
 */
const props = defineProps<{
  region: { slug: string; label: string; platform: string }
  regions: { slug: string; label: string }[]
  rule: { minGames: number; minShare: number; windowDays: number; recentDays: number }
  filters: {
    role: string | null
    sort: 'lp' | 'games' | 'wr' | 'count'
    dir: SortDir
    recent: boolean
    all: boolean
  }
  updatedAt: number | null
  patch: string | null
  champions: { champion: number; oneTricks: number; byTier: Record<Tier, number> }[]
  selected: {
    champion: number
    position: string | null
    stat: { win: number; pick: number; tier: number | null; games: number } | null
    byTier: Record<Tier, number>
    total: number
    rows: Trick[]
  } | null
  best: {
    rows: {
      champion: number
      position: string | null
      tier: number | null
      oneTricks: number
      best: Trick
      others: (number | null)[]
    }[]
    page: number
    pages: number
    total: number
    pageSize: number
  }
  oneTricks: number
  names: Record<number, [string, string]>
  description: string
}>()

const nameOf = (id: number) => props.names[id]?.[0] ?? `Champion ${id}`
const slugOf = (id: number) => props.names[id]?.[1] ?? String(id)

const chosenSlug = computed(() => (props.selected ? slugOf(props.selected.champion) : null))
const query = computed(() => ({
  region: props.region.slug === 'euw' ? null : props.region.slug,
  champion: chosenSlug.value,
  role: props.filters.role,
  sort: props.filters.sort === 'lp' ? null : props.filters.sort,
  dir: props.filters.dir === 'asc' ? 'asc' : null,
  recent: props.filters.recent,
}))
const href = (changes: Record<string, string | number | boolean | null>) =>
  withQuery('/leaderboards/one-tricks', query.value, changes)

/** The chosen champion's one-tricks: all on the page, sorted in the browser. */
const chosenSort = useSort(
  () => props.selected?.rows ?? [],
  {
    rank: (r) => -r.place,
    games: (r) => r.games,
    wr: (r) => r.winRate,
  },
  { key: 'rank' }
)
/** The best one-trick of each champion: paged, so the server sorts (`?sort=&dir=`). */
const bestSort = computed(() =>
  linkSort(
    { key: props.filters.sort, dir: props.filters.dir },
    (key, dir) => href({ sort: key === 'lp' ? null : key, dir: dir === 'asc' ? 'asc' : null }),
    { key: 'lp' }
  )
)
const SORT_WORDS = {
  lp: 'their LP',
  games: 'games on the champion',
  wr: 'win rate on the champion',
  count: 'one-tricks of the champion',
} as const

const regionSlug = ref(props.region.slug)
watch(regionSlug, (slug) => router.visit(href({ region: slug === 'euw' ? null : slug })))

/** The picker's own filters: a name and a role, in the browser. */
const find = ref('')
const pickRole = ref<string | null>(null)
const positionOf = computed(() => {
  const out = new Map<number, string | null>()
  for (const b of props.best.rows) out.set(b.champion, b.position)
  return out
})
const picker = computed(() => {
  const q = find.value.trim().toLowerCase()
  return props.champions.filter(
    (c) =>
      (!q || nameOf(c.champion).toLowerCase().includes(q)) &&
      (!pickRole.value || laneOf(positionOf.value.get(c.champion)) === pickRole.value)
  )
})
const LOW = 3

const chosenName = computed(() => (props.selected ? nameOf(props.selected.champion) : ''))
const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`
const vs = (x: number | null) =>
  x === null ? null : `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)} vs average`
const updated = computed(() => since(props.updatedAt))
</script>

<template>
  <Head :title="`One-tricks, ${region.label}`">
    <meta name="description" :content="description" />
  </Head>
  <SiteLayout>
    <div class="wrap">
      <section class="mast">
        <nav class="crumbs" aria-label="Breadcrumb">
          <Link href="/leaderboards/solo">Leaderboards</Link><Icon name="chevr" />
          <span class="t1">One-tricks</span>
        </nav>
        <div class="lb-mt">
          <div class="col" style="gap: 8px">
            <h1 class="h1">One-tricks</h1>
            <span class="meta"
              >{{ region.label }}, Master and above<template v-if="updated"
                >, updated {{ updated }}</template
              ></span
            >
          </div>
          <div class="row" style="gap: 8px; margin-left: auto">
            <Select
              v-model="regionSlug"
              label="Region"
              :options="regions.map((r) => ({ value: r.slug, label: r.label, icon: regionFlag(r.slug) }))"
              width="11rem"
              align="right"
            />
          </div>
        </div>
      </section>

      <div class="lb-filt" style="margin-top: 0">
        <Link
          class="chk"
          :href="href({ recent: !filters.recent })"
          preserve-scroll
          role="switch"
          :aria-checked="filters.recent"
          ><span class="switch" :class="{ on: filters.recent }"></span>Played in the last
          {{ rule.recentDays }} days</Link
        >
        <span class="meta" style="margin-left: auto"
          >A one-trick plays one champion in at least half of their stored ranked games,
          {{ rule.minGames }} games or more in the last {{ rule.windowDays }} days</span
        >
      </div>

      <EmptyState
        v-if="!champions.length"
        icon="star"
        :title="`No one-trick found on ${region.label} yet`"
        line="One-tricks appear once the server's apex ladder and its players' games are stored."
      />

      <template v-else>
        <div class="lb-ot">
          <aside class="card lb-pk">
            <div class="card-h">
              <Icon name="grid" />
              <h2 class="h3">Champions</h2>
              <span class="meta">by one-tricks</span>
            </div>
            <label class="field" style="margin: 0 16px 10px">
              <Icon name="search" />
              <input
                v-model="find"
                type="text"
                placeholder="Find a champion"
                aria-label="Find a champion"
              />
            </label>
            <div class="seg" role="radiogroup" aria-label="Role">
              <button type="button" :class="{ on: !pickRole }" @click="pickRole = null">All</button>
              <button
                v-for="r in ROLES"
                :key="r.lane"
                type="button"
                :class="{ on: pickRole === r.lane }"
                :aria-label="r.label"
                @click="pickRole = r.lane"
              >
                <RoleIcon :lane="r.lane" :size="16" />
              </button>
            </div>
            <div class="lb-pgr">
              <Link
                v-for="c in picker"
                :key="c.champion"
                :href="href({ champion: slugOf(c.champion), all: null })"
                :class="{ on: c.champion === selected?.champion, lo: c.oneTricks < LOW }"
                preserve-scroll
                :title="nameOf(c.champion)"
              >
                <Frame :src="champIcon(c.champion)" size="xs" :alt="nameOf(c.champion)" />{{
                  c.oneTricks
                }}</Link
              >
            </div>
            <span class="more meta" style="cursor: default"
              >{{ champions.length }} {{ champions.length === 1 ? 'champion' : 'champions' }} with a
              one-trick</span
            >
          </aside>

          <section v-if="selected" class="card">
            <div class="lb-sp">
              <Frame size="l" :src="`/cdn/loading/${selected.champion}.jpg`" eager />
              <div class="bd">
                <span class="row meta" style="gap: 7px"
                  ><RoleIcon
                    v-if="laneOf(selected.position)"
                    :lane="laneOf(selected.position)!"
                    :size="15"
                  />{{ roleLabel(selected.position)
                  }}<template v-if="patch">, patch {{ patchName(patch) }}</template></span
                >
                <span class="row" style="gap: 12px">
                  <Link :href="`/champions/${slugOf(selected.champion)}`" class="h1">{{
                    chosenName
                  }}</Link>
                  <TierChip
                    v-if="selected.stat?.tier !== null && selected.stat?.tier !== undefined"
                    :tier="selected.stat.tier"
                  />
                </span>
                <span v-if="selected.stat" class="meta"
                  >Wins {{ pct(selected.stat.win) }} of games in Emerald and above, picked in
                  {{ pct(selected.stat.pick) }} of
                  {{ roleLabel(selected.position).toLowerCase() }} games</span
                >
              </div>
              <div class="lb-at">
                <span v-for="t in ['CHALLENGER', 'GRANDMASTER', 'MASTER'] as const" :key="t">
                  <RankEmblem :tier="t" :size="30" />
                  <b>{{ selected.byTier[t] }}</b>
                  <span class="meta">{{ tierWord(t) }}</span>
                </span>
                <span class="tt">
                  <b>{{ selected.total }}</b>
                  <span class="meta">One-tricks</span>
                </span>
              </div>
            </div>
            <div class="lb-h lb-o1 nm">
              <span class="lb-n" style="font-weight: 650">#</span>
              <span>Player</span>
              <SortHead :sorter="chosenSort" col="rank" label="Rank" />
              <SortHead :sorter="chosenSort" col="games" :label="`On ${chosenName}`" title="Games on the champion" />
              <SortHead :sorter="chosenSort" col="wr" label="Win rate on it" />
              <span>Also plays</span>
            </div>
            <Link
              v-for="(r, i) in chosenSort.rows"
              :key="r.place"
              class="lb-r lb-o1 nm"
              :href="(r.pro ? `/pro/${r.pro.slug}` : playerPath(r.gameName, r.tagLine)) ?? '#'"
            >
              <span class="lb-n">{{ i + 1 }}</span>
              <span class="row" style="gap: 12px; min-width: 0">
                <Frame :src="profileIcon(r.icon)" size="s" class="lb-pi" />
                <span class="col" style="min-width: 0; gap: 1px">
                  <span class="h4 ell"
                    >{{ r.gameName ?? 'Unknown player'
                    }}<template v-if="r.tagLine">
                      <span class="lb-tag">#{{ r.tagLine }}</span></template
                    ><span v-if="r.pro" class="lb-pro">PRO</span></span
                  >
                  <span class="meta ell">{{ r.kda.toFixed(1) }} KDA</span>
                </span>
              </span>
              <span class="row" style="gap: 9px">
                <RankEmblem :tier="r.tier" :size="26" />
                <span class="col">
                  <span class="h5 num">{{ n(r.lp) }} LP</span>
                  <span class="meta">{{ tierWord(r.tier) }}</span>
                </span>
              </span>
              <span class="lb-gm">
                <span class="h5 num"
                  >{{ r.games }}
                  <span class="meta">games, {{ Math.round(r.share * 100) }}%</span></span
                >
                <span class="bar"><i :style="{ width: `${r.share * 100}%` }"></i></span>
              </span>
              <span class="col" style="gap: 2px">
                <span class="h5 num">{{ pct(r.winRate) }}</span>
                <span
                  v-if="vs(r.vsAverage)"
                  class="lb-vs"
                  :class="r.vsAverage! >= 0 ? 'up' : 'dn'"
                  >{{ vs(r.vsAverage) }}</span
                >
              </span>
              <span v-if="r.also" class="lb-alt">
                <Frame
                  :src="champIcon(r.also.champion)"
                  :width="26"
                  size="xs"
                  :alt="nameOf(r.also.champion)"
                />
                <span class="meta">{{ Math.round(r.also.share * 100) }}%</span>
              </span>
              <span v-else class="t3">–</span>
            </Link>
            <div class="lb-pg">
              <span
                >Showing {{ selected.rows.length }} of {{ selected.total }}
                {{ chosenName }} one-tricks</span
              >
              <Link
                v-if="selected.total > selected.rows.length"
                class="more"
                :href="href({ all: true })"
                preserve-scroll
                >All {{ selected.total }}<Icon name="chevr"
              /></Link>
            </div>
          </section>
        </div>

        <section class="card" style="margin-top: 24px">
          <div class="lb-sec">
            <Icon name="star" />
            <h2 class="h3">The best one-trick on each champion</h2>
            <span class="meta"
              >Ranked by {{ SORT_WORDS[filters.sort] }}{{ filters.dir === 'asc' ? ', least first' : '' }}</span
            >
            <span class="row" style="gap: 10px; margin-left: auto">
              <RoleFilter :active="filters.role" :href="(role) => href({ role })" />
              <nav class="seg" aria-label="Sort">
                <Link
                  :href="href({ sort: null, dir: null })"
                  :class="{ on: filters.sort === 'lp' }"
                  preserve-scroll
                  >By LP</Link
                >
                <Link
                  :href="href({ sort: 'games', dir: null })"
                  :class="{ on: filters.sort === 'games' }"
                  preserve-scroll
                  >By games</Link
                >
              </nav>
            </span>
          </div>
          <div class="lb-h lb-o2 nm">
            <span>Champion</span>
            <span>Best one-trick</span>
            <SortHead :sorter="bestSort" col="lp" label="Rank" />
            <SortHead :sorter="bestSort" col="games" label="Games on it" />
            <SortHead :sorter="bestSort" col="wr" label="Win rate on it" />
            <SortHead :sorter="bestSort" col="count" label="One-tricks" />
          </div>
          <EmptyState
            v-if="!best.rows.length"
            compact
            icon="search"
            title="No one-trick in this role"
          />
          <Link
            v-for="b in best.rows"
            :key="b.champion"
            class="lb-r lb-o2 nm"
            :href="
              (b.best.pro
                ? `/pro/${b.best.pro.slug}`
                : playerPath(b.best.gameName, b.best.tagLine)) ?? '#'
            "
          >
            <span class="lb-chn">
              <Frame :src="champIcon(b.champion)" size="s" :alt="nameOf(b.champion)" />
              <span class="col" style="gap: 3px; min-width: 0">
                <span class="h4">{{ nameOf(b.champion) }}</span>
                <span class="meta row" style="gap: 6px"
                  ><RoleIcon v-if="laneOf(b.position)" :lane="laneOf(b.position)!" :size="13" />{{
                    roleLabel(b.position)
                  }}<template v-if="b.tier !== null"
                    ><span class="t3">·</span><TierChip :tier="b.tier" /></template
                ></span>
              </span>
            </span>
            <LadderPlayer
              :game-name="b.best.gameName"
              :tag-line="b.best.tagLine"
              :icon="b.best.icon"
              :level="null"
            />
            <span class="row" style="gap: 9px">
              <RankEmblem :tier="b.best.tier" :size="26" />
              <span class="col">
                <span class="h5 num">{{ n(b.best.lp) }} LP</span>
                <span class="meta">{{ tierWord(b.best.tier) }}</span>
              </span>
            </span>
            <span class="lb-gm">
              <span class="h5 num"
                >{{ b.best.games }}
                <span class="meta">games, {{ Math.round(b.best.share * 100) }}%</span></span
              >
              <span class="bar"><i :style="{ width: `${b.best.share * 100}%` }"></i></span>
            </span>
            <span class="col" style="gap: 2px">
              <span class="h5 num">{{ pct(b.best.winRate) }}</span>
              <span
                v-if="vs(b.best.vsAverage)"
                class="lb-vs"
                :class="b.best.vsAverage! >= 0 ? 'up' : 'dn'"
                >{{ vs(b.best.vsAverage) }}</span
              >
            </span>
            <span class="row" style="gap: 10px">
              <span v-if="b.others.length" class="lb-stk">
                <img
                  v-for="(icon, k) in b.others"
                  :key="k"
                  :src="profileIcon(icon)"
                  alt=""
                  style="width: 24px; height: 24px"
                />
              </span>
              <span class="col" style="gap: 1px">
                <span class="h5 num">{{ b.oneTricks }}</span>
                <span class="meta">{{ b.oneTricks === 1 ? 'one-trick' : 'one-tricks' }}</span>
              </span>
            </span>
          </Link>
          <LadderPager
            :page="best.page"
            :pages="best.pages"
            :total="best.total"
            :page-size="best.pageSize"
            noun="champions"
            :href="(p) => withQuery('/leaderboards/one-tricks', query, { page: p })"
          />
        </section>
        <p class="meta lb-note">
          Games and win rate on a champion: the player's stored ranked games of the last
          {{ rule.windowDays }} days. Compared with the champion's average in that role, Emerald and
          above<template v-if="patch">, patch {{ patchName(patch) }}</template
          >.
        </p>
      </template>
    </div>
  </SiteLayout>
</template>
