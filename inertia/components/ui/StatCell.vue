<script setup lang="ts">
import Meter from './Meter.vue'

withDefaults(
  defineProps<{
    label: string
    value: string | number
    /** Small qualifier printed next to the value, e.g. "/min". */
    unit?: string
    /** Secondary line under the label, e.g. a comparison. */
    hint?: string
    /** 0–100; renders a meter that gives the number a scale to sit against. */
    meter?: number
    tone?: 'ink' | 'win' | 'loss' | 'pos' | 'neg' | 'gold' | 'muted'
  }>(),
  { tone: 'ink' }
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
  <div class="min-w-0">
    <div class="label">{{ label }}</div>
    <div class="mt-1 flex items-baseline gap-1">
      <span class="num text-[1.375rem] leading-none font-semibold" :class="toneClass[tone]">
        {{ value }}
      </span>
      <span v-if="unit" class="text-[0.6875rem] text-ink-3">{{ unit }}</span>
    </div>
    <Meter v-if="meter !== undefined" class="mt-2" :value="meter" :tone="tone" />
    <div v-if="hint" class="mt-1.5 text-[0.6875rem] text-ink-3 truncate">{{ hint }}</div>
  </div>
</template>
