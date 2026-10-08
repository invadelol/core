<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import { profileIcon } from '../lib/assets.js'
import { profilePath } from '../lib/format.js'
import type { Teammate } from '../lib/types.js'

const props = defineProps<{ teammates: Teammate[] }>()

const rows = computed(() =>
  props.teammates.slice(0, 5).map((mate) => ({
    ...mate,
    winrate: mate.games ? Math.round((mate.wins / mate.games) * 100) : 0,
  }))
)
</script>

<template>
  <section v-if="rows.length" class="card">
    <div class="section">
      <h3>Played with</h3>
    </div>

    <ul class="-mx-2">
      <li v-for="mate in rows" :key="mate.puuid">
        <Link
          :href="profilePath(mate.gameName, mate.tagLine)"
          class="flex h-[48px] items-center gap-3 rounded-[5px] px-2 transition-colors hover:bg-panel"
        >
          <img
            :src="profileIcon(mate.profileIconId)"
            alt=""
            width="32"
            height="32"
            loading="lazy"
            class="thumb h-8 w-8 rounded-[5px]"
          />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[13px] leading-[17px]">
              <span class="font-semibold text-ink">{{ mate.gameName }}</span>
              <span class="text-ink-3">#{{ mate.tagLine }}</span>
            </span>
            <span class="num block text-[12px] leading-4 text-ink-3">
              {{ mate.games }} games together
            </span>
          </span>
          <span class="num shrink-0 text-right">
            <span class="block text-[13px] font-semibold leading-[17px] text-ink">
              {{ mate.winrate }}%
            </span>
            <span class="block text-[12px] leading-4 text-ink-3">
              {{ mate.wins }}W {{ mate.games - mate.wins }}L
            </span>
          </span>
        </Link>
      </li>
    </ul>
  </section>
</template>
