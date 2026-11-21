<script setup lang="ts">
import Icon from './Icon.vue'
import MoreLink from './MoreLink.vue'
import type { IconName } from '../../lib/icons.js'

/**
 * A card's head (`.card-h`, inside a `.card`): an 18 px icon in its meaning colour (gold, red, else
 * violet), the title (16 px), a grey note and a "more" link or the card's own controls (default
 * slot) at the far end.
 */
withDefaults(
  defineProps<{
    title: string
    icon?: IconName
    meta?: string | null
    more?: { label: string; href: string } | null
    id?: string
    as?: 'h2' | 'h3' | 'span'
  }>(),
  { icon: undefined, meta: null, more: null, id: undefined, as: 'h2' }
)
</script>

<template>
  <div class="card-h">
    <Icon v-if="icon" :name="icon" :size="18" tone="auto" />
    <component :is="as" :id="id" class="h3">{{ title }}</component>
    <span v-if="meta" class="meta">{{ meta }}</span>
    <span v-if="$slots.default" class="card-h-end"><slot /></span>
    <MoreLink v-else-if="more" :href="more.href" :label="more.label" />
  </div>
</template>
