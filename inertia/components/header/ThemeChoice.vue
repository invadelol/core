<script setup lang="ts">
import { computed } from 'vue'
import Icon from '../ui/Icon.vue'
import { useTheme, type ThemeChoice } from '../../lib/theme.js'

/**
 * The theme as one icon button that turns Dark → Light → Auto (the device's) → Dark, its icon the
 * theme in use (the account menu, the phone's menu, the footer). Its words live in its label and
 * its tooltip, never on it.
 */
const { choice, setTheme } = useTheme()

const ORDER: { id: ThemeChoice; label: string; icon: 'moon' | 'sun' | 'monitor' }[] = [
  { id: 'dark', label: 'Dark', icon: 'moon' },
  { id: 'light', label: 'Light', icon: 'sun' },
  { id: 'system', label: 'Auto', icon: 'monitor' },
]

const at = computed(() => Math.max(0, ORDER.findIndex((o) => o.id === choice.value)))
const now = computed(() => ORDER[at.value])
const next = computed(() => ORDER[(at.value + 1) % ORDER.length])
const tip = computed(
  () =>
    `Theme: ${now.value.label}${now.value.id === 'system' ? ' (follows your device)' : ''}`
)
</script>

<template>
  <button
    type="button"
    class="theme-btn"
    :data-tip="tip"
    :aria-label="`${tip}. Switch to ${next.label}`"
    @click="setTheme(next.id)"
  >
    <Icon :name="now.icon" :size="17" />
  </button>
</template>
