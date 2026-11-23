<script setup lang="ts">
import { computed } from 'vue'
import VioletLine from '../ui/VioletLine.vue'
import RankEmblem from '../ui/RankEmblem.vue'
import { rankWords } from '../../lib/ladders.js'
import type { SeasonLine } from '../../lib/invade_profile.js'

/** The main account's Solo/Duo season: one line in the owner's accent, a soft fade under it. */
const props = defineProps<{ season: SeasonLine }>()
const from = computed(() => rankWords(props.season.from.tier, props.season.from.division))
const to = computed(() => rankWords(props.season.to.tier, props.season.to.division))
</script>

<template>
  <div class="pf-season">
    <VioletLine :values="season.points.map((p) => p.value)" :height="84" end="" />
    <div class="pf-sn">
      <span><RankEmblem :tier="season.from.tier" :size="18" />{{ from }}</span>
      <span><RankEmblem :tier="season.to.tier" :size="18" />{{ to }}</span>
    </div>
  </div>
</template>
