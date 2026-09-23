<script setup lang="ts">
import { computed } from 'vue'
import { itemIcon, itemName } from '../lib/assets.js'

const props = withDefaults(
  defineProps<{
    /** Riot returns seven slots; the last one is the trinket. */
    items: number[]
    size?: 'xs' | 'sm' | 'md'
  }>(),
  { size: 'sm' }
)

const dimension = computed(() => ({ xs: 19, sm: 23, md: 28 })[props.size])
/* The same steps as every other tile: portraits, spells, runes. */
const radius = computed(
  () => ({ xs: 'var(--radius-xs)', sm: 'var(--radius-sm)', md: 'var(--radius-md)' })[props.size]
)

/** Always seven cells, so empty slots keep the row aligned. */
const slots = computed(() => Array.from({ length: 7 }, (_, i) => props.items?.[i] ?? 0))
</script>

<template>
  <div class="flex shrink-0 items-center gap-[2px]">
    <template v-for="(id, index) in slots" :key="index">
      <span v-if="index === 6" class="mx-[3px] h-3.5 w-px rounded-full bg-line-2" />
      <img
        v-if="id > 0"
        :src="itemIcon(id)"
        :alt="itemName(id)"
        :title="itemName(id)"
        loading="lazy"
        decoding="async"
        class="thumb"
        :style="{
          width: `${dimension}px`,
          height: `${dimension}px`,
          borderRadius: radius,
        }"
      />
      <span
        v-else
        class="bg-sunken"
        :style="{
          width: `${dimension}px`,
          height: `${dimension}px`,
          borderRadius: radius,
        }"
      />
    </template>
  </div>
</template>
