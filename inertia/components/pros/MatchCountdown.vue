<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { countdown } from '../../lib/pro_matches.js'

/**
 * "in 9 h" until a match starts. Empty on the server and the first client render (the visitor's
 * clock is unknown there), then filled after mount and kept fresh each minute. Its box keeps one
 * width, so filling it moves nothing.
 */
const props = defineProps<{ at: string }>()
const text = ref<string | null>(null)
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  text.value = countdown(props.at)
  timer = setInterval(() => (text.value = countdown(props.at)), 60_000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <span class="pm-count num" aria-live="off">{{ text ?? '' }}</span>
</template>
