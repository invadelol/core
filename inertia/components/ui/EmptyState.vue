<script setup lang="ts">
defineProps<{
  message: string
  hint?: string
}>()
</script>

<template>
  <div class="py-8 text-center">
    <p class="text-[0.8125rem] text-ink-2">{{ message }}</p>
    <p v-if="hint" class="mt-1 text-[0.6875rem] text-ink-3">{{ hint }}</p>
  </div>
</template>
