<script setup lang="ts">
import { provide, toRef } from 'vue'
import { PLATE_REVEAL } from '../../lib/plate.js'

/** Shows each plate inside it at a share (0–1) of its score: a plate counting up as it lights. */
const props = defineProps<{ value: number }>()
provide(PLATE_REVEAL, toRef(props, 'value'))
</script>

<template>
  <slot />
</template>
