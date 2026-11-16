<script setup lang="ts">
import { computed, ref } from 'vue'
import { champIcon, championName } from '../lib/assets.js'
import { compact, timeAgo } from '../lib/format.js'
import type { ChampionMastery } from '../lib/types.js'
import MasteryBubbles from './mastery/MasteryBubbles.vue'
import MasteryCrest from './mastery/MasteryCrest.vue'
import MasteryPodium from './mastery/MasteryPodium.vue'
import CardHead from './ui/CardHead.vue'
import EmptyState from './ui/EmptyState.vue'
import Frame from './ui/Frame.vue'
import Icon from './ui/Icon.vue'
import Segmented from './ui/Segmented.vue'
import Skeleton from './ui/Skeleton.vue'
import SortHead from './ui/SortHead.vue'
import { useSort } from './ui/sort.js'

/**
 * Lifetime mastery: the totals in a card, the three biggest champions as art cards, then the whole
 * pool as circles sized by points, or as a ranked table.
 */
const props = defineProps<{
  mastery: ChampionMastery[]
  loading: boolean
  error: boolean
}>()

defineEmits<{ retry: [] }>()

/** Rows shown under the podium before "Show all". */
const LIST_SIZE = 20

const query = ref('')
const expanded = ref(false)
/** The pool as circles, or the same champions as a ranked list. */
const view = ref<'pool' | 'list'>('pool')
const VIEWS = [
  { value: 'pool' as const, label: 'Pool' },
  { value: 'list' as const, label: 'List' },
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

/** The champion played most recently, with when. */
const latest = computed(
  () => [...sorted.value].sort((a, b) => b.lastPlayTime - a.lastPlayTime)[0] ?? null
)

const ranked = computed(() => sorted.value.map((entry, index) => ({ entry, rank: index + 1 })))

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

const visible = computed(() =>
  expanded.value || query.value.trim() ? order.rows : order.rows.slice(0, LIST_SIZE)
)
</script>

<template>
  <div class="ms">
    <!-- Loading: the shapes of what is coming -->
    <div v-if="loading" class="ms" aria-busy="true" aria-label="Loading mastery">
      <article class="card"><Skeleton :height="104" /></article>
      <div class="grid3 ms-top"><Skeleton v-for="n in 3" :key="n" :height="300" /></div>
      <article class="card"><Skeleton :rows="8" pic /></article>
    </div>

    <article v-else-if="error" class="card" role="alert">
      <EmptyState
        icon="star"
        title="Mastery is not available right now"
        line="Riot did not answer for this player's mastery."
      >
        <button type="button" class="btn sm" @click="$emit('retry')">Retry</button>
      </EmptyState>
    </article>

    <article v-else-if="!sorted.length" class="card">
      <EmptyState
        icon="star"
        title="No mastery yet"
        line="Champions show up here once this player has played them."
      />
    </article>

    <template v-else>
      <article class="card">
        <CardHead title="Mastery" icon="star" :meta="provenance || 'Every champion, all time'" />
        <div class="ms-kpi">
          <div>
            <span class="lab">Total points</span>
            <span class="fg-l">{{ compact(totals.points) }}</span>
          </div>
          <div>
            <span class="lab">Champions played</span>
            <span class="fg-l">{{ totals.champions }}</span>
          </div>
          <div>
            <span class="lab">Level 10 and above</span>
            <span class="fg-l vi">{{ totals.levelTen }}</span>
          </div>
          <div v-if="latest">
            <span class="lab">Played last</span>
            <span class="row" style="gap: 10px; min-width: 0">
              <Frame :src="champIcon(latest.championId)" :width="32" size="xs" />
              <span class="col" style="gap: 2px; min-width: 0">
                <span class="h5 ell">{{ championName(latest.championId) }}</span>
                <span class="meta num">{{ timeAgo(latest.lastPlayTime) }}</span>
              </span>
            </span>
          </div>
        </div>
      </article>

      <MasteryPodium :top="sorted.slice(0, 3)" />

      <article class="card">
        <CardHead
          title="Pool"
          icon="grid"
          :meta="
            view === 'pool'
              ? `${sorted.length} champions, sized by points`
              : `${sorted.length} champions, most points first`
          "
        >
          <Segmented v-model="view" :options="VIEWS" label="View" />
        </CardHead>

        <!-- Every champion, sized by points -->
        <div v-if="view === 'pool'" class="ms-pool">
          <MasteryBubbles :mastery="sorted" />
          <p class="lgd ms-lgd">
            <span><i class="v" />Level 10 and above</span>
          </p>
        </div>

        <!-- The same, ranked -->
        <template v-else>
          <div class="ms-find">
            <label class="field">
              <Icon name="search" />
              <input v-model="query" aria-label="Find a champion" placeholder="Find a champion" />
            </label>
          </div>
          <div class="tbl ms-tbl" role="table" aria-label="Mastery by champion">
            <div class="tbl-h" role="row">
              <span class="n" role="columnheader">#</span>
              <SortHead :sorter="order" col="name" label="Champion" />
              <SortHead :sorter="order" col="level" label="Level" />
              <SortHead :sorter="order" col="points" label="Points" class="n" />
            </div>
            <div
              v-for="{ entry, rank } in visible"
              :key="entry.championId"
              class="tbl-r"
              role="row"
            >
              <span class="n rk" role="cell">{{ rank }}</span>
              <span class="who" role="cell">
                <Frame :src="champIcon(entry.championId)" :width="32" size="xs" />
                <span>
                  <b class="h5 ell">{{ championName(entry.championId) }}</b>
                  <small class="meta num">{{ timeAgo(entry.lastPlayTime) }}</small>
                </span>
              </span>
              <span class="row ms-lv num" role="cell">
                <MasteryCrest :level="entry.championLevel" :size="26" />{{ entry.championLevel }}
              </span>
              <span class="n fg-xs" role="cell">{{ compact(entry.championPoints) }}</span>
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
              class="btn"
              :aria-expanded="expanded"
              @click="expanded = !expanded"
            >
              {{ expanded ? 'Show fewer' : `Show all ${rest.length}` }}
              <Icon name="chev" :style="expanded ? 'transform: rotate(180deg)' : undefined" />
            </button>
          </div>
        </template>
      </article>
    </template>
  </div>
</template>

<style scoped>
.ms {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.ms-kpi {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding: 4px 0 20px;
}
.ms-kpi > div {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
  padding: 4px 20px;
}
.ms-kpi > div + div {
  border-left: 1px solid var(--line);
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
.ms-find {
  padding: 0 20px 12px;
}
.ms-find .field {
  max-width: 280px;
}
.ms-tbl {
  --cols: 40px minmax(0, 1fr) 96px 88px;
}
.ms-tbl .who > span {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ms-lv {
  gap: 4px;
  font-size: 13px;
  font-weight: 650;
  color: var(--t2);
}
.ms-more {
  display: flex;
  justify-content: center;
  padding: 16px 20px 20px;
  border-top: 1px solid var(--line);
}
@media (max-width: 860px) {
  .ms-kpi {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 16px;
  }
  .ms-kpi > div:nth-child(3) {
    border-left: 0;
  }
  .ms-find .field {
    max-width: none;
  }
  .ms-tbl {
    --cols: 28px minmax(0, 1fr) 64px 64px;
  }
}
</style>
