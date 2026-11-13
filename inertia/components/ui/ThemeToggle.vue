<script setup lang="ts">
import { computed } from 'vue'
import { Monitor, Moon, Sun } from 'lucide-vue-next'
import { useTheme, type ThemeChoice } from '../../lib/theme.js'

/**
 * The header's theme button: shows the current choice and steps Dark → Light → Auto (the
 * system's), the same three the footer offers.
 */
const { choice, setTheme } = useTheme()

const NEXT: Record<ThemeChoice, ThemeChoice> = { dark: 'light', light: 'system', system: 'dark' }
const NAME: Record<ThemeChoice, string> = { dark: 'Dark', light: 'Light', system: 'Auto' }

const label = computed(
  () =>
    `Theme: ${NAME[choice.value]}${choice.value === 'system' ? ' (follows your system)' : ''}. Switch to ${NAME[NEXT[choice.value]]}`
)
</script>

<template>
  <button
    type="button"
    class="iv-btn ghost icon-only"
    :title="label"
    :aria-label="label"
    @click="setTheme(NEXT[choice])"
  >
    <Moon v-if="choice === 'dark'" :size="16" />
    <Sun v-else-if="choice === 'light'" :size="16" />
    <Monitor v-else :size="16" />
  </button>
</template>
