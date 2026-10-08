<script setup lang="ts">
import Glyph from './Glyph.vue'

/** The glyph and the name, set like the desktop app's sidebar: normal width, semibold. */
withDefaults(defineProps<{ size?: number }>(), { size: 16 })
</script>

<template>
  <span class="inline-flex items-center leading-none text-ink" :style="{ gap: `${size * 0.5}px` }">
    <Glyph :size="size * 1.3" />
    <span class="font-semibold tracking-[-0.01em]" :style="{ fontSize: `${size}px` }">Invade</span>
  </span>
</template>
