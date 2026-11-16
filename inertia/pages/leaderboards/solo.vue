<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import SiteLayout from '../../components/SiteLayout.vue'
import Icon from '../../components/ui/Icon.vue'
import Frame from '../../components/ui/Frame.vue'
import Select from '../../components/ui/Select.vue'
import ScoreDial from '../../components/ui/ScoreDial.vue'
import RankEmblem from '../../components/ui/RankEmblem.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import RoleFilter from '../../components/leaderboards/RoleFilter.vue'
import LadderPager from '../../components/leaderboards/LadderPager.vue'
import LadderPlayer from '../../components/leaderboards/LadderPlayer.vue'
import { champIcon, championName } from '../../lib/assets.js'
import {
  dayMonth,
  laneOf,
  linePath,
  n,
  playerPath,
  roleLabel,
  signedN,
  since,
  tierWord,
  winPct,
  withQuery,
} from '../../lib/ladders.js'
import '../../css/leaderboards.css'

interface Row {
  place: number
  gameName: string | null
  tagLine: string | null
  icon: number | null
  level: number | null
  tier: string
  lp: number
  wins: number
  losses: number
  hotStreak: boolean
  role: string | null
  champions: { champion: number; games: number; wins: number }[]
  games: number
  pro: {
    slug: string
    name: string
    photo?: string
    team: { id: string; slug: string; name: string; shortName: string | null } | null
  } | null
  move: { lp: number; places: number } | null
  score: number | null
  scoreGames: number
}

/**
 * `/leaderboards/solo`: a server's Challenger, Grandmaster and Master, as the crawler last read
 * each league whole (app/services/ladder_service.ts). The podium, the cutoffs with their line once
 * reads are kept, the role filter with each role's share, and the table.
 */
const props = defineProps<{
  region: { slug: string; label: string; platform: string }
  regions: { slug: string; label: string }[]
  filters: { role: string | null; tier: string | null; pros: boolean; q: string | null }
  podium: Row[]
  cutoffs: {
    tier: 'CHALLENGER' | 'GRANDMASTER'
    lp: number | null
    players: number
    at: number | null
    change: number | null
  }[]
  cutoffLines: {
    CHALLENGER: { at: number; lp: number }[]
    GRANDMASTER: { at: number; lp: number }[]
  }
  movesSince: number | null
  roles: { role: string; players: number; share: number }[]
  tiers: { tier: string; players: number; readAt: number | null }[]
  updatedAt: number | null
  rows: Row[]
  total: number
  players: number
  page: number
  pages: number
  pageSize: number
  rule: { windowDays: number; scoreGames: number }
  description: string
}>()

const query = computed(() => ({
  region: props.region.slug === 'euw' ? null : props.region.slug,
  role: props.filters.role,
  tier: props.filters.tier,
  pros: props.filters.pros,
  q: props.filters.q,
}))
const href = (changes: Record<string, string | number | boolean | null>) =>
  withQuery('/leaderboards/solo', query.value, changes)

const regionSlug = ref(props.region.slug)
watch(regionSlug, (slug) => router.visit(href({ region: slug === 'euw' ? null : slug })))
const tier = ref(props.filters.tier ?? 'all')
watch(tier, (t) => router.visit(href({ tier: t === 'all' ? null : t }), { preserveScroll: true }))
const tierOptions = [
  { value: 'all', label: 'Every apex tier' },
  { value: 'challenger', label: 'Challenger' },
  { value: 'grandmaster', label: 'Grandmaster' },
  { value: 'master', label: 'Master' },
]

const search = ref(props.filters.q ?? '')
let typing: ReturnType<typeof setTimeout> | null = null
watch(search, (q) => {
  if (typing) clearTimeout(typing)
  typing = setTimeout(
    () =>
      router.visit(href({ q: q.trim() || null }), { preserveScroll: true, preserveState: true }),
    350
  )
})

const shares = computed(() =>
  Object.fromEntries(props.roles.map((r) => [laneOf(r.role)!, r.share]))
)
const updated = computed(() => since(props.updatedAt))
const line = computed(() => linePath(props.cutoffLines.CHALLENGER, 420, 52))
const lineGain = computed(() => {
  const l = props.cutoffLines.CHALLENGER
  return l.length >= 2 ? l.at(-1)!.lp - l[0].lp : null
})
/** "24 hours" when the moves read a day back, else the day they read from. */
const movesHead = computed(() => {
  if (!props.movesSince || !props.updatedAt) return null
  const h = (props.updatedAt - props.movesSince) / 3_600_000
  return h <= 30 ? '24 hours' : `Since ${dayMonth(props.movesSince)}`
})

/** The UTC midnight the cutoffs move at, as "in 6 h 12 min" from now (the browser's clock). */
const nextReset = ref('')
if (typeof window !== 'undefined') {
  const tick = () => {
    const now = new Date()
    const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    const min = Math.round((next - now.getTime()) / 60_000)
    nextReset.value = `in ${Math.floor(min / 60)} h ${min % 60} min`
  }
  tick()
  setInterval(tick, 60_000)
}

const topChampion = (r: Row) => r.champions[0] ?? null
const share = (r: Row) => {
  const c = topChampion(r)
  return c && r.games ? Math.round((c.games / r.games) * 100) : null
}
</script>

<template>
  <Head :title="`Solo/Duo ladder, ${region.label}`">
    <meta name="description" :content="description" />
  </Head>
  <SiteLayout>
    <div class="wrap">
      <section class="mast">
        <nav class="crumbs" aria-label="Breadcrumb">
          <Link href="/leaderboards/solo">Leaderboards</Link><Icon name="chevr" />
          <span class="t1">Solo/Duo</span>
        </nav>
        <div class="lb-mt">
          <div class="col" style="gap: 8px">
            <h1 class="h1">Solo/Duo ladder</h1>
            <span class="meta"
              >{{ region.label }}, ranked solo and duo<template v-if="updated"
                >, updated {{ updated }}</template
              ></span
            >
          </div>
          <div class="row" style="gap: 8px; margin-left: auto">
            <Select
              v-model="regionSlug"
              label="Region"
              :options="regions.map((r) => ({ value: r.slug, label: r.label }))"
              width="11rem"
              align="right"
            />
          </div>
        </div>
      </section>

      <EmptyState
        v-if="!players"
        icon="chart"
        :title="`No ${region.label} ladder stored yet`"
        line="The ladder appears once its Challenger, Grandmaster and Master leagues have been read."
      />

      <template v-else>
        <div class="lb-top">
          <Link
            v-for="(p, i) in podium"
            :key="p.place"
            class="lb-pod"
            :href="(p.pro ? `/pro/${p.pro.slug}` : playerPath(p.gameName, p.tagLine)) ?? '#'"
          >
            <span class="lb-no" :class="{ g: i === 0 }">#{{ p.place }}</span>
            <Frame
              :src="topChampion(p) ? `/cdn/loading/${topChampion(p)!.champion}.jpg` : null"
              eager
            />
            <span class="lb-pb">
              <span class="row meta" style="gap: 7px"
                ><RoleIcon v-if="laneOf(p.role)" :lane="laneOf(p.role)!" :size="15" /><template
                  v-if="topChampion(p)"
                  >{{ roleLabel(p.role) || 'Every role' }},
                  {{ championName(topChampion(p)!.champion) }} in {{ share(p) }}% of games</template
                ></span
              >
              <span class="col" style="gap: 14px">
                <span class="lb-pn2">
                  <span v-if="p.pro?.photo" class="lb-pp" style="width: 34px; height: 34px"
                    ><img :src="`/cdn/pro/${p.pro.slug}?s=48&v=${p.pro.photo}`" alt=""
                  /></span>
                  <Frame v-else :src="`/cdn/profile-icon/${p.icon ?? 29}.png`" size="s" />
                  <span class="col" style="min-width: 0">
                    <span class="h2 ell">{{ p.pro?.name ?? p.gameName ?? 'Unknown player' }}</span>
                    <span class="meta">{{
                      p.pro ? (p.pro.team?.name ?? 'Pro') : p.tagLine ? `#${p.tagLine}` : ''
                    }}</span>
                  </span>
                </span>
                <span class="row" style="gap: 8px">
                  <RankEmblem :tier="p.tier" :size="28" />
                  <span class="fg-s">{{ n(p.lp) }}<span class="u">LP</span></span>
                  <span class="meta" style="margin-left: 4px"
                    >{{ n(p.wins) }}W {{ n(p.losses) }}L,
                    {{ winPct(p.wins, p.wins + p.losses) }}</span
                  >
                </span>
                <span class="row" style="gap: 10px">
                  <span class="row" style="gap: 4px">
                    <Frame
                      v-for="c in p.champions"
                      :key="c.champion"
                      :src="champIcon(c.champion)"
                      :width="28"
                      size="xs"
                    />
                  </span>
                  <span style="margin-left: auto"><ScoreDial :value="p.score" size="sm" /></span>
                </span>
              </span>
            </span>
          </Link>
        </div>

        <section class="card lb-cs" :class="{ c3: !line.line }">
          <div v-for="c in cutoffs" :key="c.tier">
            <RankEmblem :tier="c.tier" :size="40" />
            <span class="col" style="gap: 3px">
              <span class="lab">{{ tierWord(c.tier) }}</span>
              <span class="fg-m num"
                >{{ c.lp === null ? '–' : n(c.lp) }}<span class="u">LP</span></span
              >
              <span class="meta"
                ><template v-if="c.change !== null && movesHead"
                  ><span :class="{ vi: c.change > 0 }">{{ signedN(c.change) }}</span>
                  {{ movesHead === '24 hours' ? 'today' : movesHead.toLowerCase() }}, </template
                >{{ n(c.players) }} players</span
              >
            </span>
          </div>
          <div v-if="line.line" class="m">
            <span class="lb-cx"
              ><span class="lab">Challenger cutoff, last 30 days</span
              ><span v-if="lineGain !== null" class="meta num vi"
                >{{ signedN(lineGain) }} LP</span
              ></span
            >
            <div class="lb-chart">
              <svg class="fade" viewBox="0 0 420 52" preserveAspectRatio="none" aria-hidden="true">
                <path class="area" :d="line.area" />
              </svg>
              <svg viewBox="0 0 420 52" preserveAspectRatio="none" aria-hidden="true">
                <path class="lb-gd" d="M0 51.5 H420" />
                <path class="ln" :d="line.line" />
              </svg>
              <span
                v-if="line.last"
                class="dt"
                :style="{ left: `${line.last.x}%`, top: `${line.last.y}%` }"
              />
            </div>
          </div>
          <div class="n">
            <span class="lab">Cutoffs move at</span>
            <span class="h4">00:00 UTC</span>
            <span class="meta">{{ nextReset }}</span>
          </div>
        </section>

        <div class="lb-filt">
          <RoleFilter :active="filters.role" :shares="shares" :href="(role) => href({ role })" />
          <Select v-model="tier" :options="tierOptions" width="13rem" />
          <Link
            class="chk"
            :href="href({ pros: !filters.pros })"
            preserve-scroll
            role="switch"
            :aria-checked="filters.pros"
            ><span class="switch" :class="{ on: filters.pros }"></span>Pros only</Link
          >
          <label class="field" style="margin-left: auto; width: 280px">
            <Icon name="search" />
            <input
              v-model="search"
              type="text"
              placeholder="Find a player"
              aria-label="Find a player"
            />
          </label>
        </div>

        <section class="card">
          <div class="lb-h lb-so">
            <span class="lb-n" style="font-weight: 650">#</span>
            <span>Player</span>
            <span>Role</span>
            <span>Rank</span>
            <span>{{ movesHead ?? 'Last read' }}</span>
            <span>Win rate, season</span>
            <span>Score</span>
            <span>Most played</span>
          </div>
          <EmptyState
            v-if="!rows.length"
            compact
            icon="search"
            title="No player matches these filters"
          />
          <Link
            v-for="r in rows"
            :key="r.place"
            class="lb-r lb-so"
            :href="(r.pro ? `/pro/${r.pro.slug}` : playerPath(r.gameName, r.tagLine)) ?? '#'"
          >
            <span class="lb-n">{{ r.place }}</span>
            <LadderPlayer
              :game-name="r.gameName"
              :tag-line="r.tagLine"
              :icon="r.icon"
              :level="r.level"
              :pro="r.pro"
            />
            <span class="meta lb-role"
              ><RoleIcon v-if="laneOf(r.role)" :lane="laneOf(r.role)!" :size="15" />{{
                roleLabel(r.role) || '–'
              }}</span
            >
            <span class="row" style="gap: 9px">
              <RankEmblem :tier="r.tier" :size="26" />
              <span class="col">
                <span class="h5 num">{{ n(r.lp) }} LP</span>
                <span class="meta">{{ tierWord(r.tier) }}</span>
              </span>
            </span>
            <span>
              <template v-if="r.move">
                <span class="h5 num" :class="r.move.lp > 0 ? 'wn' : r.move.lp < 0 ? 'ls' : ''">{{
                  r.move.lp ? `${signedN(r.move.lp)} LP` : '–'
                }}</span>
                <span v-if="r.move.places" class="meta lb-mv"
                  >{{ r.move.places > 0 ? '▲' : '▼' }} {{ Math.abs(r.move.places) }}
                  {{ Math.abs(r.move.places) === 1 ? 'place' : 'places' }}</span
                >
              </template>
              <span v-else class="t3">–</span>
            </span>
            <span class="col" style="gap: 5px">
              <span class="h5 num"
                >{{ winPct(r.wins, r.wins + r.losses) }}
                <span class="meta">{{ n(r.wins) }}W {{ n(r.losses) }}L</span></span
              >
              <span class="split"
                ><i :style="{ width: winPct(r.wins, r.wins + r.losses) }"></i><b></b
              ></span>
            </span>
            <span><ScoreDial :value="r.score" size="sm" /></span>
            <span class="row" style="gap: 4px">
              <Frame
                v-for="c in r.champions"
                :key="c.champion"
                :src="champIcon(c.champion)"
                :width="30"
                size="xs"
                :alt="championName(c.champion)"
              />
            </span>
          </Link>
          <LadderPager
            :page="page"
            :pages="pages"
            :total="total"
            :page-size="pageSize"
            :noun="
              filters.role || filters.tier || filters.pros || filters.q ? 'players' : 'apex players'
            "
            :href="
              (p) => withQuery('/leaderboards/solo', { ...query, page: undefined }, { page: p })
            "
          />
        </section>
        <p class="meta lb-note">
          Score: the average Invade score of a player's last {{ rule.scoreGames }} stored games.
          Role and most played: their stored ranked games of the last {{ rule.windowDays }} days.
          Win rate: the whole season, as Riot's ladder counts it.
        </p>
      </template>
    </div>
  </SiteLayout>
</template>
