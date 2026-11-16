<script setup lang="ts">
import { computed } from 'vue'

/**
 * A picture in a frame: League art, a pro's photo, a capture. Large pictures (96 px and up) get
 * the facet, their top-right corner cut like the glyph's wing tip; smaller tiles stay plain rounded
 * squares (no dog-ear on small tiles). `stage` puts a cutout photo on the violet stage, `visor`
 * crops a champion square to its face band.
 */
const props = withDefaults(
  defineProps<{
    src?: string | null
    alt?: string
    /** Width and height in px (or any CSS length). Height defaults to the width. */
    width?: number | string
    height?: number | string
    /** Forces a size class: `l` (an 18 px cut), `s` / `xs` (no cut). Picked from `width` otherwise. */
    size?: 'l' | 's' | 'xs' | 'm'
    /** `object-position` of the picture, e.g. `50% 20%` to keep a face in a short frame. */
    position?: string
    stage?: boolean
    visor?: boolean
    /** Above the fold: load at once instead of lazily. */
    eager?: boolean
  }>(),
  { src: null, alt: '', width: undefined, height: undefined, size: undefined, position: undefined }
)

const px = (v: number | string | undefined) => (typeof v === 'number' ? `${v}px` : v)
const cls = computed(() => {
  if (props.size) return props.size === 'm' ? '' : props.size
  const w = typeof props.width === 'number' ? props.width : null
  if (w === null) return ''
  return w < 40 ? 'xs' : w < 96 ? 's' : w >= 240 ? 'l' : ''
})
const style = computed(() => ({
  width: px(props.width),
  height: px(props.height ?? props.width),
}))
</script>

<template>
  <span class="fr" :class="[cls, { stage, visor }]" :style="style">
    <img
      v-if="src"
      :src="src"
      :alt="alt"
      :loading="eager ? undefined : 'lazy'"
      decoding="async"
      :style="position ? { objectPosition: position } : undefined"
    />
    <slot />
  </span>
</template>
