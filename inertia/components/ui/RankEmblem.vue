<script setup lang="ts">
import { computed } from 'vue'
import { emblemBackground } from '../../lib/facet.js'
import { tierName } from '../../lib/board.js'

/**
 * A rank's emblem (Riot's crest art, from /cdn/emblem) in a `size` px square. Unranked, or a
 * tier the art does not know, shows the small unranked crest instead.
 */
const props = withDefaults(
  defineProps<{ tier: string | null | undefined; size?: number; title?: string }>(),
  {
    size: 24,
    title: undefined,
  }
)
const background = computed(() => (props.tier ? emblemBackground(props.tier, props.size) : null))
const label = computed(
  () => props.title ?? (props.tier ? tierName(props.tier.toUpperCase()) : 'Unranked')
)
</script>

<template>
  <span
    v-if="background"
    class="rk-emb"
    role="img"
    :aria-label="label"
    :title="title"
    :style="{ width: `${size}px`, height: `${size}px`, background }"
  />
  <img
    v-else
    class="rk-emb"
    :src="'/cdn/rank/unranked.svg'"
    :alt="label"
    :width="size"
    :height="size"
  />
</template>
