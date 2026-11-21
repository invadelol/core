<script setup lang="ts">
import Icon from './Icon.vue'
import MoreLink from './MoreLink.vue'
import type { IconName } from '../../lib/icons.js'

/**
 * A page section's head, outside the cards: a 20 px icon in its meaning colour (gold, red, else
 * violet), the title (h2, 20 px), a grey note (`meta`, or the `meta` slot for one with a rank
 * crest in it) and a "more" link at the far end. Controls go in the default slot, before the link.
 */
withDefaults(
  defineProps<{
    title: string
    icon?: IconName
    meta?: string | null
    more?: { label: string; href: string } | null
    /** The heading's id, for the section's `aria-labelledby`. */
    id?: string
    as?: 'h1' | 'h2' | 'h3'
  }>(),
  { icon: undefined, meta: null, more: null, id: undefined, as: 'h2' }
)
</script>

<template>
  <div class="sec-h">
    <Icon v-if="icon" :name="icon" :size="20" tone="auto" />
    <component :is="as" :id="id" class="h2">{{ title }}</component>
    <span v-if="meta || $slots.meta" class="meta"
      ><slot name="meta">{{ meta }}</slot></span
    >
    <slot />
    <MoreLink v-if="more" :href="more.href" :label="more.label" />
  </div>
</template>
