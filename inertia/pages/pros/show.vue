<script setup lang="ts">
import { computed, ref } from 'vue'
import { Head, Link, usePage } from '@inertiajs/vue3'
import { ArrowRight, ExternalLink } from 'lucide-vue-next'
import { ChampIcon, RoleIcon } from '@invadelol/ui'
import AppHeader from '../../components/AppHeader.vue'
import SiteFooter from '../../components/SiteFooter.vue'
import Logo from '../../components/champions/Logo.vue'
import ProPhoto from '../../components/champions/ProPhoto.vue'
import GameImg from '../../components/champions/GameImg.vue'
import ShareButton from '../../components/champions/ShareButton.vue'
import { championName as loadedName, regionLabel } from '../../lib/assets.js'
import { championSlug, type ProGame, type ProTag } from '../../lib/champions.js'
import {
  countryName,
  pct,
  proRole,
  rankText,
  thousands,
  tierColor,
  tierName,
} from '../../lib/board.js'
import { proPage } from '../../lib/pro_pages.js'
import { matchOrNull, type ProMatch } from '../../lib/pro_matches.js'
import MatchCard from '../../components/pros/MatchCard.vue'
import ProGameList, { type ProGameMatch } from '../../components/pros/ProGameList.vue'
import ProFace from '../../components/pros/ProFace.vue'
import FormStrip from '../../components/ui/FormStrip.vue'
import WinLoss from '../../components/ui/WinLoss.vue'
import '../../css/champions.css'
import '../../css/rd-players.css'

interface LeagueRef {
  slug: string
  code: string
  name: string
}
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
interface Build {
  champion: number
  games: number
  wins: number
  kda: number
  boots: number | null
  core: number[]
  coreGames: number
  keystone: number | null
  secondaryStyle: number | null
  spells: [number, number] | null
  max: string[]
  form: boolean[]
}
type Game = ProGame & {
  opponentName?: string
  opponentPro?: ProTag | null
  pros?: { pro: ProTag; champion: number; ally: boolean }[]
}

/** `/pro/:slug`: a professional player, their accounts, teams, recent games and builds. */
const props = defineProps<{
  pro: ProTag & {
    socials: Record<string, string>
    league: LeagueRef | null
    accounts: Account[]
    teams: {
      team: NonNullable<ProTag['team']>
      league: LeagueRef | null
      title: string
      role: string | null
      current: boolean
      joinedAt: string | null
      leftAt: string | null
    }[]
    games: Game[]
    record: { games: number; wins: number; kills: number; deaths: number; assists: number }
    champions: { champion: number; games: number; wins: number; kda: number }[]
    builds: Build[]
    /** Real name, nationality (ISO-2) and birthday (`yyyy-mm-dd`), when known. */
    about?: {
      firstName: string | null
      lastName: string | null
      nationality: string | null
      birthday: string | null
    } | null
  }
  /** Their team's next match and last result. */
  matches?: { next: ProMatch | null; last: ProMatch | null }
  /** Its recent games as stored matches, opened like a profile's. */
  games?: ProGameMatch[]
  now?: number
  names?: Record<number, [string, string]>
  /** Their current team's roster and staff, with each player's most played champions. */
  roster?: {
    team: {
      id: string
      slug: string
      name: string
      shortName: string | null
      league: LeagueRef | null
      lp: number | null
      place: number | null
    }
    members: {
      name: string
      slug: string | null
      photo?: string
      role: string | null
      title: string
      country: string | null
      joinedAt: string | null
      best: { tier: string; division: number | null; lp: number | null } | null
    }[]
    pools: Record<string, number[]>
  } | null
  /** Their place on the pro ladder. */
  ladder?: { place: number; total: number } | null
}>()

const page = usePage()
const player = computed(() => proPage(props.pro))
const championName = (id: number) => props.names?.[id]?.[0] ?? loadedName(id)
const canonical = computed(
  () => (page.props.social as { canonical?: string } | undefined)?.canonical ?? ''
)
const title = computed(
  () => (page.props.social as { title?: string } | undefined)?.title ?? player.value.name
)
const now = computed(() => props.now ?? Date.now())
const about = computed(() => player.value.about ?? null)
const realName = computed(() =>
  [about.value?.firstName, about.value?.lastName].filter(Boolean).join(' ')
)
const nationality = computed(() => about.value?.nationality ?? player.value.country)
/** Their age on the page's date (the server's, so both renders agree). */
const age = computed(() => {
  const b = about.value?.birthday
  const m = b ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(b) : null
  if (!m) return null
  const d = new Date(now.value)
  const [y, mo, da] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const years =
    d.getUTCFullYear() -
    y -
    (d.getUTCMonth() + 1 < mo || (d.getUTCMonth() + 1 === mo && d.getUTCDate() < da) ? 1 : 0)
  return years > 10 && years < 80 ? years : null
})
const nextMatch = computed(() => matchOrNull(props.matches?.next))
const lastMatch = computed(() => matchOrNull(props.matches?.last))
const lane = computed(() => proRole(player.value.role))
const best = computed(() => player.value.accounts.find((a) => a.tier) ?? null)
const record = computed(() => player.value.record)
const kda = computed(() =>
  record.value.games
    ? ((record.value.kills + record.value.assists) / Math.max(1, record.value.deaths)).toFixed(1)
    : '-'
)
const SOCIAL: Record<string, [string, (v: string) => string]> = {
  twitch: ['Twitch', (v) => `https://twitch.tv/${v}`],
  twitter: ['X', (v) => `https://x.com/${v}`],
  instagram: ['Instagram', (v) => `https://instagram.com/${v}`],
  leaguepedia: [
    'Leaguepedia',
    (v) => (v.startsWith('http') ? v : `https://lol.fandom.com/wiki/${encodeURIComponent(v)}`),
  ],
}
const socials = computed(() =>
  Object.entries(player.value.socials ?? {})
    .filter(([k, v]) => SOCIAL[k] && v)
    .map(([k, v]) => ({ k, label: SOCIAL[k][0], href: SOCIAL[k][1](v) }))
)
const profile = (a: { gameName: string; tagLine: string }) =>
  `/${encodeURIComponent(`${a.gameName}-${a.tagLine}`)}`
const year = (d: string | null) => (d ? new Date(d).getUTCFullYear() : '')
const years = (t: { joinedAt: string | null; leftAt: string | null; current: boolean }) => {
  const from = year(t.joinedAt)
  const to = t.current ? 'now' : year(t.leftAt)
  return from && to && String(from) !== String(to) ? `${from} to ${to}` : String(from || to || '')
}

/* ── Games ───────────────────────────────────────────────────── */
const filter = ref<'all' | 'wins' | 'losses'>('all')
/** The other pros of each game, by match id, for the opened game's line. */
const prosByMatch = computed(() =>
  Object.fromEntries(player.value.games.map((g) => [g.matchId, g.pros ?? []]))
)

/* ── Credits ─────────────────────────────────────────────────── */
/** Servers our own pro data does not cover: their accounts come from Leaguepedia. */
const OWN_SERVERS = new Set(['EUW1', 'NA1', 'BR1'])
const credited = computed(() =>
  player.value.accounts.filter((a) => !OWN_SERVERS.has(a.platform.toUpperCase()))
)
/** "KR account", "KR, LAS accounts". */
const creditedLabel = computed(() => {
  const servers = [...new Set(credited.value.map((a) => regionLabel(a.platform)))]
  return `${servers.join(', ')} ${credited.value.length === 1 ? 'account' : 'accounts'}`
})
/** The pro's own Leaguepedia page when we know it, else the wiki. */
const leaguepedia = computed(
  () => socials.value.find((x) => x.k === 'leaguepedia')?.href ?? 'https://lol.fandom.com/'
)

/* ── Builds ──────────────────────────────────────────────────── */
const picked = ref<number | null>(player.value.builds[0]?.champion ?? null)
const build = computed(() => player.value.builds.find((b) => b.champion === picked.value) ?? null)
const champHref = (id: number) =>
  `/champions/${props.names?.[id]?.[1] ?? championSlug(championName(id))}`
const crumbs = computed(() => [
  { label: 'Pros', href: '/pros' },
  ...(player.value.league
    ? [{ label: player.value.league.code, href: `/pros?league=${player.value.league.slug}` }]
    : []),
  ...(player.value.team
    ? [{ label: player.value.team.name, href: `/team/${player.value.team.slug}` }]
    : []),
  { label: player.value.name },
])

/* ── Roster, people met, champions ───────────────────────────── */
const ORDER = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT']
const rosterPlayers = computed(() =>
  (props.roster?.members ?? [])
    .filter((m) => m.title !== 'staff')
    .sort(
      (a, b) =>
        (a.title === 'sub' ? 1 : 0) - (b.title === 'sub' ? 1 : 0) ||
        ORDER.indexOf(a.role ?? '') - ORDER.indexOf(b.role ?? '')
    )
    .slice(0, 6)
)
const staff = computed(() => (props.roster?.members ?? []).filter((m) => m.title === 'staff'))
const staffRole = (r: string | null) => (r ? r.charAt(0) + r.slice(1).toLowerCase() : 'Staff')

/** Other pros met in their games: how often with them and against them. */
const met = computed(() => {
  const by = new Map<string, { pro: ProTag; with: number; against: number }>()
  for (const g of player.value.games)
    for (const x of g.pros ?? []) {
      const e = by.get(x.pro.slug) ?? { pro: x.pro, with: 0, against: 0 }
      if (x.ally) e.with++
      else e.against++
      by.set(x.pro.slug, e)
    }
  return [...by.values()].sort((a, b) => b.with + b.against - (a.with + a.against)).slice(0, 8)
})

const mostPlayed = computed(() => player.value.builds[0] ?? null)
const bestServer = computed(() => (best.value ? regionLabel(best.value.platform) : ''))
</script>

<template>
  <Head :title="title" />
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <main class="page pp flex-1">
      <div class="crumbs">
        <nav aria-label="Breadcrumb">
          <template v-for="(c, i) in crumbs" :key="i">
            <Link v-if="c.href" :href="c.href">{{ c.label }}</Link>
            <b v-else>{{ c.label }}</b>
            <span v-if="i < crumbs.length - 1" aria-hidden="true">/</span>
          </template>
        </nav>
        <ShareButton :title="player.name" :url="canonical" />
      </div>

      <!-- Who: photo, name, the facts as tags, and the key figures -->
      <section class="pb" :aria-label="player.name">
        <img
          v-if="player.team"
          class="wm"
          :src="`/cdn/team/${player.team.id}?s=96`"
          alt=""
          aria-hidden="true"
        />
        <ProPhoto
          v-if="player.photo"
          class="pb-ph"
          :slug="player.slug"
          :photo="player.photo"
          :width="200"
          :height="220"
          eager
          fluid
        />
        <span v-else class="pb-ph e" aria-hidden="true"
          ><RoleIcon v-if="lane" :lane="lane.lane" :size="72"
        /></span>
        <div class="pb-m">
          <h1>{{ player.name }}</h1>
          <p v-if="realName || age" class="pb-rn">
            {{ realName }}<template v-if="realName && age">, </template
            ><template v-if="age">{{ age }} years old</template>
          </p>
          <div class="tags">
            <Link v-if="player.team" :href="`/team/${player.team.slug}`" class="rd-tag"
              ><Logo :team="player.team" :size="16" eager />{{ player.team.name }}</Link
            >
            <span v-else class="rd-tag">No team now</span>
            <Link
              v-if="player.league"
              :href="`/pros?league=${player.league.slug}`"
              class="rd-tag"
              >{{ player.league.code }}</Link
            >
            <span v-if="lane" class="rd-tag"
              ><RoleIcon :lane="lane.lane" :size="14" />{{ lane.label }}</span
            >
            <span v-else-if="player.staff" class="rd-tag">{{ staffRole(player.role) }}</span>
            <span v-if="nationality" class="rd-tag">{{ countryName(nationality) }}</span>
            <span v-if="best" class="rd-tag g">{{ tierName(best.tier) }}</span>
            <span v-if="mostPlayed" class="rd-tag v"
              >Most played: {{ championName(mostPlayed.champion) }}</span
            >
          </div>
          <div v-if="socials.length" class="links">
            <a
              v-for="x in socials"
              :key="x.k"
              :href="x.href"
              target="_blank"
              rel="noreferrer"
              class="iv-btn ghost sm"
              >{{ x.label }}<ExternalLink :size="12" aria-hidden="true" /><span class="nb-sr">
                (opens a new tab)</span
              ></a
            >
          </div>
        </div>
        <div class="pb-k">
          <div v-if="ladder">
            <label>Pro ladder</label>
            <div class="rd-fig num">#{{ thousands(ladder.place) }}</div>
            <small class="num">of {{ thousands(ladder.total) }} pros</small>
          </div>
          <div>
            <label>{{ best ? `${tierName(best.tier)}, ${bestServer}` : 'Best account' }}</label>
            <div class="rd-fig num" :class="{ 'rd-gold': best }">
              {{ best && best.lp !== null ? thousands(best.lp) : '-' }}
            </div>
            <small class="num"
              >LP<template v-if="best?.peakTier"
                >, peak {{ rankText(best.peakTier, best.peakDivision, best.peakLp) }}</template
              ></small
            >
          </div>
          <div>
            <label>Last 30 days</label>
            <div class="rd-fig num">{{ record.games ? pct(record.wins / record.games) : '-' }}</div>
            <small class="num">{{ record.wins }}W {{ record.games - record.wins }}L</small>
          </div>
          <div>
            <label>KDA</label>
            <div class="rd-fig num">{{ kda }}</div>
            <small v-if="record.games" class="num"
              >{{ (record.kills / record.games).toFixed(1) }} /
              {{ (record.deaths / record.games).toFixed(1) }} /
              {{ (record.assists / record.games).toFixed(1) }}</small
            >
          </div>
        </div>
      </section>

      <!-- Their team now -->
      <section v-if="roster && rosterPlayers.length" class="rd-card team">
        <div class="rd-head">
          <h3>
            {{ roster.team.name
            }}<span class="rd-meta num"
              ><template v-if="roster.team.league">{{ roster.team.league.code }}</template
              ><template v-if="roster.team.place"
                >, #{{ roster.team.place }} on the team ladder</template
              ><template v-if="roster.team.lp">, {{ thousands(roster.team.lp) }} LP</template></span
            >
          </h3>
          <Link :href="`/team/${roster.team.slug}`" class="rd-more"
            >Team page<ArrowRight :size="14" aria-hidden="true"
          /></Link>
        </div>
        <div class="ros" :class="{ nostaff: !staff.length }">
          <component
            :is="m.slug ? Link : 'div'"
            v-for="m in rosterPlayers"
            :key="m.slug ?? m.name"
            :href="m.slug ? `/pro/${m.slug}` : undefined"
            class="rp"
            :class="{ me: m.slug === player.slug }"
          >
            <ProPhoto
              v-if="m.photo && m.slug"
              class="ph2"
              :slug="m.slug"
              :photo="m.photo"
              :width="132"
              :height="132"
              fluid
            />
            <span class="ro"
              ><RoleIcon v-if="proRole(m.role)" :lane="proRole(m.role)!.lane" :size="14" />{{
                proRole(m.role)?.label ?? ''
              }}<template v-if="m.title === 'sub'">, sub</template></span
            >
            <b>{{ m.name }}</b>
            <small class="num">{{
              m.best
                ? rankText(m.best.tier, m.best.division, m.best.lp).replace(
                    / (\d[\d,]*)$/,
                    ', $1 LP'
                  )
                : m.joinedAt
                  ? `Since ${new Date(m.joinedAt).getUTCFullYear()}`
                  : ''
            }}</small>
            <span class="cps"
              ><ChampIcon
                v-for="c in (m.slug && roster.pools[m.slug]) || []"
                :key="c"
                :id="c"
                :size="24"
            /></span>
          </component>
          <div v-if="staff.length" class="staff">
            <h4>Staff</h4>
            <component
              :is="m.slug ? Link : 'div'"
              v-for="m in staff"
              :key="m.slug ?? m.name"
              :href="m.slug ? `/pro/${m.slug}` : undefined"
              class="sf"
            >
              <ProFace :slug="m.slug ?? ''" :photo="m.slug ? m.photo : null" :size="32" />
              <span
                >{{ m.name
                }}<small
                  >{{ staffRole(m.role)
                  }}<template v-if="m.joinedAt"
                    >, since {{ new Date(m.joinedAt).getUTCFullYear() }}</template
                  ></small
                ></span
              >
            </component>
          </div>
        </div>
      </section>

      <div class="pp-main">
        <div class="min-w-0">
          <section class="games" aria-labelledby="h-games">
            <div class="fil">
              <h2 id="h-games">Recent games<span>Solo queue, every account</span></h2>
              <div class="fil-r">
                <span class="lgd"
                  >Pros in the game<span class="rd-tag b">With</span
                  ><span class="rd-tag r">Against</span></span
                >
                <span class="rd-seg" role="group" aria-label="Show">
                  <button
                    v-for="f in ['all', 'wins', 'losses'] as const"
                    :key="f"
                    type="button"
                    :class="{ on: filter === f }"
                    :aria-pressed="filter === f"
                    @click="filter = f"
                  >
                    {{ f.charAt(0).toUpperCase() + f.slice(1) }}
                  </button>
                </span>
              </div>
            </div>
            <p v-if="!player.games.length" class="rd-card nb-empty">
              No ranked game of {{ player.name }} is stored for the last 30 days.
            </p>
            <ProGameList
              v-if="player.games.length"
              :items="props.games ?? []"
              :filter="filter"
              :pros="prosByMatch"
              :champion-name="championName"
            />
          </section>

          <template v-if="player.builds.length">
            <div class="fil mt">
              <h2>Champions<span>Last 30 days</span></h2>
            </div>
            <section class="rd-card">
              <ul class="rd-plist">
                <li v-for="c in player.builds" :key="c.champion">
                  <button
                    type="button"
                    class="prow ch"
                    :class="{ on: picked === c.champion }"
                    :aria-pressed="picked === c.champion"
                    @click="picked = c.champion"
                  >
                    <ChampIcon :id="c.champion" :size="36" />
                    <span class="min-w-0"
                      ><b class="truncate">{{ championName(c.champion) }}</b
                      ><small class="num"
                        >{{ c.games }} {{ c.games === 1 ? 'game' : 'games' }},
                        {{ c.kda }} KDA</small
                      ></span
                    >
                    <FormStrip :results="[...c.form].reverse()" />
                    <WinLoss :wins="c.wins" :losses="c.games - c.wins" />
                  </button>
                </li>
              </ul>
            </section>
          </template>
        </div>

        <div class="rd-col">
          <section v-if="met.length" class="rd-card">
            <div class="rd-head">
              <h3>Meets in solo queue</h3>
              <span class="rd-hm num">Last {{ player.games.length }} games</span>
            </div>
            <Link v-for="m in met" :key="m.pro.slug" :href="`/pro/${m.pro.slug}`" class="met">
              <ProFace :slug="m.pro.slug" :photo="m.pro.photo" :role="m.pro.role" />
              <span class="min-w-0"
                ><b class="truncate">{{ m.pro.name }}</b
                ><small
                  ><RoleIcon
                    v-if="proRole(m.pro.role)"
                    :lane="proRole(m.pro.role)!.lane"
                    :size="13"
                  />{{ m.pro.team?.name ?? 'Free agent' }}</small
                ></span
              >
              <span class="tg"
                ><span v-if="m.with" class="rd-tag b">With {{ m.with }}</span
                ><span v-if="m.against" class="rd-tag r">Against {{ m.against }}</span></span
              >
            </Link>
          </section>

          <section
            v-if="build"
            class="rd-card"
            :aria-label="`${player.name} on ${championName(build.champion)}`"
            aria-live="polite"
          >
            <div class="rd-head">
              <h3>{{ player.name }} on {{ championName(build.champion) }}</h3>
              <span class="rd-hm num">{{ build.wins }}W {{ build.games - build.wins }}L</span>
            </div>
            <div class="bld">
              <div v-if="build.core.length || build.boots" class="bl">
                <span class="l">Core</span>
                <GameImg v-for="id in build.core" :key="id" kind="item" :id="id" :size="32" />
                <GameImg v-if="build.boots" kind="item" :id="build.boots" :size="32" />
                <span class="x num">{{ build.coreGames }} of {{ build.games }}</span>
              </div>
              <div v-if="build.keystone || build.spells" class="bl">
                <span class="l">Runes</span>
                <template v-if="build.keystone"
                  ><GameImg kind="rune" :id="build.keystone" :size="32" round /><GameImg
                    v-if="build.secondaryStyle"
                    kind="runeStyle"
                    :id="build.secondaryStyle"
                    :size="22"
                /></template>
                <span class="w-1" />
                <template v-if="build.spells"
                  ><GameImg v-for="sp in build.spells" :key="sp" kind="spell" :id="sp" :size="32"
                /></template>
              </div>
              <div v-if="build.max.length" class="bl">
                <span class="l">Skills</span>
                <template v-for="(k, i) in build.max" :key="k">
                  <ArrowRight v-if="i" :size="13" aria-hidden="true" /><span class="key">{{
                    k
                  }}</span>
                </template>
              </div>
              <Link :href="champHref(build.champion)" class="iv-btn sm w-full justify-center"
                >Open the {{ championName(build.champion) }} page</Link
              >
            </div>
          </section>

          <section v-if="player.team && (nextMatch || lastMatch)" class="rd-card">
            <div class="rd-head">
              <h3>Matches</h3>
              <span class="rd-hm">{{ player.team.name }}</span>
            </div>
            <div class="pp-matches">
              <MatchCard v-if="nextMatch" :match="nextMatch" show-league :team="player.team?.id" />
              <MatchCard v-if="lastMatch" :match="lastMatch" show-league :team="player.team?.id" />
            </div>
          </section>

          <section class="rd-card">
            <div class="rd-head">
              <h3>Accounts</h3>
              <span class="rd-hm num">{{ player.accounts.length }}</span>
            </div>
            <p v-if="!player.accounts.length" class="nb-empty">No ranked account known.</p>
            <Link v-for="a in player.accounts" :key="a.id" :href="profile(a)" class="acc">
              <span class="min-w-0"
                ><b class="truncate"
                  >{{ a.gameName }} <span>#{{ a.tagLine }}</span></b
                ><small class="num"
                  >{{ regionLabel(a.platform)
                  }}<template v-if="a.wins !== null && (a.wins || a.losses)"
                    >, {{ a.wins }}W {{ a.losses }}L</template
                  ></small
                ></span
              >
              <span class="rkx num" :style="tierColor(a.tier)">{{
                rankText(a.tier, a.division, a.lp)
              }}</span>
            </Link>
            <p v-if="credited.length" class="pp-credit">
              {{ creditedLabel }} from
              <a :href="leaguepedia" rel="noopener" target="_blank">Leaguepedia</a>,
              <a
                href="https://creativecommons.org/licenses/by-sa/3.0/"
                rel="license noopener"
                target="_blank"
                >CC BY-SA 3.0</a
              >
            </p>
          </section>

          <section v-if="player.teams.length" class="rd-card">
            <div class="rd-head"><h3>Career</h3></div>
            <div class="tl">
              <Link
                v-for="t in player.teams"
                :key="`${t.team.id}-${t.joinedAt}`"
                :href="`/team/${t.team.slug}`"
                class="tli"
                :class="{ now: t.current }"
              >
                <Logo :team="t.team" :size="32" />
                <span class="min-w-0"
                  ><b class="truncate">{{ t.team.name }}</b
                  ><small v-if="t.title === 'sub' || t.title === 'staff'">{{
                    t.title === 'sub' ? 'Sub' : staffRole(t.role)
                  }}</small></span
                >
                <span class="yr"
                  ><span v-if="t.league" class="rd-tag">{{ t.league.code }}</span>
                  <small class="num">{{ years(t) }}</small></span
                >
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
    <SiteFooter />
  </div>
</template>

<style scoped>
.crumbs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 48px;
  margin-top: 8px;
}
.crumbs nav {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
  color: var(--text-4);
}
.crumbs nav a {
  color: var(--text-2);
  text-decoration: none;
}
.crumbs nav a:hover {
  color: var(--text-1);
}
.crumbs nav b {
  font-weight: 500;
  color: var(--text-1);
}
.pb {
  position: relative;
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr) auto;
  gap: 28px;
  align-items: end;
  min-height: 240px;
  margin-top: 8px;
  padding: 0 28px 0 12px;
  overflow: hidden;
  border-radius: 12px;
  background: linear-gradient(
    110deg,
    rgb(var(--gold-rgb) / 0.1) 0%,
    var(--rd-card) 42%,
    var(--rd-card) 100%
  );
  box-shadow: inset 0 0 0 1px var(--rd-line);
}
.pb .wm {
  position: absolute;
  right: -30px;
  top: -40px;
  width: 320px;
  height: 320px;
  object-fit: contain;
  opacity: 0.06;
  pointer-events: none;
}
.pb > *:not(.wm) {
  position: relative;
  z-index: 1;
}
.pb-ph {
  align-self: end;
  width: 200px !important;
  height: 220px !important;
  background: none !important;
  box-shadow: none !important;
}
.pb-ph :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 0;
}
.pb-ph.e {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-4);
}
.pb-m {
  align-self: center;
  min-width: 0;
  padding: 20px 0;
}
.pb h1 {
  margin: 0;
  font-size: 44px;
  font-weight: 650;
  letter-spacing: -0.025em;
  line-height: 1;
  color: var(--text-1);
}
.pb-rn {
  margin: 8px 0 0;
  font-size: 14px;
  color: var(--text-2);
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 14px;
}
.tags .rd-tag {
  height: 26px;
  padding: 0 9px;
  border-radius: 6px;
  font-size: 12px;
  text-decoration: none;
}
.links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 10px;
}
.pb-k {
  align-self: center;
  display: grid;
  grid-auto-flow: column;
}
.pb-k > div {
  padding: 0 22px;
}
.pb-k > div + div {
  box-shadow: inset 1px 0 0 var(--rd-line);
}
.pb-k label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  color: var(--text-3);
}
.pb-k .rd-fig {
  font-size: 28px;
  line-height: 1.2;
}
.pb-k small {
  font-size: 12px;
  white-space: nowrap;
  color: var(--text-3);
}
.team {
  margin-top: 16px;
}
.ros {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr)) 220px;
}
.ros.nostaff {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}
.rp {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 212px;
  padding: 14px 14px 12px;
  overflow: hidden;
  color: inherit;
  text-decoration: none;
}
.rp + .rp,
.staff {
  box-shadow: inset 1px 0 0 var(--rd-line);
}
a.rp:hover {
  background: var(--surface-1);
}
.rp :deep(.ph2) {
  position: absolute;
  right: -22px;
  top: 6px;
  width: 132px;
  height: 132px;
  background: none;
  box-shadow: none;
  -webkit-mask-image: linear-gradient(180deg, #000 70%, transparent);
  mask-image: linear-gradient(180deg, #000 70%, transparent);
}
.rp :deep(.ph2 img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 0;
}
.rp > *:not(.ph2) {
  position: relative;
  z-index: 1;
}
.rp .ro {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}
.rp b {
  display: block;
  margin-top: auto;
  overflow: hidden;
  font-size: 16px;
  font-weight: 650;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text-1);
}
.rp small {
  font-size: 12px;
  color: var(--text-3);
}
.rp .cps {
  display: flex;
  gap: 4px;
  min-height: 24px;
  margin-top: 8px;
}
.rp.me {
  background: linear-gradient(180deg, var(--rd-violet-a), transparent);
}
.rp.me::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 2px;
  background: var(--rd-violet);
}
.staff {
  display: grid;
  align-content: start;
  gap: 10px;
  padding: 14px 16px;
}
.staff h4 {
  margin: 0 0 2px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}
.sf {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  text-decoration: none;
}
.sf small {
  display: block;
  font-size: 11px;
  font-weight: 400;
  color: var(--text-3);
}
.pp-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 16px;
  align-items: start;
  margin-top: 24px;
}
.fil {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin: 0 0 12px;
}
.fil.mt {
  margin-top: 32px;
}
.fil h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  color: var(--text-1);
}
.fil h2 span {
  margin-left: 8px;
  font-size: 13px;
  font-weight: 400;
  color: var(--text-3);
}
.fil-r {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
}
.lgd {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-3);
}
.prow.ch {
  grid-template-columns: 36px minmax(0, 1fr) auto 120px;
}
.met {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  min-height: 58px;
  padding: 8px 16px;
  color: inherit;
  text-decoration: none;
}
.met + .met {
  box-shadow: inset 0 1px 0 var(--rd-line);
}
.met:hover,
.acc:hover,
.tli:hover {
  background: var(--surface-1);
}
.met b {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}
.met small {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-3);
}
.met .tg {
  display: flex;
  gap: 4px;
}
.bld {
  display: grid;
  gap: 12px;
  padding: 16px;
}
.bl {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-3);
}
.bl .l {
  width: 48px;
}
.bl .x {
  margin-left: auto;
}
.key {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  background: var(--rd-violet);
}
.pp-matches {
  display: grid;
  gap: 8px;
  padding: 12px;
}
.acc {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 54px;
  padding: 8px 16px;
  color: inherit;
  text-decoration: none;
}
.acc + .acc {
  box-shadow: inset 0 1px 0 var(--rd-line);
}
.acc b {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}
.acc b span {
  font-weight: 400;
  color: var(--text-3);
}
.acc small {
  display: block;
  font-size: 12px;
  color: var(--text-3);
}
.acc .rkx {
  font-size: 13px;
  font-weight: 600;
  text-align: right;
}
.pp-credit {
  margin: 0;
  padding: 10px 16px 14px;
  font-size: 11px;
  color: var(--text-4);
  box-shadow: inset 0 1px 0 var(--rd-line);
}
.pp-credit a {
  color: var(--text-3);
}
.tl {
  padding: 14px 16px 16px;
}
.tli {
  position: relative;
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  min-height: 50px;
  color: inherit;
  text-decoration: none;
}
.tli::before {
  content: '';
  position: absolute;
  left: 15px;
  top: -10px;
  bottom: -10px;
  width: 1px;
  background: var(--rd-line);
}
.tli:first-child::before {
  top: 25px;
}
.tli:last-child::before {
  bottom: 25px;
}
.tli:only-child::before {
  display: none;
}
.tli > :first-child {
  position: relative;
  z-index: 1;
  background: var(--rd-card);
}
.tli b {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-2);
}
.tli.now b {
  color: var(--text-1);
}
.tli small {
  font-size: 12px;
  color: var(--text-3);
}
.tli .yr {
  display: flex;
  align-items: center;
  gap: 6px;
}
@media (max-width: 1100px) {
  .pp-main {
    grid-template-columns: minmax(0, 1fr);
  }
  .ros,
  .ros.nostaff {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .ros .staff {
    grid-column: 1 / -1;
    box-shadow: inset 0 1px 0 var(--rd-line);
  }
  .rp:nth-child(4) {
    box-shadow: inset 0 1px 0 var(--rd-line);
  }
  .rp:nth-child(n + 4) {
    border-top: 1px solid var(--rd-line);
  }
  .pb {
    grid-template-columns: 140px minmax(0, 1fr);
    gap: 16px;
    padding: 16px 16px 0 0;
  }
  .pb-ph {
    width: 140px !important;
    height: 150px !important;
  }
  .pb-k {
    grid-column: 1 / -1;
    grid-auto-flow: row;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 14px;
    padding: 0 0 16px 16px;
  }
  .pb-k > div {
    padding: 0 12px 0 0;
  }
  .pb-k > div + div {
    box-shadow: none;
  }
}
@media (max-width: 560px) {
  .pb h1 {
    font-size: 30px;
  }
  .pb {
    grid-template-columns: 96px minmax(0, 1fr);
  }
  .pb-ph {
    width: 96px !important;
    height: 110px !important;
  }
  .ros,
  .ros.nostaff {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .rp {
    height: 180px;
  }
  .prow.ch {
    grid-template-columns: 36px minmax(0, 1fr) 96px;
  }
  .prow.ch .rd-form {
    display: none;
  }
}
</style>
