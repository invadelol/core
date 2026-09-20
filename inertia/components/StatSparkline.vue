<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ values: number[]; label: string }>()
const points = computed(() => {
  const min = Math.min(...props.values),
    max = Math.max(...props.values)
  return props.values
    .map(
      (v, i) =>
        `${(i * 160) / Math.max(1, props.values.length - 1)},${36 - ((v - min) / Math.max(1, max - min)) * 30}`
    )
    .join(' ')
})
</script>
<template>
  <svg
    v-if="values.length > 1"
    viewBox="0 0 164 42"
    role="img"
    :aria-label="label"
    class="stat-sparkline"
  >
    <polyline
      :points="points"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linejoin="round"
      stroke-linecap="round"
    /></svg
  ><span v-else class="subtle">More games needed</span>
</template>
