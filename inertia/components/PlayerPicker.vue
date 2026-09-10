<script setup lang="ts">
import { champIcon, championName, POSITION_NAMES } from '../lib/ddragon.js'
import { teamMembers } from '../lib/match.js'
import type { Match } from '../lib/types.js'

defineProps<{ match: Match }>()

const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="flex w-full min-w-0 items-center gap-3">
    <span class="label shrink-0">Focus</span>

    <div class="scroll-x flex min-w-0 flex-1 items-center gap-3 pb-1">
      <template v-for="(teamId, index) in [100, 200]" :key="teamId">
        <span v-if="index === 1" class="label shrink-0 !text-ink-4">vs</span>
        <div class="flex shrink-0 gap-1">
          <button
            v-for="p in teamMembers(match, teamId)"
            :key="p.puuid"
            type="button"
            class="relative rounded-lg border p-[3px] transition-colors"
            :class="
              model === p.puuid
                ? 'border-ink bg-[#f4f5f8]'
                : 'border-transparent hover:border-line-strong'
            "
            :title="`${p.gameName}#${p.tagLine} · ${championName(p.championId)}${p.position ? ` (${POSITION_NAMES[p.position] || p.position})` : ''}`"
            @click="model = p.puuid"
          >
            <img
              :src="champIcon(p.championId)"
              :alt="championName(p.championId)"
              class="thumb h-8 w-8 rounded-md"
            />
            <span
              class="absolute -bottom-px left-1/2 h-[2px] w-4 -translate-x-1/2 rounded-full"
              :class="teamId === 100 ? 'bg-win' : 'bg-loss'"
            />
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
