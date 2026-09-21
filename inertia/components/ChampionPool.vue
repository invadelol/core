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

const rows = computed(() => {
  const list = props.champions.slice(0, props.limit ?? 5)
  const most = Math.max(...list.map((c) => c.games), 1)
  return list.map((c) => ({ ...c, share: (c.games / most) * 100 }))
})
</script>

<template>
  <section v-if="rows.length">
    <div class="section">
      <h3>Champions</h3>
      <Link
        :href="`/${encodeURIComponent(slug)}/champions`"
        class="meta ml-auto transition-colors hover:text-ink"
      >
        All {{ champions.length }}
      </Link>
    </div>

    <ul class="space-y-1">
      <li v-for="champ in rows" :key="champ.championId">
        <button
          class="flex w-full items-center gap-2.5 rounded-[6px] px-1.5 py-1.5 text-left transition-colors hover:bg-raised"
          :class="active === champ.championId ? 'bg-raised' : ''"
          @click="emit('pick', champ.championId)"
        >
          <img
            :src="champIcon(champ.championId)"
            :alt="championName(champ.championId)"
            width="28"
            height="28"
            loading="lazy"
            class="thumb h-7 w-7 rounded-[6px]"
          />
          <span class="min-w-0 flex-1">
            <span class="flex items-baseline justify-between gap-2">
              <span class="truncate text-[12px] font-medium text-ink">
                {{ championName(champ.championId) }}
              </span>
              <span
                class="num shrink-0 text-[11.5px] font-medium"
                :class="champ.winrate >= 0.5 ? 'text-win' : 'text-loss'"
              >
                {{ Math.round(champ.winrate * 100) }}%
              </span>
            </span>
            <span class="mt-1 flex items-center gap-2">
              <span class="h-[4px] min-w-0 flex-1 rounded-[2px] bg-sunken">
                <span
                  class="block h-full rounded-[2px] bg-ink-3"
                  :style="{ width: `${champ.share}%` }"
                />
              </span>
              <span class="num shrink-0 text-[10.5px] text-ink-3">
                {{ champ.games }}g · {{ champ.kda.toFixed(1) }} KDA
              </span>
            </span>
          </span>
        </button>
      </li>
    </ul>
  </section>
</template>
