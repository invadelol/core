<script setup lang="ts">
import { computed } from 'vue'
import Shot from './Shot.vue'
import type { ShotName } from './shots'

/**
 * The desktop app's window around a capture: its rounded corners, a hairline edge, macOS's three
 * buttons in the space the app leaves for them, and a deep, soft shadow under it.
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
  <div class="win" :class="{ cropped: crop }" :style="cropStyle">
    <Shot :name="name" :alt="alt" :sizes="shotSizes" :eager="eager" />
    <slot />
    <span class="lights" aria-hidden="true"><i /><i /><i /></span>
  </div>
</template>

<style scoped>
.win {
  position: relative;
  overflow: hidden;
  /* 12px at 1440 wide, as the window's own corners. */
  border-radius: clamp(8px, 0.9vw, 12px);
  background: #0d0e13;
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 0.09),
    var(--ap-shadow);
}

/* The buttons sit where the app keeps room for them (its sidebar's top-left corner). */
.lights {
  position: absolute;
  top: 1.45%;
  left: 1.2%;
  display: flex;
  justify-content: space-between;
  width: 3.6%;
  pointer-events: none;
}

.lights i {
  width: 23%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: #ff5f57;
  box-shadow: inset 0 0 0 0.5px rgb(0 0 0 / 0.2);
}

.lights i:nth-child(2) {
  background: #febc2e;
}

.lights i:nth-child(3) {
  background: #28c840;
}

/* A phone: the chosen part of the window, at a size that reads. */
@media (max-width: 700px) {
  .win.cropped {
    aspect-ratio: var(--crop-ratio);
    border-radius: 14px;
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
