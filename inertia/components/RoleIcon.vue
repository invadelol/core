<script setup lang="ts">
import { computed } from 'vue'

/**
 * Riot's own position glyphs, inlined.
 *
 * They ship as two-tone SVGs on Community Dragon: a muted outline of the map
 * quadrant plus a bright shape for the lane itself. Inlining them rather than
 * proxying the files keeps the two tones bound to `currentColor`, so one icon
 * works on a light row, a dark row, a filter chip and an active state.
 */
const props = withDefaults(
  defineProps<{
    /** Riot's `teamPosition`: TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY. */
    role: string
    size?: number
  }>(),
  { size: 14 }
)

type Glyph = { outline?: string; shape: string; polygon?: boolean }

const GLYPHS: Record<string, Glyph> = {
  TOP: {
    outline: 'M21,14H14v7h7V14Zm5-3V26L11.014,26l-4,4H30V7.016Z',
    shape: 'M4 4 L4.003 28.045 L9 23 L9 9 L23 9 L28.045 4.003 Z',
  },
  JUNGLE: {
    shape:
      'M25,3c-2.128,3.3-5.147,6.851-6.966,11.469A42.373,42.373,0,0,1,20,20a27.7,27.7,0,0,1,1-3C21,12.023,22.856,8.277,25,3ZM13,20c-1.488-4.487-4.76-6.966-9-9,3.868,3.136,4.422,7.52,5,12l3.743,3.312C14.215,27.917,16.527,30.451,17,31c4.555-9.445-3.366-20.8-8-28C11.67,9.573,13.717,13.342,13,20Zm8,5a15.271,15.271,0,0,1,0,2l4-4c0.578-4.48,1.132-8.864,5-12C24.712,13.537,22.134,18.854,21,25Z',
  },
  MIDDLE: {
    outline: 'M30,12.968l-4.008,4L26,26H17l-4,4H30ZM16.979,8L21,4H4V20.977L8,17,8,8h8.981Z',
    shape: 'M25 4 L4 25 L4 30 L9 30 L30 9 L30 4 Z',
  },
  BOTTOM: {
    outline: 'M13,20h7V13H13v7ZM4,4V26.984l3.955-4L8,8,22.986,8l4-4H4Z',
    shape: 'M29.997 5.955 L25 11 L25 25 L11 25 L5.955 29.997 L30 30 Z',
  },
  UTILITY: {
    shape:
      'M26,13c3.535,0,8-4,8-4H23l-3,3,2,7,5-2-3-4h2ZM22,5L20.827,3H13.062L12,5l5,6Zm-5,9-1-1L13,28l4,3,4-3L18,13ZM11,9H0s4.465,4,8,4h2L7,17l5,2,2-7Z',
  },
}

const glyph = computed(() => GLYPHS[props.role?.toUpperCase()] ?? null)
</script>

<template>
  <svg
    v-if="glyph"
    :width="size"
    :height="size"
    viewBox="0 0 34 34"
    fill="currentColor"
    aria-hidden="true"
    class="shrink-0"
  >
    <path v-if="glyph.outline" :d="glyph.outline" fill-rule="evenodd" opacity="0.4" />
    <path :d="glyph.shape" fill-rule="evenodd" />
  </svg>
  <span v-else :style="{ width: `${size}px`, height: `${size}px` }" class="inline-block shrink-0" />
</template>
