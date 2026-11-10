<script setup lang="ts">
import { computed } from 'vue'

/**
 * A record read at a glance (Violet line): "61W 52L" with the win rate on the right,
 * over one split bar, blue for the wins and red for the losses.
 */
const props = defineProps<{ wins: number; losses: number }>()

const games = computed(() => props.wins + props.losses)
const rate = computed(() => (games.value ? Math.round((props.wins / games.value) * 100) : 0))
</script>

<template>
  <span class="rd-wl" :aria-label="`${wins} wins, ${losses} losses, ${rate}% win rate`">
    <span class="t" aria-hidden="true">
      <span
        ><b>{{ wins }}</b
        >W <b>{{ losses }}</b
        >L</span
      >
      <b>{{ rate }}%</b>
    </span>
    <span class="b" aria-hidden="true"><i :style="{ width: `${rate}%` }" /></span>
  </span>
</template>

<style>
.rd-wl {
  display: grid;
  gap: 5px;
  min-width: 0;
}
.rd-wl .t {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.rd-wl .t b {
  font-weight: 600;
  color: var(--text-1);
}
.rd-wl .b {
  display: block;
  height: 4px;
  border-radius: 9px;
  overflow: hidden;
  background: var(--rd-loss-track);
}
.rd-wl .b i {
  display: block;
  height: 100%;
  background: var(--win);
}
</style>
