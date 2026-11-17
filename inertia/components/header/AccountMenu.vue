<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Icon from '../ui/Icon.vue'
import Segmented from '../ui/Segmented.vue'
import { useTheme, type ThemeChoice } from '../../lib/theme.js'

/**
 * The settings corner's menu. invade.lol has no accounts, so it holds what is the visitor's own:
 * the theme, then the desktop app and contact.
 */
defineEmits<{ close: [] }>()

const { choice, setTheme } = useTheme()
const THEMES = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'Auto' },
] as const satisfies ReadonlyArray<{ value: ThemeChoice; label: string }>
</script>

<template>
  <div class="hx-menu hx-acc panel">
    <div class="acc-theme">
      <span class="lab">Theme</span>
      <Segmented
        :model-value="choice"
        :options="THEMES"
        label="Theme"
        @update:model-value="(v) => v && setTheme(v)"
      />
    </div>
    <div class="acc-l">
      <Link href="/app" prefetch data-track="account_app" @click="$emit('close')"
        ><Icon name="download" :size="17" />Desktop app<span class="n">Games, favourites</span></Link
      >
      <Link href="/contact" prefetch @click="$emit('close')"
        ><Icon name="news" :size="17" />Contact</Link
      >
    </div>
  </div>
</template>
