<script setup lang="ts">
import { computed, ref } from 'vue'
import { Head, Link, usePage } from '@inertiajs/vue3'
import { ExternalLink } from 'lucide-vue-next'
import { ChampIcon, RoleIcon } from '@invadelol/ui'
import AppHeader from '../../components/AppHeader.vue'
import SiteFooter from '../../components/SiteFooter.vue'
import Logo from '../../components/champions/Logo.vue'
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
import ProFace from '../../components/pros/ProFace.vue'
import WinLoss from '../../components/ui/WinLoss.vue'
import { assetUrl } from '../../lib/assets.js'
import '../../css/champions.css'
import '../../css/rd-players.css'

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
const kda = computed(() =>
  record.value.games
    ? ((record.value.kills + record.value.assists) / Math.max(1, record.value.deaths)).toFixed(2)
    : '-'
)
const SOCIAL: Record<string, string> = {
  twitter: 'X',
  instagram: 'Instagram',
  leaguepedia: 'Leaguepedia',
  twitch: 'Twitch',
  youtube: 'YouTube',
}
const socials = computed(() =>
  Object.entries(club.value.socials ?? {})
    .filter(([k, v]) => SOCIAL[k] && v && /^https?:\/\//.test(v))
    .map(([k, v]) => ({ k, label: SOCIAL[k], href: v }))
)
const items = (g: { items: number[] }) => {
  const list = g.items.slice(0, 6)
  while (list.length < 6) list.push(0)
  return list
}
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
/** The players the games can be narrowed to, by role, as named on the roster. */
const whoOptions = computed(() =>
  PRO_ROLES.map((r) => ({
    ...r,
    name: players.value.find((m) => m.role === r.role && m.title !== 'sub')?.name ?? r.label,
  })).filter((r) => club.value.games.some((g) => g.pro?.role === r.role))
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
    <main class="page tp flex-1">
      <div class="crumbs">
        <nav aria-label="Breadcrumb">
          <template v-for="(c, i) in crumbs" :key="i">
            <Link v-if="'href' in c && c.href" :href="c.href">{{ c.label }}</Link>
            <b v-else>{{ c.label }}</b>
            <span v-if="i < crumbs.length - 1" aria-hidden="true">/</span>
          </template>
        </nav>
        <ShareButton :title="club.name" :url="canonical" />
      </div>

      <section class="tb2" :aria-label="club.name">
        <img class="wm" :src="`/cdn/team/${club.id}?s=96`" alt="" aria-hidden="true" />
        <img
          class="lg"
          :src="`/cdn/team/${club.id}?s=96`"
          :alt="club.name"
          width="112"
          height="112"
        />
        <div class="min-w-0">
          <h1>{{ club.name }}</h1>
          <div class="tags">
            <Link v-if="club.league" :href="`/pros?league=${club.league.slug}`" class="rd-tag"
              ><Logo :league="club.league" :size="16" eager />{{ club.league.code }}</Link
            >
            <span v-if="club.shortName" class="rd-tag">{{ club.shortName }}</span>
            <span v-if="club.place && club.league" class="rd-tag v"
              >#{{ club.place }} on the {{ club.league.code }} team ladder</span
            >
            <span v-if="!club.active" class="rd-tag">Inactive</span>
            <a v-if="website" :href="website" target="_blank" rel="noreferrer" class="rd-tag"
              >Website<ExternalLink :size="11" aria-hidden="true" /><span class="nb-sr">
                (opens a new tab)</span
              ></a
            >
            <a
              v-for="x in socials"
              :key="x.k"
              :href="x.href"
              target="_blank"
              rel="noreferrer"
              class="rd-tag"
              >{{ x.label }}<ExternalLink :size="11" aria-hidden="true" /><span class="nb-sr">
                (opens a new tab)</span
              ></a
            >
          </div>
        </div>
        <div class="pb-k">
          <div>
            <label>Average rank</label>
            <div class="rd-fig num" :class="{ 'rd-gold': club.lp !== null }">
              {{ club.lp !== null ? thousands(club.lp) : '-' }}
            </div>
            <small>LP, starters in Master and above</small>
          </div>
          <div>
            <label>Last 30 days</label>
            <div class="rd-fig num">{{ record.games ? pct(record.wins / record.games) : '-' }}</div>
            <small class="num">{{ record.wins }}W {{ record.games - record.wins }}L</small>
          </div>
          <div>
            <label>KDA</label>
            <div class="rd-fig num">{{ kda }}</div>
            <small class="num">{{ record.games }} solo queue games</small>
          </div>
          <div v-if="pool[0]">
            <label>Most played</label>
            <div class="rd-fig name">{{ championName(pool[0].champion) }}</div>
            <small class="num">{{ pool[0].games }} games, {{ pool[0].by }}</small>
          </div>
        </div>
      </section>

      <!-- The roster -->
      <p v-if="!players.length" class="rd-card nb-empty mt-4">No current roster is known.</p>
      <div v-else class="line">
        <component
          :is="m.slug ? Link : 'div'"
          v-for="m in players"
          :key="m.name"
          :href="m.slug ? `/pro/${m.slug}` : undefined"
          class="lp"
        >
          <ProPhoto
            v-if="m.photo && m.slug"
            class="ph2"
            :slug="m.slug"
            :photo="m.photo"
            :width="230"
            :height="230"
            fluid
          />
          <span v-else-if="proRole(m.role)" class="gl"
            ><RoleIcon :lane="proRole(m.role)!.lane" :size="96"
          /></span>
          <span class="ro"
            ><RoleIcon v-if="proRole(m.role)" :lane="proRole(m.role)!.lane" :size="14" />{{
              roleLabel(m.role)
            }}<template v-if="m.title === 'sub'">, sub</template></span
          >
          <b>{{ m.name }}</b>
          <small class="num"
            ><span :style="tierColor(m.best?.tier)">{{
              m.best ? tierName(m.best.tier) : 'Unranked'
            }}</span
            ><template v-if="m.best?.lp !== null && m.best?.lp !== undefined"
              >, {{ thousands(m.best.lp) }} LP</template
            ><template v-if="countryName(m.country)"
              >, {{ countryName(m.country) }}</template
            ></small
          >
          <span class="cps"
            ><ChampIcon
              v-for="c in (m.slug ? (club.pools[m.slug] ?? []) : []).slice(0, 4)"
              :key="c.champion"
              :id="c.champion"
              :size="28"
              :title="championName(c.champion)"
          /></span>
        </component>
      </div>

      <div v-if="nextMatches.length || results.length" class="tm-matches">
        <section v-if="nextMatches.length" class="rd-card" aria-labelledby="h-next">
          <div class="rd-head">
            <h2 id="h-next">{{ nextMatches.length > 1 ? 'Next matches' : 'Next match' }}</h2>
          </div>
          <div class="pad">
            <MatchCard :match="nextMatches[0]" size="lg" show-league :team="club.id" />
            <div v-if="nextMatches.length > 1" class="rows">
              <MatchRow
                v-for="mt in nextMatches.slice(1)"
                :key="mt.id"
                :match="mt"
                :team="club.id"
              />
            </div>
          </div>
        </section>
        <section v-if="results.length" class="rd-card" aria-labelledby="h-results">
          <div class="rd-head">
            <h2 id="h-results">Results</h2>
            <span class="rd-hm">Last two weeks</span>
          </div>
          <div class="pad rows">
            <MatchRow v-for="mt in results" :key="mt.id" :match="mt" :team="club.id" />
          </div>
        </section>
      </div>

      <div class="tm-main">
        <section class="min-w-0" aria-labelledby="h-games">
          <div class="fil">
            <h2 id="h-games">Solo queue, as it happens<span>Every player, every account</span></h2>
            <span class="rd-seg" role="group" aria-label="Player">
              <button type="button" :class="{ on: !who }" :aria-pressed="!who" @click="who = null">
                Everyone
              </button>
              <button
                v-for="r in whoOptions"
                :key="r.role"
                type="button"
                :class="{ on: who === r.role }"
                :aria-pressed="who === r.role"
                @click="who = r.role"
              >
                {{ r.name }}
              </button>
            </span>
          </div>
          <p v-if="!club.games.length" class="rd-card nb-empty">
            No ranked game of this roster is stored for the last 30 days.
          </p>
          <p v-else-if="!games.length" class="rd-card nb-empty">No recent game in this role.</p>
          <ul v-else class="rd-games">
            <li v-for="g in games" :key="g.matchId">
              <div class="g2 tg" :class="g.win ? 'w' : 'l'">
                <span class="who2"
                  ><ProFace
                    v-if="g.pro"
                    :slug="g.pro.slug"
                    :photo="g.pro.photo"
                    :role="g.pro.role"
                    :size="30"
                  /><Link v-if="g.pro" :href="`/pro/${g.pro.slug}`" class="stretch">{{
                    g.pro.name
                  }}</Link></span
                >
                <span class="gc">
                  <ChampIcon :id="g.champion" :size="48" :title="championName(g.champion)" />
                  <span
                    ><img v-for="(sp, i) in g.spells" :key="i" :src="assetUrl('spell', sp)" alt=""
                  /></span>
                  <span
                    ><img
                      v-if="g.keystone"
                      class="rn"
                      :src="assetUrl('rune', g.keystone)"
                      alt="" /><img
                      v-if="g.secondaryStyle"
                      class="rn sub"
                      :src="assetUrl('runeStyle', g.secondaryStyle)"
                      alt=""
                  /></span>
                </span>
                <span class="gr"
                  ><b>{{ g.win ? 'Win' : 'Loss' }}</b
                  ><span class="num">{{ mmss(g.durationSec) }}</span
                  ><span class="num">{{ ago(g.startMs, now) }}</span></span
                >
                <span class="gk"
                  ><b class="num"
                    >{{ g.kills }}<i>/</i><em>{{ g.deaths }}</em
                    ><i>/</i>{{ g.assists }}</b
                  ><span class="num"
                    >{{ ((g.kills + g.assists) / Math.max(1, g.deaths)).toFixed(2) }} KDA</span
                  ></span
                >
                <span class="gi">
                  <template v-for="(id, i) in items(g)" :key="i">
                    <img v-if="id" :src="assetUrl('item', id)" alt="" />
                    <span v-else />
                  </template>
                </span>
                <span class="vsx"
                  ><template v-if="g.opponent"
                    >vs<ChampIcon
                      :id="g.opponent"
                      :size="28"
                      :title="(g as any).opponentPro?.name ?? championName(g.opponent)" /></template
                ></span>
              </div>
            </li>
          </ul>
        </section>

        <div class="rd-col">
          <section v-if="pool.length" class="rd-card">
            <div class="rd-head">
              <h3>Champion pools</h3>
              <span class="rd-hm">30 days</span>
            </div>
            <ul class="rd-plist">
              <li v-for="c in pool" :key="`${c.champion}-${c.by}`">
                <Link :href="champHref(c.champion)" class="prow">
                  <ChampIcon :id="c.champion" :size="36" />
                  <span class="min-w-0"
                    ><b class="truncate">{{ championName(c.champion) }}</b
                    ><small>{{ c.by }}</small></span
                  >
                  <WinLoss :wins="c.wins" :losses="c.games - c.wins" />
                </Link>
              </li>
            </ul>
          </section>
          <section v-if="staff.length" class="rd-card">
            <div class="rd-head"><h3>Staff</h3></div>
            <component
              :is="m.slug ? Link : 'div'"
              v-for="m in staff"
              :key="m.name"
              :href="m.slug ? `/pro/${m.slug}` : undefined"
              class="sf"
            >
              <ProFace :slug="m.slug ?? ''" :photo="m.slug ? m.photo : null" :size="32" />
              <span
                >{{ m.name
                }}<small
                  >{{ roleLabel(m.role) || 'Staff'
                  }}<template v-if="m.joinedAt">, since {{ year(m.joinedAt) }}</template></small
                ></span
              >
            </component>
          </section>
          <section v-if="former.length" class="rd-card">
            <div class="rd-head"><h3>Former players</h3></div>
            <component
              :is="m.slug ? Link : 'div'"
              v-for="m in former"
              :key="`${m.name}-${m.joinedAt}`"
              :href="m.slug ? `/pro/${m.slug}` : undefined"
              class="sf"
            >
              <ProFace
                :slug="m.slug ?? ''"
                :photo="m.slug ? m.photo : null"
                :role="m.role"
                :size="32"
              />
              <span class="min-w-0 flex-1"
                >{{ m.name
                }}<small>{{
                  [roleLabel(m.role), years(m)].filter(Boolean).join(', ')
                }}</small></span
              >
              <Logo v-if="m.now" :team="m.now" :size="20" />
            </component>
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
.tb2 {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 28px;
  align-items: center;
  min-height: 200px;
  margin-top: 8px;
  padding: 24px 32px;
  overflow: hidden;
  border-radius: 12px;
  background: linear-gradient(
    110deg,
    rgb(var(--gold-rgb) / 0.1) 0%,
    var(--rd-card) 46%,
    var(--rd-card) 100%
  );
  box-shadow: inset 0 0 0 1px var(--rd-line);
}
.tb2 .wm {
  position: absolute;
  right: -40px;
  top: -60px;
  width: 340px;
  height: 340px;
  object-fit: contain;
  opacity: 0.05;
  pointer-events: none;
}
.tb2 > *:not(.wm) {
  position: relative;
  z-index: 1;
}
.tb2 .lg {
  width: 112px;
  height: 112px;
  object-fit: contain;
}
.tb2 h1 {
  margin: 0;
  font-size: 44px;
  font-weight: 650;
  letter-spacing: -0.025em;
  line-height: 1;
  color: var(--text-1);
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
.pb-k {
  display: grid;
  grid-auto-flow: column;
}
.pb-k > div {
  min-width: 0;
  padding: 0 22px;
}
.pb-k > div + div {
  box-shadow: inset 1px 0 0 var(--rd-line);
}
.pb-k label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}
.pb-k .rd-fig {
  font-size: 28px;
  line-height: 1.2;
}
.pb-k .rd-fig.name {
  font-size: 22px;
  line-height: 1.5;
  white-space: nowrap;
}
.pb-k small {
  font-size: 12px;
  white-space: nowrap;
  color: var(--text-3);
}
.line {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}
.lp {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  height: 330px;
  padding: 16px;
  overflow: hidden;
  border-radius: 10px;
  color: inherit;
  text-decoration: none;
  background: linear-gradient(180deg, var(--rd-card-2), var(--rd-card));
  box-shadow: inset 0 0 0 1px var(--rd-line);
}
a.lp:hover {
  box-shadow: inset 0 0 0 1px var(--line-3, rgb(255 255 255 / 0.2));
}
a.lp:focus-visible {
  outline: 2px solid var(--rd-violet);
  outline-offset: 2px;
}
.lp :deep(.ph2) {
  position: absolute;
  left: 50%;
  top: 14px;
  width: 230px;
  height: 230px;
  transform: translateX(-50%);
  background: none;
  box-shadow: none;
  -webkit-mask-image: linear-gradient(180deg, #000 62%, transparent 96%);
  mask-image: linear-gradient(180deg, #000 62%, transparent 96%);
}
.lp :deep(.ph2 img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 0;
}
.lp .gl {
  position: absolute;
  left: 50%;
  top: 70px;
  transform: translateX(-50%);
  color: var(--text-4);
  opacity: 0.5;
}
.lp > *:not(.ph2):not(.gl) {
  position: relative;
  z-index: 1;
}
.lp > .ro:not(.ph2):not(.gl) {
  position: absolute;
  top: 14px;
  left: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}
.lp b {
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--text-1);
  text-shadow: 0 1px 8px rgb(0 0 0 / 0.8);
}
.lp small {
  font-size: 12px;
  color: var(--text-2);
}
.lp .cps {
  display: flex;
  gap: 4px;
  min-height: 28px;
  margin-top: 10px;
}
.tm-matches {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  margin-top: 16px;
  align-items: start;
}
.tm-matches .pad {
  padding: 12px;
}
.tm-matches .rows {
  display: grid;
  gap: 4px;
  margin-top: 8px;
}
.tm-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 16px;
  align-items: start;
  margin-top: 28px;
}
.fil {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin: 0 0 12px;
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
.fil .rd-seg {
  max-width: 100%;
  overflow-x: auto;
}
.g2.tg {
  grid-template-columns: 130px 104px 76px minmax(88px, 0.8fr) minmax(190px, 1.4fr) auto;
  cursor: default;
}
.who2 {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}
.who2 .stretch {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: inherit;
  text-decoration: none;
}
.who2 .stretch:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}
.vsx {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-3);
}
.vsx :deep(.iv-champ) {
  border-radius: 6px;
}
.sf {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 54px;
  padding: 6px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  text-decoration: none;
}
.sf + .sf {
  box-shadow: inset 0 1px 0 var(--rd-line);
}
a.sf:hover {
  background: var(--surface-1);
}
.sf small {
  display: block;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3);
}
@media (max-width: 1100px) {
  .line {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .tb2 {
    grid-template-columns: auto minmax(0, 1fr);
    row-gap: 18px;
    padding: 24px;
  }
  .pb-k {
    grid-column: 1 / -1;
    grid-auto-flow: row;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 14px;
  }
  .pb-k > div {
    padding: 0;
  }
  .pb-k > div + div {
    box-shadow: none;
  }
  .tm-main,
  .tm-matches {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 900px) {
  .g2.tg {
    grid-template-columns: 104px minmax(0, 1fr) auto;
    height: auto;
    padding: 12px 14px 12px 17px;
    row-gap: 10px;
  }
  .g2.tg .who2 {
    grid-column: 1 / -1;
  }
  .g2.tg .gi {
    grid-column: 1 / -1;
  }
  .g2.tg .vsx {
    display: none;
  }
}
@media (max-width: 560px) {
  .tb2 h1 {
    font-size: 30px;
  }
  .tb2 .lg {
    width: 64px;
    height: 64px;
  }
  .lp {
    height: 260px;
  }
  .lp :deep(.ph2) {
    width: 170px;
    height: 170px;
  }
}
</style>
