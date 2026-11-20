<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Logo from './Logo.vue'
import '../../css/pro_pics.css'

/**
 * A pro's picture, one rule everywhere: their photo; without one (or when it fails), their
 * current team's logo; without a team, a quiet bust in the site's faceted line. Never their
 * initials. It fills the box it is put in (a `.fr` frame, a round face, a row's square), which
 * keeps its own size, ground and corners.
 */
const props = withDefaults(
  defineProps<{
    slug?: string | null
    /** The photo's version from the page's props (`/cdn/pro/:slug?v=`); no photo without it. */
    photo?: string | null
    /** Their current team (its id draws the logo). */
    team?: { id: string } | null
    /** The box's size in CSS px: picks the served photo and logo sizes. */
    size?: number
    /** `object-position` of the photo (a face high in a short box). */
    position?: string
    /** Above the fold: the photo loads at once. */
    eager?: boolean
  }>(),
  { slug: null, photo: null, team: null, size: 40, position: undefined, eager: false }
)

/** Served photo sizes (`/cdn/pro/:slug?s=`), CSS px; the server draws them at twice the size. */
const SIZES = [24, 32, 40, 48, 64, 96, 144, 240]
const failed = ref(false)
const img = ref<HTMLImageElement | null>(null)
// A photo that failed before the page hydrated never fires the handler.
onMounted(() => {
  if (img.value?.complete && !img.value.naturalWidth) failed.value = true
})
const src = computed(() => {
  if (!props.slug || !props.photo) return null
  const size = SIZES.find((s) => s >= props.size) ?? SIZES[SIZES.length - 1]
  return `/cdn/pro/${encodeURIComponent(props.slug)}?s=${size}&v=${encodeURIComponent(props.photo)}`
})
const shows = computed(() =>
  src.value && !failed.value ? 'photo' : props.team?.id ? 'team' : 'none'
)
</script>

<template>
  <span class="pro-pic" :class="`is-${shows}`" aria-hidden="true">
    <img
      v-if="shows === 'photo'"
      ref="img"
      :loading="eager ? undefined : 'lazy'"
      :fetchpriority="eager ? 'high' : undefined"
      decoding="async"
      alt=""
      :width="size"
      :height="size"
      :src="src!"
      data-fallback="applied"
      :style="position ? { objectPosition: position } : undefined"
      @error="failed = true"
    />
    <Logo v-else-if="shows === 'team'" :team="team!.id" :size="Math.round(size * 0.56)" />
    <svg v-else viewBox="0 0 100 100" preserveAspectRatio="xMidYMax meet">
      <path d="M50 21 64 30v16l-14 9-14-9V30Z" />
      <path d="M15 100 27 69h46l12 31Z" />
    </svg>
  </span>
</template>
