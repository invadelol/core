<script setup lang="ts">
import { computed, ref } from 'vue'
import { champIcon, championName } from '../lib/assets.js'
import { compact, timeAgo } from '../lib/format.js'
import type { ChampionMastery } from '../lib/types.js'
import MasteryBubbles from './mastery/MasteryBubbles.vue'
import MasteryCrest from './mastery/MasteryCrest.vue'
import MasteryPodium from './mastery/MasteryPodium.vue'
import EmptyState from './ui/EmptyState.vue'
import Icon from './ui/Icon.vue'
import Segmented from './ui/Segmented.vue'
import Skeleton from './ui/Skeleton.vue'
import { useSort } from './ui/sort.js'

/**
 * Lifetime mastery: a lit sheet with the totals over the three biggest champions on a podium, the
 * whole pool as circles sized by points, then every other champion in two columns, searchable and
 * sortable by points, level or name.
 */
const props = defineProps<{
  mastery: ChampionMastery[]
  loading: boolean
  error: boolean
}>()

defineEmits<{ retry: [] }>()

/** Rows of "More champions" before "Show all". */
const LIST_SIZE = 12

const query = ref('')
const expanded = ref(false)
/** The order of "More champions". */
const SORTS = [
  { value: 'points' as const, label: 'Points' },
  { value: 'level' as const, label: 'Level' },
  { value: 'name' as const, label: 'Name' },
]

const sorted = computed(() =>
  [...props.mastery].sort((a, b) => b.championPoints - a.championPoints)
)

const totals = computed(() => ({
  points: sorted.value.reduce((sum, c) => sum + c.championPoints, 0),
  champions: sorted.value.length,
  levelTen: sorted.value.filter((c) => c.championLevel >= 10).length,
}))

/**
 * Where the figures come from when they are not a fresh read from Riot: the Invade app's
 * snapshot, or an older one kept while Riot could not answer. A snapshot holds the top ten.
 */
const provenance = computed(() => {
  const first = sorted.value[0]
  if (!first?.observedAt) return ''
  const desktop = first.source === 'desktop'
  // Riot's reads are cached for an hour: anything older is a kept snapshot.
  if (!desktop && Date.now() - first.observedAt < 2 * 3_600_000) return ''
  const when = timeAgo(first.observedAt)
  const seen = desktop ? `Seen by the Invade app ${when}` : `Saved ${when}`
  return sorted.value.length <= 10 ? `Top ten only. ${seen}` : seen
})

/** Everyone after the podium, with their place in the pool. */
const ranked = computed(() =>
  sorted.value.map((entry, index) => ({ entry, rank: index + 1 })).slice(3)
)

const rest = computed(() => {
  const text = query.value.trim().toLowerCase()
  if (!text) return ranked.value
  return ranked.value.filter(({ entry }) =>
    championName(entry.championId).toLowerCase().includes(text)
  )
})

/** Most points first; the heads sort by name, level or points. */
const order = useSort(
  rest,
  {
    name: ({ entry }) => championName(entry.championId),
    level: ({ entry }) => entry.championLevel,
    points: ({ entry }) => entry.championPoints,
  },
  { key: 'points', first: { name: 'asc' } }
)

const sortKey = computed({
  get: () => (order.key ?? 'points') as 'points' | 'level' | 'name',
  set: (key: 'points' | 'level' | 'name') => {
    order.key = key
    order.dir = key === 'name' ? 'asc' : 'desc'
  },
})

const visible = computed(() =>
  expanded.value || query.value.trim() ? order.rows : order.rows.slice(0, LIST_SIZE)
)
/** Two columns, filled top to bottom. */
const columns = computed(() => {
  const list = visible.value
  const half = Math.ceil(list.length / 2)
  return list.length > 3 ? [list.slice(0, half), list.slice(half)] : [list]
})
</script>

<template>
  <div class="ms">
    <!-- Loading: the shapes of what is coming -->
    <div v-if="loading" class="ms" aria-busy="true" aria-label="Loading mastery">
      <article class="card" style="padding: 20px 24px"><Skeleton :height="420" /></article>
      <article class="card" style="padding: 20px"><Skeleton :height="320" /></article>
    </div>

    <article v-else-if="error" class="card" role="alert">
      <EmptyState
        icon="crown"
        title="Mastery is not available right now"
        line="Riot did not answer for this player's mastery."
      >
        <button type="button" class="btn sm" @click="$emit('retry')">Retry</button>
      </EmptyState>
    </article>

    <article v-else-if="!sorted.length" class="card">
      <EmptyState
        icon="crown"
        title="No mastery yet"
        line="Champions show up here once this player has played them."
      />
    </article>

    <template v-else>
      <section class="card lit ms-head">
        <div class="ms-h">
          <div class="col" style="gap: 4px; min-width: 0">
            <h2 class="h3">Mastery</h2>
            <span class="meta">{{ provenance || 'Every champion, all time' }}</span>
          </div>
          <dl class="ms-tot">
            <div>
              <dt class="lab">Total points</dt>
              <dd class="fg-m num">{{ compact(totals.points) }}</dd>
            </div>
            <div>
              <dt class="lab">Champions</dt>
              <dd class="fg-m num">{{ totals.champions }}</dd>
            </div>
            <div>
              <dt class="lab">Level 10 and up</dt>
              <dd class="fg-m num">{{ totals.levelTen }}</dd>
            </div>
          </dl>
        </div>
        <MasteryPodium :top="sorted.slice(0, 3)" />
      </section>

      <section class="card">
        <div class="card-h">
          <h2 class="h3">Pool</h2>
          <span class="meta num">{{ sorted.length }} champions</span>
        </div>
        <div class="ms-pool">
          <MasteryBubbles :mastery="sorted" />
          <p class="lgd ms-lgd">
            <span><i class="v" />Level 10 and up</span>
          </p>
        </div>
      </section>

      <section v-if="ranked.length" class="card">
        <div class="card-h ms-mh">
          <h2 class="h3">More champions</h2>
          <span class="meta num">{{ ranked.length }} more</span>
          <Segmented v-model="sortKey" :options="SORTS" label="Order" class="ms-sort" />
          <label class="field ms-find">
            <Icon name="search" />
            <input v-model="query" aria-label="Find a champion" placeholder="Find a champion" />
          </label>
        </div>
        <div class="ms-list" :class="{ one: columns.length === 1 }">
          <div v-for="(col, c) in columns" :key="c">
            <div v-for="{ entry, rank } in col" :key="entry.championId" class="ml">
              <span class="k num">{{ rank }}</span>
              <img class="pic" :src="champIcon(entry.championId)" alt="" width="34" height="34" />
              <span class="col" style="gap: 3px; min-width: 0">
                <span class="h5 ell">{{ championName(entry.championId) }}</span>
                <span class="meta num">{{ timeAgo(entry.lastPlayTime) }}</span>
              </span>
              <span class="lv num"
                ><MasteryCrest :level="entry.championLevel" :size="20" />Lv
                {{ entry.championLevel }}</span
              >
              <span class="pt num">{{ compact(entry.championPoints) }}</span>
            </div>
          </div>
        </div>
        <EmptyState
          v-if="!visible.length"
          compact
          icon="search"
          :title="`No champion matches “${query.trim()}”`"
        />
        <div v-if="!query.trim() && rest.length > LIST_SIZE" class="ms-more">
          <button
            type="button"
            class="btn sm"
            :aria-expanded="expanded"
            @click="expanded = !expanded"
          >
            {{ expanded ? 'Show fewer' : `Show all ${rest.length}` }}
            <Icon name="chev" :style="expanded ? 'transform: rotate(180deg)' : undefined" />
          </button>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.ms {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.ms-head {
  overflow: hidden;
}
.ms-h {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 20px 24px 0;
}
.ms-tot {
  display: flex;
  gap: 40px;
  margin: 0 0 0 auto;
}
.ms-tot > div {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ms-tot dd {
  margin: 0;
}
.ms-pool {
  position: relative;
  padding: 4px 20px 52px;
}
.ms-lgd {
  position: absolute;
  left: 20px;
  bottom: 18px;
  justify-content: flex-start;
}
.ms-lgd i.v {
  box-shadow: inset 0 0 0 2px var(--v400);
}
.ms-mh {
  flex-wrap: wrap;
  row-gap: 10px;
}
.ms-sort {
  margin-left: auto;
}
.ms-find {
  width: 220px;
  height: 34px;
}
.ms-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 32px;
  padding: 4px 22px 14px;
}
.ms-list.one {
  grid-template-columns: 1fr;
}
.ml {
  display: grid;
  grid-template-columns: 24px 34px minmax(0, 1fr) 76px 56px;
  align-items: center;
  gap: 12px;
  height: 54px;
  border-top: 1px solid var(--line);
}
.ml .pic {
  width: 34px;
  height: 34px;
  border-radius: 8px;
}
.ml .k {
  font-size: 12px;
  font-weight: 650;
  color: var(--t4);
}
.ml .lv {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  font-size: 12px;
  font-weight: 700;
  color: var(--v200);
}
:global([data-theme='light']) .ml .lv {
  color: var(--v600);
}
.ml .pt {
  text-align: right;
  font-weight: 700;
}
.ms-more {
  display: flex;
  padding: 0 22px 20px;
}
@media (max-width: 860px) {
  .ms-h {
    flex-direction: column;
    padding: 16px 16px 0;
  }
  .ms-tot {
    margin: 4px 0 0;
    gap: 28px;
  }
  .ms-sort,
  .ms-find {
    margin-left: 0;
  }
  .ms-find {
    width: 100%;
    height: 40px;
  }
  .ms-list {
    grid-template-columns: 1fr;
    padding: 4px 16px 12px;
  }
  .ms-pool {
    padding: 4px 12px 48px;
  }
}
</style>
