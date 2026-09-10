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

const dimension = computed(() => ({ xs: 18, sm: 22, md: 28 })[props.size])

/** Always seven cells, so empty slots keep the row aligned. */
const slots = computed(() => Array.from({ length: 7 }, (_, i) => props.items?.[i] ?? 0))
</script>

<template>
  <div class="flex shrink-0 items-center gap-[2px]">
    <template v-for="(id, index) in slots" :key="index">
      <span v-if="index === 6" class="mx-[3px] h-3 w-px bg-line" />
      <img
        v-if="id > 0"
        :src="itemIcon(id)"
        :alt="itemName(id)"
        :title="itemName(id)"
        class="thumb rounded"
        :style="{ width: `${dimension}px`, height: `${dimension}px` }"
      />
      <span
        v-else
        class="rounded bg-[#f2f2f5]"
        :style="{ width: `${dimension}px`, height: `${dimension}px` }"
      />
    </template>
  </div>
</template>
