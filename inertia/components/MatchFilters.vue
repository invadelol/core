<script setup lang="ts">
import { SlidersHorizontal, RotateCcw } from 'lucide-vue-next'
import { championName } from '../lib/assets.js'
import type { ChampionStats } from '../lib/types.js'
export interface Filters {
  type: string
  champion: number
  role: string
}
const props = defineProps<{
  modelValue: Filters
  champions?: ChampionStats[]
  hideChampion?: boolean
  busy?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: Filters] }>()
function set(key: keyof Filters, value: string | number) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
const roles = [
  ['all', 'All roles'],
  ['TOP', 'Top'],
  ['JUNGLE', 'Jungle'],
  ['MIDDLE', 'Mid'],
  ['BOTTOM', 'Bot'],
  ['SUPPORT', 'Support'],
]
</script>
<template>
  <div class="match-filters" :aria-busy="busy">
    <SlidersHorizontal :size="15" class="text-ink-3" /><label
      ><span class="sr-only">Queue</span
      ><select
        aria-label="Queue"
        :value="modelValue.type"
        @change="set('type', ($event.target as HTMLSelectElement).value)"
      >
        <option value="all">All queues</option>
        <option value="ranked">Ranked Solo/Duo</option>
        <option value="flex">Ranked Flex</option>
        <option value="normal">Normal</option>
        <option value="aram">ARAM</option>
      </select></label
    ><label v-if="!hideChampion"
      ><span class="sr-only">Champion</span
      ><select
        aria-label="Champion"
        :value="modelValue.champion"
        @change="set('champion', Number(($event.target as HTMLSelectElement).value))"
      >
        <option :value="0">All champions</option>
        <option v-for="c in champions" :key="c.championId" :value="c.championId">
          {{ championName(c.championId) }}
        </option>
      </select></label
    >
    <div class="role-filter" aria-label="Role">
      <button
        v-for="[value, label] in roles"
        :key="value"
        :class="{ selected: modelValue.role === value }"
        :aria-pressed="modelValue.role === value"
        @click="set('role', value)"
      >
        {{ label }}
      </button>
    </div>
    <button
      v-if="modelValue.type !== 'all' || modelValue.champion || modelValue.role !== 'all'"
      class="filter-reset"
      aria-label="Reset filters"
      @click="emit('update:modelValue', { type: 'all', champion: 0, role: 'all' })"
    >
      <RotateCcw :size="14" />
    </button>
  </div>
</template>
