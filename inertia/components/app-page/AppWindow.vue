<script setup lang="ts">
import { computed } from 'vue'
import Shot from './Shot.vue'
import type { ShotName } from './shots'

/**
 * The desktop app's window around a capture (.app-window, css/components.css): the app's ink and
 * corners, a lit top edge, macOS's three buttons in the space the app leaves for them, and the
 * page's shadow under it. It stays dark in the light theme, as the app is.
 * `crop` (x, y, width, height as fractions of the window): on a phone only that part is shown,
 * larger, so the window reads at that width. Slotted layers (other views) are cropped the same.
 */
const props = withDefaults(
  defineProps<{
    name: ShotName
    alt: string
    sizes?: string
    eager?: boolean
    crop?: [number, number, number, number]
  }>(),
  { sizes: '(min-width: 1360px) 1240px, 92vw', eager: false, crop: undefined }
)

/** The window is 1440 × 900 points; the crop keeps the capture's own proportions. */
const cropStyle = computed(() => {
  if (!props.crop) return undefined
  const [x, y, w, h] = props.crop
  return {
    '--crop-ratio': `${(w * 1440) / (h * 900)}`,
    '--crop-w': `${100 / w}%`,
    '--crop-x': `${(-x / w) * 100}%`,
    '--crop-y': `${(-y / h) * 100}%`,
  }
})
const shotSizes = computed(() =>
  props.crop ? `(max-width: 700px) 200vw, ${props.sizes}` : props.sizes
)
</script>

<template>
  <div class="win app-window iv-dark" :class="{ cropped: crop }" :style="cropStyle">
    <Shot :name="name" :alt="alt" :sizes="shotSizes" :eager="eager" />
    <slot />
    <span class="lights" aria-hidden="true"><i /><i /><i /></span>
  </div>
</template>

<style scoped>
/* A phone: the chosen part of the window, at a size that reads. */
@media (max-width: 700px) {
  .win.cropped {
    aspect-ratio: var(--crop-ratio);
  }

  .win.cropped :deep(picture) {
    position: absolute;
    top: var(--crop-y);
    left: var(--crop-x);
    width: var(--crop-w);
    max-width: none;
  }

  .win.cropped .lights {
    display: none;
  }
}
</style>
