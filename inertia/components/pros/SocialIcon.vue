<script setup lang="ts">
/**
 * A social network's mark, one colour (`currentColor`) like the site's line icons: Twitch's and X's
 * glyphs, Instagram's camera drawn in the icons' stroke.
 */
withDefaults(defineProps<{ name: 'twitch' | 'x' | 'instagram'; size?: number }>(), { size: 16 })
</script>

<template>
  <svg
    v-if="name === 'twitch'"
    class="i"
    :width="size"
    :height="size"
    viewBox="0 1 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      fill-rule="evenodd"
      d="M6.93 2 3 5.93v14.14h4.71V24l3.93-3.93h3.14L21.86 13V2H6.93Zm13.36 10.21-3.15 3.15H14l-2.75 2.75v-2.75H7.71V3.57h12.58v8.64Z"
    />
    <path d="M17.93 6.32h-1.57v4.72h1.57V6.32ZM13.61 6.32h-1.57v4.72h1.57V6.32Z" />
  </svg>
  <svg
    v-else-if="name === 'x'"
    class="i"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      d="M18.5 2h3.39l-7.45 8.49L23.15 22h-6.84l-5.35-7-6.12 7H1.44l7.9-9.08L1 2h7l4.84 6.39L18.5 2Zm-1.19 18h1.88L7.01 3.92H4.99L17.31 20Z"
    />
  </svg>
  <svg
    v-else
    class="i"
    :width="size"
    :height="size"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    aria-hidden="true"
  >
    <rect x="2.8" y="2.8" width="14.4" height="14.4" rx="4.2" />
    <circle cx="10" cy="10" r="3.4" />
    <circle cx="14.4" cy="5.6" r=".5" fill="currentColor" stroke="none" />
  </svg>
</template>
