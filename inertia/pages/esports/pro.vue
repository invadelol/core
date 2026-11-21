<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Head, Link, usePage } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import SiteLayout from '../../components/SiteLayout.vue'
import Icon from '../../components/ui/Icon.vue'
import Frame from '../../components/ui/Frame.vue'
import Tabs from '../../components/ui/Tabs.vue'
import CardHead from '../../components/ui/CardHead.vue'
import RankEmblem from '../../components/ui/RankEmblem.vue'
import WinRate from '../../components/ui/WinRate.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import FormStrip from '../../components/ui/FormStrip.vue'
import SortHead from '../../components/ui/SortHead.vue'
import Logo from '../../components/pros/Logo.vue'
import ProPic from '../../components/pros/ProPic.vue'
import Flag from '../../components/pros/Flag.vue'
import SocialIcon from '../../components/pros/SocialIcon.vue'
import ProGames from '../../components/esports/pro/ProGames.vue'
import ProAccounts from '../../components/esports/pro/ProAccounts.vue'
import ProTeamLine from '../../components/esports/pro/ProTeamLine.vue'
import ProChampions from '../../components/esports/pro/ProChampions.vue'
import { useSort } from '../../components/ui/sort.js'
import { champIcon, assetUrl, championSplash, profileIcon } from '../../lib/assets.js'
import { countryName } from '../../lib/board.js'
import { laneOf, n, rankValue, rankWords, roleLabel, winPct } from '../../lib/ladders.js'
import { profilePath } from '../../lib/format.js'
import { rememberPro } from '../../lib/recent.js'
import type { Match } from '../../lib/types.js'
import {
  APEX,
  PLATFORM,
  type ProAccount as Account,
  type ProBuild as Build,
  type ProGame as Game,
} from '../../components/esports/pro/types.js'
import '../../css/esports.css'
import '../../css/pro_page.css'

type ProTag = NonNullable<Game['opponentPro']>
type Tab = 'overview' | 'solo' | 'champions' | 'accounts' | 'career'

/**
 * `/pro/:slug`: a pro, with their figures in the first screen. The header stands them before the
 * art of the champion they play most, with who they are, their best rank and their month in solo
 * queue, and their team in one line; the overview then lists their accounts and career, every
 * recent solo queue game (each opens in place) and their champions with how they build the one
 * they play most. Tabs for the full tables; the tab is in the address (`?tab=accounts`).
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
  /**
   * The champion they play most in solo queue over months, once they played it a few times
   * (app/services/pro_service.ts, `signatureOf`); null without one, and the hero keeps its stage.
   */
  signature: { champion: number; games: number; wins: number } | null
  /** Whether their photo is a cutout (a figure on transparency), which can stand before art. */
  cutout: boolean
  names: Record<number, [string, string]>
  /** Their recent games as stored matches, with their side in each: what a game opens on. */
  games: { match: Match; puuid: string; gameName: string; tagLine: string }[]
  description: string
}>()

const page = usePage()
const TABS: Tab[] = ['overview', 'solo', 'champions', 'accounts', 'career']
const tab = computed<Tab>(() => {
  const q = new URLSearchParams(page.url.split('?')[1] ?? '').get('tab')
  return (TABS as string[]).includes(q ?? '') ? (q as Tab) : 'overview'
})
const base = computed(() => `/pro/${props.pro.slug}`)
/** Listed with the recent searches, by its photo and name (lib/recent.ts). */
onMounted(() =>
  watch(
    () => props.pro.slug,
    () =>
      rememberPro({
        slug: props.pro.slug,
        name: props.pro.name,
        photo: props.pro.photo ?? null,
        staff: props.pro.teams.some((t) => t.current && t.title === 'staff') || undefined,
        team: props.pro.team ? { id: props.pro.team.id, name: props.pro.team.name } : null,
      }),
    { immediate: true }
  )
)
const tabs = computed(() => [
  { key: 'overview', label: 'Overview', href: base.value },
  { key: 'solo', label: 'Solo queue', href: `${base.value}?tab=solo` },
  { key: 'champions', label: 'Champions', href: `${base.value}?tab=champions` },
  {
    key: 'accounts',
    label: 'Accounts',
    href: `${base.value}?tab=accounts`,
    count: props.pro.accounts.length,
  },
  { key: 'career', label: 'Career', href: `${base.value}?tab=career` },
])

const realName = computed(() =>
  [props.pro.about?.firstName, props.pro.about?.lastName].filter(Boolean).join(' ')
)
/** Their best account (the server lists them best first) and their best peak over all of them. */
const best = computed(() => props.pro.accounts.find((a) => a.tier) ?? null)
const peak = computed(() =>
  props.pro.accounts.reduce<Account | null>(
    (top, a) =>
      a.peakTier &&
      (!top ||
        (rankValue(a.peakTier, a.peakDivision, a.peakLp) ?? 0) >
          (rankValue(top.peakTier, top.peakDivision, top.peakLp) ?? 0))
        ? a
        : top,
    null
  )
)
const tierColor = (tier: string | null | undefined) =>
  tier ? { color: `var(--tier-${tier.toLowerCase()})` } : undefined
const rankLine = computed(() =>
  best.value?.tier ? rankWords(best.value.tier, best.value.division) : null
)
const peakWords = computed(() => {
  const p = peak.value
  if (!p?.peakTier) return null
  const lp = APEX.includes(p.peakTier) && p.peakLp !== null ? ` ${n(p.peakLp)}` : ''
  return `${rankWords(p.peakTier, p.peakDivision)}${lp}`
})
/** Their last 30 days of solo queue, every account. */
const rec = computed(() => {
  const r = props.pro.record
  return {
    games: r.games,
    rate: r.games ? Math.round((r.wins / r.games) * 100) : null,
    kda: r.games ? ((r.kills + r.assists) / Math.max(1, r.deaths)).toFixed(2) : null,
  }
})
/**
 * The champion art the header stands them before: only with a figure to stand there, their cutout
 * or, without a photo, their team's logo. A plain photo (a room behind them) fills its own frame.
 */
const art = computed(() =>
  props.cutout || (!props.pro.photo && props.pro.team) ? props.signature : null
)
/** Where a pro streams and posts, as stored: a handle, or an address on that network. */
const SOCIALS = [
  { key: 'twitch', name: 'Twitch', hosts: ['twitch.tv'], home: 'https://www.twitch.tv/' },
  { key: 'twitter', name: 'X', hosts: ['x.com', 'twitter.com'], home: 'https://x.com/' },
  {
    key: 'instagram',
    name: 'Instagram',
    hosts: ['instagram.com'],
    home: 'https://www.instagram.com/',
  },
] as const
/** Each network's handle ("vladilol_") and address; anything else stored is left out. */
const socials = computed(() =>
  SOCIALS.flatMap((s) => {
    const raw = String(props.pro.socials[s.key] ?? '').trim()
    let handle = raw.replace(/^@/, '')
    if (/^https?:\/\//i.test(raw)) {
      try {
        const url = new URL(raw)
        const host = url.hostname.replace(/^www\./, '').toLowerCase()
        handle = (s.hosts as readonly string[]).includes(host)
          ? (url.pathname.split('/').filter(Boolean)[0] ?? '')
          : ''
      } catch {
        handle = ''
      }
    }
    if (!/^[\w.]{1,40}$/.test(handle)) return []
    return [
      {
        key: s.key,
        icon: s.key === 'twitter' ? ('x' as const) : s.key,
        name: s.name,
        handle,
        href: `${s.home}${handle}`,
      },
    ]
  })
)
const country = computed(() => props.pro.about?.nationality ?? props.pro.country)

const nameOf = (id: number | null) => (id ? (props.names[id]?.[0] ?? '') : '')
const slugOf = (id: number) => props.names[id]?.[1] ?? String(id)

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
</script>

<template>
  <Head :title="`${pro.name}: soloqueue accounts and stats`" />
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

      <!-- Who: the pro before their champion's art, their rank and month, their team in a line. -->
      <section class="card pp-head pp-pro" :class="{ plain: !art }">
        <div class="pp-head-g">
          <Frame class="pp-art" :src="art ? championSplash(art.champion) : null" eager stage>
            <ProPic :slug="pro.slug" :photo="pro.photo" :team="pro.team" :size="240" eager />
            <Link
              v-if="art"
              class="pp-cap"
              :href="`/champions/${slugOf(art.champion)}`"
              title="Their most played champion in solo queue, last four months"
              ><img :src="champIcon(art.champion)" alt="" />{{ nameOf(art.champion)
              }}<span>{{ n(art.games) }} games</span></Link
            >
          </Frame>
          <div class="col pp-who">
            <h1 class="pp-name">{{ pro.name }}</h1>
            <p v-if="realName" class="body" style="margin-top: 6px">{{ realName }}</p>
            <div class="row pp-tags">
              <Link v-if="pro.team" class="tagx" :href="`/team/${pro.team.slug}`"
                ><Logo :team="pro.team.id" :size="16" />{{ pro.team.name }}</Link
              >
              <Link v-if="pro.league" class="tagx" :href="`/league/${pro.league.slug}`"
                ><Logo :league="pro.league.slug" :size="16" />{{ pro.league.code }}</Link
              >
              <span v-if="laneOf(pro.role)" class="tagx"
                ><RoleIcon :lane="laneOf(pro.role)!" :size="15" />{{ roleLabel(pro.role) }}</span
              >
              <span v-if="country" class="tagx"
                ><Flag :code="country" :size="18" />{{ countryName(country) }}</span
              >
            </div>
            <div class="row pp-links">
              <button class="btn sm" type="button" @click="share">
                <Icon name="share" />{{ shared ? 'Link copied' : 'Share' }}
              </button>
              <a
                v-for="x in socials"
                :key="x.key"
                class="btn sm ghost"
                :href="x.href"
                target="_blank"
                rel="noreferrer"
                :aria-label="`${x.handle} on ${x.name}`"
                :title="x.name"
                ><SocialIcon :name="x.icon" />{{ x.handle }}</a
              >
            </div>
          </div>
          <div class="pp-rc">
            <div class="pp-rank">
              <RankEmblem :tier="best?.tier" :size="60" />
              <span class="pp-fig">
                <template v-if="best?.tier">
                  <span class="pp-tier" :style="tierColor(best.tier)">{{ rankLine }}</span>
                  <span class="fg-l num"
                    >{{ best.lp === null ? '-' : n(best.lp) }}<span class="u">LP</span></span
                  >
                </template>
                <span v-else class="fg-s">Unranked</span>
                <span class="meta pp-peak"
                  >{{ best ? (PLATFORM[best.platform] ?? best.platform) : 'No ranked account'
                  }}{{ peakWords ? `, peak ${peakWords}` : '' }}</span
                >
              </span>
            </div>
            <div class="pp-rc-figs" title="Solo queue, every account, last 30 days">
              <span class="pp-fig"
                ><span class="fg-s num">{{ n(rec.games) }}</span
                ><span class="meta">Games, 30 days</span></span
              >
              <span class="pp-fig"
                ><span class="fg-s num"
                  >{{ rec.rate ?? '-' }}<span v-if="rec.rate !== null" class="u">%</span></span
                ><span class="meta">Win rate</span></span
              >
              <span class="pp-fig"
                ><span class="fg-s num">{{ rec.kda ?? '-' }}</span
                ><span class="meta">KDA</span></span
              >
            </div>
          </div>
        </div>
        <ProTeamLine
          v-if="roster && roster.members.some((m) => m.title === 'player')"
          :team="roster.team"
          :members="roster.members"
          :me="pro.slug"
        />
      </section>

      <Tabs :items="tabs" :active="tab" label="Pro" preserve-scroll style="margin-top: 24px" />

      <!-- Overview: accounts and career, every recent game, the champions, side by side. -->
      <section
        v-if="tab === 'overview'"
        class="pp-cols"
        :class="{ 'no-champs': !pro.builds.length }"
      >
        <div class="col">
          <ProAccounts :accounts="pro.accounts" :limit="4" />
          <div v-if="pro.teams.length" class="card">
            <CardHead
              title="Career"
              icon="trophy"
              :more="pro.teams.length > 3 ? { label: 'All', href: `${base}?tab=career` } : null"
            />
            <Link
              v-for="(t, i) in pro.teams.slice(0, 3)"
              :key="`${t.team.slug}-${i}`"
              class="pp-ch"
              :href="`/team/${t.team.slug}`"
            >
              <Logo
                :team="t.team.id"
                :size="32"
                style="width: 26px; height: 26px; object-fit: contain; flex: none"
              />
              <span class="h5 ell grow">{{ t.team.name }}</span>
              <span class="meta">{{ span(t) }}</span>
            </Link>
          </div>
        </div>
        <ProGames :games="pro.games" :stored="props.games" :names="names" :slug="pro.slug" />
        <div v-if="pro.builds.length" class="col">
          <ProChampions
            :builds="pro.builds"
            :names="names"
            :pro="pro.name"
            :base="base"
            :limit="5"
          />
        </div>
      </section>

      <!-- Solo queue: every recent game across the page, with its build and the other pros. -->
      <section v-if="tab === 'solo'" class="sec" style="padding-top: 32px">
        <ProGames
          :games="pro.games"
          :stored="props.games"
          :names="names"
          :slug="pro.slug"
          items
          :faces="6"
        />
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
        <div
          class="card tbl pp-acc"
          style="--cols: minmax(0, 1fr) 70px 200px 170px 170px; --row-h: 62px"
        >
          <div class="tbl-h">
            <SortHead :sorter="accountSort" col="name" label="Account" />
            <SortHead :sorter="accountSort" col="server" label="Server" />
            <SortHead :sorter="accountSort" col="rank" label="Rank" />
            <SortHead :sorter="accountSort" col="peak" label="Peak" class="hm" />
            <SortHead
              :sorter="accountSort"
              col="record"
              label="Record"
              class="hm"
              title="Games this season"
            />
          </div>
          <Link
            v-for="a in accountSort.rows"
            :key="a.id"
            class="tbl-r"
            :href="profilePath(a.gameName, a.tagLine)"
          >
            <span class="who">
              <img
                class="pp-ic"
                loading="lazy"
                decoding="async"
                alt=""
                width="36"
                height="36"
                :src="profileIcon(a.icon)"
              />
              <span class="h5"
                >{{ a.gameName }} <span class="meta">#{{ a.tagLine }}</span></span
              >
            </span>
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
            <WinRate
              v-if="a.wins !== null && a.losses !== null && a.wins + a.losses > 0"
              class="hm"
              :wins="a.wins"
              :losses="a.losses"
              :width="90"
            />
            <span v-else class="hm meta">–</span>
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
              ><Logo
                :team="t.team.id"
                :size="32"
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
