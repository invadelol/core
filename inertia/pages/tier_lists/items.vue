<script setup lang="ts">
import { computed, ref } from 'vue'
import { Deferred, Head, Link } from '@inertiajs/vue3'
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
import ClassSeg from '../../components/champions/ClassSeg.vue'
import MovedCard, { type Moved } from '../../components/champions/MovedCard.vue'
import Fig from '../../components/champions/Fig.vue'
import SinceCell from '../../components/champions/SinceCell.vue'
import Computing from '../../components/champions/Computing.vue'
import RecipeTree, { type RecipeNode } from '../../components/champions/RecipeTree.vue'
import { BRACKETS, TIERS, champIconUrl, itemUrl, roleOf } from '../../lib/champions.js'
import { patchName } from '../../lib/patches.js'
import { barWidth, movers, ordinal, p1, thousands } from '../../lib/tier_lists.js'

type Position = 'TOP' | 'JUNGLE' | 'MIDDLE' | 'BOTTOM' | 'UTILITY'
type Cls = 'mage' | 'assassin' | 'fighter' | 'marksman' | 'tank' | 'support'

interface Row {
  item: number
  games: number
  win: number
  pick: number
  tier: number | null
  slots: [number, number, number]
  champions: { champion: number; games: number }[]
  championCount: number
  classes: Cls[]
  delta: number | null
}
interface List {
  computing?: boolean
  ahead?: number | null
  games: number
  rows: Row[]
  build: {
    class: Cls | null
    champions: number
    games: number
    slots: { item: number; share: number }[][]
    boots: { item: number; share: number }[]
    timing: Record<'before' | 'first' | 'second' | 'third' | 'never', number>
  }
  orders: Record<number, { components: number[]; games: number; of: number }>
  minGames: number
  patch: string
  previousPatch: string | null
  details: Record<
    number,
    {
      name: string
      gold: number
      recipe: RecipeNode
      stats: { value: string; stat: string }[]
      effects: { kind: string; name: string; text: string }[]
    }
  >
  names: Record<number, string>
  champions: { id: number; name: string; slug: string }[]
}

const props = defineProps<{
  list?: List | null
  position: Position | null
  class: Cls | null
  filter: { patch: string; bracket: string; region: string | null } | null
  patches: { patch: string; games: number }[]
}>()

const CLASS_LABEL: Record<Cls, string> = {
  mage: 'Mage',
  assassin: 'Assassin',
  fighter: 'Fighter',
  marksman: 'Marksman',
  tank: 'Tank',
  support: 'Support',
}
const CLASS_PEOPLE: Record<Cls, string> = {
  mage: 'mages',
  assassin: 'assassins',
  fighter: 'fighters',
  marksman: 'marksmen',
  tank: 'tanks',
  support: 'supports',
}
const classOptions = [
  { value: null, label: 'All items' },
  ...(Object.keys(CLASS_LABEL) as Cls[]).map((c) => ({ value: c, label: CLASS_LABEL[c] })),
]

const role = computed(() => (props.position ? roleOf(props.position) : null))
const roleWord = computed(() => role.value?.label.toLowerCase() ?? null)
const title = computed(() => {
  if (!role.value && !props.class) return 'Item tier list'
  const words = [role.value?.label, props.class ? CLASS_LABEL[props.class].toLowerCase() : null, 'items']
  const text = words.filter(Boolean).join(' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
})
const rankText = computed(() => {
  const b = BRACKETS.find((x) => x.value === props.filter?.bracket)
  if (!b || b.value === 'all') return 'every rank'
  return b.label.endsWith('+') ? `${b.label.slice(0, -1)} and above` : b.label
})
const ready = computed(() => (props.list && !props.list.computing ? props.list : null))
const metaLine = computed(() => {
  if (!props.filter) return 'No ranked games stored yet'
  const n = ready.value?.rows.length
  const what = [props.class ? CLASS_LABEL[props.class].toLowerCase() : null, 'items'].filter(Boolean).join(' ')
  const where = roleWord.value ? `in ${roleWord.value} builds` : 'in every role'
  return `Patch ${patchName(props.filter.patch)}, ${rankText.value}${n !== undefined ? `, ${n} ${what} ${where}` : ''}`
})

const nameOf = (id: number) => ready.value?.details[id]?.name ?? ready.value?.names[id] ?? ''
const champs = computed(() => new Map((ready.value?.champions ?? []).map((c) => [c.id, c])))
const champName = (id: number) => champs.value.get(id)?.name ?? ''
const champHref = (id: number) => {
  const c = champs.value.get(id)
  return c ? `/champions/${c.slug}${role.value ? `?role=${role.value.slug}` : ''}` : '#'
}

/* ── What the class builds, in order ────────────────────────── */
const people = computed(() => {
  const who = props.class ? CLASS_PEOPLE[props.class] : 'players'
  return roleWord.value ? `${roleWord.value} ${who}` : who
})
const TIMING = [
  ['before', 'Before the first item', 'var(--v300)'],
  ['first', 'After the first', 'var(--v500)'],
  ['second', 'After the second', 'var(--v700)'],
  ['third', 'After the third', 'var(--v800)'],
  ['never', 'Never', 'var(--s4)'],
] as const

/* ── Moved since the patch before ───────────────────────────── */
const moved = computed(() => {
  const m = movers(ready.value?.rows ?? [], (r) => r.delta)
  const toRow = ({ r, d }: { r: Row; d: number }): Moved => ({
    key: r.item,
    name: nameOf(r.item),
    d: d * 100,
    img: itemUrl(r.item),
  })
  return { up: m.up.map(toRow), down: m.down.map(toRow) }
})

/* ── Table ──────────────────────────────────────────────────── */
const query = ref('')
const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  return (ready.value?.rows ?? []).filter((r) => !q || nameOf(r.item).toLowerCase().includes(q))
})
const FIRST = 20
const all = ref(false)
const groups = computed(() => {
  let left = all.value ? Infinity : FIRST
  return TIERS.map((label, t) => {
    const list = shown.value.filter((r) => r.tier === t)
    const rows = list.slice(0, Math.max(0, left))
    left -= rows.length
    return { t, label, total: list.length, rows }
  }).filter((g) => g.rows.length > 0)
})
const hidden = computed(() => Math.max(0, shown.value.length - (all.value ? Infinity : FIRST)))
const groupMeta = (g: { total: number; rows: Row[] }) =>
  g.rows.length === g.total ? `${g.total} item${g.total === 1 ? '' : 's'}` : `Showing ${g.rows.length} of ${g.total}`
const winScale = computed(() => {
  const w = shown.value.map((r) => r.win)
  return { lo: Math.min(0.48, ...w) - 0.01, hi: Math.max(0.56, ...w) }
})
const pickMax = computed(() => Math.max(0.05, ...shown.value.map((r) => r.pick)))
const mainSlot = (r: Row) => r.slots.indexOf(Math.max(...r.slots))
const slotText = (r: Row) => {
  const s = mainSlot(r)
  return r.slots[s] >= 0.6 ? `usually ${ordinal(s + 1)} item` : '1st to 3rd item'
}
const partGold = (item: number, part: number) =>
  ready.value?.details[item]?.recipe.from.find((n) => n.item === part)?.gold ?? null
const open = ref<number | null>(null)
const toggle = (item: number) => (open.value = open.value === item ? null : item)
</script>

<template>
  <Head :title="title" />
  <SiteLayout>
    <div class="wrap">
      <Masthead
        :title="title"
        :crumbs="[{ label: 'Tier list', href: '/tier-list' }, { label: 'Items' }]"
        :meta="metaLine"
      >
        <template #end>
          <StatFilters :filter="filter" :patches="patches" />
        </template>
        <div class="tx-filters">
          <RoleSeg :value="position" all="All roles" />
          <ClassSeg :options="classOptions" :value="props.class" param="class" label="Item class" />
          <label class="field tx-q sm">
            <Icon name="search" />
            <input v-model="query" type="text" placeholder="Filter items" aria-label="Filter items" />
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
          title="No items for this filter"
          line="Too few games are stored for this patch, rank and region. A wider rank or every region has more."
        />
        <template v-else>
          <section class="g12" style="align-items: stretch">
            <article class="card" style="grid-column: span 8">
              <CardHead
                :title="`What ${people} build, in order`"
                icon="layers"
                :meta="`${ready.build.champions} ${roleWord ? `${roleWord} ` : ''}champions, share of their games`"
              />
              <div class="ti-ord">
                <div
                  v-for="(slot, k) in [...ready.build.slots, ready.build.boots]"
                  :key="k"
                  class="ti-col"
                >
                  <span class="lab">{{ ['First item', 'Second item', 'Third item', 'Boots'][k] }}</span>
                  <div v-for="(o, j) in slot" :key="o.item" class="ti-o" :class="{ top: j === 0 }">
                    <img :src="itemUrl(o.item)" alt="" />
                    <span class="nm ell">{{ nameOf(o.item) }}</span>
                    <span class="v"
                      >{{ p1(o.share) }}%<span class="bar"
                        ><i :style="{ width: `${(o.share / (slot[0]?.share || 1)) * 100}%` }" /></span
                    ></span>
                  </div>
                </div>
              </div>
              <div class="ti-bt">
                <div class="hdr">
                  <span class="h5">When they buy their boots</span>
                  <span class="meta">From {{ thousands(ready.build.games) }} games of the same champions</span>
                </div>
                <div class="ti-stack">
                  <i
                    v-for="[k, , shade] in TIMING.filter(([key]) => ready!.build.timing[key] > 0)"
                    :key="k"
                    :style="{ width: `${ready.build.timing[k] * 100}%`, background: shade }"
                  />
                </div>
                <div class="ti-legend">
                  <span v-for="[k, label] in TIMING" :key="k"
                    ><b>{{ Math.round(ready.build.timing[k] * 100) }}%</b>{{ label }}</span
                  >
                </div>
              </div>
            </article>
            <MovedCard
              style="grid-column: span 4"
              :title="ready.previousPatch ? `Moved since ${patchName(ready.previousPatch)}` : 'Moved since last patch'"
              :meta="`Win rate, ${props.class ? `${CLASS_LABEL[props.class].toLowerCase()} items` : 'every item'}`"
              :up="moved.up"
              :down="moved.down"
            />
          </section>

          <section class="sec" style="padding-top: 24px">
            <article class="card" style="overflow: hidden">
              <div class="tx-head ti-head">
                <span>Item</span><span>Win rate</span><span>Pick rate</span><span class="r">Games</span
                ><span>Built most by</span><span>Slot</span
                ><span>{{ ready.previousPatch ? `Since ${patchName(ready.previousPatch)}` : 'Since' }}</span>
              </div>
              <template v-for="g in groups" :key="g.t">
                <div class="tx-grp">
                  <TierChip :tier="g.t" large />
                  <span class="h4">{{ g.label }} tier</span>
                  <span class="meta">{{ groupMeta(g) }}</span>
                </div>
                <template v-for="r in g.rows" :key="r.item">
                  <div
                    class="tx-row ti-row"
                    :class="{ me: open === r.item }"
                    role="button"
                    tabindex="0"
                    :aria-expanded="open === r.item"
                    @click="toggle(r.item)"
                    @keydown.enter="toggle(r.item)"
                  >
                    <div class="tx-name">
                      <span class="fr s tx-ic"><img :src="itemUrl(r.item)" alt="" loading="lazy" /></span>
                      <div class="col">
                        <span class="h4 ell">{{ nameOf(r.item) }}</span>
                        <span class="meta ell"
                          >{{ thousands(ready.details[r.item]?.gold ?? 0) }} gold<i class="tx-dot" />{{
                            slotText(r)
                          }}</span
                        >
                      </div>
                    </div>
                    <Fig :value="p1(r.win)" :width="barWidth(r.win, winScale.lo, winScale.hi)" big />
                    <Fig :value="p1(r.pick)" :width="barWidth(r.pick, 0, pickMax)" />
                    <span class="fg-xs t2 r">{{ thousands(r.games) }}</span>
                    <div class="tx-by">
                      <span class="tx-faces"
                        ><span
                          v-for="c in r.champions.slice(0, 3)"
                          :key="c.champion"
                          class="fr xs"
                          style="width: 26px; height: 26px"
                          ><img :src="champIconUrl(c.champion)" alt="" loading="lazy" /></span
                      ></span>
                      <span class="ell"
                        >{{ r.champions.slice(0, 2).map((c) => champName(c.champion)).join(', ')
                        }}<span v-if="r.championCount > 2" class="t3"> +{{ r.championCount - 2 }}</span></span
                      >
                    </div>
                    <div class="ti-slot">
                      <span class="sb"
                        ><i
                          v-for="(s, k) in r.slots"
                          :key="k"
                          :class="{ on: s >= 0.5, half: s >= 0.15 && s < 0.5 }"
                      /></span>
                      <span class="t">{{ ordinal(mainSlot(r) + 1) }} in {{ Math.round(r.slots[mainSlot(r)] * 100) }}%</span>
                    </div>
                    <SinceCell :d="r.delta === null ? null : r.delta * 100" />
                  </div>
                  <div v-if="open === r.item && ready.details[r.item]" class="ti-open">
                    <div>
                      <span class="lab">Recipe</span>
                      <RecipeTree :node="ready.details[r.item].recipe" root />
                    </div>
                    <div>
                      <template v-if="ready.orders[r.item]">
                        <span class="lab"
                          >Bought in this order, in {{ thousands(ready.orders[r.item].games) }} of
                          {{ thousands(ready.orders[r.item].of) }} builds</span
                        >
                        <div class="ti-step">
                          <template v-for="(c, k) in ready.orders[r.item].components" :key="c">
                            <span class="s"
                              ><span class="k">{{ k + 1 }}</span><img :src="itemUrl(c)" alt="" /><span
                                ><b>{{ nameOf(c) }}</b
                                ><span v-if="partGold(r.item, c)">{{ thousands(partGold(r.item, c)!) }} gold</span></span
                              ></span
                            ><Icon name="chevr" />
                          </template>
                          <span class="s fin"
                            ><img :src="itemUrl(r.item)" alt="" /><span
                              ><b>{{ nameOf(r.item) }}</b
                              ><span>{{ thousands(ready.details[r.item].gold) }} gold</span></span
                            ></span
                          >
                        </div>
                      </template>
                      <span v-else class="lab">What it gives</span>
                      <div class="ti-stats">
                        <span v-for="s in ready.details[r.item].stats" :key="s.stat">{{ s.value }} {{ s.stat }}</span>
                      </div>
                      <p v-for="e in ready.details[r.item].effects" :key="e.name" class="ti-pas">
                        <b>{{ e.name }}.</b> {{ e.text }}
                      </p>
                    </div>
                    <div>
                      <span class="lab">Built most by{{ roleWord ? `, in ${roleWord}` : '' }}</span>
                      <Link v-for="c in r.champions" :key="c.champion" class="ti-bm" :href="champHref(c.champion)">
                        <span class="fr xs" style="width: 28px; height: 28px"><img :src="champIconUrl(c.champion)" alt="" /></span>
                        <span class="col"
                          ><span class="h5 ell">{{ champName(c.champion) }}</span
                          ><span class="bar"
                            ><i :style="{ width: `${(c.games / (r.champions[0]?.games || 1)) * 100}%` }" /></span
                        ></span>
                        <span class="n">{{ Math.round((c.games / r.games) * 100) }}%</span>
                      </Link>
                    </div>
                  </div>
                </template>
              </template>
              <div class="tx-foot">
                <span class="meta"
                  >Win and pick rate of the games where the item is one of the first three legendary items
                  finished: {{ thousands(ready.games) }} {{ roleWord ?? '' }} games. An item’s class is the class of
                  the champions who build it. The tier compares the items shown with each other.</span
                >
                <button v-if="hidden" class="btn sm" type="button" @click="all = true">
                  Show {{ hidden }} more items<Icon name="chev" />
                </button>
              </div>
            </article>
          </section>
        </template>
      </Deferred>
    </div>
  </SiteLayout>
</template>
