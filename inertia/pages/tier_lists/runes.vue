<script setup lang="ts">
import { computed, ref } from 'vue'
import { Deferred, Head } from '@inertiajs/vue3'
import '../../css/tier-lists.css'
import SiteLayout from '../../components/SiteLayout.vue'
import Masthead from '../../components/ui/Masthead.vue'
import CardHead from '../../components/ui/CardHead.vue'
import Icon from '../../components/ui/Icon.vue'
import TierChip from '../../components/ui/TierChip.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import Skeleton from '../../components/ui/Skeleton.vue'
import StatFilters from '../../components/champions/StatFilters.vue'
import RoleSeg from '../../components/champions/RoleSeg.vue'
import MovedCard, { type Moved } from '../../components/champions/MovedCard.vue'
import Fig from '../../components/champions/Fig.vue'
import SinceCell from '../../components/champions/SinceCell.vue'
import Computing from '../../components/champions/Computing.vue'
import { BRACKETS, TIERS, champIconUrl, perkUrl, roleOf, styleUrl } from '../../lib/champions.js'
import { patchName } from '../../lib/patches.js'
import { barWidth, movers, p1, thousands } from '../../lib/tier_lists.js'

type Position = 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY'
interface Page {
  primaryStyle: number
  keystone: number
  primary: number[]
  secondaryStyle: number
  secondary: number[]
  shards: number[]
}
interface PageRow {
  page: Page
  games: number
  win: number
  share: number
}
interface Row {
  keystone: number
  style: number
  games: number
  win: number
  pick: number
  tier: number | null
  mainOf: number
  champions: { champion: number; games: number }[]
  roles: { position: Position; games: number }[]
  secondary: { style: number; share: number }[]
  pages: PageRow[]
  delta: number | null
}
interface List {
  computing?: boolean
  ahead?: number | null
  games: number
  rows: Row[]
  trees: { style: number; share: number }[]
  shards: { shard: number; share: number }[][]
  pages: (PageRow & { keystone: number })[]
  patch: string
  previousPatch: string | null
  names: Record<number, string>
  champions: { id: number; name: string; slug: string }[]
}

const props = defineProps<{
  list?: List | null
  position: Position | null
  filter: { patch: string; bracket: string; region: string | null } | null
  patches: { patch: string; games: number }[]
}>()

const ready = computed(() => (props.list && !props.list.computing ? props.list : null))
const role = computed(() => (props.position ? roleOf(props.position) : null))
const title = computed(() => (role.value ? `${role.value.label} rune tier list` : 'Rune tier list'))
const rankText = computed(() => {
  const b = BRACKETS.find((x) => x.value === props.filter?.bracket)
  if (!b || b.value === 'all') return 'every rank'
  return b.label.endsWith('+') ? `${b.label.slice(0, -1)} and above` : b.label
})
const where = computed(() => (role.value ? `in ${role.value.label.toLowerCase()}` : 'in every role'))
const metaLine = computed(() =>
  props.filter
    ? `Patch ${patchName(props.filter.patch)}, ${rankText.value}${ready.value ? `, ${ready.value.rows.length} keystones ${where.value}` : ''}`
    : 'No ranked games stored yet'
)
const name = (id: number) => ready.value?.names[id] ?? ''
const champName = (id: number) => ready.value?.champions.find((c) => c.id === id)?.name ?? ''
const ROLE_WORD: Record<Position, string> = {
  TOP: 'top',
  JUNGLE: 'jungle',
  MIDDLE: 'mid',
  BOTTOM: 'bot lane',
  UTILITY: 'support',
}

const view = ref<'keystones' | 'pages'>('keystones')
const query = ref('')
const matches = (text: string) => !query.value.trim() || text.toLowerCase().includes(query.value.trim().toLowerCase())

/* ── Keystones by tree ──────────────────────────────────────── */
const bands = computed(() => {
  if (!ready.value) return []
  const pickMax = Math.max(0.0001, ...ready.value.rows.map((r) => r.pick))
  return ready.value.trees.map((t) => ({
    ...t,
    keystones: ready.value!.rows
      .filter((r) => r.style === t.style)
      .sort((a, b) => b.games - a.games)
      .map((r) => ({ ...r, w: (r.pick / pickMax) * 100 })),
  }))
})
const SHADES = ['var(--v400)', 'var(--v700)', 'var(--s4)', 'var(--s3)']

/* ── Moved since the patch before ───────────────────────────── */
const moved = computed(() => {
  const m = movers(ready.value?.rows ?? [], (r) => r.delta)
  const toRow = ({ r, d }: { r: Row; d: number }): Moved => ({
    key: r.keystone,
    name: name(r.keystone),
    d: d * 100,
    img: perkUrl(r.keystone),
  })
  return { up: m.up.map(toRow), down: m.down.map(toRow) }
})

/* ── Table ──────────────────────────────────────────────────── */
const shown = computed(() => (ready.value?.rows ?? []).filter((r) => matches(name(r.keystone))))
const groups = computed(() =>
  TIERS.map((label, t) => {
    const rows = shown.value.filter((r) => r.tier === t).sort((a, b) => b.win - a.win)
    return { t, label, rows }
  }).filter((g) => g.rows.length)
)
const winScale = computed(() => {
  const w = shown.value.map((r) => r.win)
  return { lo: Math.min(0.475, ...w) - 0.005, hi: Math.max(0.525, ...w) }
})
const pickMax = computed(() => Math.max(0.05, ...shown.value.map((r) => r.pick)))
const open = ref<number | null>(null)
const toggle = (k: number) => (open.value = open.value === k ? null : k)
const topRole = (r: Row) => r.roles[0]
const pageNames = (p: Page) =>
  `${p.primary.map(name).join(', ')}. ${name(p.secondaryStyle)}: ${p.secondary.map(name).join(', ')}.`
const changes = (main: Page, other: Page) => {
  const diff = other.primary.filter((x) => !main.primary.includes(x)).map(name)
  return diff.length ? diff.join(', ') : `Same ${name(main.primaryStyle)} runes`
}
const pages = computed(() => (ready.value?.pages ?? []).filter((p) => matches(name(p.keystone))))
</script>

<template>
  <Head :title="title" />
  <SiteLayout>
    <div class="wrap">
      <Masthead
        :title="title"
        :crumbs="[{ label: 'Tier list', href: '/tier-list' }, { label: 'Runes' }]"
        :meta="metaLine"
      >
        <template #end>
          <StatFilters :filter="filter" :patches="patches" />
        </template>
        <div class="tx-filters">
          <RoleSeg :value="position" all="All roles" />
          <div class="seg" role="radiogroup" aria-label="View">
            <button type="button" role="radio" :aria-checked="view === 'keystones'" :class="{ on: view === 'keystones' }" @click="view = 'keystones'">Keystones</button>
            <button type="button" role="radio" :aria-checked="view === 'pages'" :class="{ on: view === 'pages' }" @click="view = 'pages'">Full pages</button>
          </div>
          <label class="field tx-q sm">
            <Icon name="search" />
            <input v-model="query" type="text" placeholder="Filter runes" aria-label="Filter runes" />
          </label>
        </div>
      </Masthead>

      <Deferred data="list">
        <template #fallback>
          <article class="card computing"><Skeleton :rows="8" pic /></article>
        </template>
        <Computing v-if="list?.computing" :ahead="list.ahead" />
        <EmptyState
          v-else-if="!ready || !ready.rows.length"
          title="No rune pages for this filter"
          line="Too few games are stored for this patch, rank and region. A wider rank or every region has more."
        />
        <template v-else>
          <section class="g12" style="align-items: stretch">
            <article class="card" style="grid-column: span 8">
              <CardHead title="Keystones by tree" icon="grid" :meta="`Share of rune pages, ${role ? role.label.toLowerCase() : 'every role'}`" />
              <div class="ru-bands">
                <div v-for="b in bands" :key="b.style" class="ru-band">
                  <div class="ru-th">
                    <img :src="styleUrl(b.style)" alt="" />
                    <div><b>{{ name(b.style) }}</b><span>{{ Math.round(b.share * 100) }}%</span></div>
                  </div>
                  <div class="ru-ks">
                    <div v-for="(k, j) in b.keystones" :key="k.keystone" class="ru-k" :class="{ top: j === 0 }">
                      <img :src="perkUrl(k.keystone)" alt="" />
                      <span class="nm ell">{{ name(k.keystone) }}</span>
                      <span class="v">{{ p1(k.pick) }}%<span class="bar"><i :style="{ width: `${k.w}%` }" /></span></span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="ru-sh">
                <div v-for="(row, q) in ready.shards" :key="q">
                  <div class="hdr"><span class="h5">{{ ['Offense', 'Flex', 'Defense'][q] }}</span></div>
                  <div class="ti-stack">
                    <i v-for="(o, i) in row.slice(0, 4)" :key="o.shard" :style="{ width: `${o.share * 100}%`, background: SHADES[i] }" />
                  </div>
                  <div class="opts">
                    <span v-for="o in row.slice(0, 4)" :key="o.shard" class="o"
                      ><img :src="perkUrl(o.shard)" alt="" /><span class="ell">{{ name(o.shard) }}</span
                      ><b>{{ Math.round(o.share * 100) }}%</b></span
                    >
                  </div>
                </div>
              </div>
            </article>
            <MovedCard
              style="grid-column: span 4"
              :title="ready.previousPatch ? `Moved since ${patchName(ready.previousPatch)}` : 'Moved since last patch'"
              :meta="`Win rate, ${role ? role.label.toLowerCase() : 'every role'}`"
              :up="moved.up"
              :down="moved.down"
            >
              <template #face="{ m }">
                <img class="pic sm ru-face" :src="m.img ?? ''" alt="" />
              </template>
            </MovedCard>
          </section>

          <section class="sec" style="padding-top: 24px">
            <article v-if="view === 'keystones'" class="card" style="overflow: hidden">
              <div class="tx-head ru-head">
                <span>Keystone</span><span>Win rate</span><span>Pick rate</span><span>Played on</span><span>Paired with</span
                ><span>{{ ready.previousPatch ? `Since ${patchName(ready.previousPatch)}` : 'Since' }}</span>
              </div>
              <template v-for="g in groups" :key="g.t">
                <div class="tx-grp">
                  <TierChip :tier="g.t" large />
                  <span class="h4">{{ g.label }} tier</span>
                  <span class="meta">{{ g.rows.length }} keystone{{ g.rows.length === 1 ? '' : 's' }}</span>
                </div>
                <template v-for="r in g.rows" :key="r.keystone">
                  <div
                    class="tx-row ru-row"
                    :class="{ me: open === r.keystone }"
                    role="button"
                    tabindex="0"
                    :aria-expanded="open === r.keystone"
                    @click="toggle(r.keystone)"
                    @keydown.enter="toggle(r.keystone)"
                  >
                    <div class="tx-name">
                      <span class="tx-ks"><img :src="perkUrl(r.keystone)" alt="" loading="lazy" /></span>
                      <div class="col">
                        <span class="h4 ell">{{ name(r.keystone) }}</span>
                        <span class="meta ell"
                          >{{ name(r.style) }}<template v-if="topRole(r)"
                            ><i class="tx-dot" />{{ Math.round((topRole(r).games / r.games) * 100) }}%
                            {{ ROLE_WORD[topRole(r).position] }}</template
                          ></span
                        >
                      </div>
                    </div>
                    <Fig :value="p1(r.win)" :width="barWidth(r.win, winScale.lo, winScale.hi)" big mid />
                    <Fig :value="p1(r.pick)" :width="barWidth(r.pick, 0, pickMax)" />
                    <div class="tx-by">
                      <span class="tx-faces"
                        ><span v-for="c in r.champions.slice(0, 3)" :key="c.champion" class="fr xs" style="width: 26px; height: 26px"
                          ><img :src="champIconUrl(c.champion)" alt="" loading="lazy" /></span
                      ></span>
                      <span class="col" style="gap: 2px; min-width: 0"
                        ><b class="ell" style="font-size: 13.5px; font-weight: 650; color: var(--t1)"
                          >{{ r.mainOf }} champion{{ r.mainOf === 1 ? '' : 's' }}</b
                        ><span class="ell" style="font-size: 12px; color: var(--t3)">as their main rune</span></span
                      >
                    </div>
                    <div class="ru-sec">
                      <template v-if="r.secondary[0]">
                        <img :src="styleUrl(r.secondary[0].style)" alt="" />
                        <div class="col">
                          <b>{{ name(r.secondary[0].style) }}</b><span>Second tree in {{ Math.round(r.secondary[0].share * 100) }}%</span>
                        </div>
                      </template>
                    </div>
                    <SinceCell :d="r.delta === null ? null : r.delta * 100" />
                  </div>
                  <div v-if="open === r.keystone && r.pages[0]" class="ru-open">
                    <div>
                      <span class="lab">Most played {{ name(r.keystone) }} page</span>
                      <div class="ru-page">
                        <span class="ru-pt"
                          ><img class="tr0" :src="styleUrl(r.pages[0].page.primaryStyle)" alt="" /><img class="ks" :src="perkUrl(r.keystone)" alt="" /><img
                            v-for="x in r.pages[0].page.primary"
                            :key="x"
                            :src="perkUrl(x)"
                            alt=""
                        /></span>
                        <span class="ru-pt"
                          ><img class="tr0" :src="styleUrl(r.pages[0].page.secondaryStyle)" alt="" /><img
                            v-for="x in r.pages[0].page.secondary"
                            :key="x"
                            :src="perkUrl(x)"
                            alt=""
                        /></span>
                        <span class="ru-pt"><img v-for="(x, i) in r.pages[0].page.shards" :key="i" class="sh" :src="perkUrl(x)" alt="" /></span>
                      </div>
                      <p class="ti-pas" style="margin-top: 14px">{{ pageNames(r.pages[0].page) }}</p>
                      <div class="ru-pnum">
                        <span><b>{{ thousands(r.pages[0].games) }}</b>games</span>
                        <span><b>{{ p1(r.pages[0].win) }}%</b>win rate</span>
                        <span><b>{{ Math.round(r.pages[0].share * 100) }}%</b>of {{ name(r.keystone) }} pages</span>
                      </div>
                    </div>
                    <div>
                      <span class="lab">Next most played, what changes</span>
                      <div v-for="(p, i) in r.pages.slice(1, 4)" :key="i" class="ru-alt">
                        <span class="col" style="gap: 2px; min-width: 0"
                          ><b class="ell">{{ changes(r.pages[0].page, p.page) }}</b
                          ><span class="ell" style="font-size: 12px; color: var(--t3)"
                            >{{ name(p.page.secondaryStyle) }}: {{ p.page.secondary.map(name).join(', ') }}</span
                          ></span
                        >
                        <span class="n">{{ thousands(p.games) }}</span>
                        <span class="n w">{{ p1(p.win) }}%</span>
                      </div>
                      <p v-if="r.pages.length < 2" class="meta">No other page is played often enough yet.</p>
                    </div>
                  </div>
                </template>
              </template>
              <div class="tx-foot">
                <span class="meta"
                  >Counted from every player’s rune page{{ role ? ` in ${role.label.toLowerCase()}` : '' }}: {{ thousands(ready.games) }} pages. Pick
                  rate is the share of those pages; the tier compares the keystones with each other.</span
                >
              </div>
            </article>
            <article v-else class="card" style="overflow: hidden">
              <div class="tx-head ru-pg-head">
                <span>Full page</span><span class="r">Games</span><span>Win rate</span><span>Pick rate</span>
              </div>
              <div v-for="(p, i) in pages" :key="i" class="tx-row ru-pg-row">
                <div class="ru-page">
                  <span class="ru-pt"
                    ><img class="tr0" :src="styleUrl(p.page.primaryStyle)" alt="" /><img class="ks" :src="perkUrl(p.keystone)" alt="" /><img
                      v-for="x in p.page.primary"
                      :key="x"
                      :src="perkUrl(x)"
                      alt=""
                  /></span>
                  <span class="ru-pt"
                    ><img class="tr0" :src="styleUrl(p.page.secondaryStyle)" alt="" /><img v-for="x in p.page.secondary" :key="x" :src="perkUrl(x)" alt=""
                  /></span>
                  <span class="ru-pt hm"><img v-for="(x, k) in p.page.shards" :key="k" class="sh" :src="perkUrl(x)" alt="" /></span>
                </div>
                <span class="fg-xs t2 r">{{ thousands(p.games) }}</span>
                <Fig :value="p1(p.win)" :width="barWidth(p.win, winScale.lo, winScale.hi)" big mid />
                <Fig :value="p1(p.share)" :width="barWidth(p.share, 0, pages[0]?.share || 1)" />
              </div>
              <div class="tx-foot">
                <span class="meta">The {{ pages.length }} most played full pages{{ role ? ` in ${role.label.toLowerCase()}` : '' }}, each counted with every champion who runs it.</span>
              </div>
            </article>
          </section>
        </template>
      </Deferred>
    </div>
  </SiteLayout>
</template>
