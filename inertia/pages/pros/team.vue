<script setup lang="ts">
import { computed, ref } from 'vue'
import { Head, Link, usePage } from '@inertiajs/vue3'
import { ExternalLink } from 'lucide-vue-next'
import { ChampIcon, RoleIcon } from '@invadelol/ui'
import AppHeader from '../../components/AppHeader.vue'
import SiteFooter from '../../components/SiteFooter.vue'
import Crumbs from '../../components/champions/Crumbs.vue'
import Logo from '../../components/champions/Logo.vue'
import Crest from '../../components/champions/Crest.vue'
import ProPhoto from '../../components/champions/ProPhoto.vue'
import ShareButton from '../../components/champions/ShareButton.vue'
import { championName as loadedName } from '../../lib/assets.js'
import { championSlug, type GamesSummary } from '../../lib/champions.js'
import {
  PRO_ROLES,
  ago,
  countryName,
  pct,
  proRole,
  thousands,
  tierColor,
  tierName,
} from '../../lib/board.js'
import { teamPage } from '../../lib/pro_pages.js'
import { matchList, type ProMatch } from '../../lib/pro_matches.js'
import MatchCard from '../../components/pros/MatchCard.vue'
import MatchRow from '../../components/pros/MatchRow.vue'
import '../../css/champions.css'

interface LeagueRef {
  slug: string
  code: string
  name: string
}
interface TeamRef {
  id: string
  slug: string
  name: string
  shortName: string | null
}
interface Member {
  name: string
  slug: string | null
  photo?: string
  role: string | null
  title: string
  country: string | null
  current: boolean
  joinedAt: string | null
  leftAt: string | null
  best: { tier: string; division: number | null; lp: number | null } | null
  now: TeamRef | null
}

/** `/team/:slug`: a team's roster, latest games, most played champions and former players. */
const props = defineProps<{
  team: GamesSummary & {
    id: string
    slug: string
    name: string
    shortName: string | null
    region: string | null
    active: boolean
    socials: Record<string, string>
    league: LeagueRef | null
    lp: number | null
    place: number | null
    roster: Member[]
    pools: Record<string, { champion: number; games: number; wins: number }[]>
  }
  /** The team's next matches and its results of the last two weeks. */
  matches?: { next: ProMatch[]; results: ProMatch[] }
  now?: number
  names?: Record<number, [string, string]>
}>()

const page = usePage()
const club = computed(() => teamPage(props.team))
const canonical = computed(
  () => (page.props.social as { canonical?: string } | undefined)?.canonical ?? ''
)
const title = computed(
  () => (page.props.social as { title?: string } | undefined)?.title ?? club.value.name
)
const now = computed(() => props.now ?? Date.now())
const championName = (id: number) => props.names?.[id]?.[0] ?? loadedName(id)
const champHref = (id: number) =>
  `/champions/${props.names?.[id]?.[1] ?? championSlug(championName(id))}`

const ORDER = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT']
const current = computed(() => club.value.roster.filter((m) => m.current))
const players = computed(() =>
  current.value
    .filter((m) => m.title !== 'staff')
    .sort(
      (a, b) =>
        (a.title === 'sub' ? 1 : 0) - (b.title === 'sub' ? 1 : 0) ||
        ORDER.indexOf(a.role ?? '') - ORDER.indexOf(b.role ?? '')
    )
)
const staff = computed(() => current.value.filter((m) => m.title === 'staff'))
const former = computed(() =>
  club.value.roster.filter((m) => !m.current && m.title !== 'staff').slice(0, 12)
)
const record = computed(() => club.value.record)
const nextMatches = computed(() => matchList(props.matches?.next))
const results = computed(() => matchList(props.matches?.results))

const who = ref<string | null>(null)
const games = computed(() =>
  club.value.games.filter((g) => !who.value || (g.pro?.role ?? '') === who.value)
)
/** The roster's most played champions, each with the player who plays it most. */
const pool = computed(() => {
  const rows: { champion: number; games: number; wins: number; by: string }[] = []
  for (const [slug, list] of Object.entries(club.value.pools ?? {})) {
    const name =
      players.value.find((m) => m.slug === slug)?.name ??
      current.value.find((m) => m.slug === slug)?.name ??
      slug
    for (const c of list) rows.push({ ...c, by: name })
  }
  return rows.sort((a, b) => b.games - a.games).slice(0, 8)
})
const year = (d: string | null) => (d ? new Date(d).getUTCFullYear() : '')
const years = (m: Member) => {
  const from = year(m.joinedAt)
  const to = m.current ? 'now' : year(m.leftAt)
  return from && to && String(from) !== String(to) ? `${from} to ${to}` : String(from || to || '')
}
const roleLabel = (r: string | null) =>
  proRole(r)?.label ?? (r ? r.charAt(0) + r.slice(1).toLowerCase() : '')
const website = computed(() => {
  const w = club.value.socials?.website
  return w ? (w.startsWith('http') ? w : `https://${w}`) : null
})
const back = computed(() =>
  club.value.league
    ? { label: club.value.league.code, href: `/pros?league=${club.value.league.slug}` }
    : { label: 'Pros', href: '/pros' }
)
const crumbs = computed(() => [
  { label: 'Pros', href: '/pros' },
  ...(club.value.league
    ? [{ label: club.value.league.code, href: `/pros?league=${club.value.league.slug}` }]
    : []),
  { label: club.value.name },
])
</script>

<template>
  <Head :title="title" />
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <main class="nb nb-page flex-1">
      <Crumbs :back="back" :items="crumbs">
        <template #end><ShareButton :title="club.name" :url="canonical" /></template>
      </Crumbs>

      <section class="nb-panel nv-teamhead" :aria-label="club.name">
        <Logo :team="club" :size="72" eager />
        <div class="min-w-0">
          <h1>{{ club.name }}</h1>
          <div class="tags">
            <Link v-if="club.league" :href="`/pros?league=${club.league.slug}`"
              ><Logo :league="club.league" :size="20" eager />{{ club.league.code }}</Link
            >
            <span v-if="club.shortName">{{ club.shortName }}</span>
            <span v-if="!club.active" class="q">Inactive</span>
            <a
              v-if="website"
              :href="website"
              target="_blank"
              rel="noreferrer"
              style="color: var(--text-2)"
              >Website<ExternalLink :size="12" aria-hidden="true" /><span class="nb-sr">
                (opens a new tab)</span
              ></a
            >
          </div>
        </div>
        <div class="nb-figs">
          <div>
            <span>Average LP</span
            ><b class="iv-fig num">{{ club.lp !== null ? thousands(club.lp) : '-' }}</b
            ><em>starters in Master+</em>
          </div>
          <div>
            <span>Solo queue, 30 days</span
            ><b class="iv-fig num">{{ record.games ? pct(record.wins / record.games) : '-' }}</b
            ><em class="num">{{ record.games }} games</em>
          </div>
          <div v-if="club.league">
            <span>Rank in {{ club.league.code }}</span
            ><b class="iv-fig num">{{ club.place ? `#${club.place}` : '-' }}</b
            ><em>by average LP</em>
          </div>
        </div>
      </section>

      <div v-if="nextMatches.length || results.length" class="tm-matches">
        <section v-if="nextMatches.length" class="nb-panel tm-next" aria-labelledby="h-next">
          <div class="nb-ph">
            <h2 id="h-next">{{ nextMatches.length > 1 ? 'Next matches' : 'Next match' }}</h2>
          </div>
          <MatchCard :match="nextMatches[0]" size="lg" show-league :team="club.id" />
          <div v-if="nextMatches.length > 1" class="rows">
            <MatchRow v-for="mt in nextMatches.slice(1)" :key="mt.id" :match="mt" :team="club.id" />
          </div>
        </section>
        <section v-if="results.length" class="nb-panel" aria-labelledby="h-results">
          <div class="nb-ph">
            <h2 id="h-results">Results</h2>
            <span class="end nb-meta">Last two weeks</span>
          </div>
          <div class="nb-pb rows">
            <MatchRow v-for="mt in results" :key="mt.id" :match="mt" :team="club.id" />
          </div>
        </section>
      </div>

      <section style="margin-top: 16px" aria-labelledby="h-roster">
        <div class="nb-h">
          <h2 id="h-roster">Roster</h2>
          <span class="nb-meta">Best account of each player</span>
        </div>
        <p v-if="!players.length" class="nb-panel nb-empty">No current roster is known.</p>
        <div v-else class="nv-roster">
          <component
            :is="m.slug ? Link : 'div'"
            v-for="m in players"
            :key="m.name"
            :href="m.slug ? `/pro/${m.slug}` : undefined"
            class="nv-member"
          >
            <ProPhoto :slug="m.slug" :photo="m.photo" :width="240" :height="192" fluid>
              <span v-if="proRole(m.role)" class="rl"
                ><RoleIcon :lane="proRole(m.role)!.lane" :size="12" />{{ roleLabel(m.role)
                }}<template v-if="m.title === 'sub'">, sub</template></span
              >
            </ProPhoto>
            <span class="body">
              <b>{{ m.name }}</b>
              <small>{{
                [countryName(m.country), m.joinedAt ? `since ${year(m.joinedAt)}` : null]
                  .filter(Boolean)
                  .join(', ') || ' '
              }}</small>
              <span class="rk" :style="tierColor(m.best?.tier)"
                ><Crest :tier="m.best?.tier ?? null" :size="16" />{{
                  m.best ? tierName(m.best.tier) : 'Unranked'
                }}<span v-if="m.best?.lp !== null && m.best?.lp !== undefined" class="lp num"
                  >{{ thousands(m.best.lp) }} LP</span
                ></span
              >
              <span class="pool"
                ><ChampIcon
                  v-for="c in (m.slug ? (club.pools[m.slug] ?? []) : []).slice(0, 4)"
                  :key="c.champion"
                  :id="c.champion"
                  :size="24"
                  :title="championName(c.champion)"
              /></span>
            </span>
          </component>
        </div>
      </section>

      <div class="tm-cols">
        <section class="min-w-0" aria-labelledby="h-games">
          <div class="nb-h">
            <h2 id="h-games">Latest games of the roster</h2>
            <span class="nb-meta">Solo queue</span>
            <span
              class="end nb-seg"
              role="group"
              aria-label="Player"
              style="max-width: 100%; overflow-x: auto"
            >
              <button type="button" :class="{ on: !who }" :aria-pressed="!who" @click="who = null">
                Everyone
              </button>
              <button
                v-for="r in PRO_ROLES"
                :key="r.role"
                type="button"
                :class="{ on: who === r.role }"
                :aria-pressed="who === r.role"
                @click="who = r.role"
              >
                {{ r.label }}
              </button>
            </span>
          </div>
          <p v-if="!club.games.length" class="nb-panel nb-empty">
            No ranked game of this roster is stored for the last 30 days.
          </p>
          <p v-else-if="!games.length" class="nb-panel nb-empty">No recent game in this role.</p>
          <div v-for="g in games" :key="g.matchId" class="tm-row" :class="g.win ? 'w' : 'l'">
            <span class="e" />
            <span class="nb-pic"
              ><ChampIcon :id="g.champion" :size="36" :title="championName(g.champion)"
            /></span>
            <span class="min-w-0"
              ><Link v-if="g.pro" :href="`/pro/${g.pro.slug}`" class="stretch"
                ><b>{{ g.pro.name }}</b></Link
              ><small
                >{{ championName(g.champion)
                }}<template v-if="proRole(g.pro?.role)"
                  >, {{ roleLabel(g.pro?.role ?? null) }}</template
                ></small
              ></span
            >
            <span class="num kda" style="font-size: 13px; font-weight: 600; color: var(--text-1)"
              >{{ g.kills }} / {{ g.deaths }} / {{ g.assists }}</span
            >
            <span class="vs"
              ><template v-if="g.opponent"
                ><ChampIcon :id="g.opponent" :size="22" /><span
                  class="min-w-0"
                  style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap"
                  >vs {{ (g as any).opponentPro?.name ?? championName(g.opponent) }}</span
                ></template
              ></span
            >
            <span class="res"
              >{{ g.win ? 'Win' : 'Loss'
              }}<small class="num" style="font-weight: 500">{{ ago(g.startMs, now) }}</small></span
            >
          </div>
        </section>

        <div class="nb-stack">
          <section v-if="pool.length" class="nb-panel">
            <div class="nb-ph">
              <h2>Most played</h2>
              <span class="end nb-meta">Whole roster, 30 days</span>
            </div>
            <div class="nb-pb rows">
              <Link
                v-for="c in pool"
                :key="`${c.champion}-${c.by}`"
                :href="champHref(c.champion)"
                class="nb-row"
              >
                <span class="pic"><ChampIcon :id="c.champion" :size="26" /></span>
                <span class="n"
                  >{{ championName(c.champion) }}<small>{{ c.by }}</small></span
                >
                <span class="v q num">{{ c.games }}</span
                ><span class="v num">{{ pct(c.wins / c.games, 0) }}</span>
              </Link>
            </div>
          </section>
          <section v-if="former.length" class="nb-panel">
            <div class="nb-ph"><h2>Former players</h2></div>
            <div class="nb-pb rows">
              <component
                :is="m.slug ? Link : 'div'"
                v-for="m in former"
                :key="`${m.name}-${m.joinedAt}`"
                :href="m.slug ? `/pro/${m.slug}` : undefined"
                class="nb-row"
                style="min-height: 46px"
              >
                <ProPhoto :slug="m.slug" :photo="m.photo" :width="28" :height="28" />
                <span class="n"
                  >{{ m.name
                  }}<small>{{
                    [roleLabel(m.role), years(m)].filter(Boolean).join(', ')
                  }}</small></span
                >
                <Logo v-if="m.now" :team="m.now" :size="20" />
              </component>
            </div>
          </section>
          <section v-if="staff.length" class="nb-panel">
            <div class="nb-ph"><h2>Staff</h2></div>
            <div class="nb-pb rows">
              <component
                :is="m.slug ? Link : 'div'"
                v-for="m in staff"
                :key="m.name"
                :href="m.slug ? `/pro/${m.slug}` : undefined"
                class="nb-row"
                style="min-height: 46px"
              >
                <ProPhoto :slug="m.slug" :photo="m.photo" :width="28" :height="28" />
                <span class="n"
                  >{{ m.name }}<small>{{ roleLabel(m.role) || 'Staff' }}</small></span
                >
              </component>
            </div>
          </section>
        </div>
      </div>
    </main>
    <SiteFooter />
  </div>
</template>
