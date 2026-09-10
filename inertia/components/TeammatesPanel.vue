<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import Card from './ui/Card.vue'
import EmptyState from './ui/EmptyState.vue'
import Meter from './ui/Meter.vue'
import { profileIcon } from '../lib/assets.js'
import type { Teammate } from '../lib/types.js'

const props = defineProps<{ teammates: Teammate[] }>()

const maxGames = computed(() => Math.max(...props.teammates.map((t) => t.games), 1))

function winrate(mate: Teammate) {
  return mate.games ? Math.round((mate.wins / mate.games) * 100) : 0
}
</script>

<template>
  <Card title="Duo partners" note="games played together" flush>
    <EmptyState
      v-if="!teammates.length"
      message="No recurring teammates"
      hint="Players seen in more than one recent game show up here."
    />

    <ul v-else class="divide-y divide-line">
      <li v-for="mate in teammates" :key="mate.puuid">
        <Link
          :href="`/${encodeURIComponent(`${mate.gameName}-${mate.tagLine}`)}`"
          class="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[#fafafb]"
        >
          <img :src="profileIcon(mate.profileIconId)" alt="" class="thumb h-8 w-8 rounded-full" />

          <div class="min-w-0 flex-1">
            <div class="truncate text-[0.8125rem]">
              <span class="font-medium text-ink">{{ mate.gameName }}</span>
              <span class="text-ink-3">#{{ mate.tagLine }}</span>
            </div>
            <div class="mt-1 flex items-center gap-2">
              <Meter class="w-14" :value="(mate.games / maxGames) * 100" tone="muted" />
              <span class="num text-[0.6875rem] text-ink-3">{{ mate.games }} together</span>
            </div>
          </div>

          <div class="text-right">
            <div
              class="num text-[0.8125rem] font-semibold"
              :class="winrate(mate) >= 50 ? 'text-pos' : 'text-neg'"
            >
              {{ winrate(mate) }}%
            </div>
            <div class="num text-[0.625rem] text-ink-3">
              {{ mate.wins }}W {{ mate.games - mate.wins }}L
            </div>
          </div>
        </Link>
      </li>
    </ul>
  </Card>
</template>
