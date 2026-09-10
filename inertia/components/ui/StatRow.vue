<script setup lang="ts">
import Meter from './Meter.vue'

withDefaults(
  defineProps<{
    label: string
    value: string | number
    /** 0–100; a bar under the row showing the value's weight in its set. */
    meter?: number
    tone?: 'ink' | 'win' | 'loss' | 'pos' | 'neg' | 'gold' | 'muted'
    /** Draws a divider above the row to close off a group. */
    divide?: boolean
  }>(),
  { tone: 'ink', divide: false }
)

const toneClass: Record<string, string> = {
  ink: 'text-ink',
  win: 'text-win',
  loss: 'text-loss',
  pos: 'text-pos',
  neg: 'text-neg',
  gold: 'text-gold',
  muted: 'text-ink-3',
}
</script>

<template>
  <div :class="divide ? 'pt-2.5 mt-2.5 border-t border-line' : ''">
    <div class="flex items-baseline justify-between gap-3 text-[0.8125rem]">
      <span class="text-ink-2 truncate">{{ label }}</span>
      <span class="num font-medium tabular-nums" :class="toneClass[tone]">{{ value }}</span>
    </div>
    <Meter v-if="meter !== undefined" class="mt-1.5" :value="meter" :tone="tone" />
  </div>
</template>
