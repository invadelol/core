<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Icon from '../ui/Icon.vue'
import ThemeChoice from './ThemeChoice.vue'
import { DISCORD_URL } from '../../lib/links.js'

/**
 * The account corner's menu. invade.lol has no accounts (nothing to sign in to), so the corner
 * holds what is the visitor's own here: the theme, and where to go for more (the desktop app,
 * which keeps your games, favourites and linked accounts; the Discord; contact).
 */
defineEmits<{ close: [] }>()
</script>

<template>
  <div class="hx-menu hx-acc panel">
    <div class="acc-theme">
      <span class="lab">Theme</span>
      <ThemeChoice />
    </div>
    <div class="acc-l">
      <Link href="/app" prefetch data-track="account_app" @click="$emit('close')"
        ><Icon name="download" :size="17" />Desktop app<span class="n"
          >Games, favourites</span
        ></Link
      >
      <a :href="DISCORD_URL" target="_blank" rel="noreferrer" data-track="account_discord"
        ><Icon name="discord" :size="17" />Discord<span class="n">Join</span></a
      >
      <Link href="/contact" prefetch @click="$emit('close')"
        ><Icon name="news" :size="17" />Contact</Link
      >
    </div>
  </div>
</template>
