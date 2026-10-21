<script setup lang="ts">
import { computed } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import { RankCrest, RoleIcon } from '@invadelol/ui'
import AppHeader from '../../components/AppHeader.vue'
import SiteFooter from '../../components/SiteFooter.vue'
import Banner from '../../components/champions/Banner.vue'
import TeamLogo from '../../components/champions/TeamLogo.vue'
import GameRow from '../../components/champions/GameRow.vue'
import { championName } from '../../lib/assets.js'
import {
  byRank,
  champIconUrl,
  championSlug,
  laneOf,
  pct,
  rankLabel,
  splashUrl,
  type GamesSummary,
} from '../../lib/champions.js'
import '../../css/champions.css'

interface Member {
  name: string
  slug: string | null
  role: string | null
  title: string
  country: string | null
  current: boolean
  joinedAt: string | null
  leftAt: string | null
  best: { tier: string; division: number | null; lp: number | null } | null
}

/** `/team/:slug`: a team's roster, its past players and their recent ranked games. */
const props = defineProps<{
  team: GamesSummary & {
    id: string
    slug: string
    name: string
    shortName: string | null
    region: string | null
    active: boolean
    roster: Member[]
  }
}>()

const now = computed(() => props.team.roster.filter((m) => m.current))
const players = computed(() => now.value.filter((m) => m.title !== 'staff'))
const staff = computed(() => now.value.filter((m) => m.title === 'staff'))
const past = computed(() => props.team.roster.filter((m) => !m.current).slice(0, 24))
const art = computed(() => {
  const top = props.team.champions.slice(0, 3).map((c) => c.champion)
  return (top.length ? top : [222, 103, 64]).map(splashUrl)
})
const record = computed(() => props.team.record)
const ranked = computed(() =>
  players.value.filter((m) => m.best).sort((a, b) => byRank(a.best, b.best))
)
const figures = computed(() => [
  {
    label: 'Players',
    value: players.value.length,
    sub: staff.value.length ? `${staff.value.length} staff` : undefined,
  },
  {
    label: 'Best rank',
    value: ranked.value[0]?.best ? rankLabel(ranked.value[0].best.tier).split(' ·')[0] : '–',
    sub: ranked.value[0]?.name,
  },
  { label: 'Games', value: record.value.games, sub: 'last 30 days' },
  {
    label: 'Win rate',
    value: record.value.games ? pct(record.value.wins / record.value.games) : '–',
  },
])
const year = (d: string | null) => (d ? new Date(d).getFullYear() : '')
</script>

<template>
  <Head :title="team.name" />
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <Banner :art="art" :title="team.name" :figures="figures" list>
      <template #face><TeamLogo :team="team" :size="96" class="cs-face" /></template>
      <template #kicker>
        <span class="cs-pro">Team</span
        ><template v-if="team.shortName">{{ team.shortName }}</template
        ><template v-if="team.region"> · {{ team.region }}</template> ·
        {{ team.active ? 'Active' : 'Inactive' }}
      </template>
    </Banner>
    <main class="page cs-main flex-1">
      <div class="cs-cols cs-c-side">
        <div class="cs-stack">
          <section class="iv-panel cs-card">
            <h2>
              Roster<span class="meta">{{ players.length }} players</span>
            </h2>
            <component
              :is="m.slug ? Link : 'div'"
              v-for="m in players"
              :key="m.name"
              :href="m.slug ? `/pro/${m.slug}` : undefined"
              class="cs-member"
            >
              <span class="role"
                ><RoleIcon
                  v-if="laneOf(m.role ?? '')"
                  :lane="laneOf(m.role ?? '') as any"
                  :size="20"
              /></span>
              <span class="nm"
                ><b>{{ m.name }}</b
                ><small
                  >{{ m.role ? m.role.charAt(0) + m.role.slice(1).toLowerCase() : 'Player'
                  }}<template v-if="m.title === 'sub'"> · sub</template
                  ><template v-if="m.country"> · {{ m.country }}</template> · since
                  {{ year(m.joinedAt) }}</small
                ></span
              >
              <RankCrest v-if="m.best" :tier="m.best.tier" :size="22" />
              <span class="text-[12.5px] font-semibold">{{
                m.best
                  ? rankLabel(m.best.tier, m.best.division, m.best.lp).replace(' · ', ' ')
                  : 'Unranked'
              }}</span>
            </component>
            <template v-if="staff.length">
              <span class="cs-h" style="margin-top: 14px">Staff</span>
              <component
                :is="m.slug ? Link : 'div'"
                v-for="m in staff"
                :key="m.name"
                :href="m.slug ? `/pro/${m.slug}` : undefined"
                class="cs-member"
              >
                <span class="role" />
                <span class="nm"
                  ><b>{{ m.name }}</b
                  ><small>{{
                    m.role ? m.role.charAt(0) + m.role.slice(1).toLowerCase() : 'Staff'
                  }}</small></span
                >
              </component>
            </template>
          </section>
          <section>
            <div class="cs-card" style="padding: 0 0 12px">
              <h2 style="margin: 0">
                Recent games<span class="meta">The roster's ranked solo games, last 30 days</span>
              </h2>
            </div>
            <div v-if="team.games.length" class="cs-games">
              <GameRow v-for="g in team.games" :key="g.matchId" :game="g" who="pro" />
            </div>
            <p v-else class="cs-empty">No ranked game of this roster is stored yet.</p>
          </section>
        </div>
        <div class="cs-stack">
          <section v-if="team.champions.length" class="iv-panel cs-card">
            <h2>Champions<span class="meta">The roster, last 30 days</span></h2>
            <Link
              v-for="c in team.champions.slice(0, 8)"
              :key="c.champion"
              :href="`/champions/${championSlug(championName(c.champion))}`"
              class="cs-ch"
            >
              <img :src="champIconUrl(c.champion)" alt="" />
              <span class="nm"
                >{{ championName(c.champion)
                }}<small>{{ c.games }} games · {{ c.kda }} KDA</small></span
              >
              <span class="v">{{ pct(c.wins / c.games) }}</span>
            </Link>
          </section>
          <section v-if="past.length" class="iv-panel cs-card">
            <h2>Past players</h2>
            <component
              :is="m.slug ? Link : 'div'"
              v-for="m in past"
              :key="`${m.name}-${m.joinedAt}`"
              :href="m.slug ? `/pro/${m.slug}` : undefined"
              class="cs-member"
            >
              <span class="role"
                ><RoleIcon
                  v-if="laneOf(m.role ?? '')"
                  :lane="laneOf(m.role ?? '') as any"
                  :size="18"
              /></span>
              <span class="nm"
                ><b>{{ m.name }}</b
                ><small>{{ year(m.joinedAt) }}–{{ year(m.leftAt) }}</small></span
              >
            </component>
          </section>
        </div>
      </div>
    </main>
    <SiteFooter />
  </div>
</template>
