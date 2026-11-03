<script setup lang="ts">
import { computed, ref } from 'vue'
import { Head, Link, usePage } from '@inertiajs/vue3'
import { ChevronRight, ExternalLink } from 'lucide-vue-next'
import { ChampIcon, RankCrest, RoleIcon } from '@invadelol/ui'
import AppHeader from '../../components/AppHeader.vue'
import SiteFooter from '../../components/SiteFooter.vue'
import Crumbs from '../../components/champions/Crumbs.vue'
import Logo from '../../components/champions/Logo.vue'
import Crest from '../../components/champions/Crest.vue'
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
import '../../css/champions.css'

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
const back = computed(() =>
  player.value.team
    ? { label: player.value.team.name, href: `/team/${player.value.team.slug}` }
    : { label: 'Pros', href: '/pros' }
)
</script>

<template>
  <Head :title="title" />
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <main class="nb nb-page flex-1">
      <Crumbs :back="back" :items="crumbs">
        <template #end><ShareButton :title="player.name" :url="canonical" /></template>
      </Crumbs>

      <section class="nb-panel nb-prohead" :aria-label="player.name">
        <ProPhoto
          :slug="player.slug"
          :photo="player.photo"
          :width="128"
          :height="144"
          eager
          fluid
        />
        <div class="min-w-0">
          <h1>{{ player.name }}</h1>
          <p v-if="realName" class="real">{{ realName }}</p>
          <div class="tags">
            <Link v-if="player.team" :href="`/team/${player.team.slug}`"
              ><Logo :team="player.team" :size="20" eager />{{ player.team.name }}</Link
            >
            <span v-else class="q">No team now</span>
            <Link v-if="player.league" :href="`/pros?league=${player.league.slug}`"
              ><Logo :league="player.league" :size="20" eager />{{ player.league.code }}</Link
            >
            <span v-if="lane"><RoleIcon :lane="lane.lane" :size="14" />{{ lane.label }}</span>
            <span v-else-if="player.staff">{{
              (player.role ?? '').charAt(0) + (player.role ?? '').slice(1).toLowerCase()
            }}</span>
            <span v-if="nationality">{{ countryName(nationality) }}</span>
            <span v-if="age" class="num">{{ age }} years old</span>
          </div>
          <div v-if="socials.length" class="links">
            <a
              v-for="s in socials"
              :key="s.k"
              :href="s.href"
              target="_blank"
              rel="noreferrer"
              class="iv-btn ghost sm"
              >{{ s.label }}<ExternalLink :size="12" aria-hidden="true" /><span class="nb-sr">
                (opens a new tab)</span
              ></a
            >
          </div>
        </div>
        <div class="side">
          <div class="nb-figs" style="gap: 24px; margin-right: 8px">
            <div>
              <span>Games, 30 days</span><b class="iv-fig num">{{ record.games }}</b>
            </div>
            <div>
              <span>Win rate</span
              ><b class="iv-fig num">{{ record.games ? pct(record.wins / record.games) : '-' }}</b>
            </div>
            <div>
              <span>KDA</span><b class="iv-fig num">{{ kda }}</b>
            </div>
          </div>
          <div class="nb-rank">
            <RankCrest :tier="best?.tier ?? null" :size="56" emblem />
            <div>
              <span :style="tierColor(best?.tier)">{{
                best ? tierName(best.tier) : 'Unranked'
              }}</span>
              <b class="iv-fig num">{{
                best && best.lp !== null ? `${thousands(best.lp)} LP` : '-'
              }}</b>
              <small v-if="best" class="num"
                >{{ regionLabel(best.platform)
                }}<template v-if="best.peakTier"
                  >, peak {{ rankText(best.peakTier, best.peakDivision, best.peakLp) }}</template
                ></small
              >
            </div>
          </div>
        </div>
      </section>

      <div class="pp-cols">
        <div class="nb-stack aside">
          <section v-if="player.team && (nextMatch || lastMatch)" class="nb-panel">
            <div class="nb-ph">
              <h2>Matches</h2>
              <span class="end nb-meta">{{ player.team.name }}</span>
            </div>
            <div class="pp-matches">
              <MatchCard v-if="nextMatch" :match="nextMatch" show-league />
              <MatchCard v-if="lastMatch" :match="lastMatch" show-league />
            </div>
          </section>
          <section class="nb-panel">
            <div class="nb-ph">
              <h2>Accounts</h2>
              <span class="end nb-meta num">{{ player.accounts.length }}</span>
            </div>
            <div class="nb-pb rows">
              <p v-if="!player.accounts.length" class="nb-empty" style="padding-inline: 0">
                No ranked account known.
              </p>
              <Link
                v-for="a in player.accounts"
                :key="a.id"
                :href="profile(a)"
                class="nb-row"
                style="min-height: 48px"
              >
                <Crest :tier="a.tier" :size="20" />
                <span class="n"
                  >{{ a.gameName }}<span class="q">#{{ a.tagLine }}</span
                  ><small class="num"
                    >{{ regionLabel(a.platform)
                    }}<template v-if="a.wins !== null && (a.wins || a.losses)"
                      >, {{ a.wins }}W {{ a.losses }}L</template
                    ></small
                  ></span
                >
                <span
                  class="num"
                  style="flex: none; font-size: 12.5px; font-weight: 600"
                  :style="tierColor(a.tier)"
                  >{{ rankText(a.tier, a.division, a.lp) }}</span
                >
              </Link>
            </div>
          </section>
          <section v-if="player.teams.length" class="nb-panel">
            <div class="nb-ph"><h2>Career</h2></div>
            <div class="nb-pb rows">
              <Link
                v-for="t in player.teams"
                :key="`${t.team.id}-${t.joinedAt}`"
                :href="`/team/${t.team.slug}`"
                class="nb-row"
                style="min-height: 48px"
              >
                <Logo :team="t.team" :size="32" />
                <span class="n"
                  >{{ t.team.name
                  }}<small>{{
                    [
                      t.league?.code,
                      t.title === 'sub'
                        ? 'Sub'
                        : t.title === 'staff'
                          ? t.role
                            ? t.role.charAt(0) + t.role.slice(1).toLowerCase()
                            : 'Staff'
                          : null,
                      years(t),
                    ]
                      .filter(Boolean)
                      .join(', ')
                  }}</small></span
                >
                <span v-if="t.current" class="iv-badge brand">Now</span>
              </Link>
            </div>
          </section>
        </div>

        <section class="games" aria-labelledby="h-games">
          <div class="nb-h">
            <h2 id="h-games">Recent games</h2>
            <span class="nb-meta">Solo queue, every account</span>
            <span class="end nb-seg" role="group" aria-label="Show">
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
          <p v-if="!player.games.length" class="nb-panel nb-empty">
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

        <div class="nb-stack build">
          <section v-if="player.builds.length" class="nb-panel">
            <div class="nb-ph">
              <h2>Champions</h2>
              <span class="end nb-meta">30 days</span>
            </div>
            <div class="pp-picks" role="group" :aria-label="`${player.name}'s champions`">
              <button
                v-for="c in player.builds"
                :key="c.champion"
                type="button"
                class="pp-pick"
                :aria-pressed="picked === c.champion"
                @click="picked = c.champion"
              >
                <span class="nb-pic"><ChampIcon :id="c.champion" :size="26" /></span>
                <span class="n"
                  >{{ championName(c.champion)
                  }}<small class="num"
                    >{{ c.games }} {{ c.games === 1 ? 'game' : 'games' }}, {{ c.kda }} KDA</small
                  ></span
                >
                <span class="v num"
                  >{{ pct(c.wins / c.games, 0)
                  }}<small>{{ c.wins }}W {{ c.games - c.wins }}L</small></span
                >
              </button>
            </div>
          </section>
          <section
            v-if="build"
            class="nb-panel lit-sheet"
            :aria-label="`${player.name} on ${championName(build.champion)}`"
            aria-live="polite"
          >
            <div class="nb-ph">
              <span class="nb-pic"><ChampIcon :id="build.champion" :size="24" /></span>
              <h2>{{ player.name }} on {{ championName(build.champion) }}</h2>
              <span v-if="build.champion === player.builds[0].champion" class="end iv-badge"
                >Most played</span
              >
            </div>
            <div class="nb-pb">
              <span class="nb-k"
                >Core, in {{ build.coreGames }} of {{ build.games }}
                {{ build.games === 1 ? 'game' : 'games' }}</span
              >
              <div class="nb-core" style="margin-top: 8px">
                <template v-if="build.boots"
                  ><GameImg kind="item" :id="build.boots" :size="30" /><span
                    class="ar"
                    aria-hidden="true"
                    ><ChevronRight :size="12" /></span
                ></template>
                <GameImg v-for="id in build.core" :key="id" kind="item" :id="id" :size="38" />
              </div>
              <div class="nb-hl" />
              <div class="pp-kv">
                <span>Runes</span
                ><span class="i"
                  ><template v-if="build.keystone"
                    ><GameImg kind="rune" :id="build.keystone" :size="24" round /><GameImg
                      v-if="build.secondaryStyle"
                      kind="runeStyle"
                      :id="build.secondaryStyle"
                      :size="18" /></template
                  ><b v-else>-</b></span
                >
              </div>
              <div class="pp-kv">
                <span>Spells</span
                ><span class="i"
                  ><template v-if="build.spells"
                    ><GameImg
                      v-for="s in build.spells"
                      :key="s"
                      kind="spell"
                      :id="s"
                      :size="22" /></template
                  ><b v-else>-</b></span
                >
              </div>
              <div class="pp-kv">
                <span>Skills</span
                ><b class="num">{{ build.max.length ? `Max ${build.max.join(', ')}` : '-' }}</b>
              </div>
              <div class="pp-kv">
                <span>Last games</span>
                <span
                  class="nb-form"
                  :aria-label="`${build.form.filter(Boolean).length} wins in the last ${build.form.length}`"
                  ><i
                    v-for="(w, i) in build.form"
                    :key="i"
                    :class="w ? 'w' : 'l'"
                    aria-hidden="true"
                    >{{ w ? 'W' : 'L' }}</i
                  ></span
                >
              </div>
              <Link
                :href="champHref(build.champion)"
                class="iv-btn sm"
                style="width: 100%; justify-content: center; margin-top: 12px"
                >Open the {{ championName(build.champion) }} page</Link
              >
            </div>
          </section>
        </div>
      </div>
    </main>
    <SiteFooter />
  </div>
</template>
