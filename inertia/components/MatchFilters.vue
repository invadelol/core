<script setup lang="ts">
import { computed } from 'vue'
import { X } from 'lucide-vue-next'
import { RoleIcon } from '@invadelol/ui'
import { positionOf } from '@invadelol/ui/logic'
import Select from './ui/Select.vue'
import { champIcon, championName } from '../lib/assets.js'
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
  /** What the current filters actually returned, printed on the right. */
  summary?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: Filters] }>()

function set(key: keyof Filters, value: string | number) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

const QUEUES = [
  ['all', 'All'],
  ['ranked', 'Solo/Duo'],
  ['flex', 'Flex'],
  ['normal', 'Normals'],
  ['aram', 'ARAM'],
] as const

/* Riot's own position glyphs, which players read faster than the words. */
const ROLES = [
  ['TOP', 'Top'],
  ['JUNGLE', 'Jungle'],
  ['MIDDLE', 'Mid'],
  ['BOTTOM', 'Bot'],
  ['SUPPORT', 'Support'],
] as const

const championOptions = computed(() => [
  { value: 0, label: 'All champions' },
  ...[...(props.champions ?? [])]
    .sort((a, b) => b.games - a.games)
    .map((c) => ({
      value: c.championId,
      label: championName(c.championId),
      icon: champIcon(c.championId),
      meta: `${c.games}`,
    })),
])

const dirty = computed(
  () =>
    props.modelValue.type !== 'all' ||
    props.modelValue.role !== 'all' ||
    Boolean(props.modelValue.champion)
)

const championModel = computed({
  get: () => props.modelValue.champion,
  set: (value: number) => set('champion', value),
})
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-x-4 gap-y-2.5 transition-opacity"
    :class="busy ? 'opacity-55' : ''"
    :aria-busy="busy"
  >
    <div class="iv-seg" role="group" aria-label="Queue">
      <button
        v-for="[value, label] in QUEUES"
        :key="value"
        type="button"
        :class="{ on: modelValue.type === value }"
        @click="set('type', value)"
      >
        {{ label }}
      </button>
    </div>

    <div class="iv-seg" role="group" aria-label="Role">
      <button
        type="button"
        class="!px-2.5"
        :class="{ on: modelValue.role === 'all' }"
        @click="set('role', 'all')"
      >
        All
      </button>
      <button
        v-for="[value, label] in ROLES"
        :key="value"
        type="button"
        class="!px-2.5"
        :title="label"
        :aria-label="label"
        :class="{ on: modelValue.role === value }"
        @click="set('role', value)"
      >
        <RoleIcon :lane="positionOf(value === 'SUPPORT' ? 'UTILITY' : value)" :size="15" />
      </button>
    </div>

    <Select
      v-if="!hideChampion"
      v-model="championModel"
      :options="championOptions"
      searchable
      search-placeholder="Find a champion"
      placeholder="All champions"
      width="16rem"
      class="w-[160px]"
    />

    <button
      v-if="dirty"
      class="iv-btn ghost sm"
      @click="emit('update:modelValue', { type: 'all', champion: 0, role: 'all' })"
    >
      <X :size="12" />
      Clear
    </button>

    <span v-if="summary" class="num ml-auto shrink-0 text-[11.5px] text-ink-3">{{ summary }}</span>
  </div>
</template>
