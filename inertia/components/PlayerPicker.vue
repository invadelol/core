<script setup lang="ts">
import { champIcon, championName, POSITION_NAMES } from '../lib/assets.js'
import { teamMembers, teamOrder } from '../lib/match.js'
import type { Match } from '../lib/types.js'

defineProps<{ match: Match; label?: string }>()

const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="flex min-w-0 items-center gap-3">
    <span v-if="label !== ''" class="label shrink-0">{{ label ?? 'Focus' }}</span>

    <div class="scroll-x flex min-w-0 flex-1 items-center gap-2 pb-1">
      <div
        v-for="(teamId, index) in teamOrder(match)"
        :key="teamId"
        class="flex shrink-0 items-center gap-2"
      >
        <span v-if="index === 1" class="label !text-ink-4">vs</span>
        <div class="flex shrink-0 gap-1">
          <button
            v-for="p in teamMembers(match, teamId)"
            :key="p.puuid"
            type="button"
            class="relative rounded-[9px] border p-[3px] transition-colors"
            :class="
              model === p.puuid ? 'border-ink bg-raised' : 'border-transparent hover:border-line-2'
            "
            :title="`${p.gameName}#${p.tagLine} · ${championName(p.championId)}${p.position ? ` (${POSITION_NAMES[p.position] || p.position})` : ''}`"
            @click="model = p.puuid"
          >
            <img
              :src="champIcon(p.championId)"
              :alt="championName(p.championId)"
              loading="lazy"
              class="thumb h-8 w-8 rounded-[6px]"
            />
            <span
              class="absolute -bottom-px left-1/2 h-[2px] w-4 -translate-x-1/2 rounded-full"
              :style="{ background: teamId === 100 ? 'var(--color-blue)' : 'var(--color-red)' }"
            />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
