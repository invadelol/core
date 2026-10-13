<script setup lang="ts">
import { computed, useId } from 'vue'
import { monotone } from './tone.js'

/**
 * Two lines over the first minutes of a game: the player's in violet over a soft fade, the lane
 * opponent's as a faint dashed reference. A marker at `at` names the gap there. The player's
 * line draws in when it first shows.
 */
const props = withDefaults(
  defineProps<{
    you: number[]
    opponent: number[]
    /** The minute the gap is read at. */
    at: number
    /** How a value reads: "CS", "gold". */
    unit: string
    height?: number
  }>(),
  { height: 180 }
)

const gradient = `lv-race-${useId()}`
const W = 100
const TOP = 26
const BOTTOM = 18

const geometry = computed(() => {
  const n = Math.min(props.you.length, props.opponent.length)
  if (n < 2) return null
  const max = Math.max(...props.you.slice(0, n), ...props.opponent.slice(0, n), 1) * 1.04
  const h = props.height
  const x = (i: number) => (i / (n - 1)) * W
  const y = (v: number) => TOP + (1 - v / max) * (h - TOP - BOTTOM)
  const you = props.you.slice(0, n).map((v, i) => [x(i), y(v)] as [number, number])
  const them = props.opponent.slice(0, n).map((v, i) => [x(i), y(v)] as [number, number])
  const line = monotone(you)
  const at = Math.min(props.at, n - 1)
  const gap = props.you[at] - props.opponent[at]
  return {
    line,
    area: `${line}L${W} ${h - BOTTOM}L0 ${h - BOTTOM}Z`,
    them: monotone(them),
    base: h - BOTTOM,
    at: { x: x(at), you: y(props.you[at]), them: y(props.opponent[at]), minute: at, gap },
    end: apart(you[n - 1][1], them[n - 1][1]),
    ticks: [0, 5, 10, 15].filter((m) => m < n).map((m) => ({ m, x: x(m) })),
    last: { you: props.you[n - 1], them: props.opponent[n - 1], minute: n - 1 },
  }
})

/** End labels at their lines' heights, pushed apart when the lines finish close together. */
function apart(you: number, them: number) {
  const room = 16
  if (Math.abs(you - them) >= room) return { you, them }
  const mid = (you + them) / 2
  return you <= them
    ? { you: mid - room / 2, them: mid + room / 2 }
    : { you: mid + room / 2, them: mid - room / 2 }
}

const signed = (v: number) =>
  `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v)).toLocaleString('en-US')}`
</script>

<template>
  <div v-if="geometry" class="lv-race" :style="{ height: `${height}px` }">
    <svg :viewBox="`0 0 ${W} ${height}`" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient :id="gradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="var(--brand)" stop-opacity="0.2" />
          <stop offset="1" stop-color="var(--brand)" stop-opacity="0" />
        </linearGradient>
      </defs>
      <line class="lv-race-base" x1="0" :x2="W" :y1="geometry.base" :y2="geometry.base" />
      <line
        class="lv-race-at"
        :x1="geometry.at.x"
        :x2="geometry.at.x"
        :y1="TOP - 6"
        :y2="geometry.base"
      />
      <path class="lv-race-area" :d="geometry.area" :fill="`url(#${gradient})`" />
      <path class="lv-race-them" :d="geometry.them" />
      <path class="lv-race-you" :d="geometry.line" />
    </svg>

    <i
      class="lv-race-dot you"
      :style="{ left: `${geometry.at.x}%`, top: `${geometry.at.you}px` }"
    />
    <i
      class="lv-race-dot them"
      :style="{ left: `${geometry.at.x}%`, top: `${geometry.at.them}px` }"
    />
    <span class="lv-race-gap num" :style="{ left: `${geometry.at.x}%` }">
      {{ signed(geometry.at.gap) }} {{ unit }} at {{ geometry.at.minute }}
    </span>

    <span class="lv-race-end you num" :style="{ top: `${geometry.end.you}px` }">
      You {{ Math.round(geometry.last.you).toLocaleString('en-US') }}
    </span>
    <span class="lv-race-end them num" :style="{ top: `${geometry.end.them}px` }">
      Opponent {{ Math.round(geometry.last.them).toLocaleString('en-US') }}
    </span>

    <span
      v-for="tick in geometry.ticks"
      :key="tick.m"
      class="lv-race-tick num"
      :style="{ left: `${tick.x}%` }"
      >{{ tick.m }}:00</span
    >
  </div>
</template>

<style scoped>
.lv-race {
  position: relative;
  margin-right: 92px;
}

.lv-race svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  animation: lv-reveal 1300ms 120ms var(--ease-glide) both;
}

/* The lines draw in from the first minute to the last; the marks follow. */
@keyframes lv-reveal {
  from {
    clip-path: inset(-10px 100% -10px 0);
  }
  to {
    clip-path: inset(-10px 0 -10px 0);
  }
}

.lv-race-dot,
.lv-race-gap,
.lv-race-end {
  animation: lv-fade 500ms 1100ms var(--ease-glide) both;
}

.lv-race-base {
  stroke: var(--line);
  vector-effect: non-scaling-stroke;
}

.lv-race-at {
  stroke: var(--line-2);
  stroke-dasharray: 2 3;
  vector-effect: non-scaling-stroke;
}

.lv-race-them {
  fill: none;
  stroke: var(--text-3);
  stroke-width: 1.25;
  stroke-dasharray: 4 4;
  vector-effect: non-scaling-stroke;
}

.lv-race-you {
  fill: none;
  stroke: var(--brand);
  stroke-width: 2;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

@keyframes lv-fade {
  from {
    opacity: 0;
  }
}

.lv-race-dot {
  position: absolute;
  width: 8px;
  height: 8px;
  margin: -4px 0 0 -4px;
  border-radius: 50%;
}

.lv-race-dot.you {
  background: var(--brand);
  box-shadow: 0 0 0 2px var(--solid-1);
}

.lv-race-dot.them {
  box-shadow: inset 0 0 0 1.5px var(--text-3);
  background: var(--solid-1);
}

.lv-race-gap {
  position: absolute;
  top: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-1);
  white-space: nowrap;
  transform: translateX(-50%);
}

.lv-race-end {
  position: absolute;
  left: calc(100% + 10px);
  font-size: 12px;
  line-height: 14px;
  white-space: nowrap;
  transform: translateY(-50%);
}

.lv-race-end.you {
  font-weight: 600;
  color: var(--text-1);
}

.lv-race-end.them {
  color: var(--text-3);
}

.lv-race-tick {
  position: absolute;
  bottom: 0;
  font-size: 11px;
  color: var(--text-4);
  transform: translateX(-50%);
}

@media (prefers-reduced-motion: reduce) {
  .lv-race svg,
  .lv-race-dot,
  .lv-race-gap,
  .lv-race-end {
    animation: none;
  }
}
</style>
