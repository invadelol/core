<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import { champIcon, championName } from '../lib/assets.js'
import type { ChampionStats } from '../lib/types.js'

const props = defineProps<{
  champions: ChampionStats[]
  slug: string
  /** The champion currently filtering the match feed, if any. */
  active?: number
  limit?: number
}>()

const emit = defineEmits<{ pick: [championId: number] }>()

/** Below this many games a win rate is an anecdote: it is shown, but quietly. */
const SAMPLE = 3

const rows = computed(() =>
  props.champions.slice(0, props.limit ?? 5).map((c) => ({ ...c, thin: c.games < SAMPLE }))
)
</script>

<template>
  <section v-if="rows.length" class="card">
    <div class="section">
      <h3>Champions</h3>
      <Link
        :href="`/${encodeURIComponent(slug)}/champions`"
        class="meta ml-auto transition-colors hover:text-ink"
      >
        All {{ champions.length }}
      </Link>
    </div>

    <ul class="-mx-2">
      <li v-for="champ in rows" :key="champ.championId">
        <button
          class="flex h-[48px] w-full items-center gap-3 rounded-[5px] px-2 text-left transition-colors hover:bg-panel"
          :class="active === champ.championId ? '!bg-raised' : ''"
          :aria-pressed="active === champ.championId"
          :title="`Show ${championName(champ.championId)} games`"
          @click="emit('pick', champ.championId)"
        >
          <span class="portrait h-8 w-8">
            <img
              :src="champIcon(champ.championId)"
              :alt="championName(champ.championId)"
              width="32"
              height="32"
              loading="lazy"
            />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[13px] font-semibold leading-[17px] text-ink">
              {{ championName(champ.championId) }}
            </span>
            <span class="num block text-[12px] leading-4 text-ink-3">
              {{ champ.games }} {{ champ.games === 1 ? 'game' : 'games' }}
              <span class="text-ink-4">·</span> {{ champ.kda.toFixed(1) }} KDA
            </span>
          </span>
          <span class="num shrink-0 text-right">
            <span
              class="block text-[13px] font-semibold leading-[17px]"
              :class="champ.thin ? 'text-ink-3' : 'text-ink'"
            >
              {{ Math.round(champ.winrate * 100) }}%
            </span>
            <span class="block text-[12px] leading-4 text-ink-3">
              {{ champ.wins }}W {{ champ.games - champ.wins }}L
            </span>
          </span>
        </button>
      </li>
    </ul>
  </section>
</template>
