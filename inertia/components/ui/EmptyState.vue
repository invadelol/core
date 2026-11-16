<script setup lang="ts">
import Icon from './Icon.vue'
import type { IconName } from '../../lib/icons.js'

/**
 * What a block shows when it has nothing to show: a quiet icon, one plain sentence saying what is
 * missing and why (no apology, no filler), and an action when there is one (default slot).
 * `compact` fits it inside a card row instead of a whole card.
 */
withDefaults(
  defineProps<{ title: string; line?: string | null; icon?: IconName; compact?: boolean }>(),
  { line: null, icon: 'minimap', compact: false }
)
</script>

<template>
  <div class="empty" :class="{ compact }" role="status">
    <Icon :name="icon" :size="compact ? 18 : 22" />
    <p class="h5">{{ title }}</p>
    <p v-if="line" class="meta">{{ line }}</p>
    <div v-if="$slots.default" class="empty-act"><slot /></div>
  </div>
</template>
