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
const levels = computed(() => props.mastery.reduce((n, c) => n + c.championLevel, 0))
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

    <p v-else-if="error" class="py-16 text-center text-[12.5px] text-ink-3">
      Riot did not return this player's mastery.
      <button class="btn btn-sm ml-2" @click="$emit('retry')">Try again</button>
    </p>

    <p v-else-if="!mastery.length" class="py-16 text-center text-[12.5px] text-ink-3">
      No champion mastery recorded.
    </p>

    <template v-else>
      <div class="section">
        <h2>Mastery</h2>
        <span class="meta num">
          {{ mastery.length }} champions
          <span class="text-ink-4">·</span>
          {{ levels }} levels
          <span class="text-ink-4">·</span>
          {{ compact(points) }} points
          <template v-if="headline.levelTen">
            <span class="text-ink-4">·</span>
            {{ headline.levelTen }} at level 10+
          </template>
          <template v-if="headline.tokens">
            <span class="text-ink-4">·</span>
            {{ headline.tokens }} tokens
          </template>
        </span>
        <label class="relative ml-auto w-[170px]">
          <Search
            :size="12"
            class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3"
          />
          <input
            v-model="query"
            class="field !py-1 !pl-7 !text-[12px]"
            aria-label="Search mastery"
            placeholder="Find a champion"
          />
        </label>
      </div>

      <ul class="grid gap-x-8 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
        <li v-for="c in visible" :key="c.championId" class="flex items-center gap-2.5 py-1.5">
          <img
            :src="champIcon(c.championId)"
            :alt="championName(c.championId)"
            width="30"
            height="30"
            loading="lazy"
            class="thumb h-[30px] w-[30px] rounded-[6px]"
          />
          <span class="min-w-0 flex-1">
            <span class="flex items-baseline justify-between gap-2">
              <span class="truncate text-[12px] font-medium text-ink">
                {{ championName(c.championId) }}
              </span>
              <span class="num shrink-0 text-[11px] text-ink-3">
                {{ compact(c.championPoints) }}
              </span>
            </span>
            <span class="mt-1 flex items-center gap-2">
              <span class="h-[4px] min-w-0 flex-1 rounded-[2px] bg-sunken">
                <span
                  class="block h-full rounded-[2px] bg-ink-3"
                  :style="{ width: `${(c.championPoints / most) * 100}%` }"
                />
              </span>
              <span class="num shrink-0 text-[10px] text-ink-4">
                <template v-if="progress(c)">
                  {{ compact(progress(c)!.remaining) }} to next
                </template>
                <template v-else>{{ timeAgo(c.lastPlayTime) }}</template>
              </span>
            </span>
          </span>
          <span
            class="num w-6 shrink-0 text-right text-[12px] font-semibold text-gold"
            title="Mastery level"
          >
            {{ c.championLevel }}
          </span>
        </li>
      </ul>

      <p v-if="!visible.length" class="py-10 text-center text-[12.5px] text-ink-3">
        No champion matches “{{ query }}”.
      </p>

      <button
        v-if="!expanded && filtered.length > 24"
        class="btn btn-sm mt-5"
        @click="expanded = true"
      >
        Show all {{ filtered.length }} champions
      </button>
    </template>
  </div>
</template>
