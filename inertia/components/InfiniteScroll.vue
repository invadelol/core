<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { LoaderCircle, Check } from 'lucide-vue-next'
const props = defineProps<{ hasMore: boolean; loading: boolean; error: boolean; empty: boolean }>()
const emit = defineEmits<{ load: [] }>()
const sentinel = ref<HTMLElement>()
let observer: IntersectionObserver | undefined
let visible = false
function maybeLoad() {
  if (visible && props.hasMore && !props.loading && !props.error) emit('load')
}
onMounted(() => {
  observer = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting
      maybeLoad()
    },
    { rootMargin: '280px 0px' }
  )
  if (sentinel.value) observer.observe(sentinel.value)
})
watch(
  () => [props.loading, props.hasMore, props.error],
  async () => {
    await nextTick()
    // Recheck geometry after new rows push the sentinel below the viewport.
    const rect = sentinel.value?.getBoundingClientRect()
    visible = !!rect && rect.top <= window.innerHeight + 280 && rect.bottom >= -280
    maybeLoad()
  }
)
onBeforeUnmount(() => observer?.disconnect())
</script>
<template>
  <div ref="sentinel" class="feed-sentinel" aria-live="polite" :aria-busy="loading">
    <span v-if="loading"><LoaderCircle :size="15" class="animate-spin" /> Loading matches…</span>
    <template v-else-if="error"
      ><span>Couldn’t load the next matches.</span
      ><button class="btn" @click="emit('load')">Try again</button></template
    >
    <span v-else-if="!hasMore && !empty"><Check :size="14" /> You’re all caught up</span>
    <span v-else-if="hasMore" class="subtle">More matches as you scroll</span>
  </div>
</template>
