<script setup lang="ts">
import { computed } from 'vue'
import { TIERS } from '../../lib/champions.js'

/**
 * A flat tier chip (S+ to D): the violet ramp carries the rank, S+ brightest. `tier` is the index
 * the statistics use (0 = S+) or the letter itself; nothing known draws a dash.
 */
const props = defineProps<{ tier: number | string | null | undefined; large?: boolean }>()

const CLASSES = ['sp', 's', 'a', 'b', 'c', 'd'] as const
const index = computed(() => {
  if (typeof props.tier === 'number') return props.tier
  if (!props.tier) return -1
  return (TIERS as readonly string[]).indexOf(props.tier.toUpperCase())
})
</script>

<template>
  <span
    v-if="index >= 0 && index < TIERS.length"
    class="tier"
    :class="[CLASSES[index], { lg: large }]"
    >{{ TIERS[index] }}<span class="sr-only"> tier</span></span
  >
  <span v-else class="tier d" :class="{ lg: large }" aria-label="No tier">–</span>
</template>
