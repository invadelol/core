<script setup lang="ts">
/**
 * A screenshot of the desktop app (public/landing), framed with the glyph's cut corner. The
 * border follows the cut because the frame is drawn by the clipped wrapper, not by `border`.
 */
withDefaults(
  defineProps<{
    src: string
    alt: string
    width: number
    height: number
    eager?: boolean
    cut?: number
  }>(),
  { cut: 18 }
)
</script>

<template>
  <figure class="shot" :style="{ '--cut': `${cut}px` }">
    <img
      :src="`/landing/${src}.webp`"
      :alt="alt"
      :width="width"
      :height="height"
      :loading="eager ? 'eager' : 'lazy'"
      :fetchpriority="eager ? 'high' : 'auto'"
      decoding="async"
    />
  </figure>
</template>

<style scoped>
.shot {
  margin: 0;
  padding: 1px;
  background: var(--color-line-2);
  clip-path: polygon(0 0, calc(100% - var(--cut)) 0, 100% var(--cut), 100% 100%, 0 100%);
}
.shot img {
  display: block;
  width: 100%;
  height: auto;
  background: #0a0a0f;
  clip-path: polygon(
    0 0,
    calc(100% - var(--cut) + 0.4px) 0,
    100% calc(var(--cut) - 0.4px),
    100% 100%,
    0 100%
  );
}
</style>
