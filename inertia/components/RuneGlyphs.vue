<script setup lang="ts">
import { onMounted } from 'vue'
import { runeIcon, runeStyleIcon, runeName, loadRunes } from '../lib/assets.js'
import type { RuneSet } from '../lib/types.js'

onMounted(loadRunes)

withDefaults(
  defineProps<{
    runes: RuneSet
    /** Show the four secondary picks alongside the keystone. */
    full?: boolean
  }>(),
  { full: false }
)
</script>

<template>
  <div class="flex shrink-0 items-center gap-1.5">
    <img
      v-if="runes.keystone"
      :src="runeIcon(runes.keystone)"
      :alt="runeName(runes.keystone)"
      :title="runeName(runes.keystone)"
      class="h-7 w-7 shrink-0"
    />
    <span
      v-else-if="!runes.primaryStyle"
      class="h-7 w-7 shrink-0 rounded-full border border-dashed border-line-strong"
      title="Rune data unavailable"
    />

    <span class="flex flex-col gap-[2px]">
      <img
        v-if="runes.primaryStyle"
        :src="runeStyleIcon(runes.primaryStyle)"
        :alt="runeName(runes.primaryStyle)"
        :title="runeName(runes.primaryStyle)"
        class="h-3.5 w-3.5"
      />
      <img
        v-if="runes.secondaryStyle"
        :src="runeStyleIcon(runes.secondaryStyle)"
        :alt="runeName(runes.secondaryStyle)"
        :title="runeName(runes.secondaryStyle)"
        class="h-3.5 w-3.5"
      />
    </span>

    <span v-if="full && runes.runes.length" class="ml-1 flex items-center gap-1">
      <img
        v-for="rune in runes.runes"
        :key="rune"
        :src="runeIcon(rune)"
        alt=""
        class="h-[18px] w-[18px] opacity-90"
      />
    </span>
  </div>
</template>
