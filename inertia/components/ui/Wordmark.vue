<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 20 })
</script>

<template>
  <span
    class="display inline-flex items-baseline leading-none text-ink"
    :style="{ fontSize: `${size}px` }"
  >
    invade<span class="text-ink-4">.lol</span>
  </span>
</template>
