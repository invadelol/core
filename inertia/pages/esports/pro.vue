<script setup lang="ts">
import { computed, ref } from 'vue'
import { Head, Link, usePage } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import SiteLayout from '../../components/SiteLayout.vue'
import Icon from '../../components/ui/Icon.vue'
import Frame from '../../components/ui/Frame.vue'
import Tabs from '../../components/ui/Tabs.vue'
import CardHead from '../../components/ui/CardHead.vue'
import RankEmblem from '../../components/ui/RankEmblem.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import FormStrip from '../../components/ui/FormStrip.vue'
import SortHead from '../../components/ui/SortHead.vue'
import { useSort } from '../../components/ui/sort.js'
import { champIcon, assetUrl } from '../../lib/assets.js'
import { countryName, leagueLogo } from '../../lib/board.js'
import { laneOf, n, rankValue, rankWords, roleLabel, winPct } from '../../lib/ladders.js'
import { profilePath } from '../../lib/format.js'
import '../../css/esports.css'

interface ProTag {
  slug: string
  name: string
  photo?: string
  team: { id: string; slug: string; name: string; shortName: string | null } | null
}
interface Game {
  matchId: string
  account: string
  platform: string
  startMs: number
  champion: number
  position: string
  win: boolean
  kills: number
  deaths: number
  assists: number
  cs: number
  items: number[]
  durationSec: number
  opponent: number | null
  opponentName?: string
  opponentPro?: ProTag | null
  pros?: { pro: ProTag; champion: number; ally: boolean }[]
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

type Tab = 'overview' | 'solo' | 'champions' | 'accounts' | 'career'

/**
 * `/pro/:slug`: a pro, as the board draws them: the hero with their place on their league's ladder,
 * best account and recent record; tabs for their team, solo queue, champions, accounts and career.
 * The tab is in the address (`?tab=accounts`).
 */
const props = defineProps<{
  pro: {
    slug: string
    name: string
    role: string | null
    country: string | null
    photo?: string
    team: ProTag['team'] & { region?: string | null }
    league: { slug: string; code: string; name: string } | null
    socials: Record<string, string>
    about: { firstName: string | null; lastName: string | null; nationality: string | null } | null
    accounts: Account[]
    teams: {
      team: { id: string; slug: string; name: string }
      league: { slug: string; code: string } | null
      title: string | null
      current: boolean
      joinedAt: string | Date | null
      leftAt: string | Date | null
    }[]
    games: Game[]
    record: { games: number; wins: number; kills: number; deaths: number; assists: number }
    builds: Build[]
  }
  roster: {
    team: {
      id: string
      slug: string
      name: string
      shortName: string | null
      league: { slug: string; code: string } | null
    }
    members: {
      name: string
      slug: string | null
      photo?: string
      role: string | null
      title: string
      best: { tier: string; division: number | null; lp: number } | null
    }[]
  } | null
  leaguePlace: { place: number; total: number } | null
  ladder: { place: number; total: number } | null
  names: Record<number, [string, string]>
  description: string
}>()

const page = usePage()
const TABS: Tab[] = ['overview', 'solo', 'champions', 'accounts', 'career']
const tab = computed<Tab>(() => {
  const q = new URLSearchParams(page.url.split('?')[1] ?? '').get('tab')
  return (TABS as string[]).includes(q ?? '') ? (q as Tab) : 'overview'
})
const base = `/pro/${props.pro.slug}`
const tabs = computed(() => [
  { key: 'overview', label: 'Overview', href: base },
  { key: 'solo', label: 'Solo queue', href: `${base}?tab=solo` },
  { key: 'champions', label: 'Champions', href: `${base}?tab=champions` },
  {
    key: 'accounts',
    label: 'Accounts',
    href: `${base}?tab=accounts`,
    count: props.pro.accounts.length,
  },
  { key: 'career', label: 'Career', href: `${base}?tab=career` },
])

const realName = computed(() =>
  [props.pro.about?.firstName, props.pro.about?.lastName].filter(Boolean).join(' ')
)
const best = computed(() => props.pro.accounts.find((a) => a.tier) ?? null)
const peak = computed(() => {
  const peaks = props.pro.accounts.map((a) => a.peakLp ?? 0).filter(Boolean)
  return peaks.length ? Math.max(...peaks) : null
})
const twitch = computed(() => props.pro.socials.twitch ?? null)
const twitchName = computed(() =>
  twitch.value ? twitch.value.replace(/\/$/, '').split('/').pop() : null
)

const ORDER = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT']
const five = computed(() =>
  (props.roster?.members ?? [])
    .filter((m) => m.title === 'player')
    .sort((a, b) => ORDER.indexOf(a.role ?? '') - ORDER.indexOf(b.role ?? ''))
    .slice(0, 5)
)

const withPros = ref(false)
const games = computed(() =>
  props.pro.games.filter((g) => !withPros.value || (g.pros?.length ?? 0) > 0)
)
const shownGames = computed(() =>
  tab.value === 'overview' ? games.value.slice(0, 8) : games.value
)
const nameOf = (id: number | null) => (id ? (props.names[id]?.[0] ?? '') : '')
const slugOf = (id: number) => props.names[id]?.[1] ?? String(id)
const when = (ms: number) => {
  const d = new Date(ms)
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const kda = (g: { kills: number; deaths: number; assists: number }) =>
  ((g.kills + g.assists) / Math.max(1, g.deaths)).toFixed(2)
const gamePath = (g: Game) => {
  const at = g.account.lastIndexOf('#')
  return at > 0
    ? `${profilePath(g.account.slice(0, at), g.account.slice(at + 1))}/match/${g.matchId}`
    : null
}
const year = (v: string | Date | null) => (v ? new Date(v).getUTCFullYear() : null)
const span = (t: {
  current: boolean
  joinedAt: string | Date | null
  leftAt: string | Date | null
}) => {
  const a = year(t.joinedAt)
  const b = t.current ? 'now' : year(t.leftAt)
  return a && b && String(a) !== String(b) ? `${a} to ${b}` : String(a ?? b ?? '')
}
const careerOpen = ref(false)
const career = computed(() =>
  tab.value === 'career' || careerOpen.value ? props.pro.teams : props.pro.teams.slice(0, 3)
)
const shared = ref(false)
function share() {
  if (typeof window === 'undefined') return
  navigator.clipboard?.writeText(window.location.href).then(() => {
    shared.value = true
    setTimeout(() => (shared.value = false), 1600)
  })
}
const photo = (slug: string | null, v: string | undefined, size: number) =>
  slug && v ? `/cdn/pro/${slug}?s=${size}&v=${v}` : null
/** The accounts, best rank first as they come; the heads sort them. */
const accountSort = useSort(
  () => props.pro.accounts,
  {
    name: (a) => a.gameName,
    server: (a) => PLATFORM[a.platform] ?? a.platform,
    rank: (a) => rankValue(a.tier, a.division, a.lp),
    peak: (a) => rankValue(a.peakTier, a.peakDivision, a.peakLp),
    record: (a) => (a.wins !== null && a.losses !== null ? a.wins + a.losses : null),
  },
  { first: { name: 'asc', server: 'asc' } }
)
const PLATFORM: Record<string, string> = {
  EUW1: 'EUW',
  EUN1: 'EUNE',
  NA1: 'NA',
  BR1: 'BR',
  LA1: 'LAN',
  LA2: 'LAS',
  KR: 'KR',
  JP1: 'JP',
  OC1: 'OCE',
  TR1: 'TR',
  VN2: 'VN',
  TW2: 'TW',
  SG2: 'SEA',
  ME1: 'ME',
  RU: 'RU',
}
</script>

<template>
  <Head :title="pro.name">
    <meta name="description" :content="description" />
  </Head>
  <SiteLayout>
    <div class="wrap pg-es">
      <div class="mast" style="padding-bottom: 16px">
        <nav class="crumbs" aria-label="Breadcrumb">
          <Link href="/esports">Esports</Link><Icon name="chevr" />
          <template v-if="pro.league"
            ><Link :href="`/league/${pro.league.slug}`">{{ pro.league.code }}</Link
            ><Icon name="chevr"
          /></template>
          <template v-if="pro.team"
            ><Link :href="`/team/${pro.team.slug}`">{{ pro.team.name }}</Link
            ><Icon name="chevr"
          /></template>
          <span class="t1">{{ pro.name }}</span>
        </nav>
      </div>

      <section class="card pp-hero">
        <Frame class="ph5" :src="photo(pro.slug, pro.photo, 240)" stage eager />
        <div class="col" style="justify-content: center; min-width: 0">
          <h1 class="pp-name">{{ pro.name }}</h1>
          <p v-if="realName" class="body" style="margin-top: 8px">{{ realName }}</p>
          <div class="row" style="gap: 8px; margin-top: 18px; flex-wrap: wrap">
            <Link v-if="pro.team" class="tagx" :href="`/team/${pro.team.slug}`"
              ><img :src="`/cdn/team/${pro.team.id}?s=32`" alt="" />{{ pro.team.name }}</Link
            >
            <Link v-if="pro.league" class="tagx" :href="`/league/${pro.league.slug}`"
              ><img :src="leagueLogo(pro.league.slug, 32)" alt="" />{{ pro.league.code }}</Link
            >
            <span v-if="laneOf(pro.role)" class="tagx"
              ><RoleIcon :lane="laneOf(pro.role)!" :size="15" />{{ roleLabel(pro.role) }}</span
            >
            <span v-if="pro.about?.nationality ?? pro.country" class="tagx">{{
              countryName(pro.about?.nationality ?? pro.country)
            }}</span>
          </div>
          <div class="row" style="gap: 10px; margin-top: 22px; flex-wrap: wrap">
            <button class="btn" type="button" @click="share">
              <Icon name="share" />{{ shared ? 'Link copied' : 'Share' }}
            </button>
            <a v-if="twitch" class="btn ghost" :href="twitch" target="_blank" rel="noreferrer"
              ><Icon name="live" />{{ twitchName }} on Twitch</a
            >
          </div>
        </div>
        <div class="pp-kv">
          <div v-if="leaguePlace && pro.league">
            <span class="lab">{{ pro.league.code }} ladder</span>
            <span
              ><span class="fg-l">#{{ leaguePlace.place }}</span>
              <span class="meta">of {{ leaguePlace.total }} ranked pros</span></span
            >
          </div>
          <div v-else-if="ladder">
            <span class="lab">Pro ladder</span>
            <span
              ><span class="fg-l">#{{ n(ladder.place) }}</span>
              <span class="meta">of {{ n(ladder.total) }} ranked pros</span></span
            >
          </div>
          <div>
            <span class="lab">Solo queue</span>
            <span v-if="best?.tier"
              ><span class="fg-l gd">{{
                best.lp !== null ? n(best.lp) : rankWords(best.tier, best.division)
              }}</span>
              <span class="meta">{{
                ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(best.tier)
                  ? `LP${peak ? `, peak ${n(peak)}` : ''}`
                  : `LP, ${rankWords(best.tier, best.division)}`
              }}</span></span
            >
            <span v-else class="meta">Unranked</span>
          </div>
          <div v-if="pro.record.games">
            <span class="lab">Last {{ pro.record.games }} games</span>
            <span
              ><span class="fg-l">{{ winPct(pro.record.wins, pro.record.games) }}</span>
              <span class="meta"
                >{{ pro.record.wins }}W {{ pro.record.games - pro.record.wins }}L</span
              ></span
            >
          </div>
        </div>
      </section>

      <Tabs :items="tabs" :active="tab" label="Pro" preserve-scroll style="margin-top: 24px" />

      <!-- Overview: the team, then games, champions and career side by side. -->
      <section
        v-if="tab === 'overview' && roster && five.length"
        class="sec"
        style="padding-top: 36px"
      >
        <div class="sec-h">
          <img
            :src="`/cdn/team/${roster.team.id}?s=48`"
            alt=""
            style="width: 26px; height: 26px; object-fit: contain"
          />
          <h2 class="h2">{{ roster.team.name }}</h2>
          <span v-if="roster.team.league" class="meta"
            >{{ roster.team.league.code }}, current roster</span
          >
          <Link class="more" :href="`/team/${roster.team.slug}`"
            >Team page<Icon name="chevr"
          /></Link>
        </div>
        <div class="five2">
          <component
            :is="m.slug ? Link : 'div'"
            v-for="m in five"
            :key="m.name"
            class="mate"
            :class="{ me: m.slug === pro.slug }"
            :href="m.slug ? `/pro/${m.slug}` : undefined"
          >
            <Frame :src="photo(m.slug, m.photo, 240)" stage />
            <span class="rl3"
              ><RoleIcon v-if="laneOf(m.role)" :lane="laneOf(m.role)!" :size="13" />{{
                roleLabel(m.role)
              }}</span
            >
            <span class="nm4">{{ m.name }}</span>
            <span class="rk5"
              ><RankEmblem v-if="m.best" :tier="m.best.tier" :size="16" />{{
                m.best
                  ? `${rankWords(m.best.tier, m.best.division)}${['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(m.best.tier) ? `, ${n(m.best.lp)} LP` : ''}`
                  : 'Unranked'
              }}</span
            >
          </component>
        </div>
      </section>

      <section
        v-if="tab === 'overview' || tab === 'solo'"
        class="sec pp-g"
        :style="tab === 'solo' ? 'padding-top: 32px' : undefined"
      >
        <div class="card">
          <div class="card-h">
            <Icon name="chart" />
            <span class="h3">Solo queue</span>
            <span class="meta">Every account, last 30 days</span>
            <span class="seg" style="margin-left: auto">
              <button type="button" :class="{ on: !withPros }" @click="withPros = false">
                All
              </button>
              <button type="button" :class="{ on: withPros }" @click="withPros = true">
                With pros
              </button>
            </span>
          </div>
          <div v-if="games.some((g) => g.pros?.length)" class="lgd" style="padding: 0 20px 12px">
            <span><i></i>Pro on their side</span>
            <span><i class="en"></i>Pro against them</span>
          </div>
          <component
            :is="gamePath(g) ? Link : 'div'"
            v-for="g in shownGames"
            :key="g.matchId"
            class="sq"
            :class="g.win ? 'w' : 'l'"
            :href="gamePath(g) ?? undefined"
          >
            <Frame :src="champIcon(g.champion)" size="s" :alt="nameOf(g.champion)" />
            <span class="col">
              <span class="res">{{ g.win ? 'Win' : 'Loss' }}</span>
              <span class="meta">{{ when(g.startMs) }}</span>
            </span>
            <span class="col">
              <span class="kda"
                >{{ g.kills }}<span class="sl">/</span><span class="d">{{ g.deaths }}</span
                ><span class="sl">/</span>{{ g.assists }}</span
              >
              <span class="meta">{{ kda(g) }} KDA</span>
            </span>
            <span class="col">
              <span class="h5 num"
                >{{ g.durationSec ? (g.cs / (g.durationSec / 60)).toFixed(1) : '–' }} CS/min</span
              >
              <span v-if="g.opponent" class="meta ell"
                >{{ g.opponentPro?.name ?? nameOf(g.opponent) }} opposite</span
              >
            </span>
            <span class="h5 num">{{ clock(g.durationSec) }}</span>
            <span class="faces2">
              <span
                v-for="p in g.pros ?? []"
                :key="p.pro.slug"
                :class="{ en: !p.ally }"
                :title="p.pro.name"
                ><img v-if="p.pro.photo" :src="photo(p.pro.slug, p.pro.photo, 48)!" alt=""
              /></span>
            </span>
          </component>
          <EmptyState
            v-if="!shownGames.length"
            compact
            icon="chart"
            :title="
              withPros
                ? 'No game with another pro in 30 days'
                : 'No stored solo queue game in 30 days'
            "
          />
          <Link
            v-if="tab === 'overview' && games.length > shownGames.length"
            class="more"
            :href="`${base}?tab=solo`"
            preserve-scroll
            style="
              display: flex;
              justify-content: center;
              padding: 14px;
              border-top: 1px solid var(--line);
            "
            >Older games<Icon name="chev"
          /></Link>
        </div>

        <div v-if="tab === 'overview'" class="col" style="gap: 24px">
          <div v-if="pro.builds.length" class="card">
            <CardHead
              title="Champions"
              icon="grid"
              meta="Recent solo queue"
              :more="{ label: 'Builds', href: `${base}?tab=champions` }"
            />
            <Link
              v-for="b in pro.builds.slice(0, 6)"
              :key="b.champion"
              class="lrow"
              :href="`/champions/${slugOf(b.champion)}`"
            >
              <Frame :src="champIcon(b.champion)" :width="40" size="s" />
              <span class="col grow">
                <span class="h4">{{ nameOf(b.champion) }}</span>
                <span class="meta"
                  >{{ b.wins }}W {{ b.games - b.wins }}L, {{ b.kda.toFixed(2) }} KDA</span
                >
              </span>
              <span class="split" style="width: 80px"
                ><i :style="{ width: winPct(b.wins, b.games) }"></i><b></b
              ></span>
              <span class="fg-xs num" style="width: 48px; text-align: right">{{
                winPct(b.wins, b.games)
              }}</span>
            </Link>
          </div>
          <div v-if="pro.teams.length" class="card">
            <CardHead title="Career" icon="trophy" />
            <Link
              v-for="(t, i) in career"
              :key="`${t.team.slug}-${i}`"
              class="lrow"
              :href="`/team/${t.team.slug}`"
            >
              <span style="width: 36px; height: 36px; display: grid; place-items: center"
                ><img
                  :src="`/cdn/team/${t.team.id}?s=48`"
                  alt=""
                  style="width: 30px; height: 30px; object-fit: contain"
              /></span>
              <span class="col grow">
                <span class="h4">{{ t.team.name }}</span>
                <span class="meta">{{
                  t.league?.code ?? (t.title === 'staff' ? 'Staff' : '')
                }}</span>
              </span>
              <span class="meta">{{ span(t) }}</span>
            </Link>
            <button
              v-if="!careerOpen && pro.teams.length > 3"
              type="button"
              class="more"
              style="
                display: flex;
                justify-content: center;
                width: 100%;
                padding: 14px;
                border-top: 1px solid var(--line);
              "
              @click="careerOpen = true"
            >
              {{ pro.teams.length - 3 }} earlier {{ pro.teams.length - 3 === 1 ? 'team' : 'teams'
              }}<Icon name="chev" />
            </button>
          </div>
        </div>
      </section>

      <!-- Champions: their build on each, from their own games. -->
      <section v-if="tab === 'champions'" class="sec" style="padding-top: 32px">
        <div class="card">
          <CardHead
            title="Champions and builds"
            icon="grid"
            meta="Their own solo queue games, last 30 days"
          />
          <div v-for="b in pro.builds" :key="b.champion" class="es-bd">
            <Link
              :href="`/champions/${slugOf(b.champion)}`"
              class="row"
              style="gap: 12px; min-width: 0"
            >
              <Frame :src="champIcon(b.champion)" :width="44" size="s" />
              <span class="col" style="min-width: 0">
                <span class="h4">{{ nameOf(b.champion) }}</span>
                <span class="meta"
                  >{{ b.games }} games, {{ winPct(b.wins, b.games) }} won,
                  {{ b.kda.toFixed(2) }} KDA</span
                >
              </span>
            </Link>
            <span class="row" style="gap: 4px">
              <img v-if="b.keystone" class="es-ic r" :src="assetUrl('rune', b.keystone)" alt="" />
              <img
                v-if="b.secondaryStyle"
                class="es-ic r sm"
                :src="assetUrl('runeStyle', b.secondaryStyle)"
                alt=""
              />
              <img
                v-for="s in b.spells ?? []"
                :key="s"
                class="es-ic"
                :src="assetUrl('spell', s)"
                alt=""
              />
            </span>
            <span class="row" style="gap: 4px">
              <img v-if="b.boots" class="es-ic" :src="assetUrl('item', b.boots)" alt="" />
              <img
                v-for="it in b.core"
                :key="it"
                class="es-ic"
                :src="assetUrl('item', it)"
                alt=""
              />
            </span>
            <span class="meta">{{ b.max.length ? `Max ${b.max.join(' > ')}` : '' }}</span>
            <FormStrip :results="[...b.form].reverse()" small />
          </div>
          <EmptyState
            v-if="!pro.builds.length"
            compact
            icon="grid"
            title="No stored solo queue game in 30 days"
          />
        </div>
      </section>

      <!-- Accounts. -->
      <section v-if="tab === 'accounts'" class="sec" style="padding-top: 32px">
        <div class="card tbl" style="--cols: minmax(0, 1fr) 70px 180px 160px 120px">
          <div class="tbl-h">
            <SortHead :sorter="accountSort" col="name" label="Account" />
            <SortHead :sorter="accountSort" col="server" label="Server" />
            <SortHead :sorter="accountSort" col="rank" label="Rank" />
            <SortHead :sorter="accountSort" col="peak" label="Peak" class="hm" />
            <SortHead :sorter="accountSort" col="record" label="Record" class="n hm" title="Games this season" />
          </div>
          <Link
            v-for="a in accountSort.rows"
            :key="a.id"
            class="tbl-r"
            :href="profilePath(a.gameName, a.tagLine)"
          >
            <span class="h5 ell"
              >{{ a.gameName }} <span class="meta">#{{ a.tagLine }}</span></span
            >
            <span class="meta">{{ PLATFORM[a.platform] ?? a.platform }}</span>
            <span class="row" style="gap: 8px"
              ><RankEmblem :tier="a.tier" :size="24" /><span class="h5">{{
                a.tier ? rankWords(a.tier, a.division) : 'Unranked'
              }}</span
              ><span v-if="a.tier && a.lp !== null" class="meta">{{ n(a.lp) }} LP</span></span
            >
            <span class="meta hm">{{
              a.peakTier
                ? `${rankWords(a.peakTier, a.peakDivision)}${a.peakLp !== null ? `, ${n(a.peakLp)} LP` : ''}`
                : '–'
            }}</span>
            <span class="n hm meta">{{
              a.wins !== null && a.losses !== null ? `${a.wins}W ${a.losses}L` : '–'
            }}</span>
          </Link>
          <EmptyState
            v-if="!pro.accounts.length"
            compact
            icon="user"
            title="No solo queue account known"
          />
        </div>
      </section>

      <!-- Career. -->
      <section v-if="tab === 'career'" class="sec" style="padding-top: 32px">
        <div class="card">
          <CardHead
            title="Career"
            icon="trophy"
            :meta="`${pro.teams.length} ${pro.teams.length === 1 ? 'team' : 'teams'}`"
          />
          <Link
            v-for="(t, i) in career"
            :key="`${t.team.slug}-${i}`"
            class="lrow"
            :href="`/team/${t.team.slug}`"
          >
            <span style="width: 36px; height: 36px; display: grid; place-items: center"
              ><img
                :src="`/cdn/team/${t.team.id}?s=48`"
                alt=""
                style="width: 30px; height: 30px; object-fit: contain"
            /></span>
            <span class="col grow">
              <span class="h4">{{ t.team.name }}</span>
              <span class="meta">{{
                [
                  t.league?.code,
                  t.title === 'sub' ? 'Substitute' : t.title === 'staff' ? 'Staff' : null,
                ]
                  .filter(Boolean)
                  .join(', ')
              }}</span>
            </span>
            <span class="meta">{{ span(t) }}</span>
          </Link>
          <EmptyState v-if="!pro.teams.length" compact icon="trophy" title="No team known" />
        </div>
      </section>
      <p v-if="tab !== 'accounts'" class="meta" style="margin-top: 14px">
        Solo queue: the games Invade stored of their accounts in the last 30 days.
      </p>
    </div>
  </SiteLayout>
</template>
