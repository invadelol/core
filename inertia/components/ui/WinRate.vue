<script setup lang="ts">
import { computed } from 'vue'

/**
 * A win rate, the site's one way to draw it: the rate, the record beside it ("83W 76L"), and a
 * thin violet line on a grey track with a tick at 50%, so above or below even reads at a glance.
 * One colour only: no blue for the wins, no pink for the losses.
 *
 * Give a record (`wins` with `games` or `losses`), or a bare `rate` (0 to 1) when there is no
 * record to show (a champion's win rate, a share of games).
 */
const props = withDefaults(
  defineProps<{
    wins?: number | null
    losses?: number | null
    games?: number | null
    /** 0 to 1, when there is no record. */
    rate?: number | null
    /** The track's width (px, or any CSS length); it fills its cell by default. */
    width?: number | string
    /** Shows "83W 76L" beside the rate (on by default when there is a record). */
    record?: boolean
    /** Decimals of the rate (0: "52%"). */
    digits?: number
    /** The smaller type, for dense lists. */
    small?: boolean
    /** Right-aligns the figures (a figure column). */
    end?: boolean
    /** Only the line, for a rate written elsewhere in the row. */
    bare?: boolean
  }>(),
  {
    wins: null,
    losses: null,
    games: null,
    rate: null,
    width: '100%',
    record: true,
    digits: 0,
    small: false,
    end: false,
    bare: false,
  }
)

const games = computed(() => {
  if (props.games !== null && props.games !== undefined) return props.games
  if (props.wins !== null && props.losses !== null) return props.wins + props.losses
  return null
})
const value = computed<number | null>(() => {
  if (props.rate !== null && props.rate !== undefined) return props.rate
  if (props.wins === null || !games.value) return null
  return props.wins / games.value
})
const shown = computed(() =>
  value.value === null ? '–' : (value.value * 100).toFixed(props.digits)
)
const fill = computed(() => `${Math.max(0, Math.min(1, value.value ?? 0)) * 100}%`)
const losses = computed(() =>
  props.wins !== null && games.value !== null ? games.value - props.wins : null
)
const hasRecord = computed(() => props.record && props.wins !== null && losses.value !== null)
const n = (x: number) => x.toLocaleString('en-US')
const label = computed(() =>
  value.value === null
    ? 'No games'
    : hasRecord.value
      ? `${shown.value}% win rate, ${props.wins} wins, ${losses.value} losses`
      : `${shown.value}%`
)
const trackWidth = computed(() =>
  typeof props.width === 'number' ? `${props.width}px` : props.width
)
</script>

<template>
  <span
    class="wrt"
    :class="{ sm: small, end, bare, fill: trackWidth === '100%' }"
    role="img"
    :aria-label="label"
  >
    <span v-if="!bare" class="wrt-t" aria-hidden="true">
      <b class="num">{{ shown }}<span v-if="value !== null" class="u">%</span></b
      ><span v-if="hasRecord" class="meta num">{{ n(wins!) }}W {{ n(losses!) }}L</span>
    </span>
    <span class="wrt-a" :style="{ width: trackWidth }" aria-hidden="true"
      ><i :style="{ width: fill }"
    /></span>
  </span>
</template>

<style>
/* The win rate (one violet line on a grey track, a tick at 50%): components/ui/WinRate.vue. */
.wrt {
  display: inline-flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
  max-width: 100%;
}
/* A track that fills its cell takes the cell's width. */
.wrt.fill {
  display: flex;
  width: 100%;
}
.wrt.end {
  align-items: flex-end;
}
.wrt-t {
  display: flex;
  align-items: baseline;
  gap: 8px;
  white-space: nowrap;
}
.wrt.end .wrt-t {
  justify-content: flex-end;
}
.wrt-t b {
  font-size: 15px;
  font-weight: 700;
  color: var(--t1);
}
.wrt-t .meta {
  font-size: 12.5px;
}
.wrt.sm {
  gap: 6px;
}
.wrt.sm .wrt-t b {
  font-size: 14px;
}
.wrt.sm .wrt-t .meta {
  font-size: 12px;
}
.wrt-a {
  position: relative;
  display: block;
  max-width: 100%;
  height: 4px;
  border-radius: 2px;
  background: var(--s3);
}
.wrt-a i {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  border-radius: 2px;
  background: var(--v400);
}
/* Even: the tick at 50%, over the line. */
.wrt-a::after {
  content: '';
  position: absolute;
  left: 50%;
  top: -3px;
  bottom: -3px;
  width: 1px;
  background: var(--t4);
}
.wrt.bare {
  justify-content: center;
}
</style>
