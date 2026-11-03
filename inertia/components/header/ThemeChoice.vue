<script setup lang="ts">
import { Segmented } from '@invadelol/ui'
import { useTheme, type ThemeChoice } from '../../lib/theme.js'

/** Dark, light or the system's: the theme as a choice of three (the footer, the phone's menu). */
const { choice, setTheme } = useTheme()

const OPTIONS: { id: ThemeChoice; label: string }[] = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'system', label: 'Auto' },
]
</script>

<template>
  <Segmented
    :options="OPTIONS"
    :model-value="choice"
    size="sm"
    aria-label="Theme"
    @update:model-value="setTheme"
  />
</template>
