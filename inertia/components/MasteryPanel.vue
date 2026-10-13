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
 * Lifetime mastery: the three biggest champions on a podium, the whole pool as circles sized by
 * points, then the rest as a quiet list.
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

const ranked = computed(() => sorted.value.map((entry, index) => ({ entry, rank: index + 1 })))

const rest = computed(() => {
  const text = query.value.trim().toLowerCase()
  if (!text) return ranked.value.slice(3)
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
      <section class="iv-panel ms-hero">
        <div class="ms-head">
          <div class="iv-skel !h-5 !w-[110px]" />
          <div class="iv-skel !h-9 !w-[min(280px,100%)]" />
        </div>
        <div class="ms-skel-podium">
          <div class="iv-skel" style="height: 72%" />
          <div class="iv-skel" style="height: 100%" />
          <div class="iv-skel" style="height: 62%" />
        </div>
      </section>
      <div class="iv-skel !h-[320px] !w-full !rounded-[8px]" />
    </div>

    <section v-else-if="error" class="iv-panel ms-state" role="alert">
      <p class="ms-state-title">Mastery is not available right now</p>
      <p class="ms-state-text">Riot did not answer for this player's mastery.</p>
      <button type="button" class="iv-btn sm mt-4" @click="$emit('retry')">Retry</button>
    </section>

    <section v-else-if="!sorted.length" class="iv-panel ms-state">
      <MasteryCrest :level="0" :size="64" class="opacity-60" />
      <p class="ms-state-title mt-2">No mastery yet</p>
      <p class="ms-state-text">Champions show up here once this player has played them.</p>
    </section>

    <div v-else class="ms-stack">
      <!-- The podium: the featured, lit sheet of the view -->
      <section class="iv-panel lit-sheet ms-hero">
        <header class="ms-head">
          <div class="min-w-0">
            <h2 class="ms-title">Mastery</h2>
            <p v-if="provenance" class="meta mt-1">{{ provenance }}</p>
          </div>
          <dl class="ms-totals num">
            <div>
              <dt class="label">Total points</dt>
              <dd class="iv-fig">{{ compact(totals.points) }}</dd>
            </div>
            <div>
              <dt class="label">Champions</dt>
              <dd class="iv-fig">{{ totals.champions }}</dd>
            </div>
            <div>
              <dt class="label">Level 10+</dt>
              <dd class="iv-fig">{{ totals.levelTen }}</dd>
            </div>
          </dl>
        </header>
        <MasteryPodium :top="sorted.slice(0, 3)" />
      </section>

      <!-- Every champion, sized by points -->
      <section class="iv-panel">
        <div class="section flex-wrap">
          <h2>Pool</h2>
          <span class="meta">Each circle is sized by mastery points</span>
        </div>
        <div>
          <MasteryBubbles :mastery="sorted" />
        </div>
      </section>

      <!-- The rest, ranked -->
      <section v-if="sorted.length > 3" class="iv-panel">
        <div class="section flex-wrap !items-center">
          <h2>More champions</h2>
          <span class="meta num">{{ sorted.length - 3 }}</span>
          <label class="relative ml-auto w-[200px] max-sm:ml-0 max-sm:w-full">
            <Search
              :size="13"
              class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3"
            />
            <input
              v-model="query"
              class="field !h-[30px] !pl-8"
              aria-label="Find a champion"
              placeholder="Find a champion"
            />
          </label>
        </div>

        <div>
          <ol class="ms-list">
            <li v-for="{ entry, rank } in visible" :key="entry.championId" class="ms-row">
              <span class="ms-rank num">{{ rank }}</span>
              <span class="portrait h-[30px] w-[30px]">
                <img
                  :src="champIcon(entry.championId)"
                  :alt="championName(entry.championId)"
                  width="30"
                  height="30"
                  loading="lazy"
                />
              </span>
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

          <p v-if="!visible.length" class="py-6 text-[13px] text-ink-2">
            No champion matches “{{ query.trim() }}”.
          </p>

          <button
            v-if="!expanded && !query.trim() && rest.length > LIST_SIZE"
            type="button"
            class="iv-btn sm mt-4"
            @click="expanded = true"
          >
            Show all {{ rest.length }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.ms-stack {
  display: grid;
  gap: 12px;
}

/* ── The lit sheet: header, then the podium rising from its floor ── */
.ms-hero {
  overflow: hidden;
  padding: 16px 20px 0;
}

.ms-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px 24px;
  margin-bottom: 28px;
}

.ms-title {
  font-size: 16px;
  font-weight: 600;
  line-height: 20px;
  letter-spacing: -0.005em;
  color: var(--text-1);
}

.ms-totals {
  display: flex;
  gap: 32px;
}

.ms-totals > div {
  display: grid;
  gap: 6px;
}

.ms-totals dd {
  font-size: 24px;
  color: var(--text-1);
}

.ms-skel-podium {
  display: grid;
  grid-template-columns: 1fr 1.16fr 1fr;
  align-items: end;
  gap: 20px;
  height: 340px;
  max-width: 760px;
  margin-inline: auto;
}

.ms-skel-podium > .iv-skel {
  width: 100%;
  border-radius: var(--r-md) var(--r-md) 0 0;
}

/* ── Empty and error ─────────────────────────────────────────── */
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

/* ── The list ────────────────────────────────────────────────── */
.ms-list {
  display: grid;
  column-gap: 32px;
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
  min-height: 48px;
  border-bottom: 1px solid var(--line);
}

.ms-rank {
  width: 20px;
  flex: none;
  font-size: 12px;
  color: var(--text-4);
  text-align: right;
}

.ms-row-name {
  display: block;
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  line-height: 17px;
  color: var(--text-1);
  white-space: nowrap;
  text-overflow: ellipsis;
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
  color: var(--text-1);
  text-align: right;
}

@media (max-width: 30rem) {
  .ms-hero {
    padding: 14px 12px 0;
  }

  .ms-head {
    margin-bottom: 22px;
  }

  .ms-totals {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    width: 100%;
  }

  .ms-totals dd {
    font-size: 20px;
  }

  .ms-skel-podium {
    gap: 8px;
    height: 260px;
  }
}
</style>
