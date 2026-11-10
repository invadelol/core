<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search } from 'lucide-vue-next'
import { champIcon, championName } from '../lib/assets.js'
import { compact, timeAgo } from '../lib/format.js'
import type { ChampionMastery } from '../lib/types.js'
import MasteryBubbles from './mastery/MasteryBubbles.vue'
import MasteryCrest from './mastery/MasteryCrest.vue'
import MasteryPodium from './mastery/MasteryPodium.vue'

/**
 * Lifetime mastery (Violet line): the totals in a strip, the three biggest champions as splash
 * cards, then the whole pool as circles sized by points, or as a ranked list.
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

const visible = computed(() =>
  expanded.value || query.value.trim() ? rest.value : rest.value.slice(0, LIST_SIZE)
)
</script>

<template>
  <div>
    <!-- Loading: the shapes of what is coming -->
    <div v-if="loading" class="ms-stack" aria-busy="true" aria-label="Loading mastery">
      <div class="iv-skel !h-[96px]" />
      <div class="ms-skel-podium">
        <div class="iv-skel" style="height: 80%" />
        <div class="iv-skel" style="height: 100%" />
        <div class="iv-skel" style="height: 80%" />
      </div>
      <div class="iv-skel !h-[420px]" />
    </div>

    <section v-else-if="error" class="rd-card ms-state" role="alert">
      <p class="ms-state-title">Mastery is not available right now</p>
      <p class="ms-state-text">Riot did not answer for this player's mastery.</p>
      <button type="button" class="iv-btn sm mt-4" @click="$emit('retry')">Retry</button>
    </section>

    <section v-else-if="!sorted.length" class="rd-card ms-state">
      <MasteryCrest :level="0" :size="64" class="opacity-60" />
      <p class="ms-state-title mt-2">No mastery yet</p>
      <p class="ms-state-text">Champions show up here once this player has played them.</p>
    </section>

    <div v-else>
      <section class="rd-card mst">
        <div class="st">
          <label>Total points</label>
          <div class="rd-fig">{{ compact(totals.points) }}</div>
          <small>{{ provenance || 'across every champion' }}</small>
        </div>
        <div class="st">
          <label>Champions played</label>
          <div class="rd-fig">{{ totals.champions }}</div>
          <small>with mastery</small>
        </div>
        <div class="st">
          <label>Level 10 and above</label>
          <div class="rd-fig rd-vio">{{ totals.levelTen }}</div>
          <small>{{ totals.levelTen === 1 ? 'champion' : 'champions' }}</small>
        </div>
        <div v-if="latest" class="st">
          <label>Played last</label>
          <div class="rd-fig name">{{ championName(latest.championId) }}</div>
          <small class="num">{{ timeAgo(latest.lastPlayTime) }}</small>
        </div>
      </section>

      <MasteryPodium :top="sorted.slice(0, 3)" />

      <div class="fil">
        <h2>
          Pool<span class="num">{{
            view === 'pool'
              ? `Each circle is sized by mastery points, ${sorted.length} champions`
              : `${sorted.length} champions, most points first`
          }}</span>
        </h2>
        <div class="rd-seg" role="group" aria-label="View">
          <button
            type="button"
            :class="{ on: view === 'pool' }"
            :aria-pressed="view === 'pool'"
            @click="view = 'pool'"
          >
            Pool
          </button>
          <button
            type="button"
            :class="{ on: view === 'list' }"
            :aria-pressed="view === 'list'"
            @click="view = 'list'"
          >
            List
          </button>
        </div>
      </div>

      <!-- Every champion, sized by points -->
      <section v-if="view === 'pool'" class="rd-card pool">
        <MasteryBubbles :mastery="sorted" />
        <p class="pleg"><span class="rd-tag v">Violet ring: level 10 and above</span></p>
      </section>

      <!-- The same, ranked -->
      <section v-else class="rd-card">
        <div class="rd-head">
          <h3>Every champion</h3>
          <label class="ms-search">
            <Search :size="13" aria-hidden="true" />
            <input v-model="query" aria-label="Find a champion" placeholder="Find a champion" />
          </label>
        </div>
        <ol class="ms-list">
          <li v-for="{ entry, rank } in visible" :key="entry.championId" class="ms-row">
            <span class="ms-rank num">{{ rank }}</span>
            <img
              class="rd-por"
              :src="champIcon(entry.championId)"
              :alt="championName(entry.championId)"
              width="32"
              height="32"
              loading="lazy"
            />
            <span class="min-w-0 flex-1">
              <span class="ms-row-name">{{ championName(entry.championId) }}</span>
              <span class="ms-row-meta num">{{ timeAgo(entry.lastPlayTime) }}</span>
            </span>
            <span class="ms-row-level num">
              <MasteryCrest :level="entry.championLevel" :size="28" />
              <span>{{ entry.championLevel }}</span>
            </span>
            <span class="ms-row-points num">{{ compact(entry.championPoints) }}</span>
          </li>
        </ol>

        <p v-if="!visible.length" class="px-4 py-6 text-[13px] text-ink-2">
          No champion matches “{{ query.trim() }}”.
        </p>

        <div v-if="!query.trim() && rest.length > LIST_SIZE" class="rd-foot">
          <button
            type="button"
            class="iv-btn sm w-full"
            :aria-expanded="expanded"
            @click="expanded = !expanded"
          >
            {{ expanded ? 'Show fewer' : `Show all ${rest.length}` }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.ms-stack {
  display: grid;
  gap: 16px;
}
.ms-skel-podium {
  display: grid;
  grid-template-columns: 1fr 1.25fr 1fr;
  align-items: end;
  gap: 12px;
  height: 320px;
}
.ms-skel-podium > .iv-skel {
  width: 100%;
}
.mst {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 16px;
}
.mst .st {
  min-width: 0;
  padding: 16px 20px;
}
.mst .st + .st {
  box-shadow: inset 1px 0 0 var(--rd-line);
}
.mst label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}
.mst .rd-fig {
  font-size: 28px;
  line-height: 1.2;
}
.mst .rd-fig.name {
  overflow: hidden;
  font-size: 22px;
  line-height: 1.55;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.mst small {
  display: block;
  overflow: hidden;
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text-3);
}
.fil {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin: 28px 0 12px;
}
.fil h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  color: var(--text-1);
}
.fil h2 span {
  margin-left: 8px;
  font-size: 13px;
  font-weight: 400;
  color: var(--text-3);
}
.pool {
  position: relative;
  padding: 16px 16px 48px;
  background:
    radial-gradient(60% 80% at 50% 50%, rgb(123 109 255 / 0.07), transparent 70%), var(--rd-card);
}
.pleg {
  position: absolute;
  left: 16px;
  bottom: 14px;
  margin: 0;
}
.ms-search {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 220px;
  height: 32px;
  padding: 0 10px;
  border-radius: 6px;
  color: var(--text-3);
  background: var(--inset);
  box-shadow: var(--inset-shadow);
}
.ms-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  font: 400 13px var(--font);
  color: var(--text-1);
  background: none;
}
.ms-search:focus-within {
  box-shadow: 0 0 0 2px var(--rd-violet);
}
.ms-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 16px;
  text-align: center;
}
.ms-state-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}
.ms-state-text {
  margin-top: 4px;
  font-size: 13px;
  color: var(--text-3);
}
.ms-list {
  display: grid;
  column-gap: 32px;
  margin: 0;
  padding: 4px 18px 8px;
  list-style: none;
}
@media (min-width: 48rem) {
  .ms-list {
    grid-template-columns: 1fr 1fr;
  }
}
.ms-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  box-shadow: inset 0 -1px 0 var(--rd-line);
}
.ms-rank {
  flex: none;
  width: 22px;
  font-size: 12px;
  text-align: right;
  color: var(--text-4);
}
.ms-row-name {
  display: block;
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  line-height: 17px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text-1);
}
.ms-row-meta {
  display: block;
  font-size: 12px;
  line-height: 16px;
  color: var(--text-3);
}
.ms-row-level {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-width: 56px;
  font-size: 12px;
  color: var(--text-2);
}
.ms-row-points {
  min-width: 44px;
  font-size: 13px;
  font-weight: 600;
  text-align: right;
  color: var(--text-1);
}
@media (max-width: 1000px) {
  .mst {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .mst .st:nth-child(3) {
    box-shadow: inset 0 1px 0 var(--rd-line);
  }
  .mst .st:nth-child(4) {
    box-shadow:
      inset 1px 0 0 var(--rd-line),
      inset 0 1px 0 var(--rd-line);
  }
  .ms-skel-podium {
    grid-template-columns: 1fr;
    height: auto;
  }
  .ms-skel-podium > .iv-skel {
    height: 220px !important;
  }
}
@media (max-width: 520px) {
  .ms-search {
    width: 100%;
  }
}
</style>
