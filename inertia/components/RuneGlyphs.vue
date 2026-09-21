<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { runeIcon, runeStyleIcon, runeName, loadRunes } from '../lib/assets.js'
import type { RuneSet } from '../lib/types.js'

onMounted(loadRunes)

const props = withDefaults(
  defineProps<{
    runes: RuneSet
    size?: 'xs' | 'sm' | 'md'
  }>(),
  { size: 'sm' }
)

const dimension = computed(() => ({ xs: 18, sm: 22, md: 28 })[props.size])
</script>

<template>
  <div class="flex shrink-0 items-center gap-1">
    <img
      v-if="runes.keystone"
      :src="runeIcon(runes.keystone)"
      :alt="runeName(runes.keystone)"
      :title="runeName(runes.keystone) || 'Keystone'"
      class="glyph"
      :style="{ width: `${dimension}px`, height: `${dimension}px` }"
      loading="lazy"
    />
    <span
      v-else-if="runes.primaryStyle"
      class="glyph grid place-items-center"
      :style="{ width: `${dimension}px`, height: `${dimension}px` }"
    >
      <img
        :src="runeStyleIcon(runes.primaryStyle)"
        :alt="runeName(runes.primaryStyle)"
        class="h-[62%] w-[62%]"
      />
    </span>
    <span
      v-else
      class="rounded-full border border-dashed border-line-2"
      :style="{ width: `${dimension}px`, height: `${dimension}px` }"
      title="No rune data for this match"
    />

    <img
      v-if="runes.secondaryStyle"
      :src="runeStyleIcon(runes.secondaryStyle)"
      :alt="runeName(runes.secondaryStyle)"
      :title="runeName(runes.secondaryStyle)"
      class="shrink-0 opacity-80"
      :style="{ width: `${dimension * 0.6}px`, height: `${dimension * 0.6}px` }"
      loading="lazy"
    />
  </div>
</template>
