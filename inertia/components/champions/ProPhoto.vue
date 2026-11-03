<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import '../../css/pro_media.css'

/**
 * A pro's photo from our own /cdn, cropped square from the top and drawn in its box; a quiet
 * silhouette (drawn by CSS) holds the place when they have none or it fails to load. The box has
 * its size before the image arrives, so nothing moves.
 */
const props = withDefaults(
  defineProps<{
    slug?: string | null
    /** The photo's version from the page's props; no photo without it. */
    photo?: string | null
    width?: number
    height?: number
    /** Lazy unless it is part of the first screen. */
    eager?: boolean
    /** Sized by its CSS (width and height then only pick the image's size). */
    fluid?: boolean
  }>(),
  { slug: null, photo: null, width: 36, height: 36, eager: false, fluid: false }
)

/** Served sizes (`/cdn/pro/:slug?s=`), CSS pixels; the server draws them at twice the size. */
const SIZES = [24, 32, 40, 48, 64, 96, 144, 240]
const failed = ref(false)
const img = ref<HTMLImageElement | null>(null)
// A photo that failed before the page hydrated never fires the handler.
onMounted(() => {
  if (img.value?.complete && !img.value.naturalWidth) failed.value = true
})
const src = computed(() => {
  if (!props.slug || !props.photo) return null
  const want = Math.max(props.width, props.height)
  const size = SIZES.find((s) => s >= want) ?? SIZES[SIZES.length - 1]
  return `/cdn/pro/${encodeURIComponent(props.slug)}?s=${size}&v=${encodeURIComponent(props.photo)}`
})
</script>

<template>
  <span
    class="nb-photo"
    :class="{ has: src && !failed }"
    :style="fluid ? undefined : { width: `${width}px`, height: `${height}px` }"
    aria-hidden="true"
  >
    <img
      v-if="src && !failed"
      ref="img"
      :src="src"
      alt=""
      :width="width"
      :height="height"
      :loading="eager ? 'eager' : 'lazy'"
      :fetchpriority="eager ? 'high' : undefined"
      decoding="async"
      data-fallback="applied"
      @error="failed = true"
    />
    <slot />
  </span>
</template>
