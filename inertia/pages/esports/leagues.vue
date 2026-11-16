<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import SiteLayout from '../../components/SiteLayout.vue'
import Masthead from '../../components/ui/Masthead.vue'
import RankEmblem from '../../components/ui/RankEmblem.vue'
import MatchLine from '../../components/esports/MatchLine.vue'
import { leagueLogo } from '../../lib/board.js'
import { n } from '../../lib/ladders.js'
import { matchOrNull, type ProMatch } from '../../lib/pro_matches.js'
import '../../css/esports.css'

/**
 * `/leagues`: every league with its teams, players and solo queue leader, and its next game (or
 * its last result while none is planned).
 */
defineProps<{
  leagues: {
    slug: string
    code: string
    name: string
    region: string | null
    tier: number
    counts: { teams: number; players: number; accounts: number } | null
    leader: { slug: string; name: string; best: { tier: string; lp: number } | null } | null
    next: ProMatch | null
    last: ProMatch | null
  }[]
  description: string
}>()
</script>

<template>
  <Head title="Leagues">
    <meta name="description" :content="description" />
  </Head>
  <SiteLayout>
    <div class="wrap pg-es">
      <Masthead
        title="Leagues"
        :crumbs="[{ label: 'Esports', href: '/esports' }, { label: 'Leagues' }]"
        :meta="`${leagues.length} leagues: their teams, their games around now and their players in solo queue`"
      />
      <div class="es-lgc">
        <section v-for="l in leagues" :key="l.slug" class="card">
          <Link :href="`/league/${l.slug}`" class="es-lgh">
            <img :src="leagueLogo(l.slug, 96)" alt="" />
            <span class="col" style="min-width: 0">
              <span class="h2">{{ l.code }}</span>
              <span class="meta ell">{{ l.name }}</span>
            </span>
            <span class="meta" style="margin-left: auto">{{ l.region }}</span>
          </Link>
          <div class="es-kv">
            <span
              ><b class="num">{{ l.counts?.teams ?? '–' }}</b
              ><span class="meta">teams</span></span
            >
            <span
              ><b class="num">{{ l.counts ? n(l.counts.players) : '–' }}</b
              ><span class="meta">players</span></span
            >
            <span v-if="l.leader?.best" class="grow">
              <span class="row" style="gap: 6px"
                ><RankEmblem :tier="l.leader.best.tier" :size="20" /><b class="num">{{
                  n(l.leader.best.lp)
                }}</b></span
              ><span class="meta"
                >best in solo queue:
                <Link :href="`/pro/${l.leader.slug}`" class="t2">{{ l.leader.name }}</Link></span
              >
            </span>
          </div>
          <MatchLine v-if="matchOrNull(l.next ?? l.last)" :match="matchOrNull(l.next ?? l.last)!" />
        </section>
      </div>
    </div>
  </SiteLayout>
</template>
