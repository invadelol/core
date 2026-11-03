<script setup lang="ts">
/**
 * A rank crest for lists with one per row: the crests of `RankCrest` from one cached stylesheet
 * (`crests.css`) instead of an image inlined in every row. The tier name is its label.
 */
const props = withDefaults(defineProps<{ tier?: string | null; size?: number }>(), {
  tier: null,
  size: 18,
})
const key = () => (props.tier ? props.tier.toLowerCase() : 'unranked')
</script>

<template>
  <span
    class="nb-crest"
    :class="key()"
    :style="{ width: `${size}px` }"
    role="img"
    :aria-label="tier ? `${tier.charAt(0)}${tier.slice(1).toLowerCase()}` : 'Unranked'"
  />
</template>
