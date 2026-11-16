<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3'
import SiteLayout from '../../components/SiteLayout.vue'
import Masthead from '../../components/ui/Masthead.vue'
import MoreLink from '../../components/ui/MoreLink.vue'
import { leagueLogo } from '../../lib/board.js'
import { n } from '../../lib/ladders.js'
import '../../css/esports.css'

/** `/teams`: every league's teams, by their starters' average solo queue LP. */
const props = defineProps<{
  groups: {
    league: { slug: string; code: string; name: string; region: string | null }
    teams: {
      id: string
      slug: string
      name: string
      shortName: string | null
      players: number
      lp: number | null
    }[]
  }[]
  description: string
}>()
const total = props.groups.reduce((s, g) => s + g.teams.length, 0)
</script>

<template>
  <Head title="Teams">
    <meta name="description" :content="description" />
  </Head>
  <SiteLayout>
    <div class="wrap pg-es">
      <Masthead
        title="Teams"
        :crumbs="[{ label: 'Esports', href: '/esports' }, { label: 'Teams' }]"
        :meta="`${total} teams in ${groups.length} leagues, ordered by their starters' average solo queue LP`"
      />
      <div class="stk">
        <section v-for="g in groups" :id="g.league.slug" :key="g.league.slug" class="card">
          <div class="card-h">
            <img
              :src="leagueLogo(g.league.slug, 40)"
              alt=""
              style="width: 20px; height: 20px; object-fit: contain"
            />
            <h2 class="h3">{{ g.league.code }}</h2>
            <span class="meta">{{ g.league.name }}</span>
            <MoreLink :href="`/league/${g.league.slug}`" :label="`${g.league.code} page`" />
          </div>
          <div class="es-tg">
            <Link v-for="t in g.teams" :key="t.id" :href="`/team/${t.slug}`">
              <img :src="`/cdn/team/${t.id}?s=96`" alt="" />
              <span class="h5">{{ t.name }}</span>
              <span class="meta">{{
                t.lp === null ? `${t.players} players` : `${n(t.lp)} LP average`
              }}</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  </SiteLayout>
</template>
