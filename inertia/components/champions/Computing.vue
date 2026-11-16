<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { router } from '@inertiajs/vue3'
import Skeleton from '../ui/Skeleton.vue'

/**
 * A list whose counts are being read in the background (a filter nobody asked for yet): says so,
 * and asks for the list again every few seconds until it is there. `ahead` is the number of reads
 * before this one; null when the queue is full.
 */
const props = withDefaults(defineProps<{ ahead?: number | null; only?: string[] }>(), {
  ahead: 0,
  only: () => ['list'],
})
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(
    () => router.reload({ only: props.only }),
    props.ahead === null ? 15_000 : 4_000
  )
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <article class="card computing" aria-live="polite">
    <div class="computing-t">
      <span class="h4">Counting this filter’s games</span>
      <span class="meta">{{
        ahead === null
          ? 'Many lists are being counted right now. This one starts as soon as there is room.'
          : ahead > 0
            ? `It starts after ${ahead} other ${ahead === 1 ? 'list' : 'lists'}, then shows here by itself.`
            : 'It shows here by itself in a moment.'
      }}</span>
    </div>
    <Skeleton :rows="6" pic />
  </article>
</template>
