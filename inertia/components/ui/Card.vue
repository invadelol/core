<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    note?: string
    /** Drop the inner padding when the body owns its own layout (tables, lists). */
    flush?: boolean
  }>(),
  { flush: false }
)
</script>

<template>
  <section class="card overflow-hidden">
    <header v-if="title || $slots.actions" class="card-head">
      <div class="flex items-baseline gap-2 min-w-0">
        <h2 v-if="title" class="card-title truncate">{{ title }}</h2>
        <span v-if="note" class="card-note truncate">{{ note }}</span>
      </div>
      <slot name="actions" />
    </header>
    <div :class="flush ? '' : 'card-body'">
      <slot />
    </div>
  </section>
</template>
