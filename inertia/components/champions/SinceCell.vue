<script setup lang="ts">
import Icon from '../ui/Icon.vue'
import { sgn } from '../../lib/tier_lists.js'

/**
 * The change since the patch before (`.tx-plc`): violet up, grey down, "Same" when it did not
 * move, a dash without the patch before. `text` replaces the figure ("4 places").
 */
const props = withDefaults(
  defineProps<{ d: number | null; digits?: number; text?: string | null; eps?: number }>(),
  { digits: 1, text: null, eps: 0.05 }
)
const kind = () =>
  props.d === null ? 'none' : Math.abs(props.d) < props.eps ? 'eq' : props.d > 0 ? 'up' : 'dn'
</script>

<template>
  <span v-if="kind() === 'none'" class="tx-plc eq">&#8211;</span>
  <span v-else-if="kind() === 'eq'" class="tx-plc eq"><Icon name="arrow" :size="14" />Same</span>
  <span v-else class="tx-plc" :class="kind()"
    ><Icon name="arrow" :size="14" />{{ text ?? sgn(d!, digits) }}</span
  >
</template>
