<script setup lang="ts">
import { computed } from 'vue'
import { dialColor } from '../../lib/facet.js'

/**
 * The Invade score (0–100) as a dial: a 260° arc with butt caps, its colour running from pink
 * (25 and under) through grey to blue at 75, gold from 80. `place` is the small word under the
 * figure (a rank in the lobby, "MVP"). No score (an AFK player) draws an empty track and a dash.
 */
const props = withDefaults(
  defineProps<{
    value: number | null | undefined
    size?: 'sm' | 'md' | 'lg' | 'xl'
    place?: string
  }>(),
  { size: 'md', place: '' }
)

const ARC = 'M7.74 30.28A16 16 0 1 1 32.26 30.28'
const v = computed(() =>
  props.value === null || props.value === undefined
    ? null
    : Math.max(0, Math.min(100, Math.round(props.value)))
)
const gold = computed(() => v.value !== null && v.value >= 80)
</script>

<template>
  <span
    class="dial"
    :class="[size === 'md' ? '' : size, { gold }]"
    :style="v !== null ? { '--dc': dialColor(v) } : undefined"
    :aria-label="v !== null ? `Score ${v}${place ? `, ${place}` : ''}` : 'No score'"
    role="img"
  >
    <svg width="44" height="44" viewBox="0 0 40 40" aria-hidden="true">
      <path class="tr" :d="ARC" pathLength="100" />
      <path v-if="v !== null" class="vl" :d="ARC" pathLength="100" :stroke-dasharray="`${v} 100`" />
    </svg>
    <b aria-hidden="true">{{ v ?? '–' }}</b
    ><i aria-hidden="true">{{ place }}</i>
  </span>
</template>
