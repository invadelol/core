<script setup lang="ts">
import { computed } from 'vue'
import { RoleIcon } from '@invadelol/ui'
import { positionOf } from '@invadelol/ui/logic'
import Icon from './ui/Icon.vue'
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
  /** The queue is chosen elsewhere (the Performance card). */
  hideQueue?: boolean
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
  <div class="mf" :class="{ busy }" :aria-busy="busy">
    <div v-if="!hideQueue" class="seg mf-seg" role="group" aria-label="Queue">
      <button
        v-for="[value, label] in QUEUES"
        :key="value"
        type="button"
        :class="{ on: modelValue.type === value }"
        :aria-pressed="modelValue.type === value"
        @click="set('type', value)"
      >
        {{ label }}
      </button>
    </div>

    <div class="seg mf-seg" role="group" aria-label="Role">
      <button
        type="button"
        :class="{ on: modelValue.role === 'all' }"
        :aria-pressed="modelValue.role === 'all'"
        @click="set('role', 'all')"
      >
        All
      </button>
      <button
        v-for="[value, label] in ROLES"
        :key="value"
        type="button"
        class="mf-role"
        :title="label"
        :aria-label="label"
        :class="{ on: modelValue.role === value }"
        :aria-pressed="modelValue.role === value"
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
      class="mf-sel"
    />

    <button
      v-if="dirty"
      type="button"
      class="btn ghost sm"
      @click="emit('update:modelValue', { type: 'all', champion: 0, role: 'all' })"
    >
      <Icon name="x" />Clear
    </button>

    <span v-if="summary" class="meta num mf-sum">{{ summary }}</span>
  </div>
</template>

<style scoped>
.mf {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
  transition: opacity 160ms var(--ease);
}
.mf.busy {
  opacity: 0.55;
}
.mf-role {
  padding: 0 10px !important;
}
.mf-sel {
  width: 180px;
}
.mf-sum {
  margin-left: auto;
}
@media (max-width: 640px) {
  .mf-seg {
    display: flex;
    width: 100%;
  }
  .mf-seg > * {
    flex: 1 1 0;
    justify-content: center;
    min-width: 0;
    padding: 0 6px;
  }
  .mf-sel {
    width: 100%;
  }
}
</style>
