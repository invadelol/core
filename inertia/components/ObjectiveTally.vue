<script setup lang="ts">
import { computed } from 'vue'
import { Eye, Flame, Shield, Skull, TowerControl } from 'lucide-vue-next'
import { objectives } from '../lib/match.js'
import type { Match } from '../lib/types.js'

const props = defineProps<{ match: Match; teamId: number; size?: 'sm' | 'md' }>()

const ICONS = {
  towers: { icon: TowerControl, label: 'Turrets' },
  inhibs: { icon: Shield, label: 'Inhibitors' },
  dragons: { icon: Flame, label: 'Dragons' },
  barons: { icon: Skull, label: 'Barons' },
  heralds: { icon: Eye, label: 'Rift Heralds' },
} as const

const rows = computed(() => {
  const taken = objectives(props.match, props.teamId)
  return (Object.keys(ICONS) as Array<keyof typeof ICONS>).map((key) => ({
    key,
    value: taken[key] ?? 0,
    ...ICONS[key],
  }))
})
</script>

<template>
  <div class="flex items-center gap-2.5">
    <span
      v-for="row in rows"
      :key="row.key"
      class="num flex items-center gap-1 text-[11.5px]"
      :class="row.value ? 'text-ink-2' : 'text-ink-4'"
      :title="`${row.value} ${row.label}`"
    >
      <component :is="row.icon" :size="size === 'md' ? 14 : 12.5" />
      {{ row.value }}
    </span>
  </div>
</template>
