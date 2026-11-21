<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import SiteLayout from '../../components/SiteLayout.vue'
import Icon from '../../components/ui/Icon.vue'
import Frame from '../../components/ui/Frame.vue'
import CardHead from '../../components/ui/CardHead.vue'
import RankEmblem from '../../components/ui/RankEmblem.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import MatchLine from '../../components/esports/MatchLine.vue'
import LpRule from '../../components/esports/LpRule.vue'
import Logo from '../../components/pros/Logo.vue'
import ProPic from '../../components/pros/ProPic.vue'
import Flag from '../../components/pros/Flag.vue'
import { champIcon } from '../../lib/assets.js'
import { countryName } from '../../lib/board.js'
import { laneOf, n, rankWords, roleLabel } from '../../lib/ladders.js'
import { profilePath } from '../../lib/format.js'
import { rememberTeam } from '../../lib/recent.js'
import { matchList, type ProMatch } from '../../lib/pro_matches.js'
import { lpText } from '../../lib/esports_landing.js'
import '../../css/esports.css'

interface Member {
  name: string
  slug: string | null
  photo?: string
  role: string | null
  title: string
  country: string | null
  current: boolean
  joinedAt: string | Date | null
  leftAt: string | Date | null
  best: { tier: string; division: number | null; lp: number } | null
  /** Where a former player plays now. */
  now: { id: string; slug: string; name: string } | null
}
interface Game {
  matchId: string
  account: string
  startMs: number
  champion: number
  win: boolean
  kills: number
  deaths: number
  assists: number
  cs: number
  durationSec: number
  pro?: { slug: string; name: string; photo?: string; team?: { id: string } | null }
}

/**
 * `/team/:slug`: a team's starting five and their solo queue, its games around now, its staff,
 * former players and where its starters' solo queue ranks it in its league. Split results are not
 * stored: the games of two weeks back and three ahead stand in.
 */
const props = defineProps<{
  team: {
    id: string
    slug: string
    name: string
    shortName: string | null
    region: string | null
    socials: Record<string, string>
    league: { slug: string; code: string; name: string; region: string | null } | null
    /** The starters' average LP against Master 0 LP, how many it counts, of how many starters. */
    lp: number | null
    counted: number
    starters: number
    place: number | null
    roster: Member[]
    games: Game[]
    record: { games: number; wins: number }
    pools: Record<string, { champion: number; games: number; wins: number }[]>
  }
  matches: { next: ProMatch[]; results: ProMatch[] }
  leagueTeams: { id: string; slug: string; name: string; lp: number | null }[]
  names: Record<number, [string, string]>
  description: string
}>()

/** Listed with the recent searches, by its logo and name (lib/recent.ts). */
onMounted(() =>
  watch(
    () => props.team.slug,
    () => rememberTeam(props.team),
    { immediate: true }
  )
)

const ORDER = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT']
/** The year of a date the page gets as text (or as a date on the server's render). */
const year = (v: string | Date | null) => (v ? String(new Date(v).getUTCFullYear()) : '')
const five = computed(() =>
  props.team.roster
    .filter((m) => m.current && m.title === 'player')
    .sort((a, b) => ORDER.indexOf(a.role ?? '') - ORDER.indexOf(b.role ?? ''))
)
const subs = computed(() => props.team.roster.filter((m) => m.current && m.title === 'sub'))
const staff = computed(() => props.team.roster.filter((m) => m.current && m.title === 'staff'))
/** Former players, one card each, with the years they played here. */
const former = computed(() => {
  const by = new Map<string, { m: Member; spans: [string, string][] }>()
  for (const m of props.team.roster) {
    if (m.current || m.title === 'staff' || !m.slug) continue
    const span: [string, string] = [year(m.joinedAt), year(m.leftAt)]
    const e = by.get(m.slug) ?? { m, spans: [] }
    e.spans.push(span)
    by.set(m.slug, e)
  }
  return [...by.values()].slice(0, 10).map(({ m, spans }) => ({
    m,
    years: spans
      .filter(([a]) => a)
      .sort()
      .map(([a, b]) => (b && b !== a ? `${a} to ${b}` : a))
      .join(', '),
  }))
})
const games = computed(() => props.team.games.slice(0, 8))
const pools = computed(() =>
  five.value
    .filter((m) => m.slug && props.team.pools[m.slug]?.length)
    .map((m) => ({ m, list: props.team.pools[m.slug!].slice(0, 4) }))
    .slice(0, 3)
)
const matchesAround = computed(() => [
  ...matchList(props.matches.next),
  ...matchList(props.matches.results),
])
const nextMatch = computed(() => matchList(props.matches.next)[0] ?? null)
const lastMatch = computed(() => matchList(props.matches.results)[0] ?? null)
const nameOf = (id: number) => props.names[id]?.[0] ?? ''
const day = (ms: number) =>
  new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const ordinal = (k: number) =>
  `${k}${k % 10 === 1 && k !== 11 ? 'st' : k % 10 === 2 && k !== 12 ? 'nd' : k % 10 === 3 && k !== 13 ? 'rd' : 'th'}`
const gamePath = (g: Game) => {
  const at = g.account.lastIndexOf('#')
  return at > 0
    ? `${profilePath(g.account.slice(0, at), g.account.slice(at + 1))}/match/${g.matchId}`
    : null
}
const website = computed(() => props.team.socials.website ?? null)
const site = computed(() =>
  website.value ? website.value.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : null
)
const shared = ref(false)
function share() {
  if (typeof window === 'undefined') return
  navigator.clipboard?.writeText(window.location.href).then(() => {
    shared.value = true
    setTimeout(() => (shared.value = false), 1600)
  })
}
const opponentOf = (m: ProMatch) => (m.teams[0].id === props.team.id ? m.teams[1] : m.teams[0])
const wonBy = (m: ProMatch) => (m.winner ? m.teams[m.winner - 1].id === props.team.id : null)
</script>

<template>
  <Head :title="`${team.name}: roster and soloqueue accounts`" />
  <SiteLayout>
    <div class="wrap pg-es">
      <div class="mast" style="padding-bottom: 16px">
        <nav class="crumbs" aria-label="Breadcrumb">
          <Link href="/esports">Esports</Link><Icon name="chevr" />
          <template v-if="team.league"
            ><Link :href="`/league/${team.league.slug}`">{{ team.league.code }}</Link
            ><Icon name="chevr"
          /></template>
          <span class="t1">{{ team.name }}</span>
        </nav>
      </div>

      <section class="card pp-hero tm">
        <Frame
          size="l"
          style="height: 220px; display: grid; place-items: center; background: var(--v900)"
        >
          <Logo
            :team="team.id"
            :size="96"
            style="width: 120px; height: 120px; object-fit: contain"
          />
        </Frame>
        <div class="col" style="justify-content: center; min-width: 0">
          <h1 class="pp-name">{{ team.name }}</h1>
          <div class="row" style="gap: 8px; margin-top: 16px; flex-wrap: wrap">
            <Link v-if="team.league" class="tagx" :href="`/league/${team.league.slug}`"
              ><Logo :league="team.league.slug" :size="16" />{{ team.league.code }}</Link
            >
            <span v-if="team.league?.region ?? team.region" class="tagx">{{
              team.league?.region ?? team.region
            }}</span>
            <span v-if="team.shortName" class="tagx">{{ team.shortName }}</span>
          </div>
          <div class="row" style="gap: 10px; margin-top: 22px; flex-wrap: wrap">
            <button class="btn" type="button" @click="share">
              <Icon name="share" />{{ shared ? 'Link copied' : 'Share' }}
            </button>
            <a v-if="website" class="btn ghost" :href="website" target="_blank" rel="noreferrer"
              ><Icon name="external" />{{ site }}</a
            >
          </div>
        </div>
        <div class="pp-kv tm-kv">
          <div v-if="nextMatch || lastMatch">
            <span class="lab">{{ nextMatch ? 'Next match' : 'Last match' }}</span>
            <span v-if="nextMatch" class="tm-f"
              ><span class="tm-f1"
                ><span class="fg-l">{{
                  opponentOf(nextMatch).code ?? opponentOf(nextMatch).name
                }}</span></span
              ><span class="tm-f2"
                >{{ nextMatch.league?.code }}, {{ day(Date.parse(nextMatch.at)) }}</span
              ></span
            >
            <span v-else-if="lastMatch" class="tm-f"
              ><span class="tm-f1"
                ><span class="fg-l"
                  >{{ lastMatch.teams[0].score }}-{{ lastMatch.teams[1].score }}</span
                ></span
              ><span class="tm-f2"
                >{{ wonBy(lastMatch) ? 'Won' : 'Lost' }} against
                {{ opponentOf(lastMatch).code ?? opponentOf(lastMatch).name }}</span
              ></span
            >
          </div>
          <div v-if="team.lp !== null">
            <span class="lab">Starters</span>
            <span class="tm-f"
              ><span class="tm-f1 gd"
                ><span class="fg-l">{{ lpText(team.lp) }}</span
                ><span class="tm-u">LP average</span
                ><LpRule :counted="team.counted" :starters="team.starters" /></span
              ><span v-if="team.place && team.league" class="tm-f2"
                >{{ ordinal(team.place) }} in the {{ team.league.code }}</span
              ><span v-if="team.counted < team.starters" class="tm-f3"
                >{{ team.counted }} of {{ team.starters }} starters counted</span
              ></span
            >
          </div>
          <div v-if="team.record.games">
            <span class="lab">Solo queue</span>
            <span class="tm-f"
              ><span class="tm-f1"
                ><span class="fg-l"
                  >{{ Math.round((team.record.wins / team.record.games) * 100) }}%</span
                ><span class="tm-u">win rate</span></span
              ><span class="tm-f2">Over their last {{ n(team.record.games) }} games</span></span
            >
          </div>
        </div>
      </section>

      <nav class="tabs" style="margin-top: 24px" aria-label="Team">
        <a class="on" href="#roster">Overview</a>
        <a href="#games">Games</a>
        <a href="#solo">Solo queue</a>
        <a v-if="former.length" href="#history">History</a>
      </nav>

      <section id="roster" class="sec" style="padding-top: 32px">
        <div class="sec-h">
          <Icon name="users" />
          <h2 class="h2">Starting five</h2>
          <span v-if="subs.length" class="meta"
            >and {{ subs.map((s) => s.name).join(', ') }} on the bench</span
          >
        </div>
        <div v-if="five.length" class="five2">
          <component
            :is="m.slug ? Link : 'div'"
            v-for="m in five"
            :key="m.name"
            class="mate"
            :href="m.slug ? `/pro/${m.slug}` : undefined"
          >
            <Frame stage
              ><ProPic :slug="m.slug" :photo="m.photo" :team="team" :size="240" position="50% 0"
            /></Frame>
            <span class="rl3"
              ><RoleIcon v-if="laneOf(m.role)" :lane="laneOf(m.role)!" :size="13" />{{
                roleLabel(m.role)
              }}<template v-if="m.country"
                >, <Flag :code="m.country" :size="16" />{{ countryName(m.country) }}</template
              ></span
            >
            <span class="nm4">{{ m.name }}</span>
            <span class="rk5"
              ><RankEmblem v-if="m.best" :tier="m.best.tier" :size="16" />{{
                m.best
                  ? `${rankWords(m.best.tier, m.best.division)}, ${n(m.best.lp)} LP`
                  : 'Unranked'
              }}</span
            >
          </component>
        </div>
        <EmptyState
          v-else
          icon="users"
          title="No current roster"
          line="The team has no player listed now."
        />
      </section>

      <section class="sec side2" style="padding-top: 32px">
        <div class="stk">
          <div id="games" class="card">
            <CardHead title="Games" icon="list" meta="Last two weeks and next three" />
            <div v-if="matchList(matches.results).length" class="rsrow">
              <component
                :is="opponentOf(m).slug ? Link : 'span'"
                v-for="m in matchList(matches.results).slice().reverse()"
                :key="m.id"
                :href="opponentOf(m).slug ? `/team/${opponentOf(m).slug}` : undefined"
              >
                <Logo :team="opponentOf(m).id" :size="32" />
                <span class="wl" :class="{ w: wonBy(m) }">{{ wonBy(m) ? 'W' : 'L' }}</span>
                <span class="meta">{{ opponentOf(m).code ?? opponentOf(m).name }}</span>
              </component>
            </div>
            <MatchLine v-for="m in matchesAround" :key="m.id" :match="m" league />
            <EmptyState
              v-if="!matchesAround.length"
              compact
              icon="clock"
              title="No game in the last two weeks or the next three"
            />
          </div>

          <div id="solo" class="card">
            <CardHead title="Solo queue, latest games" icon="chart" />
            <component
              :is="gamePath(g) ? Link : 'div'"
              v-for="g in games"
              :key="g.matchId + g.champion"
              class="lrow tm-sq"
              :href="gamePath(g) ?? undefined"
            >
              <span class="es-pp" style="width: 36px; height: 36px"
                ><ProPic :slug="g.pro?.slug" :photo="g.pro?.photo" :team="team" :size="36"
              /></span>
              <span class="col tm-sq-who">
                <span class="h5 ell">{{ g.pro?.name ?? '' }}</span>
                <span class="meta">{{ day(g.startMs) }}</span>
              </span>
              <Frame :src="champIcon(g.champion)" :width="32" size="xs" />
              <span class="h5 ell tm-sq-ch">{{ nameOf(g.champion) }}</span>
              <span class="wl" :class="{ w: g.win }">{{ g.win ? 'W' : 'L' }}</span>
              <span class="meta tm-sq-t">{{ clock(g.durationSec) }}</span>
              <span
                class="tm-kda"
                :aria-label="`${g.kills} kills, ${g.deaths} deaths, ${g.assists} assists`"
                ><b>{{ g.kills }}</b
                ><i>/</i><b class="d">{{ g.deaths }}</b
                ><i>/</i><b>{{ g.assists }}</b></span
              >
              <span class="meta tm-sq-cs">{{ g.cs }} CS</span>
            </component>
            <EmptyState
              v-if="!games.length"
              compact
              icon="chart"
              title="No stored solo queue game in 30 days"
            />
          </div>

          <div v-if="pools.length" class="card es-ld">
            <div v-for="p in pools" :key="p.m.slug!">
              <span class="row h4" style="gap: 8px; margin-bottom: 6px"
                ><span class="es-pp" style="width: 28px; height: 28px; border-radius: 7px"
                  ><ProPic :slug="p.m.slug" :photo="p.m.photo" :team="team" :size="28" /></span
                >{{ p.m.name }}</span
              >
              <div
                v-for="c in p.list"
                :key="c.champion"
                class="row"
                style="gap: 9px; padding: 5px 0"
              >
                <Frame :src="champIcon(c.champion)" :width="28" size="xs" />
                <span class="h5 ell">{{ nameOf(c.champion) }}</span>
                <span class="meta" style="margin-left: auto; white-space: nowrap"
                  >{{ c.games }} games, {{ Math.round((c.wins / c.games) * 100) }}%</span
                >
              </div>
            </div>
          </div>

          <div v-if="former.length" id="history" class="card">
            <CardHead title="Former players" icon="trophy" />
            <div class="alum">
              <Link v-for="f in former" :key="f.m.slug!" :href="`/pro/${f.m.slug}`">
                <Frame stage
                  ><ProPic :slug="f.m.slug" :photo="f.m.photo" :team="f.m.now" :size="144"
                /></Frame>
                <span class="h5">{{ f.m.name }}</span>
                <span class="meta">{{ f.years }}</span>
              </Link>
            </div>
          </div>
        </div>

        <div class="stk">
          <div v-if="staff.length" class="card">
            <CardHead title="Staff" icon="users" />
            <div v-for="m in staff" :key="m.name" class="lrow" style="min-height: 50px">
              <span class="es-pp" style="width: 34px; height: 34px"
                ><ProPic :slug="m.slug" :photo="m.photo" :team="team" :size="34"
              /></span>
              <span class="col grow">
                <span class="h5">{{ m.name }}</span>
                <span class="meta"
                  >{{ m.role ? m.role.charAt(0) + m.role.slice(1).toLowerCase() : 'Staff'
                  }}<template v-if="m.country"
                    >, <Flag :code="m.country" :size="16" /> {{ countryName(m.country) }}</template
                  ></span
                >
              </span>
              <span v-if="m.joinedAt" class="meta">since {{ year(m.joinedAt) }}</span>
            </div>
          </div>
          <div v-if="leagueTeams.length" class="card">
            <CardHead title="Starters, average LP" icon="chart" :meta="team.league?.code" />
            <Link
              v-for="(t, i) in leagueTeams"
              :key="t.id"
              class="lrow"
              :href="`/team/${t.slug}`"
              :style="
                t.id === team.id
                  ? 'min-height: 42px; background: rgb(var(--v-rgb) / .08)'
                  : 'min-height: 42px'
              "
            >
              <span class="rk">{{ i + 1 }}</span>
              <Logo
                :team="t.id"
                :size="24"
                style="width: 22px; height: 22px; object-fit: contain"
              />
              <span class="h5 grow">{{ t.name }}</span>
              <span class="fg-xs num">{{ t.lp === null ? '–' : lpText(t.lp) }}</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  </SiteLayout>
</template>

<style scoped>
/* The header's figures: the figure and its unit on one line, in the figure's colour, then what
   it means below it. */
.tm-f {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.tm-f1 {
  display: flex;
  align-items: baseline;
  gap: 8px;
  white-space: nowrap;
}
.tm-f1 .fg-l {
  white-space: nowrap;
}
.tm-u {
  font-size: 15px;
  font-weight: 600;
}
.tm-f1 :deep(.lp-rule) {
  align-self: center;
  margin-left: -2px;
}
.tm-f2 {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.35;
  color: var(--t1);
}
.tm-f3 {
  margin-top: -2px;
  font-size: 13px;
  font-weight: 500;
  color: var(--t3);
}

/* A solo queue game: one grid for every row, the KDA always on one line. */
.vb .lrow.tm-sq {
  display: grid;
  grid-template-columns: 36px minmax(0, 120px) 32px minmax(0, 110px) 24px 44px minmax(0, 1fr) 64px;
  gap: 14px;
  min-height: 58px;
}
.tm-sq-t,
.tm-sq-cs {
  white-space: nowrap;
}
.tm-sq-cs {
  text-align: right;
}
.tm-kda {
  display: inline-flex;
  flex-flow: row nowrap;
  align-items: baseline;
  gap: 3px;
  font-size: 14.5px;
  font-weight: 700;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.tm-kda b {
  font-weight: 700;
  color: var(--t1);
}
.tm-kda b.d {
  color: var(--loss);
}
.tm-kda i {
  font-style: normal;
  font-weight: 600;
  color: var(--t4);
}
@media (max-width: 767px) {
  .vb .lrow.tm-sq {
    grid-template-columns: 36px minmax(0, 1fr) 28px 24px 76px;
    gap: 10px;
    padding: 8px 16px;
  }
  .tm-kda {
    justify-self: end;
  }
  .tm-sq-ch,
  .tm-sq-t,
  .tm-sq-cs {
    display: none;
  }
}
</style>
