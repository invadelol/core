<script setup lang="ts">
import type { Run } from '../../lib/changelog.js'

/** A changelog line's runs as text: bold, emphasis, code. */
defineProps<{ runs: Run[] }>()
</script>

<template>
  <template v-for="(r, i) in runs" :key="i">
    <b v-if="r.b">{{ r.s }}</b>
    <em v-else-if="r.i">{{ r.s }}</em>
    <code v-else-if="r.c">{{ r.s }}</code>
    <template v-else>{{ r.s }}</template>
  </template>
</template>
