<script setup lang="ts">
import ProPic from '../pros/ProPic.vue'
import '../../css/pro_media.css'

/**
 * A pro's photo in its box (`.nb-photo`), sized before the image arrives so nothing moves. The
 * picture follows the site's one rule (`pros/ProPic.vue`): the photo, else their team's logo,
 * else a quiet bust.
 */
withDefaults(
  defineProps<{
    slug?: string | null
    /** The photo's version from the page's props; no photo without it. */
    photo?: string | null
    /** Their current team: its logo stands in for a missing photo. */
    team?: { id: string } | null
    width?: number
    height?: number
    /** Lazy unless it is part of the first screen. */
    eager?: boolean
    /** Sized by its CSS (width and height then only pick the image's size). */
    fluid?: boolean
  }>(),
  { slug: null, photo: null, team: null, width: 36, height: 36, eager: false, fluid: false }
)
</script>

<template>
  <span
    class="nb-photo has"
    :style="fluid ? undefined : { width: `${width}px`, height: `${height}px` }"
    aria-hidden="true"
  >
    <ProPic
      :slug="slug"
      :photo="photo"
      :team="team"
      :size="Math.max(width, height)"
      :eager="eager"
    />
    <slot />
  </span>
</template>
