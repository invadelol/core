<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Deferred, Head, Link } from '@inertiajs/vue3'
import '../../css/tier-lists.css'
import '../../css/tier-boards.css'
import SiteLayout from '../../components/SiteLayout.vue'
import Masthead from '../../components/ui/Masthead.vue'
import Icon from '../../components/ui/Icon.vue'
import TierChip from '../../components/ui/TierChip.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import Skeleton from '../../components/ui/Skeleton.vue'
import StatFilters from '../../components/champions/StatFilters.vue'
import RoleSeg from '../../components/champions/RoleSeg.vue'
import ClassSeg from '../../components/champions/ClassSeg.vue'
import Computing from '../../components/champions/Computing.vue'
import RecipeTree, { type RecipeNode } from '../../components/champions/RecipeTree.vue'
import { BRACKETS, TIERS, champIconUrl, compact, itemUrl, roleOf } from '../../lib/champions.js'
import { patchName } from '../../lib/patches.js'
import { ordinal, p1, points, thousands } from '../../lib/tier_lists.js'

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
  /** Its tier on the patch before (same role and class), null when it was not ranked then. */
  tierBefore: number | null
}
interface List {
  computing?: boolean
  ahead?: number | null
  games: number
  rows: Row[]
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
const classOptions = [
  { value: null, label: 'All classes' },
  ...(['marksman', 'mage', 'fighter', 'assassin', 'tank', 'support'] as Cls[]).map((c) => ({
    value: c,
    label: CLASS_LABEL[c],
  })),
]

const role = computed(() => (props.position ? roleOf(props.position) : null))
const roleWord = computed(() => role.value?.label.toLowerCase() ?? null)
const title = computed(() => {
  if (!role.value && !props.class) return 'Item tier list'
  const words = [
    role.value?.label,
    props.class ? CLASS_LABEL[props.class].toLowerCase() : null,
    'items',
  ]
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
  const what = [props.class ? CLASS_LABEL[props.class].toLowerCase() : null, 'items']
    .filter(Boolean)
    .join(' ')
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

/* ── The board: one band per tier, the items in it by games ── */
const query = ref('')
const bands = computed(() => {
  const q = query.value.trim().toLowerCase()
  const rows = (ready.value?.rows ?? []).filter(
    (r) => !q || nameOf(r.item).toLowerCase().includes(q)
  )
  return TIERS.map((label, t) => ({
    t,
    label,
    rows: rows.filter((r) => r.tier === t).sort((a, b) => b.win - a.win),
  })).filter((b) => b.rows.length)
})

/* ── The opened item ───────────────────────────────────────── */
const picked = ref<number | null>(null)
const sheet = ref(false)
const byItem = computed(() => new Map((ready.value?.rows ?? []).map((r) => [r.item, r])))
const open = computed(() => {
  const rows = ready.value?.rows ?? []
  return (picked.value !== null && byItem.value.get(picked.value)) || rows[0] || null
})
const detail = computed(() => (open.value ? ready.value?.details[open.value.item] : undefined))

const narrow = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches
function pick(item: number) {
  picked.value = item
  if (narrow()) sheet.value = true
  try {
    history.replaceState(history.state, '', `${location.pathname}${location.search}#item-${item}`)
  } catch {}
}
function fromHash() {
  const m = /^#item-(\d+)$/.exec(location.hash)
  if (m) picked.value = Number(m[1])
}
const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') sheet.value = false
}
onMounted(() => {
  fromHash()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
// A new filter keeps the opened item when it is still listed.
watch(ready, () => {
  if (picked.value !== null && !byItem.value.has(picked.value)) picked.value = null
})

/** The recipe two levels deep: the item and what it is built from. */
const recipe = computed<RecipeNode | null>(() => {
  const r = detail.value?.recipe
  return r ? { ...r, from: r.from.map((c) => ({ ...c, from: [] })) } : null
})
/** The order the parts are bought in, when there is an order to tell (two parts or more). */
const order = computed(() => {
  const o = open.value ? ready.value?.orders[open.value.item] : undefined
  return o && o.components.length > 1 ? o : undefined
})
const mainSlot = (r: Row) => r.slots.indexOf(Math.max(...r.slots))

/** How an item's tier moved since the patch before; null without that patch to compare. */
function moveOf(r: Row) {
  const before = ready.value?.previousPatch
  if (!before || r.tier === null) return null
  const patch = patchName(before)
  if (r.tierBefore === null) return { kind: 'new', text: `Not ranked on ${patch}` }
  if (r.tierBefore === r.tier) return { kind: 'eq', text: `Same tier as on ${patch}` }
  const up = r.tier < r.tierBefore
  return {
    kind: up ? 'up' : 'dn',
    text: `${up ? 'Up' : 'Down'} from ${TIERS[r.tierBefore]} since ${patch}`,
  }
}
/** The tiles mark only the items that changed tier. */
const moved = (r: Row) => {
  const m = moveOf(r)
  return m && (m.kind === 'up' || m.kind === 'dn') ? m : null
}
const classLabel = (r: Row) => (r.classes[0] ? CLASS_LABEL[r.classes[0]] : null)

/** The game's stat icons (`/cdn/stat/<name>`), by the stat's words; others get a small diamond. */
const STAT_ICON: [RegExp, string][] = [
  [/attack damage/i, 'ad'],
  [/ability power/i, 'ap'],
  [/ability haste/i, 'haste'],
  [/attack speed/i, 'as'],
  [/move(ment)? speed/i, 'ms'],
  [/magic resist/i, 'mr'],
  [/armor$/i, 'armor'],
  [/^health$/i, 'health'],
  [/tenacity/i, 'tenacity'],
]
const statIcon = (stat: string) => STAT_ICON.find(([re]) => re.test(stat.trim()))?.[1] ?? null
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
          <RoleSeg :value="position" all="All roles" icons />
          <ClassSeg :options="classOptions" :value="props.class" param="class" label="Item class" />
          <label class="field tx-q sm">
            <Icon name="search" />
            <input
              v-model="query"
              type="text"
              placeholder="Filter items"
              aria-label="Filter items"
            />
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
          <section class="ib">
            <div class="card ib-board">
              <div v-for="b in bands" :key="b.t" class="ib-band">
                <div class="ib-lab">
                  <TierChip :tier="b.t" large />
                  <span class="meta">{{ b.rows.length }}</span>
                </div>
                <div class="ib-tiles">
                  <button
                    v-for="r in b.rows"
                    :key="r.item"
                    type="button"
                    class="ib-t"
                    :class="{ on: open?.item === r.item }"
                    :aria-pressed="open?.item === r.item"
                    :title="
                      moved(r)
                        ? `${nameOf(r.item)}, ${moved(r)!.text.toLowerCase()}`
                        : nameOf(r.item)
                    "
                    @click="pick(r.item)"
                  >
                    <span class="ib-ic"
                      ><img
                        class="tb-ic"
                        :src="itemUrl(r.item)"
                        alt=""
                        width="48"
                        height="48"
                        loading="lazy"
                      /><i v-if="moved(r)" class="ib-mv" :class="moved(r)!.kind"
                        ><Icon name="arrow" :size="12" :stroke-width="2" /><span class="sr-only">{{
                          moved(r)!.text
                        }}</span></i
                      ></span
                    >
                    <span class="n">{{ nameOf(r.item) }}</span>
                    <span class="wr">{{ p1(r.win) }}%</span>
                  </button>
                </div>
              </div>
              <p v-if="!bands.length" class="meta ib-none">No item matches “{{ query }}”.</p>
            </div>

            <button
              v-if="sheet"
              type="button"
              class="ip-shade"
              aria-label="Close"
              @click="sheet = false"
            />
            <aside
              v-if="open && detail"
              class="card ip"
              :class="{ open: sheet }"
              aria-live="polite"
            >
              <div class="ip-h">
                <img class="tb-ic" :src="itemUrl(open.item)" alt="" width="64" height="64" />
                <div class="col">
                  <span class="h2">{{ detail.name }}</span>
                  <span class="row meta" style="gap: 8px">
                    <TierChip :tier="open.tier" />
                    <template v-if="classLabel(open)"
                      ><span>{{ classLabel(open) }}</span
                      ><span class="t4">·</span></template
                    >
                    <span class="gd">{{ thousands(detail.gold) }} gold</span>
                  </span>
                  <span v-if="moveOf(open)" class="ip-mv" :class="moveOf(open)!.kind"
                    ><Icon
                      v-if="moveOf(open)!.kind === 'up' || moveOf(open)!.kind === 'dn'"
                      name="arrow"
                      :size="14"
                    />{{ moveOf(open)!.text }}</span
                  >
                </div>
                <button type="button" class="ip-x" aria-label="Close" @click="sheet = false">
                  <Icon name="x" />
                </button>
              </div>
              <div class="ip-n">
                <span
                  ><span class="fg-m">{{ p1(open.win) }}<span class="u">%</span></span
                  ><span class="meta">Win rate</span></span
                >
                <span
                  ><span class="fg-m">{{ p1(open.pick) }}<span class="u">%</span></span
                  ><span class="meta">Pick rate</span></span
                >
                <span
                  ><span class="fg-m">{{ compact(open.games) }}</span
                  ><span class="meta">Games</span></span
                >
              </div>
              <div v-if="detail.stats.length" class="ip-sec">
                <span class="lab">Stats</span>
                <div class="ip-st">
                  <span v-for="s in detail.stats" :key="s.stat"
                    ><img v-if="statIcon(s.stat)" :src="`/cdn/stat/${statIcon(s.stat)}`" alt="" /><i
                      v-else
                    /><b>{{ s.value }}</b
                    >{{ s.stat }}</span
                  >
                </div>
              </div>
              <div v-if="recipe && recipe.from.length" class="ip-sec">
                <span class="lab">Recipe</span>
                <RecipeTree :node="recipe" root />
              </div>
              <div v-if="order" class="ip-sec">
                <span class="lab"
                  >Players buy the parts in this order,
                  {{ Math.round((order.games / order.of) * 100) }}% of
                  {{ thousands(order.of) }} builds</span
                >
                <div class="ip-po">
                  <template v-for="(c, k) in order.components" :key="c">
                    <Icon v-if="k" name="chevr" />
                    <span class="s" :title="nameOf(c)"
                      ><span class="k">{{ k + 1 }}</span
                      ><img class="tb-ic" :src="itemUrl(c)" alt="" width="30" height="30"
                    /></span>
                  </template>
                </div>
              </div>
              <div class="ip-sec">
                <span class="lab">Finished as the</span>
                <div
                  v-for="(s, k) in open.slots"
                  :key="k"
                  class="ip-sl"
                  :class="{ top: k === mainSlot(open) }"
                >
                  <span>{{ ordinal(k + 1) }} item</span>
                  <span class="bar"><i :style="{ width: `${s * 100}%` }" /></span>
                  <span class="n">{{ Math.round(s * 100) }}%</span>
                </div>
              </div>
              <div v-if="open.champions.length" class="ip-sec">
                <span class="lab">Built most by{{ roleWord ? `, in ${roleWord}` : '' }}</span>
                <div class="ip-bm">
                  <Link
                    v-for="c in open.champions"
                    :key="c.champion"
                    :href="champHref(c.champion)"
                    :title="champName(c.champion)"
                    ><img
                      class="tb-ic"
                      :src="champIconUrl(c.champion)"
                      :alt="champName(c.champion)"
                      width="40"
                      height="40"
                    />{{ Math.round((c.games / open.games) * 100) }}%</Link
                  >
                </div>
              </div>
              <div v-if="open.delta !== null && ready.previousPatch" class="ip-sec ip-f">
                <span class="meta"
                  >Win rate {{ points(open.delta) }} since
                  {{ patchName(ready.previousPatch) }}</span
                >
                <span class="meta">{{ open.championCount }} champions build it</span>
              </div>
            </aside>
          </section>
          <p class="meta tb-note">
            Win rate of the {{ thousands(ready.games) }} {{ roleWord ? `${roleWord} ` : '' }}games
            where the item is one of the first three legendary items finished. The tier compares the
            items shown with each other; an item’s class is the class of the champions who build it.
          </p>
        </template>
      </Deferred>
    </div>
  </SiteLayout>
</template>
