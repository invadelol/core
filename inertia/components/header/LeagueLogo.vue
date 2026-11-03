<script setup lang="ts">
import { ref } from 'vue'

/** A league's logo from our own /cdn, or its short name in the same slot when there is none. */
const props = withDefaults(
  defineProps<{ league: { slug: string; name: string; short: string }; size?: number }>(),
  { size: 20 }
)
const failed = ref(false)
</script>

<template>
  <span
    class="sh-lgo"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      fontSize: `${Math.max(7, Math.round(size / 3))}px`,
    }"
    :title="league.name"
  >
    <img
      v-if="!failed"
      :src="`/cdn/league/${props.league.slug}`"
      :alt="league.short"
      :width="size"
      :height="size"
      loading="lazy"
      decoding="async"
      data-fallback="applied"
      @error="failed = true"
    />
    <template v-else>{{ league.short }}</template>
  </span>
</template>
