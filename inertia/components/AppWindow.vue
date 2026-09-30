<script setup lang="ts">
/** A screenshot of the desktop app, framed with the glyph's cut corner. Files live in public/landing. */
defineProps<{ name: string; alt: string; eager?: boolean }>()
</script>

<template>
  <figure class="facet border border-line-2 bg-[#0a0a0f] [--facet:18px]">
    <img
      :src="`/landing/${name}.webp`"
      :alt="alt"
      width="2400"
      height="1500"
      :loading="eager ? 'eager' : 'lazy'"
      :fetchpriority="eager ? 'high' : 'auto'"
      decoding="async"
      class="block h-auto w-full"
    />
  </figure>
</template>
