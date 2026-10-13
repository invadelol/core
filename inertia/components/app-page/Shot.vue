<script setup lang="ts">
import { computed } from 'vue'
import { SHOTS, type ShotName } from './shots'

/**
 * A capture of the real app (public/app/), as a responsive <picture>: AVIF where it is smaller,
 * WebP otherwise, at 1× and 2×, with its natural size so nothing shifts. Lazy unless `eager`.
 */
const props = withDefaults(
  defineProps<{
    name: ShotName
    alt: string
    /** The `sizes` attribute: how wide the image is drawn. */
    sizes?: string
    eager?: boolean
  }>(),
  { sizes: '100vw', eager: false }
)

const info = computed(() => SHOTS[props.name])
const set = (ext: string) =>
  info.value.widths.map((w) => `/app/${props.name}-${w}.${ext} ${w}w`).join(', ')
const avif = computed(() => ('avif' in info.value ? info.value.avif : false))
const fallback = computed(() => `/app/${props.name}-${info.value.widths[0]}.webp`)
</script>

<template>
  <picture class="shot">
    <source v-if="avif" type="image/avif" :srcset="set('avif')" :sizes="sizes" />
    <source type="image/webp" :srcset="set('webp')" :sizes="sizes" />
    <img
      :src="fallback"
      :width="info.w"
      :height="info.h"
      :alt="alt"
      :loading="eager ? 'eager' : 'lazy'"
      :fetchpriority="eager ? 'high' : undefined"
      decoding="async"
      draggable="false"
    />
  </picture>
</template>

<style scoped>
.shot,
.shot img {
  display: block;
  width: 100%;
  height: auto;
}

.shot img {
  user-select: none;
}
</style>
