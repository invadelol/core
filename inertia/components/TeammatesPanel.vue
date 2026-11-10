<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import { profileIcon } from '../lib/assets.js'
import { profilePath } from '../lib/format.js'
import type { Teammate } from '../lib/types.js'
import ShowMore from './ShowMore.vue'
import WinLoss from './ui/WinLoss.vue'

const props = defineProps<{ teammates: Teammate[] }>()

/** Rows shown before "Show all". */
const LIST = 5
const open = ref(false)
const rows = computed(() =>
  (open.value ? props.teammates : props.teammates.slice(0, LIST)).map((mate) => ({
    ...mate,
    winrate: mate.games ? Math.round((mate.wins / mate.games) * 100) : 0,
  }))
)
</script>

<template>
  <section v-if="rows.length" class="rd-card">
    <div class="rd-head">
      <h3>Played with</h3>
    </div>

    <ul class="rd-plist">
      <li v-for="mate in rows" :key="mate.puuid">
        <Link :href="profilePath(mate.gameName, mate.tagLine)" class="prow">
          <img
            :src="profileIcon(mate.profileIconId)"
            alt=""
            width="36"
            height="36"
            loading="lazy"
            class="rd-por"
          />
          <span class="min-w-0">
            <b class="truncate">{{ mate.gameName }}</b>
            <small class="num">{{ mate.games }} games together</small>
          </span>
          <WinLoss :wins="mate.wins" :losses="mate.games - mate.wins" />
        </Link>
      </li>
    </ul>
    <div v-if="teammates.length > LIST" class="rd-foot">
      <ShowMore v-model="open" :total="teammates.length" :limit="LIST" />
    </div>
  </section>
</template>
