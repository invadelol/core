<script setup lang="ts">
import { computed } from 'vue'
import Stars from './Stars.vue'
import type { RatingSummary } from '../../lib/skin_types.js'

/**
 * Ratings as ten bars, half a star to five stars, the visitor's own in violet, with the average
 * beside them. One violet family, no colour for good or bad.
 */
const props = withDefaults(
  defineProps<{
    summary: RatingSummary
    mine?: number | null
    height?: number
    /** Under the average: "average", or the count ("86 ratings") where nothing else says it. */
    caption?: 'average' | 'count'
  }>(),
  { mine: null, height: 52, caption: 'count' }
)
const max = computed(() => Math.max(1, ...props.summary.histogram))
const words = computed(() =>
  props.summary.histogram
    .map((n, i) => `${(i + 1) / 2} ${i === 1 ? 'star' : 'stars'}: ${n}`)
    .join(', ')
)
</script>

<template>
  <div class="skn-rates">
    <div class="skn-hist" role="img" :aria-label="`Ratings by stars. ${words}`">
      <div class="skn-hb" :style="{ height: `${height}px` }">
        <i
          v-for="(n, i) in summary.histogram"
          :key="i"
          :class="{ me: mine === i + 1 }"
          :style="{ height: `${Math.max(4, (n / max) * 100)}%` }"
        />
      </div>
      <div class="skn-ha" aria-hidden="true">
        <Stars :value="1" :size="9" />
        <Stars :value="10" :size="9" />
      </div>
    </div>
    <div class="skn-avg">
      <template v-if="summary.average !== null">
        <b class="num">{{ summary.average.toFixed(1) }}</b>
        <span v-if="caption === 'average'">average</span>
        <span v-else class="num"
          >{{ summary.count.toLocaleString('en-US') }}
          {{ summary.count === 1 ? 'rating' : 'ratings' }}</span
        >
      </template>
      <span v-else>No ratings yet</span>
    </div>
  </div>
</template>
