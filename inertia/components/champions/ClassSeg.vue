<script setup lang="ts">
import { Link, usePage } from '@inertiajs/vue3'
import { withQuery } from '../../lib/tier_lists.js'

/** A filter of addresses (`.seg`): each option sets `param` (null drops it, the first option). */
defineProps<{
  options: ReadonlyArray<{ value: string | null; label: string }>
  value: string | null
  param: string
  label: string
}>()
const page = usePage()
</script>

<template>
  <nav class="seg" :aria-label="label">
    <Link
      v-for="o in options"
      :key="o.value ?? ''"
      :href="withQuery(page.url, { [param]: o.value })"
      :class="{ on: (o.value ?? null) === (value ?? null) }"
      :aria-current="(o.value ?? null) === (value ?? null) ? 'page' : undefined"
      preserve-scroll
      >{{ o.label }}</Link
    >
  </nav>
</template>
