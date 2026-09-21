<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import { profileIcon } from '../lib/assets.js'
import { profilePath } from '../lib/format.js'
import type { Teammate } from '../lib/types.js'

const props = defineProps<{ teammates: Teammate[] }>()

const rows = computed(() => {
  const list = props.teammates.slice(0, 5)
  const most = Math.max(...list.map((t) => t.games), 1)
  return list.map((mate) => ({
    ...mate,
    share: (mate.games / most) * 100,
    winrate: mate.games ? Math.round((mate.wins / mate.games) * 100) : 0,
  }))
})
</script>

<template>
  <section v-if="rows.length">
    <div class="section">
      <h3>Played with</h3>
      <span class="meta">recurring teammates</span>
    </div>

    <ul class="space-y-1">
      <li v-for="mate in rows" :key="mate.puuid">
        <Link
          :href="profilePath(mate.gameName, mate.tagLine)"
          class="flex items-center gap-2.5 rounded-[6px] px-1.5 py-1.5 transition-colors hover:bg-raised"
        >
          <img
            :src="profileIcon(mate.profileIconId)"
            alt=""
            width="26"
            height="26"
            loading="lazy"
            class="thumb h-[26px] w-[26px] rounded-full"
          />
          <span class="min-w-0 flex-1">
            <span class="flex items-baseline justify-between gap-2">
              <span class="truncate text-[12px]">
                <span class="font-medium text-ink">{{ mate.gameName }}</span>
                <span class="text-ink-4">#{{ mate.tagLine }}</span>
              </span>
              <span
                class="num shrink-0 text-[11.5px] font-medium"
                :class="mate.winrate >= 50 ? 'text-win' : 'text-loss'"
              >
                {{ mate.winrate }}%
              </span>
            </span>
            <span class="mt-1 flex items-center gap-2">
              <span class="h-[4px] min-w-0 flex-1 rounded-[2px] bg-sunken">
                <span
                  class="block h-full rounded-[2px] bg-ink-3"
                  :style="{ width: `${mate.share}%` }"
                />
              </span>
              <span class="num shrink-0 text-[10.5px] text-ink-3"> {{ mate.games }} together </span>
            </span>
          </span>
        </Link>
      </li>
    </ul>
  </section>
</template>
