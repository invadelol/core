<script setup lang="ts">
/**
 * The last games as a strip of straight bars (`.form`), oldest on the left: blue a win, pink a
 * loss. `tall` is the larger strip of a header.
 */
defineProps<{ results: boolean[]; tall?: boolean; small?: boolean }>()
</script>

<template>
  <!-- `vb` on its own box: the strip keeps its look on a page not rebuilt yet. -->
  <span class="vb form-box">
    <span
      class="form"
      :class="{ lg: tall, sm: small }"
      :aria-label="`${results.filter(Boolean).length} wins in the last ${results.length} games`"
    >
      <i v-for="(win, i) in results" :key="i" :class="{ w: win }" aria-hidden="true" />
    </span>
  </span>
</template>
