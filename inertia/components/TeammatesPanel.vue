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
  <section v-if="rows.length" class="card">
    <div class="section">
      <h3>Played with</h3>
      <span class="meta">recurring teammates</span>
    </div>

    <ul class="space-y-0.5 !px-2 !pb-2 !pt-2">
      <li v-for="mate in rows" :key="mate.puuid">
        <Link
          :href="profilePath(mate.gameName, mate.tagLine)"
          class="flex items-center gap-3 rounded-[7px] px-2 py-2 transition-colors hover:bg-raised"
        >
          <img
            :src="profileIcon(mate.profileIconId)"
            alt=""
            width="30"
            height="30"
            loading="lazy"
            class="thumb h-[30px] w-[30px] rounded-[7px]"
          />
          <span class="min-w-0 flex-1">
            <span class="flex items-baseline justify-between gap-2">
              <span class="truncate text-[12px]">
                <span class="font-semibold text-ink">{{ mate.gameName }}</span>
                <span class="text-ink-4">#{{ mate.tagLine }}</span>
              </span>
              <span
                class="num stat shrink-0 text-[15px]"
                :class="mate.winrate >= 50 ? 'text-win' : 'text-loss'"
              >
                {{ mate.winrate }}%
              </span>
            </span>
            <span class="mt-1 flex items-center gap-2">
              <span class="meter min-w-0 flex-1">
                <span class="!bg-ink-3" :style="{ width: `${mate.share}%` }" />
              </span>
              <span class="num shrink-0 text-[10.5px] text-ink-3"> {{ mate.games }} together </span>
            </span>
          </span>
        </Link>
      </li>
    </ul>
  </section>
</template>
