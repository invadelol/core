<script setup lang="ts">
import { computed } from 'vue'
import { starsWords } from '../../lib/skins.js'

/**
 * A rating in half stars (1 to 10) as five stars: ink, or violet when it is the visitor's own.
 * `prompt` draws five outlined stars for a skin not rated yet.
 */
const props = withDefaults(
  defineProps<{ value: number | null; size?: number; mine?: boolean; prompt?: boolean }>(),
  { size: 12, mine: false, prompt: false }
)

const STAR =
  'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.12 2.12 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.12 2.12 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.12 2.12 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.12 2.12 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.12 2.12 0 0 0 1.597-1.16z'

/** Each star: 2 full, 1 half, 0 empty. */
const stars = computed(() =>
  Array.from({ length: 5 }, (_, i) => Math.max(0, Math.min(2, (props.value ?? 0) - i * 2)))
)
const label = computed(() =>
  props.value ? starsWords(props.value) : props.prompt ? 'Not rated yet' : undefined
)
</script>

<template>
  <span
    class="skn-stars"
    :class="{ mine, prompt: prompt && !value }"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
  >
    <svg
      v-for="(fill, i) in stars"
      :key="i"
      :width="size"
      :height="size"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path class="off" :d="STAR" />
      <path v-if="fill === 2" class="on" :d="STAR" />
      <path v-else-if="fill === 1" class="on" :d="STAR" style="clip-path: inset(0 50% 0 0)" />
    </svg>
  </span>
</template>
