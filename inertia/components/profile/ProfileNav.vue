<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import Icon from '../ui/Icon.vue'
import type { IconName } from '../../lib/icons.js'

/**
 * The profile's sections as a side list (`.pl-nav`): icon, name, a count when it says something.
 * Each is a real address. On a phone the list becomes a row that scrolls sideways.
 */
defineProps<{
  items: ReadonlyArray<{ key: string; label: string; href: string; icon: IconName; count?: number }>
  active: string
}>()
</script>

<template>
  <nav class="pl-nav" aria-label="Profile">
    <Link
      v-for="item in items"
      :key="item.key"
      :href="item.href"
      :class="{ on: item.key === active }"
      :aria-current="item.key === active ? 'page' : undefined"
      preserve-scroll
      prefetch
    >
      <Icon :name="item.icon" :size="17" />{{ item.label
      }}<span v-if="item.count" class="n">{{ item.count }}</span>
    </Link>
  </nav>
</template>
