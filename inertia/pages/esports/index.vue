<script setup lang="ts">
import { computed } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import SiteLayout from '../../components/SiteLayout.vue'
import Icon from '../../components/ui/Icon.vue'
import CardHead from '../../components/ui/CardHead.vue'
import MoreLink from '../../components/ui/MoreLink.vue'
import RankEmblem from '../../components/ui/RankEmblem.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import MatchLine from '../../components/esports/MatchLine.vue'
import MatchTime from '../../components/pros/MatchTime.vue'
import { leagueLogo } from '../../lib/board.js'
import { n } from '../../lib/ladders.js'
import { isLive, matchList, stageLine, teamName, type ProMatch } from '../../lib/pro_matches.js'
import '../../css/esports.css'

interface League {
  slug: string
  code: string
  name: string
  region: string | null
  tier?: number
}

/**
 * `/esports`: the match to watch now, the leagues, one league's games around now with its teams by
 * their starters' solo queue, and its pros at the top of solo queue (app/services/
 * esports_service.ts). Standings, split results and power rankings are not stored: not shown.
 */
const props = defineProps<{
  headline: (ProMatch & { leagues: [string | null, string | null]; game: number | null }) | null
  live: ProMatch[]
  next: ProMatch[]
  leagues: League[]
  focus: {
    league: League
    next: ProMatch[]
    results: ProMatch[]
    teams: {
      id: string
      slug: string
      name: string
      shortName: string | null
      players: number
      lp: number | null
    }[]
    counts: { teams: number; players: number; accounts: number } | null
  } | null
  ladder: {
    total: number
    rows: {
      place: number
      pro: {
        slug: string
        name: string
        photo?: string
        role: string | null
        team: { id: string; slug: string; name: string; shortName: string | null } | null
      }
      account: { platform: string; tier: string; division: number | null; lp: number }
    }[]
  } | null
  description: string
}>()

const head = computed(() => props.headline)
const live = computed(() => matchList(props.live))
const next = computed(() => matchList(props.next))
const focusMatches = computed(() =>
  props.focus ? [...matchList(props.focus.next), ...matchList(props.focus.results)] : []
)
const logo = (id: string | null, size = 96) => (id ? `/cdn/team/${id}?s=${size}` : null)
</script>

<template>
  <Head title="Esports">
    <meta name="description" :content="description" />
  </Head>
  <SiteLayout>
    <div class="wrap pg-es">
      <div class="mast">
        <div class="crumbs"><span class="t1">Esports</span></div>
        <div class="mast-r">
          <div>
            <h1 class="h1">Esports</h1>
            <p v-if="focus?.counts" class="meta" style="margin-top: 8px">
              Live and next games, every league, and the solo queue of {{ n(focus.counts.players) }}
              {{ focus.league.code }} players
            </p>
          </div>
        </div>
      </div>

      <section v-if="head" class="card es-hd">
        <div class="tm r">
          <span class="col">
            <component
              :is="head.teams[0].slug ? Link : 'span'"
              :href="head.teams[0].slug ? `/team/${head.teams[0].slug}` : undefined"
              class="h2"
              >{{ teamName(head.teams[0]) }}</component
            >
            <span v-if="head.leagues[0]" class="meta">{{ head.leagues[0] }}</span>
          </span>
          <img v-if="logo(head.teams[0].id)" :src="logo(head.teams[0].id)!" alt="" />
        </div>
        <div class="mid">
          <span class="row" style="gap: 8px; justify-content: center"
            ><img
              v-if="head.league"
              :src="leagueLogo(head.league.slug, 48)"
              alt=""
              style="width: 22px; height: 22px; object-fit: contain"
            /><span class="h5"
              >{{ head.league?.name ?? head.tournament
              }}<template v-if="stageLine(head)"
                >, {{ stageLine(head).toLowerCase() }}</template
              ></span
            ></span
          >
          <div class="fg-xl" style="margin-top: 12px">
            <template v-if="head.status === 'finished' || isLive(head)"
              >{{ head.teams[0].score ?? 0 }} – {{ head.teams[1].score ?? 0 }}</template
            >
            <template v-else>vs</template>
          </div>
          <span v-if="isLive(head)" class="live" style="margin-top: 10px"
            >Live<template v-if="head.game">, game {{ head.game }}</template></span
          >
          <span
            v-else-if="head.status === 'finished'"
            class="meta"
            style="display: block; margin-top: 10px"
            >Final</span
          >
          <span v-else class="meta" style="display: block; margin-top: 10px"
            ><MatchTime :at="head.at"
          /></span>
          <div v-if="head.stream && isLive(head)" style="margin-top: 14px">
            <a class="btn pri" :href="head.stream" target="_blank" rel="noreferrer"
              ><Icon name="play" />Watch</a
            >
          </div>
        </div>
        <div class="tm">
          <img v-if="logo(head.teams[1].id)" :src="logo(head.teams[1].id)!" alt="" />
          <span class="col">
            <component
              :is="head.teams[1].slug ? Link : 'span'"
              :href="head.teams[1].slug ? `/team/${head.teams[1].slug}` : undefined"
              class="h2"
              >{{ teamName(head.teams[1]) }}</component
            >
            <span v-if="head.leagues[1]" class="meta">{{ head.leagues[1] }}</span>
          </span>
        </div>
      </section>

      <section class="sec side2" style="padding-top: 24px">
        <div class="stk">
          <div class="card">
            <CardHead
              title="Leagues"
              icon="trophy"
              :more="{ label: 'All leagues', href: '/leagues' }"
            />
            <div class="es-lgs">
              <Link v-for="l in leagues" :key="l.slug" :href="`/league/${l.slug}`" class="lrow">
                <img :src="leagueLogo(l.slug, 72)" alt="" />
                <span class="col">
                  <span class="h4">{{ l.code }}</span>
                  <span class="meta">{{ l.region ?? l.name }}</span>
                </span>
              </Link>
            </div>
          </div>

          <div v-if="focus">
            <div class="sec-h">
              <img
                :src="leagueLogo(focus.league.slug, 48)"
                alt=""
                style="width: 22px; height: 22px; object-fit: contain"
              />
              <h2 class="h2">{{ focus.league.code }}, games around now</h2>
              <MoreLink
                :href="`/league/${focus.league.slug}`"
                :label="`${focus.league.code} page`"
              />
            </div>
            <div class="card">
              <MatchLine v-for="m in focusMatches" :key="m.id" :match="m" />
              <EmptyState
                v-if="!focusMatches.length"
                compact
                icon="clock"
                :title="`No ${focus.league.code} game in the last two weeks or the next three`"
              />
            </div>
          </div>

          <div v-if="ladder && ladder.rows.length" class="card">
            <CardHead
              title="Top of the solo queue"
              icon="chart"
              :more="{
                label: 'Ladder',
                href: `/leaderboards/pros${focus ? `?league=${focus.league.slug}` : ''}`,
              }"
            />
            <Link
              v-for="r in ladder.rows"
              :key="r.pro.slug"
              class="lrow"
              :href="`/pro/${r.pro.slug}`"
            >
              <span class="rk">{{ r.place }}</span>
              <span class="es-pp"
                ><img
                  v-if="r.pro.photo"
                  :src="`/cdn/pro/${r.pro.slug}?s=48&v=${r.pro.photo}`"
                  alt=""
              /></span>
              <span class="col grow">
                <span class="h4">{{ r.pro.name }}</span>
                <span v-if="r.pro.team" class="meta row" style="gap: 5px"
                  ><img class="es-tl" :src="`/cdn/team/${r.pro.team.id}?s=32`" alt="" />{{
                    r.pro.team.name
                  }}</span
                >
              </span>
              <span class="row" style="gap: 6px">
                <RankEmblem :tier="r.account.tier" :size="22" />
                <span class="fg-xs num">{{ n(r.account.lp) }}</span>
              </span>
            </Link>
          </div>
        </div>

        <div class="stk">
          <div v-if="live.length" class="card">
            <CardHead title="Live now" icon="live" />
            <MatchLine v-for="m in live" :key="m.id" :match="m" league />
          </div>
          <div class="card">
            <CardHead title="Next games" icon="clock" meta="Every league" />
            <MatchLine v-for="m in next" :key="m.id" :match="m" league />
            <EmptyState
              v-if="!next.length"
              compact
              icon="clock"
              title="No game planned in the next week"
            />
          </div>
          <div v-if="focus && focus.teams.length" class="card">
            <CardHead
              :title="`${focus.league.code} teams`"
              icon="shield"
              meta="Starters' average LP"
            />
            <Link
              v-for="(t, i) in focus.teams"
              :key="t.id"
              class="lrow"
              style="min-height: 46px"
              :href="`/team/${t.slug}`"
            >
              <span class="rk">{{ i + 1 }}</span>
              <img
                :src="`/cdn/team/${t.id}?s=48`"
                alt=""
                style="width: 24px; height: 24px; object-fit: contain"
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
