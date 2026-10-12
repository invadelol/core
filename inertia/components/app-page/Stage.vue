<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * A piece of UI drawn at its real size (`w` × `h`, the size it has in the app or the game) and
 * scaled to the width it is given, so it stays sharp and exact at any width. Below `narrowAt`
 * pixels it shows `focus` instead, a crop of the same piece at a size that can still be read.
 * The box keeps its ratio from the first paint, so nothing moves when the scale arrives.
 */
const props = withDefaults(
  defineProps<{
    w: number
    h: number
    /** The crop shown on narrow screens, in the piece's own pixels. */
    focus?: { x: number; y: number; w: number; h: number }
    /** The part shown otherwise (default: all of it). */
    crop?: { x: number; y: number; w: number; h: number }
    narrowAt?: number
    label?: string
  }>(),
  { focus: undefined, crop: undefined, narrowAt: 640, label: undefined }
)

const box = ref<HTMLElement>()
const width = ref(0)
let observer: ResizeObserver | undefined

onMounted(() => {
  if (!box.value) return
  width.value = box.value.clientWidth
  observer = new ResizeObserver(([entry]) => (width.value = entry.contentRect.width))
  observer.observe(box.value)
})
onBeforeUnmount(() => observer?.disconnect())

/** The part of the piece in view: all of it, or the focus on a narrow screen. */
const view = computed(() =>
  props.focus && width.value && width.value < props.narrowAt
    ? props.focus
    : (props.crop ?? { x: 0, y: 0, w: props.w, h: props.h })
)

const style = computed(() => {
  const v = view.value
  const s = width.value ? width.value / v.w : 0
  return {
    width: `${props.w}px`,
    height: `${props.h}px`,
    transform: s ? `translate(${-v.x * s}px, ${-v.y * s}px) scale(${s})` : undefined,
  }
})
</script>

<template>
  <div
    ref="box"
    class="stage"
    :style="{ aspectRatio: `${view.w} / ${view.h}` }"
    :role="label ? 'img' : undefined"
    :aria-label="label"
  >
    <div
      class="stage-in"
      :class="{ ready: width > 0 }"
      :style="style"
      :aria-hidden="label ? 'true' : undefined"
      :inert="label ? true : undefined"
    >
      <slot v-if="width > 0" />
    </div>
  </div>
</template>

<style scoped>
.stage {
  position: relative;
  width: 100%;
  overflow: hidden;
}

.stage-in {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  opacity: 0;
  transition: opacity 300ms var(--ease);
}

.stage-in.ready {
  opacity: 1;
}
</style>
