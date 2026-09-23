<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { runeIcon, runeStyleIcon, runeName, loadRunes } from '../lib/assets.js'
import type { RuneSet } from '../lib/types.js'

const props = withDefaults(
  defineProps<{
    runes: RuneSet
    /** Tighter glyphs, for the detail row inside a scoreboard. */
    compact?: boolean
  }>(),
  { compact: false }
)

onMounted(loadRunes)

const primary = computed(() => ({
  style: props.runes.primaryStyle,
  keystone: props.runes.keystone,
  minor: props.runes.runes.slice(1, 4).filter(Boolean),
}))

const secondary = computed(() => ({
  style: props.runes.secondaryStyle,
  picks: props.runes.runes.slice(4).filter(Boolean),
}))

const shards = computed(() =>
  [
    { key: 'Offense', id: props.runes.statPerks?.offense ?? 0 },
    { key: 'Flex', id: props.runes.statPerks?.flex ?? 0 },
    { key: 'Defense', id: props.runes.statPerks?.defense ?? 0 },
  ].filter((shard) => shard.id)
)

const size = computed(() =>
  props.compact ? { key: 34, minor: 22, tree: 16 } : { key: 46, minor: 28, tree: 20 }
)
</script>

<template>
  <div class="grid gap-x-6 gap-y-4 sm:grid-cols-2">
    <div class="min-w-0">
      <div class="mb-2.5 flex items-center gap-1.5">
        <img
          v-if="primary.style"
          :src="runeStyleIcon(primary.style)"
          :alt="runeName(primary.style)"
          :style="{ width: `${size.tree}px`, height: `${size.tree}px` }"
        />
        <span class="label truncate !text-ink-2">
          {{ runeName(primary.style) || 'Primary' }}
        </span>
      </div>

      <div v-if="primary.keystone" class="flex items-center gap-2.5">
        <img
          :src="runeIcon(primary.keystone)"
          :alt="runeName(primary.keystone)"
          class="glyph p-[2px]"
          :style="{ width: `${size.key}px`, height: `${size.key}px` }"
        />
        <span
          class="display min-w-0 truncate text-ink"
          :class="compact ? 'text-[13px]' : 'text-[15px]'"
        >
          {{ runeName(primary.keystone) || 'Keystone' }}
        </span>
      </div>

      <ul v-if="primary.minor.length" class="mt-2.5 space-y-1.5">
        <li v-for="id in primary.minor" :key="id" class="flex items-center gap-2.5">
          <img
            :src="runeIcon(id)"
            :alt="runeName(id)"
            class="glyph p-[2px]"
            :style="{ width: `${size.minor}px`, height: `${size.minor}px` }"
          />
          <span class="min-w-0 truncate text-[12px] text-ink-2">{{ runeName(id) }}</span>
        </li>
      </ul>
    </div>

    <div class="min-w-0 sm:border-l sm:border-line sm:pl-6">
      <div class="mb-2.5 flex items-center gap-1.5">
        <img
          v-if="secondary.style"
          :src="runeStyleIcon(secondary.style)"
          :alt="runeName(secondary.style)"
          :style="{ width: `${size.tree}px`, height: `${size.tree}px` }"
        />
        <span class="label truncate !text-ink-2">
          {{ runeName(secondary.style) || 'Secondary' }}
        </span>
      </div>

      <ul v-if="secondary.picks.length" class="space-y-1.5">
        <li v-for="id in secondary.picks" :key="id" class="flex items-center gap-2.5">
          <img
            :src="runeIcon(id)"
            :alt="runeName(id)"
            class="glyph p-[2px]"
            :style="{ width: `${size.minor}px`, height: `${size.minor}px` }"
          />
          <span class="min-w-0 truncate text-[12px] text-ink-2">{{ runeName(id) }}</span>
        </li>
      </ul>

      <div
        v-if="shards.length"
        class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3"
      >
        <span
          v-for="shard in shards"
          :key="shard.key"
          class="flex items-center gap-1.5"
          :title="`${shard.key}: ${runeName(shard.id)}`"
        >
          <img
            :src="runeIcon(shard.id)"
            :alt="runeName(shard.id)"
            class="glyph p-[2px]"
            :style="{ width: `${size.tree + 4}px`, height: `${size.tree + 4}px` }"
          />
          <span class="text-[11px] text-ink-3">{{ runeName(shard.id) }}</span>
        </span>
      </div>
    </div>
  </div>
</template>
