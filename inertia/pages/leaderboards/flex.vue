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
import SortHead from '../../components/ui/SortHead.vue'
import { linkSort, type SortDir } from '../../components/ui/sort.js'
import RoleFilter from '../../components/leaderboards/RoleFilter.vue'
import LadderPager from '../../components/leaderboards/LadderPager.vue'
import LadderPlayer from '../../components/leaderboards/LadderPlayer.vue'
import { champIcon, championName } from '../../lib/assets.js'
import {
  laneOf,
  n,
  playerPath,
  rankWords,
  roleLabel,
  tierWord,
  withQuery,
} from '../../lib/ladders.js'
import { regionFlag } from '../../lib/flags.js'
import '../../css/leaderboards.css'

interface Row {
  place: number
  gameName: string
  tagLine: string
  icon: number | null
  level: number | null
  tier: string
  division: string | null
  lp: number
  wins: number
  losses: number
  role: string | null
  champions: { champion: number; games: number; wins: number }[]
  games: number
}

/**
 * `/leaderboards/flex`: Riot's flex ladder is not stored, so this is the flex ranks of the players
 * Invade knows on a server (looked up, or seen by the desktop app, in the last 30 days), with their
 * role and champions from their stored flex games (app/services/flex_ladder_service.ts).
 */
const props = defineProps<{
  region: { slug: string; label: string; platform: string }
  regions: { slug: string; label: string }[]
  scope: { kind: 'tracked'; seenDays: number; listed: number }
  filters: {
    role: string | null
    q: string | null
    sort: string | null
    dir: SortDir | null
  }
  tiers: { tier: string; players: number }[]
  rows: Row[]
  total: number
  players: number
  page: number
  pages: number
  pageSize: number
  description: string
}>()

const query = computed(() => ({
  region: props.region.slug === 'euw' ? null : props.region.slug,
  role: props.filters.role,
  q: props.filters.q,
  sort: props.filters.sort,
  dir: props.filters.dir,
}))
const href = (changes: Record<string, string | number | boolean | null>) =>
  withQuery('/leaderboards/flex', query.value, changes)
/** The heads sort the whole list on the server (`?sort=&dir=`), the first page again. */
const sort = computed(() =>
  linkSort(
    { key: props.filters.sort, dir: props.filters.dir ?? 'desc' },
    (key, dir) => href({ sort: key, dir }),
    { key: 'rank' }
  )
)

const regionSlug = ref(props.region.slug)
watch(regionSlug, (slug) => router.visit(href({ region: slug === 'euw' ? null : slug })))
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

const apex = computed(() =>
  ['CHALLENGER', 'GRANDMASTER'].map((tier) => ({
    tier,
    players: props.tiers.find((t) => t.tier === tier)?.players ?? 0,
  }))
)
</script>

<template>
  <Head :title="`Flex ladder, ${region.label}`" />
  <SiteLayout>
    <div class="wrap">
      <section class="mast">
        <nav class="crumbs" aria-label="Breadcrumb">
          <Link href="/leaderboards/solo">Leaderboards</Link><Icon name="chevr" />
          <span class="t1">Flex</span>
        </nav>
        <div class="lb-mt">
          <div class="col" style="gap: 8px">
            <h1 class="h1">Flex ladder</h1>
            <span class="meta row" style="gap: 10px"
              >{{ region.label }}, ranked flex<span
                class="lb-ex"
                :title="`Riot's flex ladder is not stored: these are the players Invade looked up or saw in the desktop app in the last ${scope.seenDays} days`"
                ><Icon name="users" />Players Invade knows</span
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
        icon="users"
        :title="`No ${region.label} flex player known yet`"
        line="Players appear here once someone looks them up on invade.lol or meets them in the desktop app."
      />

      <template v-else>
        <section class="card lb-cs c3" style="margin-top: 0">
          <div v-for="t in apex" :key="t.tier">
            <RankEmblem :tier="t.tier" :size="40" />
            <span class="col" style="gap: 3px">
              <span class="lab">{{ tierWord(t.tier) }}</span>
              <span class="fg-m num">{{ n(t.players) }}</span>
              <span class="meta">players Invade knows</span>
            </span>
          </div>
          <div class="n">
            <span class="lab">Who is listed</span>
            <span class="h4">{{ n(players) }} players</span>
            <span class="meta">seen in the last {{ scope.seenDays }} days</span>
          </div>
        </section>

        <div class="lb-filt">
          <RoleFilter :active="filters.role" :href="(role) => href({ role })" />
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
          <div class="lb-h lb-fx">
            <span class="lb-n" style="font-weight: 650">#</span>
            <span>Player</span>
            <span>Role</span>
            <SortHead :sorter="sort" col="rank" label="Rank" />
            <SortHead :sorter="sort" col="wr" label="Win rate, season" />
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
            class="lb-r lb-fx"
            :href="playerPath(r.gameName, r.tagLine) ?? '#'"
          >
            <span class="lb-n">{{ r.place }}</span>
            <LadderPlayer
              :game-name="r.gameName"
              :tag-line="r.tagLine"
              :icon="r.icon"
              :level="r.level"
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
                <span class="meta">{{ rankWords(r.tier, r.division) }}</span>
              </span>
            </span>
            <WinRate :wins="r.wins" :losses="r.losses" :width="130" />
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
            noun="players"
            :href="(p) => withQuery('/leaderboards/flex', query, { page: p })"
          />
        </section>
        <p class="meta lb-note">
          Riot's flex ladder is not stored: these are the flex ranks of players Invade looked up or
          saw in the desktop app in the last {{ scope.seenDays }} days. Role and champions: their
          stored flex games.
        </p>
      </template>
    </div>
  </SiteLayout>
</template>
