<script setup lang="ts">
import { ICONS, type IconName } from '../../lib/icons.js'

/** One of the design's line icons (lib/icons.ts): a 20 px grid, 1.6 px strokes, mitred corners. */
withDefaults(defineProps<{ name: IconName; size?: number; strokeWidth?: number }>(), {
  size: 16,
  strokeWidth: 1.6,
})
</script>

<template>
  <svg
    class="i"
    :width="size"
    :height="size"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linejoin="miter"
    stroke-linecap="butt"
    aria-hidden="true"
  >
    <path
      v-for="(p, i) in ICONS[name]"
      :key="i"
      :d="p.d"
      :transform="'transform' in p ? p.transform : undefined"
    />
  </svg>
</template>
