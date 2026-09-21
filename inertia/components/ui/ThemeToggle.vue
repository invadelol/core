<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'
import { useTheme } from '../../lib/theme.js'

const { resolved, toggle } = useTheme()
</script>

<template>
  <button
    type="button"
    class="icon-btn"
    :title="resolved === 'dark' ? 'Switch to light' : 'Switch to dark'"
    :aria-label="resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
    @click="toggle"
  >
    <Sun v-if="resolved === 'dark'" :size="16" />
    <Moon v-else :size="16" />
  </button>
</template>
