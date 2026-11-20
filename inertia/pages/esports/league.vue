<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import SiteLayout from '../../components/SiteLayout.vue'
import Icon from '../../components/ui/Icon.vue'
import Select from '../../components/ui/Select.vue'
import Tabs from '../../components/ui/Tabs.vue'
import CardHead from '../../components/ui/CardHead.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import MatchLine from '../../components/esports/MatchLine.vue'
import Logo from '../../components/pros/Logo.vue'
import ProPic from '../../components/pros/ProPic.vue'
import { leagueLogo } from '../../lib/board.js'
import { useTheme } from '../../lib/theme.js'
import { n, signedN } from '../../lib/ladders.js'
import { isLive, matchList, stageLine, teamLabel, type ProMatch } from '../../lib/pro_matches.js'
import '../../css/esports.css'

interface League {
  slug: string
  code: string
  name: string
  region: string | null
}
interface Leader {
  slug: string
  name: string
  photo?: string
  team: { id: string; slug: string; name: string; shortName: string | null } | null
  best: { tier: string; lp: number } | null
  move: { lp: number; places: number | null } | null
  record: { games: number; wins: number } | null
}

/**
 * `/league/:slug`: a league's games around now (two weeks back, three ahead), its players' solo
 * queue (best LP, LP won in a day, most games), its teams by their starters' average LP, and the
 * international event's games. Standings, brackets and awards are not stored, so not shown.
 */
const props = defineProps<{
  league: League
  leagues: League[]
  teams: {
    id: string
    slug: string
    name: string
    shortName: string | null
    players: number
    lp: number | null
  }[]
  counts: { teams: number; players: number; accounts: number }
  leaders: { lp: Leader[]; gained: Leader[]; games: Leader[] }
  next: ProMatch[]
  results: ProMatch[]
  international: ProMatch[]
  description: string
}>()

const slug = ref(props.league.slug)
watch(slug, (s) => router.visit(`/league/${s}`))
/** The select draws one logo per league: the copy for the theme in use. */
const { resolved } = useTheme()
const leagueOptions = computed(() =>
  props.leagues.map((l) => ({
    value: l.slug,
    label: l.code,
    icon: leagueLogo(l.slug, 40, resolved.value),
  }))
)
const games = computed(() => [...matchList(props.next), ...matchList(props.results)])
const world = computed(() => matchList(props.international)[0] ?? null)
const tabs = computed(() => [
  { key: 'overview', label: 'Overview', href: `/league/${props.league.slug}` },
  {
    key: 'pros',
    label: 'Pros',
    href: `/leaderboards/pros?league=${props.league.slug}`,
    count: props.counts.players,
  },
  { key: 'teams', label: 'Teams', href: `/teams#${props.league.slug}`, count: props.counts.teams },
])
const columns = computed(() => [
  {
    label: 'Solo queue LP',
    list: props.leaders.lp,
    value: (p: Leader) => (p.best ? n(p.best.lp) : '–'),
  },
  {
    label: 'LP won in 24 hours',
    list: props.leaders.gained,
    value: (p: Leader) => (p.move ? signedN(p.move.lp) : '–'),
  },
  {
    label: 'Solo queue games, 30 days',
    list: props.leaders.games,
    value: (p: Leader) => (p.record ? n(p.record.games) : '–'),
  },
])
</script>

<template>
  <Head :title="`${league.code}: teams, players and results`" />
  <SiteLayout>
    <div class="wrap pg-es">
      <div class="mast" style="padding-bottom: 16px">
        <nav class="crumbs" aria-label="Breadcrumb">
          <Link href="/esports">Esports</Link><Icon name="chevr" /><Link href="/leagues"
            >Leagues</Link
          ><Icon name="chevr" /><span class="t1">{{ league.code }}</span>
        </nav>
      </div>
      <section class="card lq3-hd">
        <div class="row" style="gap: 18px">
          <Logo
            :league="league.slug"
            :size="56"
            style="width: 56px; height: 56px; object-fit: contain"
          />
          <span class="col">
            <h1 class="h1">{{ league.code }}</h1>
            <span class="meta">{{ league.name }}</span>
          </span>
          <span class="row" style="margin-left: auto; gap: 10px">
            <span
              class="row meta"
              style="gap: 8px; padding-right: 14px; border-right: 1px solid var(--line)"
              >{{ counts.teams }} teams, {{ n(counts.players) }} players</span
            >
            <Select v-model="slug" :options="leagueOptions" width="12rem" align="right" />
          </span>
        </div>
        <Tabs :items="tabs" active="overview" label="League" style="margin-top: 18px; border: 0" />
      </section>

      <section class="sec side2" style="padding-top: 24px">
        <div class="stk">
          <div class="card">
            <CardHead title="Games" icon="list" meta="Last two weeks and next three" />
            <MatchLine v-for="m in games" :key="m.id" :match="m" />
            <EmptyState
              v-if="!games.length"
              compact
              icon="clock"
              :title="`No ${league.code} game in the last two weeks or the next three`"
            />
          </div>
          <div class="card es-ld">
            <div v-for="c in columns" :key="c.label">
              <span class="lab">{{ c.label }}</span>
              <Link
                v-for="(p, i) in c.list"
                :key="p.slug"
                class="lrow"
                :href="`/pro/${p.slug}`"
                style="padding: 6px 0; border: 0"
              >
                <span class="es-pp" style="width: 36px; height: 36px"
                  ><ProPic :slug="p.slug" :photo="p.photo" :team="p.team" :size="36"
                /></span>
                <span class="col grow" style="min-width: 0">
                  <span class="h5 ell">{{ p.name }}</span>
                  <span v-if="p.team" class="meta row" style="gap: 5px"
                    ><Logo class="es-tl" :team="p.team.id" :size="14" />{{
                      p.team.shortName ?? p.team.name
                    }}</span
                  >
                </span>
                <span v-if="i === 0" class="vtop">{{ c.value(p) }}</span>
                <span v-else class="fg-xs num">{{ c.value(p) }}</span>
              </Link>
              <span v-if="!c.list.length" class="meta">No one yet</span>
            </div>
          </div>
          <div class="card">
            <CardHead
              title="Teams"
              icon="shield"
              :more="{ label: 'Rosters', href: `/teams#${league.slug}` }"
            />
            <div class="tgrid">
              <Link v-for="t in teams" :key="t.id" :href="`/team/${t.slug}`">
                <Logo
                  :team="t.id"
                  :size="48"
                  style="width: 48px; height: 48px; object-fit: contain"
                />
                <span class="h5">{{ t.name }}</span>
                <span class="meta" style="margin-top: -4px">{{
                  t.lp === null ? `${t.players} players` : `${n(t.lp)} LP`
                }}</span>
              </Link>
            </div>
          </div>
        </div>
        <div class="stk">
          <div v-if="world" class="card">
            <div class="card-h">
              <Logo
                v-if="world.league"
                :league="world.league.slug"
                :size="20"
                style="width: 20px; height: 20px; object-fit: contain"
              />
              <span class="h3"
                >{{ world.league?.name ?? world.tournament
                }}<template v-if="stageLine(world)"
                  >, {{ stageLine(world).toLowerCase() }}</template
                ></span
              >
              <span v-if="isLive(world)" class="live" style="margin-left: auto">Live</span>
            </div>
            <div class="row" style="justify-content: space-between; padding: 0 20px 18px">
              <span class="row h4" style="gap: 8px"
                ><Logo
                  :team="world.teams[0].id"
                  :size="32"
                  style="width: 30px; height: 30px; object-fit: contain"
                />{{ teamLabel(world.teams[0]) }}</span
              >
              <span class="fg-m num"
                >{{ world.teams[0].score ?? '–' }} – {{ world.teams[1].score ?? '–' }}</span
              >
              <span class="row h4" style="gap: 8px"
                >{{ teamLabel(world.teams[1])
                }}<Logo
                  :team="world.teams[1].id"
                  :size="32"
                  style="width: 30px; height: 30px; object-fit: contain"
              /></span>
            </div>
          </div>
          <div class="card">
            <CardHead title="Starters, average LP" icon="chart" />
            <Link
              v-for="(t, i) in teams"
              :key="t.id"
              class="lrow"
              style="min-height: 42px"
              :href="`/team/${t.slug}`"
            >
              <span class="rk">{{ i + 1 }}</span>
              <Logo
                :team="t.id"
                :size="24"
                style="width: 22px; height: 22px; object-fit: contain"
              />
              <span class="h5 grow">{{ t.name }}</span>
              <span class="fg-xs num">{{ t.lp === null ? '–' : n(t.lp) }}</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  </SiteLayout>
</template>
