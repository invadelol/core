<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Check, LoaderCircle } from 'lucide-vue-next'

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
    { rootMargin: '320px 0px' }
  )
  if (sentinel.value) observer.observe(sentinel.value)
})

watch(
  () => [props.loading, props.hasMore, props.error],
  async () => {
    await nextTick()
    // Recheck geometry after new rows push the sentinel below the viewport.
    const rect = sentinel.value?.getBoundingClientRect()
    visible = !!rect && rect.top <= window.innerHeight + 320 && rect.bottom >= -320
    maybeLoad()
  }
)

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div
    ref="sentinel"
    class="flex min-h-[56px] items-center justify-center gap-3 py-4 text-[11.5px] text-ink-3"
    aria-live="polite"
    :aria-busy="loading"
  >
    <span v-if="loading" class="flex items-center gap-2">
      <LoaderCircle :size="14" class="animate-spin" />
      Loading more games
    </span>
    <template v-else-if="error">
      <span>Couldn’t load the next matches.</span>
      <button class="btn btn-sm" @click="emit('load')">Try again</button>
    </template>
    <span v-else-if="!hasMore && !empty" class="flex items-center gap-1.5">
      <Check :size="13" />
      That’s every tracked game
    </span>
  </div>
</template>
