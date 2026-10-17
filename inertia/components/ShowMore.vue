<script setup lang="ts">
/**
 * The toggle under a list cut to its first rows, worded like the Friends list: shown only when
 * something is hidden, and it folds the list back once opened.
 */
defineProps<{ total: number; limit: number }>()
const open = defineModel<boolean>({ default: false })
</script>

<template>
  <button
    v-if="total > limit"
    type="button"
    class="iv-btn ghost sm w-full"
    :aria-expanded="open"
    @click="open = !open"
  >
    {{ open ? 'Show fewer' : `Show all ${total}` }}
  </button>
</template>
