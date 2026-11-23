<script setup lang="ts">
import { profileIcon } from '../../lib/assets.js'

/** A person's square picture; without one, League's default icon (never initials). */
withDefaults(defineProps<{ src: string | null; size?: number }>(), { size: 32 })
</script>

<template>
  <img
    class="skn-av"
    :src="src ?? profileIcon(null)"
    alt=""
    :width="size"
    :height="size"
    loading="lazy"
    decoding="async"
  />
</template>
