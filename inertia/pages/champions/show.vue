<script setup lang="ts">
import { computed } from 'vue'
import { Head, Link } from '@inertiajs/vue3'
import { ChevronRight } from 'lucide-vue-next'
import { RankCrest, RoleIcon, Skeleton } from '@invadelol/ui'
import AppHeader from '../../components/AppHeader.vue'
import SiteFooter from '../../components/SiteFooter.vue'
import Banner from '../../components/champions/Banner.vue'
import FilterBar from '../../components/champions/FilterBar.vue'
import TierMark from '../../components/champions/TierMark.vue'
import RuneTree from '../../components/champions/RuneTree.vue'
import BuildPath from '../../components/champions/BuildPath.vue'
import SkillOrder from '../../components/champions/SkillOrder.vue'
import SpellPairs from '../../components/champions/SpellPairs.vue'
import ChampionRows from '../../components/champions/ChampionRows.vue'
import GameRow from '../../components/champions/GameRow.vue'
import LineChart from '../../components/champions/LineChart.vue'
import { championName, nameOf } from '../../lib/assets.js'
import {
  CHAMPION_TABS,
  RANK_GROUPS,
  ROLES,
  TIERS,
  abilityUrl,
  champIconUrl,
  championSlug,
  compact,
  filterQuery,
  itemUrl,
  perkUrl,
  pct,
  roleOf,
  splashUrl,
  styleUrl,
  thousands,
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
  type Teammates,
} from '../../lib/champions.js'
import '../../css/champions.css'

/** `/champions/:slug/:tab`: one champion in one role, from our own ranked games. */
const props = defineProps<{
  champion: ChampionEntry
  tab: ChampionTab
  position: string
  roles: RoleStat[]
  stat: RoleStat | null
  ranked: number
  games: number
  patches: { patch: string; games: number }[]
  filter: Filter | null
  data: Record<string, any> | null
  /** Build tab blocks still counting when the page was sent: each arrives on its own. */
  build?: BuildStats | null
  runes?: RuneStats | null
  spells?: SpellStats | null
  skills?: Skills | null
  matchups?: Matchup[] | null
  teammates?: Teammates | null
  trees?: RuneTrees | null
}>()

type Block = 'build' | 'runes' | 'spells' | 'skills' | 'matchups' | 'teammates' | 'trees'
/** A block of the tab: sent with the page, or arrived since. */
const block = (key: Block): any => (props.data && key in props.data ? props.data[key] : props[key])
/** Whether a build tab block is still on its way (its panel holds its place meanwhile). */
const waiting = (...keys: Block[]) =>
  props.tab === 'build' &&
  !!props.data &&
  keys.some((key) => !(key in props.data!) && props[key] === undefined)

const latest = computed(() => props.patches[0]?.patch)
const role = computed(() => roleOf(props.position))
const rank = computed(() => props.filter?.bracket ?? 'emerald_plus')
const patch = computed(() => props.filter?.patch ?? latest.value ?? '')

function href(change: { tab?: ChampionTab; role?: string; rank?: string; patch?: string } = {}) {
  const tab = change.tab ?? props.tab
  const q = filterQuery(
    {
      role: change.role ?? role.value.slug,
      rank: change.rank ?? rank.value,
      patch: change.patch ?? patch.value,
      region: props.filter?.region,
    },
    latest.value
  )
  return `/champions/${props.champion.slug}${tab === 'build' ? '' : `/${tab}`}${q}`
}
const championHref = (id: number) =>
  `/champions/${championSlug(championName(id))}${filterQuery({ rank: rank.value, patch: patch.value }, latest.value)}`

const tabs = computed(() =>
  CHAMPION_TABS.map((t) => ({
    label: t.label,
    href: href({ tab: t.key }),
    on: t.key === props.tab,
  }))
)
const roleChoices = computed(() =>
  [...props.roles]
    .sort((a, b) => b.games - a.games)
    .map((r) => {
      const meta = roleOf(r.position)
      return {
        label: meta.label,
        lane: meta.lane,
        href: href({ role: meta.slug }),
        on: r.position === props.position,
        share: pct(r.roleShare, 0),
      }
    })
)
const classes = computed(() =>
  props.champion.roles.map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')
)
const figures = computed(() => {
  const s = props.stat
  return [
    {
      label: 'Tier',
      value: s?.tier !== null && s?.tier !== undefined ? TIERS[s.tier] : '–',
      sub: s?.rank
        ? `#${s.rank} of ${props.ranked} in ${role.value.label.toLowerCase()}`
        : 'Not ranked',
    },
    {
      label: 'Win rate',
      value: s ? pct(s.win) : '–',
      sub: s ? `${thousands(s.games)} games` : 'No games yet',
    },
    {
      label: 'Pick rate',
      value: s ? pct(s.pick) : '–',
      sub: `of ${role.value.label.toLowerCase()} games`,
    },
    { label: 'Ban rate', value: s ? pct(s.ban) : '–', sub: 'of games' },
  ]
})

/* ── Build tab ───────────────────────────────────────────────── */
const build = computed(() => block('build') as BuildStats | null | undefined)
const runes = computed(() => block('runes') as RuneStats | null | undefined)
const spells = computed(() => block('spells') as SpellStats | null | undefined)
const skills = computed(() => block('skills') as Skills | null | undefined)
const trees = computed(() => (block('trees') ?? undefined) as RuneTrees | undefined)
const matchups = computed(() => (block('matchups') ?? []) as Matchup[])
const teammates = computed(() => (block('teammates') ?? undefined) as Teammates | undefined)

/** Opponents with enough games to be compared: 2 % of the champion's games, 30 at least. */
const reliable = computed(() => {
  const total = matchups.value.reduce((n, m) => n + m.games, 0)
  return matchups.value.filter((m) => m.games >= Math.max(30, total * 0.02))
})
const hardest = computed(() => [...reliable.value].sort((a, b) => a.win - b.win).slice(0, 5))
const easiest = computed(() => [...reliable.value].sort((a, b) => b.win - a.win).slice(0, 5))
/** The teammate that matters most for each role: the support for a bot laner, and so on. */
const DUO: Record<string, string> = {
  BOTTOM: 'UTILITY',
  UTILITY: 'BOTTOM',
  TOP: 'JUNGLE',
  JUNGLE: 'MIDDLE',
  MIDDLE: 'JUNGLE',
}
const duoRole = computed(() => DUO[props.position] ?? 'JUNGLE')
const duos = computed(() =>
  [...(teammates.value?.[duoRole.value as keyof Teammates] ?? [])]
    .sort((a, b) => b.win - a.win)
    .slice(0, 5)
)

/* ── Runes tab ───────────────────────────────────────────────── */
const secondary = computed(() => {
  const map = new Map<number, { games: number; wins: number }>()
  for (const p of runes.value?.pages ?? []) {
    const s = map.get(p.page.secondaryStyle) ?? { games: 0, wins: 0 }
    s.games += p.games
    s.wins += p.games * p.win
    map.set(p.page.secondaryStyle, s)
  }
  const total = [...map.values()].reduce((n, s) => n + s.games, 0)
  return [...map]
    .map(([style, s]) => ({ style, games: s.games, win: s.wins / s.games, share: s.games / total }))
    .sort((a, b) => b.games - a.games)
})

/* ── Statistics tab ─────────────────────────────────────────── */
const byRank = computed(
  () =>
    (props.data?.byRank ?? []) as {
      group: string
      games: number
      win: number | null
      pick: number
      tier: number | null
    }[]
)
const trend = computed(
  () =>
    (props.data?.trend ?? []) as {
      day: string
      games: number
      win: number | null
      pick: number
      ban: number
    }[]
)
const length = computed(
  () => (props.data?.length ?? []) as { minutes: number; games: number; win: number }[]
)
const averages = computed(() => props.data?.averages as Record<string, number> | null | undefined)
const dayLabel = (d?: string) =>
  d
    ? new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : ''
const minutes = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

/* ── Pro builds tab ─────────────────────────────────────────── */
const proGames = computed(() => (props.data?.games ?? []) as ProGame[])
const proPlayers = computed(
  () => (props.data?.players ?? []) as { pro: ProTag; games: number; wins: number }[]
)
const proCore = computed(() => {
  const counts = new Map<number, number>()
  for (const g of proGames.value)
    for (const id of new Set(g.items)) if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
  const finished = new Set(build.value?.items.map((i) => i.item) ?? [])
  return [...counts]
    .filter(([id]) => !finished.size || finished.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
})

const item = (id: number) => nameOf('item', id) ?? ''
const rune = (id: number) => nameOf('rune', id) ?? ''
</script>

<template>
  <Head
    :title="`${champion.name} ${tab === 'build' ? 'build' : CHAMPION_TABS.find((t) => t.key === tab)?.label.toLowerCase()}`"
  />
  <div class="flex min-h-screen flex-col">
    <AppHeader />
    <Banner
      :art="[splashUrl(champion.id)]"
      :face="champIconUrl(champion.id)"
      :title="champion.name"
      :figures="figures"
      :tabs="tabs"
    >
      <template #kicker>
        <RoleIcon :lane="role.lane as any" :size="14" />{{ role.label
        }}<template v-if="classes"> · {{ classes }}</template
        ><template v-if="filter"> · Patch {{ filter.patch }}</template>
      </template>
      <template #under>
        <div class="cs-kit">
          <span v-for="k in ['p', 'q', 'w', 'e', 'r']" :key="k"
            ><img :src="abilityUrl(champion.id, k)" alt="" /><b>{{ k.toUpperCase() }}</b></span
          >
        </div>
      </template>
    </Banner>

    <main class="page cs-main flex-1">
      <FilterBar
        :roles="roleChoices"
        :rank="rank"
        :patch="patch"
        :patches="patches"
        :href="(c) => href(c)"
      />

      <p v-if="!data" class="cs-empty">
        Not enough games for {{ champion.name }} {{ role.label.toLowerCase() }} with these filters
        yet.
      </p>

      <!-- Build -->
      <div v-else-if="tab === 'build'" class="cs-cols cs-c-420">
        <div class="cs-stack">
          <section v-if="runes?.pages.length && trees" class="iv-panel cs-card">
            <h2>
              Runes<span class="meta"
                >{{ rune(runes.pages[0].page.keystone) }} · {{ pct(runes.pages[0].win) }} win ·
                {{ thousands(runes.pages[0].games) }} games</span
              >
            </h2>
            <RuneTree :page="runes.pages[0].page" :trees="trees" />
            <div class="cs-keys">
              <span
                v-for="(k, i) in runes.keystones.slice(0, 3)"
                :key="k.keystone"
                :class="{ on: !i }"
                ><img :src="perkUrl(k.keystone)" alt="" />{{ rune(k.keystone)
                }}<small>{{ pct(k.share, 0) }}</small></span
              >
            </div>
          </section>
          <section v-else-if="waiting('runes', 'trees')" class="iv-panel cs-card" aria-busy="true">
            <h2>Runes</h2>
            <Skeleton height="300px" />
          </section>
          <section v-if="spells?.pairs.length" class="iv-panel cs-card">
            <h2>Summoner spells</h2>
            <SpellPairs :spells="spells" />
          </section>
          <section v-else-if="waiting('spells')" class="iv-panel cs-card" aria-busy="true">
            <h2>Summoner spells</h2>
            <Skeleton height="96px" />
          </section>
          <section v-if="duos.length" class="iv-panel cs-card">
            <ChampionRows
              :rows="duos"
              :title="`Best with · ${roleOf(duoRole).label}`"
              note="games together"
              :href="championHref"
            />
          </section>
          <section v-else-if="waiting('teammates')" class="iv-panel cs-card" aria-busy="true">
            <span class="cs-h">Best with · {{ roleOf(duoRole).label }}</span>
            <Skeleton height="220px" />
          </section>
        </div>
        <div class="cs-stack">
          <section v-if="build?.cores.length" class="iv-panel cs-card">
            <h2>
              Build<span class="meta">Most played order</span
              ><Link class="end cs-link" :href="href({ tab: 'items' })"
                >Every item<ChevronRight :size="13"
              /></Link>
            </h2>
            <BuildPath :build="build" />
          </section>
          <section v-else-if="waiting('build')" class="iv-panel cs-card" aria-busy="true">
            <h2>Build<span class="meta">Most played order</span></h2>
            <Skeleton height="220px" />
          </section>
          <section v-if="skills" class="iv-panel cs-card">
            <h2>Skill order</h2>
            <SkillOrder :skills="skills" :champion="champion.id" />
          </section>
          <section v-else-if="waiting('skills')" class="iv-panel cs-card" aria-busy="true">
            <h2>Skill order</h2>
            <Skeleton height="150px" />
          </section>
          <div v-if="reliable.length" class="cs-cols cs-c-2" style="margin: 0">
            <section class="iv-panel cs-card">
              <ChampionRows :rows="hardest" title="Hardest lanes" polar :href="championHref" />
            </section>
            <section class="iv-panel cs-card">
              <ChampionRows :rows="easiest" title="Easiest lanes" polar :href="championHref" />
            </section>
          </div>
          <div v-else-if="waiting('matchups')" class="cs-cols cs-c-2" style="margin: 0">
            <section
              v-for="t in ['Hardest lanes', 'Easiest lanes']"
              :key="t"
              class="iv-panel cs-card"
              aria-busy="true"
            >
              <span class="cs-h">{{ t }}</span>
              <Skeleton height="220px" />
            </section>
          </div>
        </div>
      </div>

      <!-- Runes -->
      <div v-else-if="tab === 'runes' && runes?.pages.length && trees" class="cs-cols cs-c-side">
        <div class="cs-stack">
          <section class="iv-panel cs-card">
            <h2>
              Most played page<span class="meta"
                >{{ rune(runes.pages[0].page.keystone) }} with
                {{ trees.styles[runes.pages[0].page.secondaryStyle]?.name }}</span
              >
            </h2>
            <RuneTree :page="runes.pages[0].page" :trees="trees" big />
            <div class="cs-kv" style="grid-template-columns: repeat(3, 1fr); margin-top: 20px">
              <div>
                <span>Win rate</span><b>{{ pct(runes.pages[0].win) }}</b>
              </div>
              <div>
                <span>Played</span><b>{{ pct(runes.pages[0].share, 0) }}</b>
              </div>
              <div>
                <span>Games</span><b>{{ thousands(runes.pages[0].games) }}</b>
              </div>
            </div>
          </section>
          <section class="iv-panel cs-card">
            <h2>
              Every page<span class="meta">{{ runes.pages.length }} pages with enough games</span>
            </h2>
            <div v-for="p in runes.pages" :key="JSON.stringify(p.page)" class="cs-row">
              <span class="pics"
                ><img class="round" :src="perkUrl(p.page.keystone)" alt="" /><img
                  class="round"
                  :src="styleUrl(p.page.secondaryStyle)"
                  alt=""
                  style="width: 20px; height: 20px"
              /></span>
              <span class="nm"
                >{{ rune(p.page.keystone)
                }}<small>{{
                  [...p.page.primary, ...p.page.secondary].map(rune).join(', ')
                }}</small></span
              >
              <span class="cs-track"><i :style="{ width: `${p.share * 100}%` }" /></span>
              <span class="v">{{ pct(p.win) }}</span>
              <span class="s">{{ pct(p.share, 0) }}</span>
            </div>
          </section>
        </div>
        <div class="cs-stack cs-narrow">
          <section class="iv-panel cs-card">
            <h2>Keystones</h2>
            <div v-for="k in runes.keystones" :key="k.keystone" class="cs-row">
              <span class="pics"><img class="round" :src="perkUrl(k.keystone)" alt="" /></span>
              <span class="nm"
                >{{ rune(k.keystone) }}<small>{{ thousands(k.games) }} games</small></span
              >
              <span class="cs-track"><i :style="{ width: `${k.share * 100}%` }" /></span>
              <span class="v">{{ pct(k.win) }}</span
              ><span class="s">{{ pct(k.share, 0) }}</span>
            </div>
          </section>
          <section class="iv-panel cs-card">
            <h2>Secondary tree</h2>
            <div v-for="s in secondary" :key="s.style" class="cs-row">
              <span class="pics"><img :src="styleUrl(s.style)" alt="" /></span>
              <span class="nm"
                >{{ trees.styles[s.style]?.name
                }}<small>{{ thousands(s.games) }} games</small></span
              >
              <span class="cs-track"><i :style="{ width: `${s.share * 100}%` }" /></span>
              <span class="v">{{ pct(s.win) }}</span
              ><span class="s">{{ pct(s.share, 0) }}</span>
            </div>
          </section>
        </div>
      </div>

      <!-- Items -->
      <template v-else-if="tab === 'items' && build">
        <div class="cs-cols cs-c-3 cs-narrow">
          <section
            v-for="[title, list, isCore] in [
              ['Starting items', build.starters, false],
              ['Boots', build.boots, false],
              ['Core builds', build.cores, true],
            ] as const"
            :key="title"
            class="iv-panel cs-card"
          >
            <h2>{{ title }}</h2>
            <div
              v-for="o in list"
              :key="o.items.join()"
              class="cs-row"
              :class="{ low: o.level < 1 }"
            >
              <span class="pics">
                <template
                  v-for="(id, i) in isCore ? o.items : [...new Set(o.items)].slice(0, 2)"
                  :key="i"
                >
                  <ChevronRight v-if="isCore && i" :size="11" class="chev" /><img
                    :src="itemUrl(id)"
                    :alt="item(id)"
                    :title="item(id)"
                  />
                </template>
              </span>
              <span class="nm"
                >{{ isCore ? '' : item(o.items[0])
                }}<small>{{ thousands(o.games) }} games</small></span
              >
              <span class="cs-track"><i :style="{ width: `${o.share * 100}%` }" /></span>
              <span class="v">{{ pct(o.win) }}</span
              ><span class="s">{{ pct(o.share, 0) }}</span>
            </div>
          </section>
        </div>
        <section class="iv-panel cs-card" style="margin-top: 16px">
          <h2>
            After the core<span class="meta">The options at each slot, most bought first</span>
          </h2>
          <div class="cs-later">
            <div v-for="(slot, i) in build.slots" :key="i">
              <span class="h">{{ ['4th', '5th', '6th'][i] }} item</span>
              <div v-for="o in slot.slice(0, 5)" :key="o.item" class="r">
                <img :src="itemUrl(o.item)" alt="" /><span class="n">{{ item(o.item) }}</span
                ><span class="v">{{ pct(o.win) }}</span>
              </div>
            </div>
          </div>
        </section>
        <section class="iv-panel cs-card flush" style="margin-top: 16px">
          <h2>
            Every item<span class="meta"
              >Finished items: how often they are bought and how those games end</span
            >
          </h2>
          <table class="iv-table cs-table">
            <thead>
              <tr>
                <th>Item</th>
                <th class="num on">Bought in</th>
                <th class="hm" />
                <th class="num">Win rate</th>
                <th class="num hm">Games</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="o in build.items" :key="o.item">
                <td class="c">
                  <img :src="itemUrl(o.item)" alt="" /><b>{{ item(o.item) }}</b>
                </td>
                <td class="num">{{ pct(o.share, 0) }}</td>
                <td class="hm" style="width: 160px">
                  <span class="cs-track" style="display: block"
                    ><i :style="{ width: `${o.share * 100}%` }"
                  /></span>
                </td>
                <td class="num">
                  <b>{{ pct(o.win) }}</b>
                </td>
                <td class="num hm t2">{{ thousands(o.games) }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </template>

      <!-- Matchups -->
      <div v-else-if="tab === 'matchups'" class="cs-cols cs-c-side">
        <section class="iv-panel cs-card flush">
          <h2>
            Lane opponents<span class="meta"
              >{{ champion.name }}'s win rate against each
              {{ role.label.toLowerCase() }} laner</span
            >
          </h2>
          <table class="iv-table cs-table">
            <thead>
              <tr>
                <th>Opponent</th>
                <th class="num on">Games</th>
                <th class="num hm">Against 50%</th>
                <th class="num">Win rate</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="m in matchups.filter((x) => x.games >= 10)"
                :key="m.champion"
                :class="{ 'opacity-60': m.level < 1 }"
              >
                <td class="c">
                  <img :src="champIconUrl(m.champion)" alt="" /><Link
                    :href="championHref(m.champion)"
                    ><b>{{ championName(m.champion) }}</b></Link
                  >
                </td>
                <td class="num t2">{{ thousands(m.games) }}</td>
                <td class="num hm">
                  <div class="cs-dv">
                    <i
                      :class="m.win >= 0.5 ? 'g' : 'b'"
                      :style="{ width: `${Math.min(50, (Math.abs(m.win - 0.5) / 0.08) * 50)}%` }"
                    />
                  </div>
                </td>
                <td class="num">
                  <b :class="m.win >= 0.5 ? 'cs-up' : 'cs-down'">{{ pct(m.win) }}</b>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
        <div class="cs-stack">
          <section
            v-for="r in ROLES.filter((x) => x.position !== position)"
            :key="r.position"
            class="iv-panel cs-card"
          >
            <h2>Best {{ r.label.toLowerCase() }}<span class="meta">Win rate together</span></h2>
            <ChampionRows
              :rows="[...(teammates?.[r.position] ?? [])].sort((a, b) => b.win - a.win).slice(0, 5)"
              note="games together"
              :href="championHref"
            />
          </section>
        </div>
      </div>

      <!-- Statistics -->
      <template v-else-if="tab === 'statistics'">
        <section class="iv-panel cs-card" style="margin-top: 20px">
          <h2>
            By rank<span class="meta"
              >Tier, win rate and pick rate at each rank · patch {{ patch }}</span
            >
          </h2>
          <div class="cs-ranks">
            <div v-for="(r, i) in byRank" :key="r.group">
              <RankCrest :tier="RANK_GROUPS[i].crest" :size="30" />
              <span class="n">{{ RANK_GROUPS[i].label }}</span>
              <TierMark :tier="r.tier" />
              <span class="w">{{ pct(r.win) }}</span>
              <small>{{ pct(r.pick, 0) }} picked<br />{{ thousands(r.games) }} games</small>
            </div>
          </div>
        </section>
        <div v-if="trend.length > 1" class="cs-cols cs-c-3">
          <section
            v-for="[title, key, value] in [
              ['Win rate', 'win', stat?.win],
              ['Pick rate', 'pick', stat?.pick],
              ['Ban rate', 'ban', stat?.ban],
            ] as const"
            :key="key"
            class="iv-panel cs-card"
          >
            <h2>
              {{ title }}<span class="meta">{{ trend.length }} days</span
              ><span
                class="end"
                style="font-size: 20px; font-weight: 700; font-stretch: var(--fig)"
                >{{ pct(value) }}</span
              >
            </h2>
            <LineChart
              :values="trend.map((d) => (d[key] ?? 0) as number)"
              :labels="[dayLabel(trend[0]?.day), dayLabel(trend[trend.length - 1]?.day)]"
              :height="100"
            />
          </section>
        </div>
        <div class="cs-cols cs-c-side">
          <section v-if="length.length > 1" class="iv-panel cs-card">
            <h2>Win rate by game length</h2>
            <LineChart
              :values="length.map((l) => l.win)"
              :labels="length.map((l) => `${l.minutes}${l === length[0] ? ' min' : ''}`)"
              :guides="[0.45, 0.5, 0.55]"
              :bench="0.5"
              :height="190"
            />
          </section>
          <div class="cs-stack cs-narrow">
            <section class="iv-panel cs-card">
              <h2>Roles</h2>
              <div
                v-for="r in [...roles].sort((a, b) => b.roleShare - a.roleShare)"
                :key="r.position"
                class="cs-row"
              >
                <span class="pics" style="width: 20px; color: var(--text-2)"
                  ><RoleIcon :lane="roleOf(r.position).lane as any" :size="16"
                /></span>
                <span class="nm">{{ roleOf(r.position).label }}</span>
                <span class="cs-track"><i :style="{ width: `${r.roleShare * 100}%` }" /></span>
                <span class="v">{{ pct(r.roleShare, 0) }}</span
                ><span />
              </div>
            </section>
            <section v-if="averages" class="iv-panel cs-card">
              <h2>Per game</h2>
              <div class="cs-kv">
                <div>
                  <span>KDA</span><b>{{ averages.kda }}</b>
                </div>
                <div>
                  <span>Kills</span><b>{{ averages.kills }}</b>
                </div>
                <div>
                  <span>Damage to champions</span><b>{{ compact(averages.damage) }}</b>
                </div>
                <div>
                  <span>CS per minute</span><b>{{ averages.csPerMin }}</b>
                </div>
                <div>
                  <span>Gold</span><b>{{ compact(averages.gold) }}</b>
                </div>
                <div>
                  <span>Game length</span><b>{{ minutes(averages.length) }}</b>
                </div>
              </div>
            </section>
          </div>
        </div>
      </template>

      <!-- Pro builds -->
      <div v-else-if="tab === 'pros'" class="cs-cols cs-c-side">
        <section>
          <div class="cs-card" style="padding: 0 0 12px">
            <h2 style="margin: 0">
              Recent pro games<span class="meta"
                >{{ champion.name }} {{ role.label.toLowerCase() }}, last 14 days</span
              >
            </h2>
          </div>
          <div v-if="proGames.length" class="cs-games">
            <GameRow v-for="g in proGames" :key="g.matchId" :game="g" who="pro" />
          </div>
          <p v-else class="cs-empty">
            No pro has played {{ champion.name }} {{ role.label.toLowerCase() }} in ranked lately.
          </p>
        </section>
        <div v-if="proGames.length" class="cs-stack">
          <section class="iv-panel cs-card">
            <h2>Most built by pros</h2>
            <div class="cs-later" style="grid-template-columns: 1fr">
              <div>
                <div v-for="[id, n] in proCore" :key="id" class="r">
                  <img :src="itemUrl(id)" alt="" /><span class="n">{{ item(id) }}</span
                  ><span class="v">{{ n }} games</span>
                </div>
              </div>
            </div>
          </section>
          <section class="iv-panel cs-card">
            <h2>Played by</h2>
            <Link
              v-for="p in proPlayers"
              :key="p.pro.slug"
              :href="`/pro/${p.pro.slug}`"
              class="cs-ch"
            >
              <img :src="champIconUrl(champion.id)" alt="" />
              <span class="nm"
                >{{ p.pro.name }}<small>{{ p.pro.team?.name ?? 'No team' }}</small></span
              >
              <span class="v">{{ p.games }} games</span>
            </Link>
          </section>
        </div>
      </div>
    </main>
    <SiteFooter />
  </div>
</template>
