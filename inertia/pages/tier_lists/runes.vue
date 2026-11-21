<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Deferred, Head, Link } from '@inertiajs/vue3'
import { RoleIcon } from '@invadelol/ui'
import '../../css/tier-lists.css'
import '../../css/tier-boards.css'
import SiteLayout from '../../components/SiteLayout.vue'
import Masthead from '../../components/ui/Masthead.vue'
import RankTag from '../../components/ui/RankTag.vue'
import Icon from '../../components/ui/Icon.vue'
import TierChip from '../../components/ui/TierChip.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import Skeleton from '../../components/ui/Skeleton.vue'
import StatFilters from '../../components/champions/StatFilters.vue'
import RoleSeg from '../../components/champions/RoleSeg.vue'
import Computing from '../../components/champions/Computing.vue'
import { champIconUrl, perkUrl, roleOf, styleUrl } from '../../lib/champions.js'
import { patchName } from '../../lib/patches.js'
import { p1, points, thousands } from '../../lib/tier_lists.js'

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
interface Tree {
  style: number
  share: number
  paired?: { style: number; share: number } | null
  rows?: { rune: number; share: number }[][]
}
interface List {
  computing?: boolean
  ahead?: number | null
  games: number
  rows: Row[]
  trees: Tree[]
  shards: { shard: number; share: number }[][]
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
const where = computed(() =>
  role.value ? `in ${role.value.label.toLowerCase()}` : 'in every role'
)
/** What follows the rank filter in the masthead's line ("Patch 26.22, Emerald+, …"). */
const metaTail = computed(() =>
  ready.value
    ? `, ${ready.value.rows.length} keystones, ${thousands(ready.value.games)} games ${where.value}`
    : ''
)
const name = (id: number) => ready.value?.names[id] ?? ''
const champs = computed(() => new Map((ready.value?.champions ?? []).map((c) => [c.id, c])))
const champName = (id: number) => champs.value.get(id)?.name ?? ''
const champHref = (id: number) => {
  const c = champs.value.get(id)
  return c ? `/champions/${c.slug}/runes${role.value ? `?role=${role.value.slug}` : ''}` : '#'
}
const ROLE_LANE = {
  TOP: { lane: 'TOP', label: 'Top' },
  JUNGLE: { lane: 'JUNGLE', label: 'Jungle' },
  MIDDLE: { lane: 'MID', label: 'Mid' },
  BOTTOM: { lane: 'ADC', label: 'Bot' },
  UTILITY: { lane: 'SUPPORT', label: 'Support' },
} as const satisfies Record<Position, { lane: string; label: string }>

/* ── The rune page: a column per tree, keystones by tier ────── */
const query = ref('')
const matches = (id: number) => {
  const q = query.value.trim().toLowerCase()
  return !q || name(id).toLowerCase().includes(q)
}
const columns = computed(() => {
  if (!ready.value) return []
  return ready.value.trees.map((t) => ({
    ...t,
    keystones: ready
      .value!.rows.filter((r) => r.style === t.style)
      .sort((a, b) => (a.tier ?? 9) - (b.tier ?? 9) || b.win - a.win),
    rows: t.rows ?? [],
  }))
})

/* ── The opened keystone ───────────────────────────────────── */
const picked = ref<number | null>(null)
const tab = ref<number | null>(null)
const byKeystone = computed(() => new Map((ready.value?.rows ?? []).map((r) => [r.keystone, r])))
const open = computed(() => {
  if (picked.value !== null) {
    const r = byKeystone.value.get(picked.value)
    if (r) return r
  }
  return [...(ready.value?.rows ?? [])].sort((a, b) => b.games - a.games)[0] ?? null
})
/** On a phone one tree shows at a time: the one picked, else the opened keystone's. */
const shownTree = computed(() => tab.value ?? open.value?.style ?? columns.value[0]?.style ?? null)
function pick(keystone: number) {
  picked.value = keystone
  try {
    history.replaceState(
      history.state,
      '',
      `${location.pathname}${location.search}#rune-${keystone}`
    )
  } catch {}
}
onMounted(() => {
  const m = /^#rune-(\d+)$/.exec(location.hash)
  if (m) picked.value = Number(m[1])
})
watch(ready, () => {
  if (picked.value !== null && !byKeystone.value.has(picked.value)) picked.value = null
})
const morePages = ref(false)
watch(open, () => (morePages.value = false))
const mainPage = computed(() => open.value?.pages[0] ?? null)
const SHARD_ROWS = ['Offense', 'Flex', 'Defense']
</script>

<template>
  <Head :title="title" />
  <SiteLayout>
    <div class="wrap">
      <Masthead
        :title="title"
        :crumbs="[{ label: 'Tier list', href: '/tier-list' }, { label: 'Runes' }]"
        meta="No ranked games stored yet"
      >
        <template v-if="filter" #meta
          >Patch {{ patchName(filter.patch) }}, <RankTag :bracket="filter.bracket" />{{
            metaTail
          }}</template
        >
        <template #end>
          <StatFilters :filter="filter" :patches="patches" />
        </template>
        <div class="tx-filters">
          <RoleSeg :value="position" all="All roles" />
          <label class="field tx-q sm">
            <Icon name="search" />
            <input
              v-model="query"
              type="text"
              placeholder="Filter runes"
              aria-label="Filter runes"
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
          title="No rune pages for this filter"
          line="Too few games are stored for this patch, rank and region. A wider rank or every region has more."
        />
        <template v-else>
          <div class="seg ra-tabs" role="tablist" aria-label="Rune tree">
            <button
              v-for="c in columns"
              :key="c.style"
              type="button"
              role="tab"
              :aria-selected="shownTree === c.style"
              :aria-label="name(c.style)"
              :class="{ on: shownTree === c.style }"
              @click="tab = c.style"
            >
              <img :src="styleUrl(c.style)" alt="" />
            </button>
          </div>
          <section class="ra">
            <article
              v-for="c in columns"
              :key="c.style"
              class="card ra-c"
              :class="{ cur: shownTree === c.style }"
            >
              <div class="ra-h">
                <img :src="styleUrl(c.style)" alt="" />
                <span class="h4">{{ name(c.style) }}</span>
                <span class="meta">{{ Math.round(c.share * 100) }}%</span>
              </div>
              <div class="ra-ks">
                <button
                  v-for="k in c.keystones"
                  :key="k.keystone"
                  type="button"
                  class="ra-k"
                  :class="{ on: open?.keystone === k.keystone, dim: !matches(k.keystone) }"
                  :aria-pressed="open?.keystone === k.keystone"
                  @click="pick(k.keystone)"
                >
                  <img class="tb-rd" :src="perkUrl(k.keystone)" alt="" width="40" height="40" />
                  <span class="col">
                    <span class="nm">{{ name(k.keystone) }}</span>
                    <span class="meta">{{ p1(k.pick) }}% of pages</span>
                  </span>
                  <span class="rt">
                    <TierChip :tier="k.tier" />
                    <span class="wr">{{ p1(k.win) }}%</span>
                  </span>
                </button>
              </div>
              <div class="ra-mt">
                <span v-if="c.rows.length" class="ra-then">Then, most taken</span>
                <div v-for="(row, q) in c.rows" :key="q" class="ra-m">
                  <span
                    v-for="(m, j) in row"
                    :key="m.rune"
                    :class="{
                      top: j === row.indexOf(row.reduce((a, b) => (b.share > a.share ? b : a))),
                      dim: !matches(m.rune),
                    }"
                    :title="name(m.rune)"
                  >
                    <img
                      class="tb-rd"
                      :src="perkUrl(m.rune)"
                      :alt="name(m.rune)"
                      width="34"
                      height="34"
                    />{{ Math.round(m.share * 100) }}%
                  </span>
                </div>
              </div>
              <div class="ra-foot">
                <template v-if="c.paired"
                  >Paired most with {{ name(c.paired.style) }},
                  {{ Math.round(c.paired.share * 100) }}%</template
                >
              </div>
            </article>
          </section>

          <section class="ra-low">
            <article class="card ra-shc">
              <div class="card-h">
                <Icon name="grid" />
                <span class="h4">Shards</span>
                <span class="meta">{{ role ? role.label.toLowerCase() : 'every role' }}</span>
              </div>
              <div class="ra-sh">
                <div v-for="(row, q) in ready.shards" :key="q" class="shr">
                  <span>{{ SHARD_ROWS[q] }}</span>
                  <span
                    v-for="(o, j) in row.slice(0, 3)"
                    :key="o.shard"
                    class="o"
                    :class="{ top: j === 0 }"
                    :title="name(o.shard)"
                    ><img :src="perkUrl(o.shard)" :alt="name(o.shard)" />{{
                      Math.round(o.share * 100)
                    }}%</span
                  >
                </div>
              </div>
            </article>

            <article v-if="open" class="card ro-card">
              <div class="card-h">
                <img class="tb-rd" :src="perkUrl(open.keystone)" alt="" />
                <span class="h4">{{ name(open.keystone) }}</span>
                <TierChip :tier="open.tier" />
                <span class="meta">{{ name(open.style) }} keystone</span>
                <button
                  v-if="open.pages.length > 1"
                  type="button"
                  class="more"
                  :aria-expanded="morePages"
                  @click="morePages = !morePages"
                >
                  {{ morePages ? 'Most played page only' : `${open.pages.length - 1} more pages`
                  }}<Icon :name="morePages ? 'min' : 'chev'" />
                </button>
              </div>
              <div class="ro" :class="{ two: position }">
                <div>
                  <template v-if="mainPage">
                    <span class="lab">Most played full page</span>
                    <div
                      class="pg"
                      :title="`${mainPage.page.primary.map(name).join(', ')}. ${name(mainPage.page.secondaryStyle)}: ${mainPage.page.secondary.map(name).join(', ')}.`"
                    >
                      <span class="grp"
                        ><img class="tr" :src="styleUrl(mainPage.page.primaryStyle)" alt="" /><img
                          class="ks"
                          :src="perkUrl(open.keystone)"
                          alt="" /><img
                          v-for="x in mainPage.page.primary"
                          :key="x"
                          :src="perkUrl(x)"
                          :alt="name(x)"
                      /></span>
                      <span class="grp"
                        ><img class="tr" :src="styleUrl(mainPage.page.secondaryStyle)" alt="" /><img
                          v-for="x in mainPage.page.secondary"
                          :key="x"
                          :src="perkUrl(x)"
                          :alt="name(x)"
                      /></span>
                      <span class="grp"
                        ><img
                          v-for="(x, i) in mainPage.page.shards"
                          :key="i"
                          class="sh"
                          :src="perkUrl(x)"
                          :alt="name(x)"
                      /></span>
                    </div>
                    <div class="ro-num">
                      <span
                        ><b>{{ thousands(mainPage.games) }}</b
                        ><span class="meta">games</span></span
                      >
                      <span
                        ><b>{{ p1(mainPage.win) }}%</b><span class="meta">win rate</span></span
                      >
                      <span
                        ><b>{{ Math.round(mainPage.share * 100) }}%</b
                        ><span class="meta">of {{ name(open.keystone) }} pages</span></span
                      >
                    </div>
                    <div v-if="morePages" class="ro-alt">
                      <div v-for="(p, i) in open.pages.slice(1)" :key="i">
                        <div class="pg">
                          <span class="grp"
                            ><img class="tr" :src="styleUrl(p.page.primaryStyle)" alt="" /><img
                              class="ks"
                              :src="perkUrl(p.page.keystone)"
                              alt="" /><img
                              v-for="x in p.page.primary"
                              :key="x"
                              :src="perkUrl(x)"
                              :alt="name(x)"
                          /></span>
                          <span class="grp"
                            ><img class="tr" :src="styleUrl(p.page.secondaryStyle)" alt="" /><img
                              v-for="x in p.page.secondary"
                              :key="x"
                              :src="perkUrl(x)"
                              :alt="name(x)"
                          /></span>
                        </div>
                        <span class="n"
                          ><b>{{ p1(p.win) }}%</b>{{ thousands(p.games) }} games</span
                        >
                      </div>
                    </div>
                  </template>
                  <p v-else class="meta">No full page is played often enough yet.</p>
                </div>
                <div>
                  <span class="lab">Taken most by</span>
                  <div class="ro-who">
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
                  <p
                    v-if="open.delta !== null && ready.previousPatch"
                    class="meta"
                    style="margin-top: 16px"
                  >
                    Win rate {{ points(open.delta) }} since {{ patchName(ready.previousPatch) }}
                  </p>
                </div>
                <div v-if="!position">
                  <span class="lab">In which role</span>
                  <div
                    v-for="r in open.roles.filter((x) => x.games / open!.games >= 0.01)"
                    :key="r.position"
                    class="ro-rl"
                  >
                    <span
                      ><RoleIcon :lane="ROLE_LANE[r.position].lane" :size="14" />{{
                        ROLE_LANE[r.position].label
                      }}</span
                    >
                    <span class="bar"
                      ><i :style="{ width: `${(r.games / open.games) * 100}%` }"
                    /></span>
                    <span class="n">{{ Math.round((r.games / open.games) * 100) }}%</span>
                  </div>
                </div>
              </div>
            </article>
          </section>
          <p class="meta tb-note">
            Read like the rune page in the client: each tree with its keystones ranked, then the
            rune most taken in each row. Pick rate is the share of the
            {{ thousands(ready.games) }} rune pages
            {{ role ? `in ${role.label.toLowerCase()}` : 'in every role' }}; the tier compares a
            keystone with every other one.
          </p>
        </template>
      </Deferred>
    </div>
  </SiteLayout>
</template>
