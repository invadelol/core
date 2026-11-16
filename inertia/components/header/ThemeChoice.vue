<script setup lang="ts">
import Icon from '../ui/Icon.vue'
import { useTheme, type ThemeChoice } from '../../lib/theme.js'

/** Dark, light or the device's: the theme as a choice of three (the account menu, the phone's menu, the footer). */
const { choice, setTheme } = useTheme()

const OPTIONS = [
  { id: 'dark', label: 'Dark', icon: 'moon' },
  { id: 'light', label: 'Light', icon: 'sun' },
  { id: 'system', label: 'Auto', icon: 'monitor' },
] as const satisfies readonly { id: ThemeChoice; label: string; icon: string }[]
</script>

<template>
  <span class="seg theme-seg" role="radiogroup" aria-label="Theme">
    <button
      v-for="o in OPTIONS"
      :key="o.id"
      type="button"
      role="radio"
      :class="{ on: choice === o.id }"
      :aria-checked="choice === o.id"
      :title="o.id === 'system' ? 'Follows your device' : undefined"
      @click="setTheme(o.id)"
    >
      <Icon :name="o.icon" :size="14" />{{ o.label }}
    </button>
  </span>
</template>
