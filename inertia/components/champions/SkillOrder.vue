<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import { abilityUrl, pct, thousands, type Skills } from '../../lib/champions.js'

/** The skills maxed first, and the most played order level by level (15 levels). */
const props = defineProps<{ skills: Skills; champion: number }>()

const top = computed(() => props.skills.orders[0] ?? null)
const KEYS = ['Q', 'W', 'E', 'R'] as const
</script>

<template>
  <div v-if="top">
    <div class="cs-skill-p">
      <template v-for="(k, i) in skills.max" :key="k">
        <ChevronRight v-if="i" :size="13" class="c" />
        <span class="k"
          ><img :src="abilityUrl(champion, k)" alt="" /><b>{{ k }}</b></span
        >
      </template>
      <span class="v"
        ><b>{{ pct(top.win) }}</b
        ><small>{{ thousands(top.games) }} games</small></span
      >
    </div>
    <div class="cs-skill-g">
      <template v-for="k in KEYS" :key="k">
        <span class="l"><img :src="abilityUrl(champion, k)" alt="" />{{ k }}</span>
        <i v-for="(o, i) in top.order" :key="i" :class="o === k ? ['on', k.toLowerCase()] : []">{{
          o === k ? i + 1 : ''
        }}</i>
      </template>
    </div>
  </div>
  <p v-else class="cs-empty">Not enough games yet.</p>
</template>
