<script setup lang="ts">
import { computed } from 'vue'
import { SCORE_TONE, scoreTier } from '../lib/match.js'

const props = withDefaults(defineProps<{ score: number; size?: number; stroke?: number }>(), {
  size: 88,
  stroke: 6,
})

const radius = computed(() => (props.size - props.stroke) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const tone = computed(() => SCORE_TONE[scoreTier(props.score)])
</script>

<template>
  <span class="relative inline-block shrink-0" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg :width="size" :height="size" class="block -rotate-90" aria-hidden="true">
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        stroke="var(--color-sunken)"
        :stroke-width="stroke"
      />
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        :stroke="tone"
        :stroke-width="stroke"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="circumference * (1 - Math.max(0, Math.min(score, 100)) / 100)"
        class="transition-[stroke-dashoffset] duration-500"
      />
    </svg>
    <!-- Centred over the whole ring rather than left to grid alignment,
         which engines disagree on for absolutely positioned children. -->
    <span
      class="stat absolute inset-0 flex items-center justify-center leading-none"
      :style="{ fontSize: `${Math.round(size * 0.36)}px`, color: tone }"
    >
      {{ score }}
    </span>
  </span>
</template>
