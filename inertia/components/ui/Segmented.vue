<script setup lang="ts" generic="T extends string | number">
defineProps<{
  options: ReadonlyArray<{ value: T; label: string }>
}>()

const model = defineModel<T>({ required: true })
</script>

<template>
  <div class="seg">
    <button
      v-for="option in options"
      :key="String(option.value)"
      type="button"
      :data-active="model === option.value"
      @click="model = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>
