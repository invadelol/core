<script setup lang="ts">
import type { Parts } from '../../lib/new_dawn.js'

/** A line of the hub's text with its bold runs (lib/new_dawn.ts: odd parts are bold). */
defineProps<{ parts: Parts }>()
</script>

<template>
  <template v-for="(p, i) in parts" :key="i"
    ><b v-if="i % 2">{{ p }}</b
    ><template v-else>{{ p }}</template></template
  >
</template>
