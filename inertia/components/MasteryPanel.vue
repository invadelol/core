<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search } from 'lucide-vue-next'
import { champIcon, championName } from '../lib/assets.js'
import { compact, timeAgo } from '../lib/format.js'
import type { ChampionMastery } from '../lib/types.js'

const props = defineProps<{
  mastery: ChampionMastery[]
  loading: boolean
  error: boolean
}>()

defineEmits<{ retry: [] }>()

const query = ref('')
const expanded = ref(false)

const points = computed(() => props.mastery.reduce((n, c) => n + c.championPoints, 0))
const most = computed(() => Math.max(...props.mastery.map((c) => c.championPoints), 1))

const filtered = computed(() =>
  props.mastery.filter((c) =>
    championName(c.championId).toLowerCase().includes(query.value.toLowerCase())
  )
)

const visible = computed(() => (expanded.value ? filtered.value : filtered.value.slice(0, 24)))

/** Riot ships the distance to the next level and the tokens held; both were
 *  arriving in the payload and neither was ever shown. */
function progress(c: ChampionMastery) {
  const remaining = Math.max(c.championPointsUntilNextLevel ?? 0, 0)
  if (!remaining) return null
  // Each level costs a fixed number of points, so the span is inferable.
  const span = remaining + (c.championPoints % Math.max(remaining + 1, 1))
  return { remaining, pct: span ? ((span - remaining) / span) * 100 : 0 }
}

const headline = computed(() => {
  const list = props.mastery
  return {
    levelTen: list.filter((c) => c.championLevel >= 10).length,
    levelSeven: list.filter((c) => c.championLevel >= 7).length,
    tokens: list.reduce((n, c) => n + (c.tokensEarned ?? 0), 0),
  }
})
</script>

<template>
  <div>
    <div v-if="loading" class="skel h-[320px]" />

    <p v-else-if="error" class="flex items-center gap-3 py-6 text-[13px] text-ink-2">
      Riot did not return this player's mastery.
      <button class="btn btn-sm" @click="$emit('retry')">Retry</button>
    </p>

    <p v-else-if="!mastery.length" class="py-6 text-[13px] text-ink-2">
      No champion mastery recorded.
    </p>

    <section v-else class="card">
      <div class="section flex-wrap !items-center">
        <h2>Mastery</h2>
        <span class="meta num">
          {{ mastery.length }} champions <span class="text-ink-4">·</span>
          {{ compact(points) }} points
          <template v-if="headline.levelTen">
            <span class="text-ink-4">·</span> {{ headline.levelTen }} at level 10 or more
          </template>
        </span>
        <label class="relative ml-auto w-[200px]">
          <Search
            :size="13"
            class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3"
          />
          <input
            v-model="query"
            class="field !h-[30px] !pl-8"
            aria-label="Search mastery"
            placeholder="Find a champion"
          />
        </label>
      </div>

      <div>
        <ul class="grid gap-x-8 sm:grid-cols-2 xl:grid-cols-3">
          <li
            v-for="c in visible"
            :key="c.championId"
            class="flex h-[56px] items-center gap-3 border-b border-line"
          >
            <span class="portrait h-9 w-9">
              <img
                :src="champIcon(c.championId)"
                :alt="championName(c.championId)"
                width="36"
                height="36"
                loading="lazy"
              />
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex items-baseline justify-between gap-2">
                <span class="truncate text-[13px] font-semibold text-ink">
                  {{ championName(c.championId) }}
                </span>
                <span class="num shrink-0 text-[13px] font-semibold text-ink">
                  {{ compact(c.championPoints) }}
                </span>
              </span>
              <span class="mt-1.5 flex items-center gap-2">
                <span class="meter !h-[3px] min-w-0 flex-1">
                  <span :style="{ width: `${(c.championPoints / most) * 100}%` }" />
                </span>
                <span class="num shrink-0 text-[11px] text-ink-3">
                  <template v-if="progress(c)">
                    {{ compact(progress(c)!.remaining) }} to next
                  </template>
                  <template v-else>{{ timeAgo(c.lastPlayTime) }}</template>
                </span>
              </span>
            </span>
            <span class="num w-10 shrink-0 text-right" title="Mastery level">
              <span class="block text-[11px] leading-3 text-ink-3">Level</span>
              <span class="block text-[15px] font-semibold leading-5 text-ink">
                {{ c.championLevel }}
              </span>
            </span>
          </li>
        </ul>

        <p v-if="!visible.length" class="py-6 text-[13px] text-ink-2">
          No champion matches “{{ query }}”.
        </p>

        <button
          v-if="!expanded && filtered.length > 24"
          class="btn btn-sm mt-4"
          @click="expanded = true"
        >
          Show all {{ filtered.length }} champions
        </button>
      </div>
    </section>
  </div>
</template>
