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

    <p v-else-if="error" class="card py-16 text-center text-[12.5px] text-ink-3">
      Riot did not return this player's mastery.
      <button class="btn btn-sm ml-2" @click="$emit('retry')">Try again</button>
    </p>

    <p v-else-if="!mastery.length" class="card py-16 text-center text-[12.5px] text-ink-3">
      No champion mastery recorded.
    </p>

    <section v-else class="card">
      <div class="section flex-wrap !items-center">
        <h2>Mastery</h2>
        <span class="meta num">
          <b class="font-semibold text-ink">{{ mastery.length }}</b> champions
          <span class="text-ink-4">·</span>
          <b class="font-semibold text-ink">{{ levels }}</b> levels
          <span class="text-ink-4">·</span>
          <b class="font-semibold text-ink">{{ compact(points) }}</b> points
          <template v-if="headline.levelTen">
            <span class="text-ink-4">·</span>
            <b class="font-semibold text-ink">{{ headline.levelTen }}</b> at level 10+
          </template>
          <template v-if="headline.tokens">
            <span class="text-ink-4">·</span>
            <b class="font-semibold text-ink">{{ headline.tokens }}</b> tokens
          </template>
        </span>
        <label class="relative ml-auto w-[180px]">
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

      <div>
        <ul class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <li
            v-for="c in visible"
            :key="c.championId"
            class="flex items-center gap-3 rounded-[8px] bg-raised px-3 py-2.5"
          >
            <img
              :src="champIcon(c.championId)"
              :alt="championName(c.championId)"
              width="36"
              height="36"
              loading="lazy"
              class="thumb h-9 w-9 rounded-[7px]"
            />
            <span class="min-w-0 flex-1">
              <span class="flex items-baseline justify-between gap-2">
                <span class="truncate text-[13px] font-semibold text-ink">
                  {{ championName(c.championId) }}
                </span>
                <span class="stat shrink-0 text-[14px] text-ink">
                  {{ compact(c.championPoints) }}
                </span>
              </span>
              <span class="mt-1.5 flex items-center gap-2">
                <span class="meter min-w-0 flex-1">
                  <span
                    class="!bg-ink-3"
                    :style="{ width: `${(c.championPoints / most) * 100}%` }"
                  />
                </span>
                <span class="num shrink-0 text-[10.5px] text-ink-3">
                  <template v-if="progress(c)">
                    {{ compact(progress(c)!.remaining) }} to next
                  </template>
                  <template v-else>{{ timeAgo(c.lastPlayTime) }}</template>
                </span>
              </span>
            </span>
            <span
              class="flex w-9 shrink-0 flex-col items-end border-l border-line-2 pl-2.5"
              title="Mastery level"
            >
              <span class="label !text-[9px]">Lvl</span>
              <span class="stat mt-0.5 text-[18px] text-ink">{{ c.championLevel }}</span>
            </span>
          </li>
        </ul>

        <p v-if="!visible.length" class="py-10 text-center text-[12.5px] text-ink-3">
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
