<script setup lang="ts">
import { computed } from 'vue'
import Icon from '../ui/Icon.vue'
import { useTheme } from '../../lib/theme.js'

/**
 * The header's theme button: one click between dark and light, its icon the theme it switches to
 * (a sun on the dark page). Auto, which follows the device, stays in the footer's and the phone
 * menu's button.
 */
const { resolved, toggle } = useTheme()
const next = computed(() => (resolved.value === 'dark' ? 'light' : 'dark'))
const label = computed(() => (next.value === 'light' ? 'Light theme' : 'Dark theme'))
</script>

<template>
  <button
    type="button"
    class="btn sm ico hx-theme"
    :data-tip="label"
    :aria-label="`Switch to the ${next} theme`"
    data-track="header_theme"
    @click="toggle"
  >
    <Icon :name="next === 'light' ? 'sun' : 'moon'" :size="17" />
  </button>
</template>
