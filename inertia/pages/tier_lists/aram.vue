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
import SortHead from '../../components/ui/SortHead.vue'
import { useSort } from '../../components/ui/sort.js'
import StatFilters from '../../components/champions/StatFilters.vue'
import ClassSeg from '../../components/champions/ClassSeg.vue'
import Fig from '../../components/champions/Fig.vue'
import { TIERS, champIconUrl, perkUrl } from '../../lib/champions.js'
import { patchName } from '../../lib/patches.js'
import { barWidth, thousands } from '../../lib/tier_lists.js'

type Cls = 'mage' | 'assassin' | 'fighter' | 'marksman' | 'tank' | 'support'
interface Row {
  champion: number
  games: number
  win: number
  pick: number
  kda: number
  tier: number | null
  rank: number | null
  keystone: { keystone: number; style: number; share: number } | null
}
interface List {
  games: number
  enough: boolean
  rows: Row[]
  minGames: number
  patch: string
  mode: 'aram' | 'mayhem'
  names: Record<number, string>
  champions: { id: number; name: string; slug: string; class: Cls | null }[]
}

const props = defineProps<{
  list?: List | null
  mode: 'aram' | 'mayhem'
  filter: { patch: string; bracket: string; region: string | null } | null
  patches: { patch: string; games: number }[]
}>()

const CLASS_LABEL: Record<Cls, string> = {
  mage: 'Mage',
  marksman: 'Marksman',
  fighter: 'Fighter',
  tank: 'Tank',
  assassin: 'Assassin',
  support: 'Support',
}
const label = computed(() => (props.mode === 'mayhem' ? 'ARAM: Mayhem' : 'ARAM'))
const title = computed(() => `${label.value} tier list`)
const metaLine = computed(() =>
  props.filter
    ? `Patch ${patchName(props.filter.patch)}, Howling Abyss${props.list ? `, ${thousands(props.list.games)} games` : ''}`
    : 'No games stored yet'
)
const champs = computed(() => new Map((props.list?.champions ?? []).map((c) => [c.id, c])))
const nm = (id: number) => champs.value.get(id)?.name ?? ''
const clsOf = (id: number) => champs.value.get(id)?.class ?? null
const href = (id: number) => {
  const c = champs.value.get(id)
  return c ? `/champions/${c.slug}` : '#'
}

const cls = ref<Cls | null>(null)
const query = ref('')
const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  return (props.list?.rows ?? []).filter(
    (r) => (!cls.value || clsOf(r.champion) === cls.value) && (!q || nm(r.champion).toLowerCase().includes(q))
  )
})
const ranked = computed(() => (props.list?.rows ?? []).filter((r) => r.rank !== null).length)
const bands = computed(() =>
  TIERS.map((label, t) => ({ t, label, rows: shown.value.filter((r) => r.tier === t) })).filter((b) => b.rows.length)
)
const FIRST = [9, 8, 6]
const all = ref(false)
const sort = useSort(() => shown.value.filter((r) => r.tier !== null), {
  name: (r) => nm(r.champion),
  win: (r) => r.win,
  pick: (r) => r.pick,
  games: (r) => r.games,
  kda: (r) => r.kda,
}, { first: { name: 'asc' } })
const groups = computed(() => {
  if (sort.key) {
    const rows = all.value ? sort.rows : sort.rows.slice(0, FIRST.reduce((a, b) => a + b, 0))
    return [{ t: null as number | null, label: '', total: sort.rows.length, rows }]
  }
  return TIERS.map((label, t) => {
    const list = shown.value.filter((r) => r.tier === t)
    return { t: t as number | null, label, total: list.length, rows: all.value ? list : list.slice(0, FIRST[t] ?? 0) }
  }).filter((g) => g.rows.length)
})
const hidden = computed(
  () => shown.value.filter((r) => r.tier !== null).length - groups.value.reduce((n, g) => n + g.rows.length, 0)
)
const pickMax = computed(() => Math.max(0.1, ...shown.value.map((r) => r.pick)))
</script>

<template>
  <Head :title="title" />
  <SiteLayout>
    <div class="wrap">
      <Masthead :title="title" :crumbs="[{ label: 'Tier list', href: '/tier-list' }, { label: 'ARAM' }]" :meta="metaLine">
        <template #end>
          <StatFilters :filter="filter" :patches="patches" :rank="false" default-rank="all" />
        </template>
        <div class="tx-filters">
          <ClassSeg
            :options="[
              { value: null, label: 'ARAM' },
              { value: 'mayhem', label: 'ARAM: Mayhem' },
            ]"
            :value="mode === 'aram' ? null : mode"
            param="mode"
            label="Mode"
          />
          <div class="seg" role="radiogroup" aria-label="Class">
            <button type="button" role="radio" :aria-checked="!cls" :class="{ on: !cls }" @click="cls = null">All classes</button>
            <button
              v-for="(text, c) in CLASS_LABEL"
              :key="c"
              type="button"
              role="radio"
              :aria-checked="cls === c"
              :class="{ on: cls === c }"
              @click="cls = c"
            >
              {{ text }}
            </button>
          </div>
          <label class="field tx-q sm">
            <Icon name="search" />
            <input v-model="query" type="text" placeholder="Filter champions" aria-label="Filter champions" />
          </label>
        </div>
      </Masthead>

      <Deferred data="list">
        <template #fallback>
          <article class="card computing"><Skeleton :rows="8" pic /></article>
        </template>
        <EmptyState
          v-if="!list || !list.enough"
          :title="`Not enough games this patch`"
          icon="clock"
        />
        <template v-else>
          <section class="g12" style="align-items: stretch">
            <article class="card" style="grid-column: span 12">
              <CardHead title="Every champion" icon="grid" :meta="`${ranked} champions, best first in each tier`" />
              <div class="ar-board">
                <div v-for="b in bands" :key="b.t" class="ar-band">
                  <div><TierChip :tier="b.t" /><span class="n">{{ b.rows.length }}</span></div>
                  <div class="ics">
                    <Link v-for="r in b.rows" :key="r.champion" class="fr xs" :href="href(r.champion)" :title="nm(r.champion)"
                      ><img :src="champIconUrl(r.champion)" alt="" loading="lazy"
                    /></Link>
                  </div>
                </div>
              </div>
            </article>
          </section>

          <section class="sec" style="padding-top: 24px">
            <article class="card" style="overflow: hidden">
              <div class="tx-head ar-head">
                <SortHead :sorter="sort" col="name" label="Champion" />
                <SortHead :sorter="sort" col="win" label="Win rate" class="c" />
                <SortHead :sorter="sort" col="pick" label="Pick rate" class="c" />
                <SortHead :sorter="sort" col="games" label="Games" class="c" />
                <SortHead :sorter="sort" col="kda" label="KDA" class="c" />
                <span>Keystone</span>
              </div>
              <template v-for="g in groups" :key="g.t ?? 'sorted'">
                <div v-if="g.t !== null" class="tx-grp">
                  <TierChip :tier="g.t" large />
                  <span class="h4">{{ g.label }} tier</span>
                  <span class="meta">{{ g.rows.length === g.total ? `${g.total} champion${g.total === 1 ? '' : 's'}` : `Showing ${g.rows.length} of ${g.total}` }}</span>
                </div>
                <Link v-for="r in g.rows" :key="r.champion" class="tx-row ar-row" :href="href(r.champion)">
                  <div class="tx-name">
                    <TierChip v-if="g.t === null" :tier="r.tier" class="tx-tc" />
                    <div class="fr s visor" style="width: 84px; height: 44px; flex: none"><img :src="champIconUrl(r.champion)" alt="" loading="lazy" /></div>
                    <div class="col">
                      <span class="h4 ell">{{ nm(r.champion) }}</span>
                      <span class="meta ell"
                        ><template v-if="clsOf(r.champion)">{{ CLASS_LABEL[clsOf(r.champion)!] }}<i class="tx-dot" /></template>#{{ r.rank }} of
                        {{ ranked }}</span
                      >
                    </div>
                  </div>
                  <Fig :value="(r.win * 100).toFixed(0)" :width="barWidth(r.win, 0.38, 0.62)" big mid class="c" />
                  <Fig :value="(r.pick * 100).toFixed(0)" :width="barWidth(r.pick, 0, pickMax)" class="c" />
                  <span class="fg-xs t2 c">{{ thousands(r.games) }}</span>
                  <span class="fg-xs t2 c">{{ r.kda.toFixed(2) }}</span>
                  <div class="ar-ks">
                    <template v-if="r.keystone">
                      <img :src="perkUrl(r.keystone.keystone)" alt="" />
                      <div class="col">
                        <b class="ell">{{ list.names[r.keystone.keystone] }}</b><span>{{ list.names[r.keystone.style] }}</span>
                      </div>
                    </template>
                  </div>
                </Link>
              </template>
              <div class="tx-foot">
                <span class="meta"
                  >Win and pick rates of the {{ thousands(list.games) }} {{ label }} games we hold, any rank. A champion is ranked from
                  {{ thousands(list.minGames) }} games.</span
                >
                <button v-if="hidden > 0" class="btn sm" type="button" @click="all = true">
                  Show {{ hidden }} more champions<Icon name="chev" />
                </button>
              </div>
            </article>
          </section>
        </template>
      </Deferred>
    </div>
  </SiteLayout>
</template>
