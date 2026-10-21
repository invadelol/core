<script setup lang="ts">
import { computed } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import { ExternalLink } from 'lucide-vue-next'
import { RankCrest, RoleIcon } from '@invadelol/ui'
import AppHeader from '../../components/AppHeader.vue'
import SiteFooter from '../../components/SiteFooter.vue'
import Banner from '../../components/champions/Banner.vue'
import TeamLogo from '../../components/champions/TeamLogo.vue'
import GameRow from '../../components/champions/GameRow.vue'
import { championName, nameOf, regionLabel } from '../../lib/assets.js'
import {
  champIconUrl,
  championSlug,
  itemUrl,
  laneOf,
  pct,
  rankLabel,
  roleOf,
  splashUrl,
  type GamesSummary,
  type ProTag,
} from '../../lib/champions.js'
import '../../css/champions.css'

interface Account {
  id: string
  platform: string
  gameName: string
  tagLine: string
  tier: string | null
  division: number | null
  lp: number | null
  wins: number | null
  losses: number | null
  peakTier: string | null
  peakDivision: number | null
  peakLp: number | null
}

/** `/pro/:slug`: a professional player, every account they play on, their teams and their games. */
const props = defineProps<{
  pro: ProTag &
    GamesSummary & {
      socials: Record<string, string>
      accounts: Account[]
      teams: {
        team: NonNullable<ProTag['team']>
        title: string
        role: string | null
        current: boolean
        joinedAt: string | null
        leftAt: string | null
      }[]
    }
}>()

/** Art when no game is stored yet: a champion of the role. */
const ROLE_ART: Record<string, number> = { TOP: 122, JUNGLE: 64, MID: 103, ADC: 222, SUPPORT: 412 }
const main = computed(
  () => props.pro.champions[0]?.champion ?? ROLE_ART[props.pro.role ?? ''] ?? 103
)
const lane = computed(() => laneOf(props.pro.role ?? ''))
const best = computed(() => props.pro.accounts.find((a) => a.tier) ?? null)
const record = computed(() => props.pro.record)
const roleLabel = computed(() =>
  props.pro.role ? props.pro.role.charAt(0) + props.pro.role.slice(1).toLowerCase() : 'Player'
)
const figures = computed(() => [
  {
    label: 'Best rank',
    value: best.value ? rankLabel(best.value.tier).split(' ·')[0] : 'Unranked',
    sub: best.value?.lp !== null && best.value ? `${best.value.lp} LP` : undefined,
  },
  {
    label: 'Accounts',
    value: props.pro.accounts.length,
    sub: [...new Set(props.pro.accounts.map((a) => regionLabel(a.platform)))].join(' · '),
  },
  { label: 'Games', value: record.value.games, sub: 'last 30 days' },
  {
    label: 'Win rate',
    value: record.value.games ? pct(record.value.wins / record.value.games) : '–',
    sub: record.value.games
      ? `${((record.value.kills + record.value.assists) / Math.max(1, record.value.deaths)).toFixed(2)} KDA`
      : undefined,
  },
])
const profile = (a: Account) => `/${encodeURIComponent(`${a.gameName}-${a.tagLine}`)}`
const SOCIAL: Record<string, (v: string) => string> = {
  twitter: (v) => `https://x.com/${v}`,
  twitch: (v) => `https://twitch.tv/${v}`,
  instagram: (v) => `https://instagram.com/${v}`,
  leaguepedia: (v) => (v.startsWith('http') ? v : `https://lol.fandom.com/wiki/${v}`),
}
const socials = computed(() =>
  Object.entries(props.pro.socials ?? {})
    .filter(([k, v]) => SOCIAL[k] && v)
    .map(([k, v]) => ({
      k,
      label: k === 'twitter' ? 'X' : k.charAt(0).toUpperCase() + k.slice(1),
      href: SOCIAL[k](v),
    }))
)
const year = (d: string | null) => (d ? new Date(d).getFullYear() : '')
</script>

<template>
  <Head :title="pro.name" />
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <Banner :art="[splashUrl(main)]" :title="pro.name" :figures="figures">
      <template #face>
        <TeamLogo v-if="pro.team" :team="pro.team" :size="96" class="cs-face" />
        <img v-else class="cs-face" :src="champIconUrl(main)" alt="" />
      </template>
      <template #kicker>
        <span class="cs-pro">{{ pro.staff ? roleLabel : 'Pro' }}</span>
        <RoleIcon v-if="lane" :lane="lane as any" :size="14" />{{ pro.staff ? '' : roleLabel
        }}<template v-if="pro.country"> · {{ pro.country }}</template>
      </template>
      <template #under>
        <div class="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
          <Link v-if="pro.team" :href="`/team/${pro.team.slug}`" class="iv-btn sm"
            ><TeamLogo :team="pro.team" :size="16" />{{ pro.team.name }}</Link
          >
          <span v-else class="text-ink-3">No team now</span>
          <a
            v-for="s in socials"
            :key="s.k"
            :href="s.href"
            target="_blank"
            rel="noreferrer"
            class="iv-btn sm ghost"
            >{{ s.label }}<ExternalLink :size="11"
          /></a>
        </div>
      </template>
    </Banner>

    <main class="page cs-main flex-1">
      <div class="cs-cols cs-c-side">
        <div class="cs-stack">
          <section>
            <div class="cs-card" style="padding: 0 0 12px">
              <h2 style="margin: 0">
                Recent games<span class="meta">Ranked solo, last 30 days, every account</span>
              </h2>
            </div>
            <div v-if="pro.games.length" class="cs-games">
              <GameRow v-for="g in pro.games" :key="g.matchId" :game="g" who="account" />
            </div>
            <p v-else class="cs-empty">
              No ranked game of {{ pro.name }} is stored yet. Their accounts are read first: games
              show up within a few hours.
            </p>
          </section>
          <section v-if="pro.champions.length" class="iv-panel cs-card flush">
            <h2>Champions<span class="meta">Last 30 days</span></h2>
            <table class="iv-table cs-table">
              <thead>
                <tr>
                  <th>Champion</th>
                  <th class="num on">Games</th>
                  <th class="num">Win rate</th>
                  <th class="num hm">KDA</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in pro.champions.slice(0, 12)" :key="c.champion">
                  <td class="c">
                    <img :src="champIconUrl(c.champion)" alt="" /><Link
                      :href="`/champions/${championSlug(championName(c.champion))}`"
                      ><b>{{ championName(c.champion) }}</b></Link
                    >
                  </td>
                  <td class="num">{{ c.games }}</td>
                  <td class="num">
                    <b>{{ pct(c.wins / c.games) }}</b>
                  </td>
                  <td class="num hm t2">{{ c.kda }}</td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
        <div class="cs-stack">
          <section class="iv-panel cs-card">
            <h2>
              Accounts<span class="meta">{{ pro.accounts.length }}</span>
            </h2>
            <Link v-for="a in pro.accounts" :key="a.id" :href="profile(a)" class="cs-acc">
              <RankCrest :tier="a.tier" :size="26" />
              <span class="min-w-0"
                ><b
                  >{{ a.gameName }}<span>#{{ a.tagLine }}</span></b
                ><small
                  >{{ regionLabel(a.platform)
                  }}<template v-if="a.peakTier">
                    · peak {{ rankLabel(a.peakTier).split(' ·')[0] }}</template
                  ></small
                ></span
              >
              <span class="v"
                >{{ rankLabel(a.tier, a.division, a.lp).replace(' · ', ' ')
                }}<small v-if="a.wins !== null && (a.wins || a.losses)"
                  >{{ a.wins }}W {{ a.losses }}L</small
                ></span
              >
              <span />
            </Link>
          </section>
          <section v-if="pro.items.length" class="iv-panel cs-card">
            <h2>Most built<span class="meta">Finished items, last 30 days</span></h2>
            <div class="cs-later" style="grid-template-columns: 1fr">
              <div>
                <div v-for="i in pro.items.slice(0, 8)" :key="i.item" class="r">
                  <img :src="itemUrl(i.item)" alt="" /><span class="n">{{
                    nameOf('item', i.item)
                  }}</span
                  ><span class="v">{{ i.games }} games</span>
                </div>
              </div>
            </div>
          </section>
          <section v-if="pro.teams.length" class="iv-panel cs-card">
            <h2>Teams</h2>
            <Link
              v-for="t in pro.teams"
              :key="`${t.team.id}-${t.joinedAt}`"
              :href="`/team/${t.team.slug}`"
              class="cs-member"
            >
              <TeamLogo :team="t.team" :size="32" />
              <span class="nm"
                ><b>{{ t.team.name }}</b
                ><small
                  >{{
                    t.role
                      ? roleOf(
                          t.role === 'MID'
                            ? 'MIDDLE'
                            : t.role === 'ADC'
                              ? 'BOTTOM'
                              : t.role === 'SUPPORT'
                                ? 'UTILITY'
                                : t.role
                        ).label
                      : t.title
                  }}<template v-if="t.title === 'sub'"> · sub</template> · {{ year(t.joinedAt) }}–{{
                    t.current ? 'now' : year(t.leftAt)
                  }}</small
                ></span
              >
              <span v-if="t.current" class="cs-pro">Now</span>
            </Link>
          </section>
        </div>
      </div>
    </main>
    <SiteFooter />
  </div>
</template>
