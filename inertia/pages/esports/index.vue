<script setup lang="ts">
import { computed } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import SiteLayout from '../../components/SiteLayout.vue'
import MoreLink from '../../components/ui/MoreLink.vue'
import MatchLine from '../../components/esports/MatchLine.vue'
import MatchHero from '../../components/esports/MatchHero.vue'
import ProLineup from '../../components/esports/ProLineup.vue'
import ChampionBand from '../../components/esports/ChampionBand.vue'
import ClimberList from '../../components/esports/ClimberList.vue'
import RosterMoves from '../../components/esports/RosterMoves.vue'
import Logo from '../../components/pros/Logo.vue'
import { matchList, type ProMatch } from '../../lib/pro_matches.js'
import type { Climber, LastEvent, LineupCard, RosterMove } from '../../lib/esports_landing.js'
import '../../css/esports.css'
import '../../css/esports-landing.css'

/**
 * `/esports`: the pros lead, all year. A centred title over the best pro of each league in solo
 * queue (tall portraits, each with its league's crest), the leagues under them. Then the event of
 * the moment: the match on now or next with the games after it in season, the last international
 * champion and the five who won it between seasons. Then the pros who won the most LP today next
 * to the games (or the roster moves), and the roster moves (app/services/esports_service.ts,
 * app/services/esports_landing_service.ts).
 */
const props = defineProps<{
  headline: (ProMatch & { leagues: [string | null, string | null]; game: number | null }) | null
  live: ProMatch[]
  next: ProMatch[]
  /** Between seasons (nothing planned): the last two weeks' results. */
  results: ProMatch[]
  leagues: { slug: string; code: string; name: string; region: string | null }[]
  leaders: LineupCard[]
  event: LastEvent | null
  climbers: Climber[]
  moves: RosterMove[]
  description: string
}>()

const head = computed(() => props.headline)
/** A match on now or still to come: the season is on. */
const playing = computed(() => Boolean(head.value && head.value.status !== 'finished'))
const live = computed(() => matchList(props.live))
const next = computed(() => matchList(props.next))
/** Between seasons: the last results, the headline first unless the champion's band shows it. */
const latest = computed(() => {
  const h = head.value
  const first = h && !playing.value && h.id !== props.event?.final.id ? [h] : []
  return [...first, ...matchList(props.results)].slice(0, 6)
})
/** The games beside today's climbers: next ones, else the latest results; none in season. */
const games = computed(() => (playing.value ? [] : next.value.length ? next.value : latest.value))
</script>

<template>
  <Head title="LoL esports: live matches, leagues and pros" />
  <SiteLayout>
    <div class="wrap pg-es el-pg">
      <header class="el-bh">
        <h1 class="el-d0">Esports</h1>
        <p v-if="leaders.length" class="el-lead">The best of each league in solo queue</p>
        <ProLineup v-if="leaders.length" :cards="leaders" />
        <nav class="el-crest" aria-label="Leagues">
          <Link v-for="l in leagues" :key="l.slug" :href="`/league/${l.slug}`" :title="l.name"
            ><Logo :league="l.slug" :size="32" class="el-lg28" /><span>{{ l.code }}</span></Link
          >
        </nav>
      </header>

      <section v-if="playing && head" class="sec">
        <div class="sec-h"><h2 class="h2">Live and next</h2></div>
        <div class="card lit el-hero">
          <MatchHero :match="head" :leagues="head.leagues" />
          <div v-if="next.length || live.length" class="el-hero-next">
            <MatchLine v-for="m in [...live, ...next].slice(0, 4)" :key="m.id" :match="m" league />
          </div>
        </div>
      </section>
      <ChampionBand v-else-if="event" :event="event" />

      <section v-if="climbers.length || games.length || moves.length" class="sec el-2">
        <div v-if="climbers.length" class="card">
          <div class="card-h">
            <h2 class="h3">LP won in 24 hours</h2>
            <MoreLink href="/leaderboards/pros?league=all" label="Pro ladder" />
          </div>
          <ClimberList :rows="climbers" />
        </div>
        <div v-if="games.length" class="card">
          <div class="card-h">
            <h2 class="h3">{{ next.length ? 'Next games' : 'Latest results' }}</h2>
          </div>
          <MatchLine v-for="m in games" :key="m.id" :match="m" league />
        </div>
        <div v-else-if="moves.length" class="card">
          <div class="card-h">
            <h2 class="h3">Roster moves</h2>
            <MoreLink href="/teams" label="Teams" />
          </div>
          <RosterMoves :moves="moves" />
        </div>
      </section>

      <section v-if="games.length && moves.length" class="sec">
        <div class="sec-h">
          <h2 class="h2">Roster moves</h2>
          <MoreLink href="/teams" label="Teams" />
        </div>
        <div class="card"><RosterMoves :moves="moves" /></div>
      </section>
    </div>
  </SiteLayout>
</template>
