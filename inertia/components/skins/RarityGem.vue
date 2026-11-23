<script setup lang="ts">
import { computed } from 'vue'
import { RARITY_NAMES, gemUrl } from '../../lib/skins.js'
import type { SkinRarity } from '../../lib/skin_types.js'

/** Riot's rarity gem (the client's own art), and its name unless `bare`. */
const props = withDefaults(defineProps<{ rarity: SkinRarity; size?: number; bare?: boolean }>(), {
  size: 14,
  bare: false,
})
const src = computed(() => gemUrl(props.rarity))
</script>

<template>
  <span v-if="src || !bare" class="skn-gem">
    <img
      v-if="src"
      :src="src"
      :width="size"
      :height="size"
      :alt="bare ? RARITY_NAMES[rarity] : ''"
      loading="lazy"
      decoding="async"
    /><span v-if="!bare">{{ RARITY_NAMES[rarity] }}</span>
  </span>
</template>
