<script setup lang="ts">
/** A pro's photo: the pro data has none, so a quiet silhouette holds its place (drawn by CSS). */
withDefaults(defineProps<{ width?: number; height?: number }>(), { width: 36, height: 36 })
</script>

<template>
  <span
    class="nb-photo"
    :style="{ width: `${width}px`, height: `${height}px` }"
    aria-hidden="true"
  />
</template>
