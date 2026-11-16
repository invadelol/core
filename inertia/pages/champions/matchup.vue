<script setup lang="ts">
import { computed } from 'vue'
import { Deferred, Head, Link, usePage } from '@inertiajs/vue3'
import '../../css/tier-lists.css'
import '../../css/champion.css'
import SiteLayout from '../../components/SiteLayout.vue'
import CardHead from '../../components/ui/CardHead.vue'
import WinRate from '../../components/ui/WinRate.vue'
import Icon from '../../components/ui/Icon.vue'
import TierChip from '../../components/ui/TierChip.vue'
import Skeleton from '../../components/ui/Skeleton.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import StatFilters from '../../components/champions/StatFilters.vue'
import { nameOf } from '../../lib/assets.js'
import {
  BRACKETS,
  abilityUrl,
  champIconUrl,
  itemUrl,
  perkUrl,
  roleOf,
  spellUrl,
  splashUrl,
  type RoleStat,
} from '../../lib/champions.js'
import { patchName } from '../../lib/patches.js'
import { thousands, withQuery } from '../../lib/tier_lists.js'

interface Matchup {
  champion: number
  games: number
  win: number
  level: number
}
interface Side {
  averages: { games: number; kda: number; csPerMin: number; damage: number; length: number } | null
  early: { minute: number; ahead: number; aheadWin: number | null }[] | null
  firstBlood: { kill: number; assist: number } | null
  runes: { games: number; win: number; page: { page: { keystone: number; primary: number[]; secondary: number[] }; win: number } | null } | null
  spells: { pair: { spells: number[]; win: number } | null } | null
  build: {
    starter: { items: number[]; win: number } | null
    core: { items: number[]; win: number } | null
    boots: { items: number[]; win: number } | null
  } | null
  skills: { max: string[]; order: { win: number } | null } | null
  matchups: Matchup[]
  against: Matchup | null
  labels: Record<'item' | 'rune' | 'spell', Record<string, string>> | null
}

const props = defineProps<{
  champion: { id: number; name: string; slug: string }
  opponent: { id: number; name: string; slug: string }
  position: string
  main: string | null
  stat: RoleStat | null
  opponentStat: RoleStat | null
  expected: number | null
  ranked: number
  games: number
  patches: { patch: string; games: number }[]
  filter: { patch: string; bracket: string; region: string | null } | null
  names: Record<number, [string, string]>
  mine?: Side | null
  theirs?: Side | null
}>()
const page = usePage()

const role = computed(() => roleOf(props.position))
const query = computed(() => (page.url.includes('?') ? `?${page.url.split('?')[1]}` : ''))
const champName = (id: number) => props.names[id]?.[0] ?? ''
const champSlug = (id: number) => props.names[id]?.[1] ?? String(id)
const champHref = (slug: string) => withQuery(`/champions/${slug}${query.value}`, { role: role.value.slug })
const vsHref = (a: string, b: string) => withQuery(`/champions/${a}/matchups/${b}${query.value}`, { role: role.value.slug })

const against = computed(() => props.mine?.against ?? null)
const myWin = computed(() => against.value?.win ?? null)
const fmt2 = (x: number | null | undefined) => (x === null || x === undefined ? '–' : (x * 100).toFixed(2))
const fmt1 = (x: number | null | undefined) => (x === null || x === undefined ? '–' : (x * 100).toFixed(1))
const rankLabel = computed(() => BRACKETS.find((b) => b.value === props.filter?.bracket)?.label ?? '')
const gap = computed(() =>
  myWin.value !== null && props.expected !== null ? (myWin.value - props.expected) * 100 : null
)
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

/* ── Head to head: each champion against every opponent ──────── */
const at15 = (s?: Side | null) => s?.early?.find((e) => e.minute === 15) ?? null
const fb = (s?: Side | null) => (s?.firstBlood ? s.firstBlood.kill + s.firstBlood.assist : null)
const h2h = computed(() => {
  const a = props.mine
  const b = props.theirs
  const rows: { label: string; a: number | null; b: number | null; text: (v: number) => string }[] = [
    { label: 'Win rate, all opponents', a: props.stat?.win ?? null, b: props.opponentStat?.win ?? null, text: (v) => `${fmt2(v)}%` },
    { label: 'Pick rate', a: props.stat?.pick ?? null, b: props.opponentStat?.pick ?? null, text: (v) => `${fmt2(v)}%` },
    { label: 'Ban rate', a: props.stat?.ban ?? null, b: props.opponentStat?.ban ?? null, text: (v) => `${fmt2(v)}%` },
    { label: 'KDA', a: a?.averages?.kda ?? null, b: b?.averages?.kda ?? null, text: (v) => v.toFixed(2) },
    { label: 'CS per minute', a: a?.averages?.csPerMin ?? null, b: b?.averages?.csPerMin ?? null, text: (v) => v.toFixed(1) },
    { label: 'Damage to champions', a: a?.averages?.damage ?? null, b: b?.averages?.damage ?? null, text: (v) => thousands(v) },
    { label: 'Ahead at 15 minutes', a: at15(a)?.ahead ?? null, b: at15(b)?.ahead ?? null, text: (v) => `${fmt1(v)}%` },
    { label: 'Win rate when ahead at 15', a: at15(a)?.aheadWin ?? null, b: at15(b)?.aheadWin ?? null, text: (v) => `${fmt1(v)}%` },
    { label: 'Takes part in first blood', a: fb(a), b: fb(b), text: (v) => `${fmt1(v)}%` },
    { label: 'Average game', a: a?.averages?.length ?? null, b: b?.averages?.length ?? null, text: clock },
  ]
  return rows.filter((r) => r.a !== null && r.b !== null)
})

/** A side's share of a head-to-head bar (both sides fill it together). */
const part = (x: number, y: number) => Math.max(1, Math.round((Math.max(x, 0) / Math.max(x + y, 1e-9)) * 1000))

/* ── Builds ─────────────────────────────────────────────────── */
const label = (s: Side | null | undefined, kind: 'item' | 'rune' | 'spell', id: number) =>
  s?.labels?.[kind]?.[id] ?? nameOf(kind, id) ?? ''

/* ── Lanes ──────────────────────────────────────────────────── */
const mostPlayed = computed(() => (props.mine?.matchups ?? []).slice(0, 6))
const hardestForThem = computed(() => {
  const list = props.theirs?.matchups ?? []
  const total = list.reduce((n, m) => n + m.games, 0)
  const gate = Math.max(30, total * 0.02)
  return list
    .filter((m) => m.games >= gate)
    .sort((x, y) => x.win - y.win)
    .slice(0, 6)
})
const tabs = computed(() => [
  { label: 'Overview', href: page.url, on: true },
  { label: 'Build', href: `${champHref(props.champion.slug)}#items`, on: false },
  { label: 'Runes', href: `${champHref(props.champion.slug)}#runes`, on: false },
  {
    label: `All ${props.champion.name} matchups`,
    href: `${champHref(props.champion.slug)}#matchups`,
    on: false,
    n: props.mine?.matchups.length ?? null,
  },
])
</script>

<template>
  <Head :title="`${champion.name} vs ${opponent.name}`" />
  <SiteLayout>
    <div class="wrap">
      <div class="mast mu-mast">
        <nav class="crumbs" aria-label="Breadcrumb">
          <Link href="/tier-list">Tier list</Link><Icon name="chevr" :size="12" /><Link :href="champHref(champion.slug)">{{
            champion.name
          }}</Link><Icon name="chevr" :size="12" /><span class="t1" aria-current="page">Against {{ opponent.name }}</span>
        </nav>
        <StatFilters :filter="filter" :patches="patches" />
      </div>

      <section class="card mu2">
        <Link class="fr l art2" :href="champHref(champion.slug)"
          ><img :src="splashUrl(champion.id)" alt="" /><span class="cap"
            ><span class="h1">{{ champion.name }}</span><TierChip :tier="stat?.tier ?? null" /></span
        ></Link>
        <div class="mu-mid">
          <div class="row" style="justify-content: center; gap: 16px">
            <span class="fg-xl">{{ fmt2(myWin) }}<span class="u">%</span></span><span class="meta">vs</span
            ><span class="fg-xl t3">{{ myWin === null ? '–' : (100 - myWin * 100).toFixed(2) }}<span class="u">%</span></span>
          </div>
          <WinRate class="mu-wr" :rate="myWin ?? 0.5" bare :width="260" style="margin-top: 14px" />
          <p class="meta" style="margin-top: 12px">
            {{ role.label }}, {{ rankLabel }}<template v-if="filter">, patch {{ patchName(filter.patch) }}</template
            ><template v-if="against">, {{ thousands(against.games) }} games</template>
          </p>
          <Link class="btn sm" :href="vsHref(opponent.slug, champion.slug)" style="margin-top: 14px"
            ><Icon name="compare" />Swap sides</Link
          >
        </div>
        <Link class="fr l art2 r" :href="champHref(opponent.slug)"
          ><img :src="splashUrl(opponent.id)" alt="" /><span class="cap"
            ><TierChip :tier="opponentStat?.tier ?? null" /><span class="h1">{{ opponent.name }}</span></span
          ></Link
        >
      </section>

      <nav class="tabs" style="margin-top: 24px" aria-label="Matchup">
        <Link v-for="t in tabs" :key="t.label" :href="t.href" :class="{ on: t.on }"
          >{{ t.label }}<span v-if="t.n" class="n">{{ t.n }}</span></Link
        >
      </nav>

      <EmptyState v-if="!filter" title="No ranked games stored yet" line="This page fills in once our crawler has read the patch's games." />
      <Deferred v-else :data="['mine', 'theirs']">
        <template #fallback>
          <section class="sec side2" style="padding-top: 28px">
            <div class="stk"><div class="card"><Skeleton :rows="10" /></div></div>
            <div class="stk"><div class="card"><Skeleton :rows="6" pic /></div></div>
          </section>
        </template>
        <section class="sec side2" style="padding-top: 28px">
          <div class="stk">
            <div class="card mu-sum">
              <div><span class="fg-m">{{ fmt2(myWin) }}%</span><span class="meta">{{ champion.name }} wins</span></div>
              <div><span class="fg-m">{{ against ? thousands(against.games) : '–' }}</span><span class="meta">Games this patch</span></div>
              <div><span class="fg-m">{{ fmt2(expected) }}%</span><span class="meta">Expected from both win rates</span></div>
              <div>
                <span class="fg-m" :class="gap === null ? '' : gap >= 0 ? 'wn' : 'ls'">{{ gap === null ? '–' : `${gap >= 0 ? '+' : '−'}${Math.abs(gap).toFixed(2)}` }}</span
                ><span class="meta">Against expectation</span>
              </div>
            </div>

            <div class="card">
              <CardHead title="Head to head" icon="compare" :meta="`Violet is ${champion.name}`" />
              <div v-for="r in h2h" :key="r.label" class="h2x">
                <span class="fg-xs num">{{ r.text(r.a!) }}</span>
                <span class="m4"
                  >{{ r.label }}<span class="sp2"><i :style="{ flex: part(r.a!, r.b!) }" /><i :style="{ flex: part(r.b!, r.a!) }" /></span
                ></span>
                <span class="fg-xs num" style="text-align: right">{{ r.text(r.b!) }}</span>
              </div>
              <div style="height: 10px" />
            </div>

            <div class="card">
              <CardHead title="Builds" icon="route" meta="Most played, all opponents" />
              <div class="bvs3">
                <div v-for="[who, s] in ([[champion, mine], [opponent, theirs]] as const)" :key="who.id">
                  <div class="card-h">
                    <span class="fr xs" style="width: 26px; height: 26px"><img :src="champIconUrl(who.id)" alt="" /></span><span class="h4">{{ who.name }}</span>
                  </div>
                  <div v-if="s?.runes?.page" class="bln">
                    <span class="lab">Runes</span>
                    <span class="ic2"
                      ><img class="rn" :src="perkUrl(s.runes.page.page.keystone)" :alt="label(s, 'rune', s.runes.page.page.keystone)" style="width: 34px; height: 34px" /><img
                        v-for="id in [...s.runes.page.page.primary, ...s.runes.page.page.secondary]"
                        :key="id"
                        class="rn"
                        :src="perkUrl(id)"
                        :alt="label(s, 'rune', id)"
                        style="width: 26px; height: 26px"
                    /></span>
                    <span class="fg-xs num" style="text-align: right">{{ fmt1(s.runes.page.win) }}<span class="u">%</span></span>
                  </div>
                  <div v-if="s?.spells?.pair" class="bln">
                    <span class="lab">Spells</span>
                    <span class="ic2"><img v-for="id in s.spells.pair.spells" :key="id" :src="spellUrl(id)" :alt="label(s, 'spell', id)" /></span>
                    <span class="fg-xs num" style="text-align: right">{{ fmt1(s.spells.pair.win) }}<span class="u">%</span></span>
                  </div>
                  <div v-for="[k, set] in ([['Start', s?.build?.starter], ['Core', s?.build?.core], ['Boots', s?.build?.boots]] as const)" :key="k">
                    <div v-if="set" class="bln">
                      <span class="lab">{{ k }}</span>
                      <span class="ic2"><img v-for="(id, i) in [...new Set(set.items)]" :key="i" :src="itemUrl(id)" :alt="label(s, 'item', id)" /></span>
                      <span class="fg-xs num" style="text-align: right">{{ fmt1(set.win) }}<span class="u">%</span></span>
                    </div>
                  </div>
                  <div v-if="s?.skills?.max?.length" class="bln">
                    <span class="lab">Skill max</span>
                    <span class="ic2"
                      ><template v-for="(k, i) in s.skills.max" :key="k"
                        ><img :src="abilityUrl(who.id, k)" :alt="k" /><span v-if="i < s.skills.max.length - 1" class="t4">›</span></template
                      ></span
                    >
                    <span class="fg-xs num" style="text-align: right">{{ s.skills.order ? fmt1(s.skills.order.win) : '–' }}<span v-if="s.skills.order" class="u">%</span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="stk">
            <div class="card">
              <CardHead :title="`${champion.name}’s most played lanes`" icon="swords" :more="{ label: 'All', href: `${champHref(champion.slug)}#matchups` }" />
              <Link
                v-for="m in mostPlayed"
                :key="m.champion"
                class="lrow"
                :href="vsHref(champion.slug, champSlug(m.champion))"
                :style="m.champion === opponent.id ? { background: 'rgb(var(--v-rgb) / .08)' } : {}"
              >
                <span class="fr s" style="width: 36px; height: 36px"><img :src="champIconUrl(m.champion)" alt="" /></span>
                <span class="col grow"><span class="h4">{{ champName(m.champion) }}</span><span class="meta">{{ thousands(m.games) }} games</span></span>
                <span class="fg-xs num">{{ fmt2(m.win) }}<span class="u">%</span></span>
              </Link>
              <p v-if="!mostPlayed.length" class="meta cp-none">Too few games against one opponent yet.</p>
            </div>
            <div class="card">
              <CardHead :title="`Hardest lanes for ${opponent.name}`" icon="shield" :more="{ label: 'All', href: `${champHref(opponent.slug)}#matchups` }" />
              <Link v-for="m in hardestForThem" :key="m.champion" class="lrow" :href="vsHref(opponent.slug, champSlug(m.champion))">
                <span class="fr s" style="width: 36px; height: 36px"><img :src="champIconUrl(m.champion)" alt="" /></span>
                <span class="col grow"><span class="h4">{{ champName(m.champion) }}</span><span class="meta">{{ thousands(m.games) }} games</span></span>
                <span class="fg-xs num">{{ fmt2(m.win) }}<span class="u">%</span></span>
              </Link>
              <p v-if="!hardestForThem.length" class="meta cp-none">Too few games against one opponent yet.</p>
            </div>
          </div>
        </section>
      </Deferred>
    </div>
  </SiteLayout>
</template>
