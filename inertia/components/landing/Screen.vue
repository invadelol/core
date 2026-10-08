<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * A fixed-size piece of UI (a game screen, an app window) fitted to the width it is given, with
 * a camera: `camera` is the point to centre, in the screen's own pixels, and a zoom. Moves glide
 * like a screen recording being zoomed in the edit; the view never leaves the screen's edges.
 */
const props = withDefaults(
  defineProps<{
    w: number
    h: number
    camera?: { x: number; y: number; z: number }
    /** The view's height as a share of its width, when it differs from the screen's. */
    ratio?: number
  }>(),
  { camera: undefined, ratio: undefined }
)

const box = ref<HTMLElement>()
const width = ref(0)
/** No glide on the first placement or while the window is being resized. */
const instant = ref(true)

let observer: ResizeObserver | undefined
let settle = 0

onMounted(() => {
  if (!box.value) return
  observer = new ResizeObserver(([entry]) => {
    instant.value = true
    width.value = entry.contentRect.width
    cancelAnimationFrame(settle)
    settle = requestAnimationFrame(() => {
      settle = requestAnimationFrame(() => (instant.value = false))
    })
  })
  observer.observe(box.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  cancelAnimationFrame(settle)
})

const viewRatio = computed(() => props.ratio ?? props.h / props.w)

const transform = computed(() => {
  const W = width.value
  if (!W) return undefined
  const H = W * viewRatio.value
  const fit = W / props.w
  const cam = props.camera ?? { x: props.w / 2, y: props.h / 2, z: 1 }
  const scale = fit * cam.z
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
  const tx = clamp(W / 2 - cam.x * scale, Math.min(0, W - props.w * scale), 0)
  const ty = clamp(H / 2 - cam.y * scale, Math.min(0, H - props.h * scale), 0)
  return `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${scale.toFixed(5)})`
})
</script>

<template>
  <div ref="box" class="screen" :style="{ aspectRatio: `1 / ${viewRatio}` }">
    <div
      class="screen-cam"
      :class="{ ready: !!transform, instant }"
      :style="{ width: `${w}px`, height: `${h}px`, transform }"
    >
      <slot :scale="width ? width / w : 0" />
    </div>
  </div>
</template>

<style scoped>
.screen {
  position: relative;
  width: 100%;
  overflow: hidden;
}

.screen-cam {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  opacity: 0;
  transition:
    transform 1100ms cubic-bezier(0.65, 0, 0.35, 1),
    opacity 400ms var(--ease);
}

.screen-cam.ready {
  opacity: 1;
}

.screen-cam.instant {
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  .screen-cam {
    transition: none;
  }
}
</style>
