<script setup lang="ts">
import { computed } from 'vue'
import { championName, championSplash } from '../lib/assets.js'
import type { ChampionStats } from '../lib/types.js'

const props = defineProps<{ champions: ChampionStats[] }>()
const emit = defineEmits<{ pick: [championId: number] }>()
const champion = computed(() => [...props.champions].sort((a, b) => b.games - a.games)[0])
</script>

<template>
  <button
    v-if="champion"
    class="group relative block h-[150px] w-full overflow-hidden rounded-xl border border-line sm:h-[210px]"
    :aria-label="`View ${championName(champion.championId)} matches`"
    @click="emit('pick', champion.championId)"
  >
    <img
      :src="championSplash(champion.championId)"
      :alt="championName(champion.championId)"
      class="h-full w-full object-cover object-[50%_25%] transition-transform duration-500 group-hover:scale-[1.02]"
    />
  </button>
</template>
