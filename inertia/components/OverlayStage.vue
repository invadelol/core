<script setup lang="ts">
import Glyph from './ui/Glyph.vue'

/**
 * The overlay's widgets, as the desktop app draws them, laid out the way they sit over a game.
 * The middle is left empty on purpose: that is the game. The stage stays dark in both themes
 * because the widgets are made for a dark game.
 */
const widgets = {
  objectives: { w: 388, h: 74, alt: 'Objective timers for the next dragon, Baron and Herald' },
  gold: { w: 248, h: 171, alt: 'Win probability, team gold lead and enemy respawn timers' },
  stats: { w: 218, h: 226, alt: 'Your KDA, CS, gold and vision per minute' },
  tips: {
    w: 290,
    h: 112,
    alt: 'Tips that react to the game, such as an objective window or an item counter',
  },
  next: {
    w: 248,
    h: 118,
    alt: 'The next item of the recommended build and the gold it still needs',
  },
} as const
</script>

<template>
  <div
    class="facet relative overflow-hidden border border-line-2 bg-[#0b0c11] px-5 py-6 [--facet:18px] sm:px-10 sm:py-10"
  >
    <Glyph
      :size="420"
      class="pointer-events-none absolute -right-16 -bottom-24 !fill-white opacity-[0.035]"
    />
    <div class="relative flex flex-col gap-6">
      <img
        :src="`/landing/w-objectives.webp`"
        :alt="widgets.objectives.alt"
        :width="widgets.objectives.w"
        :height="widgets.objectives.h"
        loading="lazy"
        class="mx-auto h-auto max-w-full"
      />
      <div class="flex flex-col gap-6 sm:min-h-[320px] sm:flex-row sm:justify-between">
        <div class="flex flex-col gap-6">
          <img
            :src="`/landing/w-gold.webp`"
            :alt="widgets.gold.alt"
            :width="widgets.gold.w"
            :height="widgets.gold.h"
            loading="lazy"
            class="h-auto max-w-full"
          />
          <img
            :src="`/landing/w-stats.webp`"
            :alt="widgets.stats.alt"
            :width="widgets.stats.w"
            :height="widgets.stats.h"
            loading="lazy"
            class="h-auto max-w-full"
          />
        </div>
        <div class="flex flex-col gap-6 sm:items-end sm:justify-between">
          <img
            :src="`/landing/w-tips.webp`"
            :alt="widgets.tips.alt"
            :width="widgets.tips.w"
            :height="widgets.tips.h"
            loading="lazy"
            class="h-auto max-w-full"
          />
          <img
            :src="`/landing/w-next.webp`"
            :alt="widgets.next.alt"
            :width="widgets.next.w"
            :height="widgets.next.h"
            loading="lazy"
            class="h-auto max-w-full"
          />
        </div>
      </div>
    </div>
  </div>
</template>
