<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { Head, Link, usePage } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import '../../css/tier-lists.css'
import '../../css/champion.css'
import SiteLayout from '../../components/SiteLayout.vue'
import CardHead from '../../components/ui/CardHead.vue'
import Icon from '../../components/ui/Icon.vue'
import TierChip from '../../components/ui/TierChip.vue'
import Skeleton from '../../components/ui/Skeleton.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import SortHead from '../../components/ui/SortHead.vue'
import { useSort } from '../../components/ui/sort.js'
import StatFilters from '../../components/champions/StatFilters.vue'
import { nameOf } from '../../lib/assets.js'
import {
  RANK_GROUPS,
  abilityUrl,
  champIconUrl,
  itemUrl,
  laneOf,
  perkUrl,
  roleOf,
  spellUrl,
  splashUrl,
  styleUrl,
  type BuildStats,
  type ChampionEntry,
  type ChampionTab,
  type Filter,
  type Matchup,
  type ProGame,
  type ProTag,
  type RoleStat,
  type RuneStats,
  type RuneTrees,
  type Skills,
  type SpellStats,
} from '../../lib/champions.js'
import { patchName } from '../../lib/patches.js'
import { p1, thousands, withQuery } from '../../lib/tier_lists.js'
import { rememberChampion } from '../../lib/recent.js'

type Labels = Record<'item' | 'rune' | 'spell', Record<string, string>>
interface Early {
  minute: number
  games: number
  goldDiff: number
  ahead: number
  aheadWin: number | null
  behindWin: number | null
}
interface Profile {
  length: { minutes: number; games: number; win: number }[]
  averages: {
    games: number
    kills: number
    deaths: number
    assists: number
    kda: number
    csPerMin: number
    gold: number
    damage: number
    vision: number
    length: number
  } | null
}
interface Details {
  games: number
  damageTaken: number
  damageToTurrets: number
  damageToObjectives: number
  wardsPlaced: number
  wardsCleared: number
  controlWards: number
  level: number
  jungleMonsters: number
  damageSplit: { physical: number; magic: number; true: number }
}
interface FirstBlood {
  games: number
  kill: number
  assist: number
  victim: number
  involvedWin: number | null
}
type ByRank = { group: string; games: number; win: number | null; pick: number; tier: number | null }[]
type ProGames = {
  games: (ProGame & { league: { slug: string; code: string; name: string } | null })[]
  players: { pro: ProTag; games: number; wins: number }[]
}

/** `/champions/:slug`: one champion in one role, every section on one page. */
const props = defineProps<{
  champion: ChampionEntry
  text: { title: string; abilities: Partial<Record<'p' | 'q' | 'w' | 'e' | 'r', string>> } | null
  section: ChampionTab | null
  position: string
  main: string | null
  roles: { position: string; games: number; roleShare: number }[]
  stat: RoleStat | null
  before: { win: number; pick: number; rank: number | null } | null
  previousPatch: string | null
  ranked: number
  games: number
  patches: { patch: string; games: number }[]
  filter: Filter | null
  data: Record<string, any> | null
  labels: Labels | null
  names: Record<number, [string, string]>
  build?: BuildStats | null
  runes?: RuneStats | null
  spells?: SpellStats | null
  skills?: Skills | null
  matchups?: Matchup[] | null
  trees?: RuneTrees | null
  profile?: Profile | null
  early?: Early[] | null
  firstBlood?: FirstBlood | null
  byRank?: ByRank | null
  details?: Details | null
  pros?: ProGames | null
}>()
const page = usePage()

onMounted(() =>
  watch(
    () => props.champion.slug,
    () => rememberChampion(props.champion),
    { immediate: true }
  )
)
onMounted(() => {
  if (props.section) document.getElementById(props.section === 'statistics' ? 'stats' : props.section)?.scrollIntoView()
})

type Block =
  | 'build'
  | 'runes'
  | 'spells'
  | 'skills'
  | 'matchups'
  | 'trees'
  | 'profile'
  | 'early'
  | 'firstBlood'
  | 'byRank'
  | 'details'
  | 'pros'
/** A block: sent with the page, arrived since, or still on its way (undefined). */
const block = (key: Block): any =>
  props.data && key in props.data ? props.data[key] : (props as Record<string, any>)[key]
const waiting = (...keys: Block[]) => !!props.filter && keys.some((k) => block(k) === undefined)

const build = computed(() => block('build') as BuildStats | null | undefined)
const runes = computed(() => block('runes') as RuneStats | null | undefined)
const spells = computed(() => block('spells') as SpellStats | null | undefined)
const skills = computed(() => block('skills') as Skills | null | undefined)
const trees = computed(() => block('trees') as RuneTrees | null | undefined)
const matchups = computed(() => (block('matchups') ?? []) as Matchup[])
const profile = computed(() => block('profile') as Profile | null | undefined)
const early = computed(() => (block('early') ?? []) as Early[])
const firstBlood = computed(() => block('firstBlood') as FirstBlood | null | undefined)
const byRank = computed(() => (block('byRank') ?? []) as ByRank)
const details = computed(() => block('details') as Details | null | undefined)
const pros = computed(() => block('pros') as ProGames | null | undefined)

/* ── The tables' heads sort them (rank order, most met, latest first by default) ── */
const rankSort = useSort(byRank, {
  games: (r) => r.games,
  win: (r) => r.win,
  pick: (r) => r.pick,
  tier: (r) => (r.tier === null ? null : -r.tier),
})
const matchupSort = useSort(matchups, {
  name: (m) => champName(m.champion),
  games: (m) => m.games,
  win: (m) => m.win,
}, { first: { name: 'asc' } })
const proSort = useSort(() => pros.value?.games.slice(0, 12) ?? [], {
  name: (g) => g.pro?.name ?? '',
  kda: (g) => (g.kills + g.assists) / Math.max(1, g.deaths),
  win: (g) => (g.win ? 1 : 0),
  when: (g) => g.startMs,
}, { first: { name: 'asc' } })

const role = computed(() => roleOf(props.position))
const roleWord = computed(() => role.value.label.toLowerCase())
const champName = (id: number) => props.names[id]?.[0] ?? nameOf('champion', id) ?? ''
const champSlug = (id: number) => props.names[id]?.[1] ?? String(id)
const label = (kind: 'item' | 'rune' | 'spell', id: number) =>
  props.labels?.[kind]?.[id] ?? nameOf(kind === 'rune' ? 'rune' : kind, id) ?? ''
const styleName = (id: number) => trees.value?.styles[id]?.name ?? nameOf('runeStyle', id) ?? ''
const matchupHref = (id: number) =>
  withQuery(`/champions/${props.champion.slug}/matchups/${champSlug(id)}${page.url.includes('?') ? `?${page.url.split('?')[1]}` : ''}`, {
    role: role.value.slug,
  })

/* ── Head ───────────────────────────────────────────────────── */
const ORD = (n: number) => (({ 1: '1st', 2: '2nd', 3: '3rd' }) as Record<number, string>)[n] ?? `${n}th`
const title = computed(() => {
  const t = props.text?.title
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : null
})
const share = computed(() => props.roles.find((r) => r.position === props.position)?.roleShare)
const sentence = computed(() => {
  const parts: string[] = []
  if (title.value) parts.push(`${title.value}.`)
  if (props.stat?.rank) parts.push(`${ORD(props.stat.rank)} of the ${roleWord.value} lane,`)
  if (share.value !== undefined) parts.push(`played ${roleWord.value} in ${Math.round(share.value * 100)}% of their games.`)
  return parts.join(' ').replace(/,$/, '.')
})
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
const ABILITIES = ['p', 'q', 'w', 'e', 'r'] as const

/* ── Tabs and filters ───────────────────────────────────────── */
const tabs = computed(() => [
  { key: 'build', label: 'Build', href: '#build' },
  { key: 'runes', label: 'Runes', href: '#runes' },
  { key: 'items', label: 'Items', href: '#items' },
  { key: 'skills', label: 'Skills', href: '#skills' },
  { key: 'matchups', label: 'Matchups', href: '#matchups', count: matchups.value.length || null },
  { key: 'stats', label: 'Statistics', href: '#stats' },
  { key: 'pros', label: 'Pros', href: '#pros' },
])
const roleTabs = computed(() =>
  props.roles
    .filter((r) => r.roleShare >= 0.05 || r.position === props.position)
    .map((r) => ({ ...r, role: roleOf(r.position), href: withQuery(page.url, { role: roleOf(r.position).slug }) }))
)

/* ── Runes ──────────────────────────────────────────────────── */
const page0 = computed(() => runes.value?.pages[0] ?? null)
const tree = computed(() => {
  const p = page0.value?.page
  const t = p && trees.value?.styles[p.primaryStyle]
  if (!p || !t) return null
  const chosen = new Set([p.keystone, ...p.primary])
  return {
    style: p.primaryStyle,
    keystones: (t.rows[0] ?? []).map((id) => ({ id, on: chosen.has(id) })),
    minors: t.rows.slice(1).flatMap((row) => row.map((id) => ({ id, on: chosen.has(id) }))),
  }
})

/* ── Spells and starting items ──────────────────────────────── */
const spellPairs = computed(() => (spells.value?.pairs ?? []).slice(0, 2))
const starter = computed(() => build.value?.starters[0] ?? null)
const starterText = (items: number[]) => {
  const counts = new Map<number, number>()
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1)
  return [...counts]
    .map(([i, n]) => {
      const nm = label('item', i)
      if (n === 1) return nm
      return /potion/i.test(nm) ? `${n} potions` : `${n} ${nm}`
    })
    .join(', ')
}
const starterIcons = (items: number[]) => {
  const counts = new Map<number, number>()
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1)
  return [...counts].map(([item, n]) => ({ item, n }))
}

/* ── Item path ──────────────────────────────────────────────── */
const core = computed(() => build.value?.cores[0] ?? null)
const fourth = computed(() => (build.value?.slots[0] ?? []).slice(0, 3))
const shortName = (id: number) => label('item', id).replace(/^(.+?)'s .*$/, "$1's").split(' ').slice(0, 2).join(' ')
const POS = ['first', 'second', 'third']
const otherCores = computed(() => {
  const main = core.value?.items ?? []
  return (build.value?.cores ?? []).slice(1, 4).map((c) => {
    const diff = c.items.map((i, k) => ({ i, k })).filter(({ i }) => !main.includes(i))
    const text = diff.length
      ? diff.map(({ i, k }) => `${shortName(i)} ${POS[k]}`).join(', ')
      : `${shortName(c.items[0])} first`
    return { ...c, text }
  })
})
const bootsRows = computed(() => (build.value?.boots ?? []).slice(0, 2))
const later = computed(() => {
  const main = new Set(core.value?.items ?? [])
  return (build.value?.items ?? []).filter((i) => !main.has(i.item)).slice(0, 5)
})
const laterMax = computed(() => Math.max(0.0001, ...later.value.map((i) => i.share)))

/* ── Skills ─────────────────────────────────────────────────── */
const order = computed(() => skills.value?.orders[0] ?? null)
const skillRows = computed(() =>
  (['Q', 'W', 'E', 'R'] as const).map((key) => ({
    key,
    name: props.text?.abilities[key.toLowerCase() as 'q'] ?? '',
    cells: Array.from({ length: 15 }, (_, i) => (order.value?.order[i] === key ? i + 1 : null)),
  }))
)

/* ── At 15 minutes ──────────────────────────────────────────── */
const at15 = computed(() => early.value.find((e) => e.minute === 15) ?? null)
const fbIn = computed(() => (firstBlood.value ? firstBlood.value.kill + firstBlood.value.assist : null))

/* ── Lanes ──────────────────────────────────────────────────── */
const common = computed(() => {
  const total = matchups.value.reduce((n, m) => n + m.games, 0)
  const gate = Math.max(30, total * 0.02)
  return matchups.value.filter((m) => m.games >= gate)
})
const hardest = computed(() => [...common.value].sort((a, b) => a.win - b.win).slice(0, 4))
const easiest = computed(() =>
  [...common.value]
    .sort((a, b) => b.win - a.win)
    .filter((m) => !hardest.value.includes(m))
    .slice(0, 4)
)
const loadingUrl = (id: number) => `/cdn/loading/${id}.jpg`

/* ── Win rate by game length ────────────────────────────────── */
const lengthChart = computed(() => {
  const pts = profile.value?.length ?? []
  if (pts.length < 2) return null
  const wins = pts.map((p) => p.win * 100)
  const lo = Math.floor(Math.min(...wins, 49) - 1)
  const hi = Math.ceil(Math.max(...wins, 51) + 1)
  const x = (i: number) => (i / (pts.length - 1)) * 100
  const y = (w: number) => 100 - ((w - lo) / (hi - lo)) * 100
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)} ${y(p.win * 100).toFixed(2)}`).join(' ')
  const area = `${line} L100 100 L0 100 Z`
  const peak = pts.reduce((b, p, i) => (p.win > pts[b].win ? i : b), 0)
  const most = pts.reduce((b, p) => (p.games > b.games ? p : b), pts[0])
  const step = hi - lo > 8 ? 4 : 2
  const gy = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) gy.push({ y: y(v), t: `${v}%` })
  return {
    line,
    area,
    gy,
    px: x(peak),
    py: y(pts[peak].win * 100),
    peak: `${Math.round(pts[peak].win * 100)}% at ${pts[peak].minutes} min`,
    xs: pts.map((p, i) => (i === 0 || i === pts.length - 1 ? `${p.minutes} min` : String(p.minutes))),
    most: `Most games end between ${most.minutes} and ${most.minutes + 5} minutes`,
    mid: y(50),
  }
})

/* ── Lower sections ─────────────────────────────────────────── */
const rankLabel = (g: string) => RANK_GROUPS.find((r) => r.value === g)?.label ?? g
const dmg = computed(() => details.value?.damageSplit ?? null)
const ago = (ms: number) => {
  const days = Math.floor((Date.now() - ms) / 86_400_000)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}
</script>

<template>
  <Head :title="`${champion.name} ${role.label.toLowerCase()}`" />
  <SiteLayout>
    <div class="wrap">
      <section id="build" class="cp-head cp-sec">
        <div class="col">
          <nav class="crumbs" aria-label="Breadcrumb">
            <Link href="/tier-list">Tier list</Link><Icon name="chevr" :size="12" /><Link
              :href="`/tier-list?role=${role.slug}`"
              >{{ role.label }}</Link
            ><Icon name="chevr" :size="12" /><span class="t2" aria-current="page">{{ champion.name }}</span>
          </nav>
          <div class="cp-id">
            <div class="fr pt" style="--cut: 14px"><img :src="champIconUrl(champion.id)" alt="" /></div>
            <div class="col" style="gap: 6px; min-width: 0">
              <div class="row" style="gap: 14px">
                <h1 class="d1">{{ champion.name }}</h1>
                <TierChip :tier="stat?.tier ?? null" large />
              </div>
              <span class="meta" style="font-size: 14px">{{ sentence }}</span>
              <div class="cp-abs">
                <span v-for="k in ABILITIES" :key="k" class="cp-ab" :title="text?.abilities[k] ?? ''"
                  ><img :src="abilityUrl(champion.id, k)" :alt="text?.abilities[k] ?? k.toUpperCase()" /><b>{{
                    k.toUpperCase()
                  }}</b></span
                >
              </div>
            </div>
          </div>
          <div class="cp-stats">
            <div><span class="lab">Win rate</span><span class="fg-l">{{ p1(stat?.win) }}<span class="u">%</span></span></div>
            <div><span class="lab">Pick rate</span><span class="fg-l">{{ p1(stat?.pick) }}<span class="u">%</span></span></div>
            <div><span class="lab">Ban rate</span><span class="fg-l">{{ p1(stat?.ban) }}<span class="u">%</span></span></div>
            <div><span class="lab">Games</span><span class="fg-l">{{ stat ? thousands(stat.games) : '–' }}</span></div>
            <div>
              <span class="lab">Average game</span
              ><span class="fg-l">{{ profile?.averages ? clock(profile.averages.length) : '–' }}</span>
            </div>
          </div>
        </div>
        <div class="fr l cp-art"><img :src="splashUrl(champion.id)" :alt="champion.name" /></div>
      </section>

      <div class="cp-tabs">
        <nav class="tabs" aria-label="Champion">
          <a v-for="t in tabs" :key="t.key" :href="t.href" :class="{ on: t.key === 'build' }"
            >{{ t.label }}<span v-if="t.count" class="n">{{ t.count }}</span></a
          >
        </nav>
        <div class="cp-ctl">
          <nav v-if="roleTabs.length > 1" class="seg" aria-label="Role">
            <Link v-for="r in roleTabs" :key="r.position" :href="r.href" :class="{ on: r.position === position }" preserve-scroll
              ><RoleIcon :lane="laneOf(r.position)" :size="16" />{{ r.role.label }}</Link
            >
          </nav>
          <StatFilters :filter="filter" :patches="patches" :region="false" />
        </div>
      </div>

      <EmptyState
        v-if="!filter"
        title="No ranked games stored yet"
        line="This page fills in once our crawler has read the patch's games."
      />
      <template v-else>
        <section class="g12" style="padding-top: 24px; align-items: start">
          <article id="runes" class="card cp-sec" style="grid-column: span 8">
            <CardHead
              title="Runes"
              icon="spark"
              :meta="page0 ? `${p1(page0.win)}% win rate in ${thousands(page0.games)} games` : null"
            >
              <Link class="btn sm" href="/app" style="margin-left: auto"><Icon name="download" />Get the app</Link>
            </CardHead>
            <Skeleton v-if="waiting('runes', 'trees')" :height="220" />
            <div v-else-if="page0" class="cp-runes">
              <div class="cp-tree">
                <template v-if="tree">
                  <div class="hd2"><img :src="styleUrl(tree.style)" alt="" /><span class="h5">{{ styleName(tree.style) }}</span></div>
                  <img v-for="r in tree.keystones" :key="r.id" class="k" :class="r.on ? 'on' : 'off'" :src="perkUrl(r.id)" :alt="label('rune', r.id)" />
                  <span class="sep" />
                  <img v-for="r in tree.minors" :key="r.id" class="r" :class="r.on ? 'on' : 'off'" :src="perkUrl(r.id)" :alt="label('rune', r.id)" />
                </template>
              </div>
              <span class="vr" />
              <div class="col" style="gap: 14px">
                <span class="lab">Keystone and primary</span>
                <div v-for="id in [page0.page.keystone, ...page0.page.primary]" :key="id" class="cp-pick">
                  <img :src="perkUrl(id)" alt="" /><span class="h5">{{ label('rune', id) }}</span>
                </div>
              </div>
              <span class="vr" />
              <div class="col" style="gap: 14px">
                <span class="lab row" style="gap: 6px"
                  ><img :src="styleUrl(page0.page.secondaryStyle)" alt="" style="width: 16px; height: 16px" />{{
                    styleName(page0.page.secondaryStyle)
                  }}</span
                >
                <div v-for="id in page0.page.secondary" :key="id" class="cp-pick">
                  <img :src="perkUrl(id)" alt="" /><span class="h5">{{ label('rune', id) }}</span>
                </div>
                <span class="lab" style="margin-top: 6px">Shards</span>
                <div v-for="(id, i) in page0.page.shards" :key="i" class="cp-pick">
                  <img class="sh" :src="perkUrl(id)" alt="" /><span class="sm t2">{{ label('rune', id) }}</span>
                </div>
              </div>
            </div>
            <p v-else class="meta cp-none">Too few games with runes stored for this filter.</p>
          </article>
          <div class="col" style="grid-column: span 4; gap: 24px">
            <article class="card">
              <CardHead title="Summoner spells" icon="flame" />
              <Skeleton v-if="waiting('spells')" :rows="2" />
              <div v-for="s in spellPairs" :key="s.spells.join()" class="cp-opt">
                <span class="pair"><img v-for="id in s.spells" :key="id" :src="spellUrl(id)" alt="" /></span>
                <div class="col grow" style="gap: 3px">
                  <span class="h5">{{ s.spells.map((id) => label('spell', id)).join(', ') }}</span>
                  <span class="meta">Picked in {{ p1(s.share) }}% of games</span>
                </div>
                <span class="fg-s">{{ p1(s.win) }}<span class="u">%</span></span>
              </div>
            </article>
            <article class="card">
              <CardHead title="Starting items" icon="shield" />
              <Skeleton v-if="waiting('build')" :rows="1" />
              <div v-if="starter" class="cp-opt">
                <span class="pair"><img v-for="o in starterIcons(starter.items)" :key="o.item" :src="itemUrl(o.item)" alt="" /></span>
                <div class="col grow" style="gap: 3px">
                  <span class="h5">{{ starterText(starter.items) }}</span>
                  <span class="meta">Picked in {{ p1(starter.share) }}% of games</span>
                </div>
                <span class="fg-s">{{ p1(starter.win) }}<span class="u">%</span></span>
              </div>
            </article>
          </div>
        </section>

        <section id="items" class="sec cp-sec" style="padding-top: 24px">
          <article class="card">
            <CardHead title="Item path" icon="route" :meta="`The most played order on ${patchName(filter.patch)}`" />
            <Skeleton v-if="waiting('build')" :height="160" />
            <template v-else-if="build && core">
              <div class="cp-path">
                <div v-if="starter" class="cp-stage">
                  <span class="lab">Start</span>
                  <div class="its">
                    <span v-for="o in starterIcons(starter.items)" :key="o.item" class="it"
                      ><span class="fr xs"><img :src="itemUrl(o.item)" :alt="label('item', o.item)" /></span
                      ><b v-if="o.n > 1">{{ o.n }}</b></span
                    >
                  </div>
                  <span class="meta"><b class="t1">{{ p1(starter.win) }}%</b>, {{ thousands(starter.games) }} games</span>
                </div>
                <span class="cp-arrow"><Icon name="chevr" /></span>
                <div v-if="build.boots[0]" class="cp-stage">
                  <span class="lab">Boots</span>
                  <div class="its">
                    <span class="it"><span class="fr xs"><img :src="itemUrl(build.boots[0].items[0])" alt="" /></span></span>
                  </div>
                  <span class="meta"><b class="t1">{{ p1(build.boots[0].win) }}%</b>, {{ thousands(build.boots[0].games) }} games</span>
                </div>
                <span class="cp-arrow"><Icon name="chevr" /></span>
                <div class="cp-stage core">
                  <span class="lab vi">Core build</span>
                  <div class="its">
                    <template v-for="(id, k) in core.items" :key="id">
                      <span class="it"><span class="fr xs"><img :src="itemUrl(id)" :alt="label('item', id)" /></span></span>
                      <span v-if="k < core.items.length - 1" class="cp-arrow" style="margin-top: 0; height: 52px"><Icon name="chevr" /></span>
                    </template>
                  </div>
                  <span class="meta"
                    ><b class="t1">{{ p1(core.win) }}%</b>, {{ thousands(core.games) }} games:
                    {{ core.items.map((id) => label('item', id)).join(', ') }}</span
                  >
                </div>
                <template v-if="fourth.length">
                  <span class="cp-arrow"><Icon name="chevr" /></span>
                  <div class="cp-stage">
                    <span class="lab">Fourth item</span>
                    <div class="its">
                      <span v-for="o in fourth" :key="o.item" class="it"><span class="fr xs"><img :src="itemUrl(o.item)" alt="" /></span></span>
                    </div>
                    <span class="meta">{{ fourth.map((o) => shortName(o.item)).join(', ').replace(/, ([^,]*)$/, ' or $1') }}</span>
                  </div>
                </template>
              </div>
              <div class="g12" style="gap: 0; border-top: 1px solid var(--line)">
                <div class="cp-list" style="grid-column: span 6; border-right: 1px solid var(--line)">
                  <template v-if="otherCores.length">
                    <div class="cp-li" style="border-top: 0; min-height: 40px"><span /><span class="lab">Other cores</span><span class="lab">Games</span><span class="lab" style="text-align: right">Win rate</span></div>
                    <div v-for="c in otherCores" :key="c.items.join()" class="cp-li" style="grid-template-columns: 124px minmax(0, 1fr) 120px 64px">
                      <span class="its"><img v-for="x in c.items" :key="x" class="ic" :src="itemUrl(x)" alt="" /></span>
                      <span class="sm t2 ell">{{ c.text }}</span>
                      <span class="meta num">{{ thousands(c.games) }}</span>
                      <span class="fg-xs" style="text-align: right">{{ p1(c.win) }}<span class="u">%</span></span>
                    </div>
                  </template>
                  <div class="cp-li" style="min-height: 40px"><span /><span class="lab">Boots</span><span class="lab">Built in</span><span class="lab" style="text-align: right">Win rate</span></div>
                  <div v-for="b in bootsRows" :key="b.items[0]" class="cp-li">
                    <img class="ic" :src="itemUrl(b.items[0])" alt="" />
                    <span class="h5 ell">{{ label('item', b.items[0]) }}</span>
                    <div class="row" style="gap: 10px"><div class="bar grow"><i :style="{ width: `${b.share * 100}%` }" /></div><span class="meta num" style="width: 40px">{{ p1(b.share) }}%</span></div>
                    <span class="fg-xs" style="text-align: right">{{ p1(b.win) }}<span class="u">%</span></span>
                  </div>
                </div>
                <div class="cp-list" style="grid-column: span 6">
                  <div class="cp-li" style="border-top: 0; min-height: 40px"><span /><span class="lab">Later items</span><span class="lab">Built in</span><span class="lab" style="text-align: right">Win rate</span></div>
                  <div v-for="i in later" :key="i.item" class="cp-li">
                    <img class="ic" :src="itemUrl(i.item)" alt="" />
                    <span class="h5 ell">{{ label('item', i.item) }}</span>
                    <div class="row" style="gap: 10px"><div class="bar grow"><i :style="{ width: `${(i.share / laterMax) * 100}%` }" /></div><span class="meta num" style="width: 40px">{{ p1(i.share) }}%</span></div>
                    <span class="fg-xs" style="text-align: right">{{ p1(i.win) }}<span class="u">%</span></span>
                  </div>
                </div>
              </div>
            </template>
            <p v-else class="meta cp-none">Too few games with three finished items stored for this filter.</p>
          </article>
        </section>

        <section id="skills" class="sec g12 cp-sec" style="padding-top: 24px; align-items: stretch">
          <article class="card" style="grid-column: span 8">
            <CardHead title="Skill order" icon="sliders" :meta="order ? `${p1(order.win)}% win rate in ${thousands(order.games)} games` : null">
              <div v-if="skills?.max?.length" class="cp-max" style="margin-left: auto">
                <template v-for="(k, i) in skills.max" :key="k">
                  <img :src="abilityUrl(champion.id, k)" :alt="k" /><Icon v-if="i < skills.max.length - 1" name="chevr" />
                </template>
              </div>
            </CardHead>
            <Skeleton v-if="waiting('skills')" :height="160" />
            <div v-else-if="order" class="cp-sk">
              <span />
              <span v-for="l in 15" :key="l" class="lab" style="text-align: center">{{ l }}</span>
              <template v-for="s in skillRows" :key="s.key">
                <span class="ab"
                  ><img :src="abilityUrl(champion.id, s.key)" alt="" /><span
                    ><b class="t1">{{ s.key }}</b> {{ s.name }}</span
                  ></span
                >
                <span v-for="(c, i) in s.cells" :key="i" class="c" :class="{ on: c, q: c && s.key === skills?.max?.[0] }">{{ c ?? '' }}</span>
              </template>
            </div>
            <p v-else class="meta cp-none">Too few games with a skill order stored for this filter.</p>
          </article>
          <article class="card" style="grid-column: span 4">
            <CardHead title="At 15 minutes" icon="clock" />
            <Skeleton v-if="waiting('early', 'firstBlood')" :rows="4" />
            <div v-else-if="at15" class="cp-early">
              <div class="col" style="gap: 8px">
                <div class="row" style="justify-content: space-between; align-items: baseline">
                  <span class="sm t2">Ahead in gold</span><span class="fg-s">{{ Math.round(at15.ahead * 100) }}<span class="u">% of games</span></span>
                </div>
                <div class="split"><i :style="{ width: `${at15.ahead * 100}%` }" /><b style="background: var(--s4)" /></div>
              </div>
              <div class="row" style="gap: 12px">
                <div class="col grow well" style="gap: 4px; padding: 12px 14px">
                  <span class="lab">Wins when ahead</span><span class="fg-m wn">{{ at15.aheadWin === null ? '–' : Math.round(at15.aheadWin * 100) }}<span class="u">%</span></span>
                </div>
                <div class="col grow well" style="gap: 4px; padding: 12px 14px">
                  <span class="lab">Wins when behind</span><span class="fg-m ls">{{ at15.behindWin === null ? '–' : Math.round(at15.behindWin * 100) }}<span class="u">%</span></span>
                </div>
              </div>
              <div class="row meta" style="justify-content: space-between">
                <span>Gold difference</span><b class="t1 num">{{ at15.goldDiff > 0 ? '+' : at15.goldDiff < 0 ? '−' : '' }}{{ thousands(Math.abs(at15.goldDiff)) }}</b>
              </div>
              <div v-if="firstBlood && fbIn !== null" class="row meta" style="justify-content: space-between">
                <span>In on first blood</span
                ><b class="t1 num">{{ Math.round(fbIn * 100) }}%<template v-if="firstBlood.involvedWin !== null">, wins {{ Math.round(firstBlood.involvedWin * 100) }}%</template></b>
              </div>
            </div>
            <p v-else class="meta cp-none">The early game of this filter is not counted yet.</p>
          </article>
        </section>

        <section class="sec" style="padding-top: 24px">
          <div class="g12">
            <article v-for="[t, list] in ([['Hardest lanes', hardest], ['Easiest lanes', easiest]] as const)" :key="t" class="card" style="grid-column: span 6">
              <CardHead
                :title="t"
                :icon="t === 'Hardest lanes' ? 'swords' : 'shield'"
                :meta="`Common opponents, ${champion.name}’s win rate`"
                :more="t === 'Easiest lanes' && matchups.length ? { label: `All ${matchups.length}`, href: '#matchups' } : undefined"
              />
              <Skeleton v-if="waiting('matchups')" :height="260" />
              <div v-else-if="list.length" class="cp-mu">
                <Link v-for="m in list" :key="m.champion" class="cp-mc" :href="matchupHref(m.champion)">
                  <div class="fr"><img :src="loadingUrl(m.champion)" alt="" loading="lazy" /></div>
                  <div class="col" style="gap: 2px">
                    <span class="h4">{{ champName(m.champion) }}</span>
                    <span class="fg-s">{{ p1(m.win) }}<span class="u">%</span></span>
                    <span class="meta">{{ thousands(m.games) }} games</span>
                  </div>
                </Link>
              </div>
              <p v-else class="meta cp-none">Too few games against one opponent yet.</p>
            </article>
          </div>
        </section>

        <section id="stats" class="sec g12 cp-sec" style="padding-top: 24px; align-items: stretch">
          <article class="card" style="grid-column: span 8; padding-bottom: 20px">
            <CardHead title="Win rate by game length" icon="chart" :meta="lengthChart?.most ?? null" />
            <Skeleton v-if="waiting('profile')" :height="220" />
            <template v-else-if="lengthChart">
              <div class="chart cp-len">
                <div v-for="g in lengthChart.gy" :key="g.t" class="gy" :style="{ top: `${g.y}%` }"><span>{{ g.t }}</span></div>
                <svg class="fade" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="area" :d="lengthChart.area" /></svg>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <path class="dash" :d="`M0 ${lengthChart.mid} H100`" />
                  <path class="ln" :d="lengthChart.line" />
                </svg>
                <span class="dot" :style="{ left: `${lengthChart.px}%`, top: `${lengthChart.py}%` }" />
                <span class="peak" :style="{ left: `${lengthChart.px}%`, top: `${lengthChart.py}%` }">{{ lengthChart.peak }}</span>
              </div>
              <div class="cp-xs"><span v-for="(x, i) in lengthChart.xs" :key="i">{{ x }}</span></div>
            </template>
            <p v-else class="meta cp-none">Too few games stored for this filter.</p>
          </article>
          <article class="card" style="grid-column: span 4; display: flex; flex-direction: column">
            <CardHead title="Average game" icon="target" :meta="profile?.averages ? `${thousands(profile.averages.games)} games` : null" />
            <div v-if="profile?.averages" class="cp-av" style="flex: 1">
              <div>
                <span class="lab">Kills, deaths, assists</span
                ><span class="fg-m">{{ profile.averages.kills }} <span class="t3">/</span> {{ profile.averages.deaths }} <span class="t3">/</span> {{ profile.averages.assists }}</span>
              </div>
              <div><span class="lab">KDA</span><span class="fg-m">{{ profile.averages.kda.toFixed(2) }}</span></div>
              <div><span class="lab">CS a minute</span><span class="fg-m">{{ profile.averages.csPerMin }}</span></div>
              <div><span class="lab">Damage</span><span class="fg-m">{{ thousands(profile.averages.damage) }}</span></div>
              <div><span class="lab">Gold</span><span class="fg-m">{{ thousands(profile.averages.gold) }}</span></div>
              <div><span class="lab">Vision score</span><span class="fg-m">{{ profile.averages.vision }}</span></div>
            </div>
            <Skeleton v-else-if="waiting('profile')" :rows="3" />
          </article>
        </section>

        <section class="sec g12" style="padding-top: 24px; align-items: start">
          <article class="card" style="grid-column: span 7; overflow: hidden">
            <CardHead title="At each rank" icon="trophy" :meta="`${champion.name} ${roleWord}, this patch`" />
            <Skeleton v-if="waiting('byRank')" :rows="6" />
            <div v-else class="tbl cp-rk">
              <div class="tbl-h">
                <span>Rank</span>
                <SortHead :sorter="rankSort" col="games" label="Games" class="n" />
                <SortHead :sorter="rankSort" col="win" label="Win rate" class="n" />
                <SortHead :sorter="rankSort" col="pick" label="Pick rate" class="n hm" />
                <SortHead :sorter="rankSort" col="tier" label="Tier" class="n hm" />
              </div>
              <div v-for="r in rankSort.rows" :key="r.group" class="tbl-r">
                <span class="h5">{{ rankLabel(r.group) }}</span>
                <span class="n num">{{ thousands(r.games) }}</span>
                <span class="n num">{{ r.win === null ? '–' : `${p1(r.win)}%` }}</span>
                <span class="n num hm">{{ p1(r.pick) }}%</span>
                <span class="n hm"><TierChip :tier="r.tier" /></span>
              </div>
            </div>
          </article>
          <article class="card" style="grid-column: span 5">
            <CardHead title="Beyond the averages" icon="layers" :meta="details ? `${thousands(details.games)} games` : null" />
            <Skeleton v-if="waiting('details')" :rows="4" />
            <div v-else-if="details" class="cp-det">
              <div><span class="lab">Damage taken</span><span class="fg-s num">{{ thousands(details.damageTaken) }}</span></div>
              <div><span class="lab">To turrets</span><span class="fg-s num">{{ thousands(details.damageToTurrets) }}</span></div>
              <div><span class="lab">To objectives</span><span class="fg-s num">{{ thousands(details.damageToObjectives) }}</span></div>
              <div><span class="lab">Wards placed</span><span class="fg-s num">{{ details.wardsPlaced }}</span></div>
              <div><span class="lab">Wards cleared</span><span class="fg-s num">{{ details.wardsCleared }}</span></div>
              <div><span class="lab">Control wards</span><span class="fg-s num">{{ details.controlWards }}</span></div>
              <div v-if="dmg"><span class="lab">Physical damage</span><span class="fg-s num">{{ Math.round(dmg.physical * 100) }}<span class="u">%</span></span></div>
              <div v-if="dmg"><span class="lab">Magic damage</span><span class="fg-s num">{{ Math.round(dmg.magic * 100) }}<span class="u">%</span></span></div>
              <div v-if="dmg"><span class="lab">True damage</span><span class="fg-s num">{{ Math.round(dmg.true * 100) }}<span class="u">%</span></span></div>
            </div>
            <p v-else class="meta cp-none">Too few games stored for this filter.</p>
          </article>
        </section>

        <section id="matchups" class="sec cp-sec" style="padding-top: 24px">
          <article class="card" style="overflow: hidden">
            <CardHead title="Every lane opponent" icon="users" :meta="`${champion.name}’s win rate against each, most met first`" />
            <Skeleton v-if="waiting('matchups')" :rows="8" pic />
            <div v-else-if="matchups.length" class="tbl cp-tbl">
              <div class="tbl-h">
                <SortHead :sorter="matchupSort" col="name" label="Opponent" />
                <SortHead :sorter="matchupSort" col="games" label="Games" class="n" />
                <SortHead :sorter="matchupSort" col="win" label="Win rate" class="n" />
                <span class="n hm">Matchup</span>
              </div>
              <Link v-for="m in matchupSort.rows" :key="m.champion" class="tbl-r" :href="matchupHref(m.champion)">
                <span class="who"><img class="pic sm" :src="champIconUrl(m.champion)" alt="" loading="lazy" /><span class="h5 ell">{{ champName(m.champion) }}</span></span>
                <span class="n num">{{ thousands(m.games) }}</span>
                <span class="n num" :class="m.win >= 0.5 ? 't1' : 't3'">{{ p1(m.win) }}%</span>
                <span class="n hm meta" style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 4px">Open<Icon name="chevr" :size="12" /></span>
              </Link>
            </div>
            <p v-else class="meta cp-none">Too few games against one opponent yet.</p>
          </article>
        </section>

        <section id="pros" class="sec cp-sec" style="padding-top: 24px">
          <article class="card" style="overflow: hidden">
            <CardHead title="Pros on this champion" icon="pro" :meta="pros?.games?.length ? `Their ${pros.games.length} latest games in ${roleWord}` : null" />
            <Skeleton v-if="waiting('pros')" :rows="5" pic />
            <div v-else-if="pros?.games?.length" class="tbl cp-pro">
              <div class="tbl-h">
                <SortHead :sorter="proSort" col="name" label="Pro" />
                <span class="hm">Against</span>
                <SortHead :sorter="proSort" col="kda" label="KDA" class="n" />
                <SortHead :sorter="proSort" col="win" label="Result" class="n hm" />
                <SortHead :sorter="proSort" col="when" label="When" class="n hm" />
              </div>
              <div v-for="g in proSort.rows" :key="g.matchId + g.account" class="tbl-r">
                <Link class="who" :href="g.pro ? `/pro/${g.pro.slug}` : '#'"
                  ><img :src="g.pro ? `/cdn/pro/${g.pro.slug}${g.pro.photo ? `?v=${g.pro.photo}` : ''}` : champIconUrl(champion.id)" alt="" loading="lazy" /><span class="col" style="min-width: 0"
                    ><span class="h5 ell">{{ g.pro?.name ?? 'Pro' }}</span><span class="meta ell">{{ g.pro?.team?.name ?? g.league?.name ?? '' }}</span></span
                  ></Link
                >
                <span class="hm row" style="gap: 8px"
                  ><template v-if="g.opponent"><img class="pic xs" :src="champIconUrl(g.opponent)" alt="" /><span class="sm t2 ell">{{ champName(g.opponent) }}</span></template></span
                >
                <span class="n num">{{ g.kills }}/{{ g.deaths }}/{{ g.assists }}</span>
                <span class="n hm" :class="g.win ? 'wn' : 'ls'">{{ g.win ? 'Win' : 'Loss' }}</span>
                <span class="n hm meta">{{ ago(g.startMs) }}</span>
              </div>
            </div>
            <p v-else class="meta cp-none">No pro game on {{ champion.name }} in {{ roleWord }} stored yet.</p>
          </article>
        </section>
      </template>
    </div>
  </SiteLayout>
</template>
