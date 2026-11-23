<script setup lang="ts">
import { posterUrl } from '../../lib/skins.js'
import type { SkinCard } from '../../lib/skin_types.js'

/**
 * A skin's poster: its loading art, framed, the painted border cropped by scale. Decorative: the
 * name beside or under it says what it is.
 */
withDefaults(
  defineProps<{
    skin: Pick<SkinCard, 'championId' | 'num'>
    size?: 'big' | 'md' | 'xs' | 'xxs'
    eager?: boolean
  }>(),
  {
    size: 'md',
    eager: false,
  }
)
</script>

<template>
  <span class="skn-po" :class="size">
    <img
      :src="posterUrl(skin)"
      alt=""
      width="308"
      height="560"
      :loading="eager ? 'eager' : 'lazy'"
      decoding="async"
    />
  </span>
</template>
