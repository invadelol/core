<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 0–100. */
    value: number
    tone?: 'ink' | 'win' | 'loss' | 'pos' | 'neg' | 'gold' | 'muted'
  }>(),
  { tone: 'ink' }
)

const colors: Record<string, string> = {
  ink: 'var(--color-ink)',
  win: 'var(--color-win)',
  loss: 'var(--color-loss)',
  pos: 'var(--color-pos)',
  neg: 'var(--color-neg)',
  gold: 'var(--color-gold)',
  muted: 'var(--color-ink-4)',
}

const width = computed(() => `${Math.max(0, Math.min(100, props.value))}%`)
</script>

<template>
  <div class="meter">
    <span :style="{ width, background: colors[tone] }" />
  </div>
</template>
