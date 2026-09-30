<script setup lang="ts">
import Glyph from './Glyph.vue'

/** The glyph and the name, set like the desktop app's sidebar. */
withDefaults(defineProps<{ size?: number }>(), { size: 20 })
</script>

<template>
  <span class="inline-flex items-center leading-none text-ink" :style="{ gap: `${size * 0.42}px` }">
    <Glyph :size="size * 1.2" />
    <span class="display font-extrabold" :style="{ fontSize: `${size}px` }">Invade</span>
  </span>
</template>
