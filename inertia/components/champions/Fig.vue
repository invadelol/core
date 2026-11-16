<script setup lang="ts">
/**
 * A figure over a thin bar (`.tx-fig`): the board's win, pick and ban rate cells. `width` is the
 * bar's fill in percent; `mid` draws the tick of 50 % (when the bar's middle is 50 % win rate).
 */
withDefaults(
  defineProps<{
    value: string
    width: number
    big?: boolean
    unit?: string
    mid?: boolean
  }>(),
  { big: false, unit: '%', mid: false }
)
</script>

<template>
  <div class="tx-fig">
    <span :class="big ? 'fg-s' : 'fg-xs'"
      >{{ value }}<span v-if="unit" class="u">{{ unit }}</span></span
    >
    <div class="bar" :class="{ mid }"><i :style="{ width: `${Math.round(width)}%` }" /></div>
  </div>
</template>
