<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue'
import { endOfList } from '@invadelol/ui/logic'
import Icon from '../ui/Icon.vue'
import Skeleton from '../ui/Skeleton.vue'

/**
 * The end of the match history: the next page loads as the end comes into view (`auto`, on a wide
 * screen) or from the "Show older games" button. When the source holds older games back for a
 * while (`retryAfterMs`), the end stays quiet until a later reach after it; a failed page offers
 * to try again. The same behaviour as the shared views' list end, drawn in Facet.
 */
const props = withDefaults(
  defineProps<{
    more: boolean
    load: () => Promise<void | { retryAfterMs: number }>
    auto?: boolean
  }>(),
  { auto: true }
)

const end = endOfList()
const state = shallowRef<'idle' | 'loading' | 'error'>('idle')
const el = useTemplateRef<HTMLElement>('el')
let inView = false
let observer: IntersectionObserver | undefined

async function next(asked = false) {
  if (!props.more || state.value === 'loading' || !inView) return
  if (end.held() && !(asked && end.ask())) return
  const before = el.value?.offsetTop
  state.value = 'loading'
  try {
    const answer = await props.load()
    state.value = 'idle'
    if (answer && typeof answer.retryAfterMs === 'number') {
      end.hold(answer.retryAfterMs)
      return
    }
    end.clear()
  } catch {
    state.value = 'error'
    return
  }
  /* The end moved down with the new rows: observe it again so a still visible end asks once more. */
  if (props.auto) {
    await nextTick()
    if (el.value && observer && el.value.offsetTop !== before) {
      observer.unobserve(el.value)
      observer.observe(el.value)
    }
  }
}

function retry() {
  state.value = 'idle'
  inView = true
  void next(true)
}

function older() {
  inView = true
  void next(true)
}

onMounted(() => {
  observer = new IntersectionObserver(
    ([entry]) => {
      const was = inView
      inView = entry.isIntersecting
      if (inView && props.auto) void next(!was)
    },
    { rootMargin: '240px 0px' }
  )
  if (el.value) observer.observe(el.value)
})
watch(
  () => props.more,
  (more) => {
    if (more) end.clear()
    if (props.auto) void next()
  }
)
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="el" class="og" :aria-busy="state === 'loading'">
    <article v-if="state === 'loading'" class="card"><Skeleton :rows="3" pic /></article>
    <p v-else-if="state === 'error'" class="og-line" role="alert">
      <span class="meta">Older games could not be loaded.</span>
      <button type="button" class="btn sm" @click="retry"><Icon name="refresh" />Try again</button>
    </p>
    <button v-else-if="more && !auto" type="button" class="btn og-btn" @click="older">
      Show older games<Icon name="chev" />
    </button>
    <p v-else-if="!more" class="og-line meta" role="status">That's every tracked game</p>
  </div>
</template>

<style scoped>
.og-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 44px;
  margin: 0;
}
.og-btn {
  width: 100%;
}
</style>
