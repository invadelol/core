<script setup lang="ts">
import { computed } from 'vue'
import { itemIcon, itemName } from '../lib/assets.js'

const props = withDefaults(
  defineProps<{
    /** Riot returns seven slots; the last one is the trinket. */
    items: number[]
    /** xs 19 (dense tables), row 22 (inside a match row's well), sm 23, md 28. */
    size?: 'xs' | 'row' | 'sm' | 'md'
  }>(),
  { size: 'sm' }
)

const dimension = computed(() => ({ xs: 19, row: 22, sm: 23, md: 28 })[props.size])

/** Always seven cells, so empty slots keep the row aligned. */
const slots = computed(() => Array.from({ length: 7 }, (_, i) => props.items?.[i] ?? 0))
</script>

<template>
  <div class="flex shrink-0 items-center gap-[2px]">
    <template v-for="(id, index) in slots" :key="index">
      <img
        v-if="id > 0"
        :src="itemIcon(id)"
        :alt="itemName(id)"
        :title="itemName(id)"
        loading="lazy"
        decoding="async"
        class="thumb rounded-[3px]"
        :class="index === 6 ? 'ml-1' : ''"
        :style="{ width: `${dimension}px`, height: `${dimension}px` }"
      />
      <span
        v-else
        class="empty rounded-[3px]"
        :class="index === 6 ? 'ml-1' : ''"
        :style="{ width: `${dimension}px`, height: `${dimension}px` }"
      />
    </template>
  </div>
</template>

<style scoped>
/* An empty slot is a well; inside a well it is a slightly lighter inset. */
.empty {
  flex-shrink: 0;
  background: var(--color-well);
}

:global(.mrow-well) .empty {
  background: rgb(140 140 170 / 0.09);
}
</style>
