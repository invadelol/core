<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import { ChampIcon } from '@invadelol/ui'
import { championName } from '../lib/assets.js'
import ShowMore from './ShowMore.vue'
import WinLoss from './ui/WinLoss.vue'
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

const open = ref(false)
const rows = computed(() =>
  (open.value ? props.champions : props.champions.slice(0, props.limit ?? 5)).map((c) => ({
    ...c,
    thin: c.games < SAMPLE,
  }))
)
</script>

<template>
  <section v-if="rows.length" class="rd-card">
    <div class="rd-head">
      <h3>Champions</h3>
      <Link :href="`/${encodeURIComponent(slug)}/champions`" class="rd-more">
        All {{ champions.length }}
      </Link>
    </div>

    <ul class="rd-plist">
      <li v-for="champ in rows" :key="champ.championId">
        <button
          type="button"
          class="prow"
          :class="{ on: active === champ.championId }"
          :aria-pressed="active === champ.championId"
          :title="`Show ${championName(champ.championId)} games`"
          @click="emit('pick', champ.championId)"
        >
          <ChampIcon :id="champ.championId" :size="36" />
          <span class="min-w-0">
            <b class="truncate">{{ championName(champ.championId) }}</b>
            <small class="num"
              >{{ champ.kda.toFixed(2) }} KDA, {{ champ.csMin.toFixed(1) }} CS/min</small
            >
          </span>
          <WinLoss
            :class="{ thin: champ.thin }"
            :wins="champ.wins"
            :losses="champ.games - champ.wins"
          />
        </button>
      </li>
    </ul>
    <div v-if="champions.length > (limit ?? 5)" class="rd-foot">
      <ShowMore v-model="open" :total="champions.length" :limit="limit ?? 5" />
    </div>
  </section>
</template>
