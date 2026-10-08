<script setup lang="ts">
import type { ObjTimer } from './types.js'
import { Bug, Crown, Eye, Flame } from 'lucide-vue-next'
import { mmss } from './clock.js'

/**
 * Objectives, as the overlay draws it: one pill per timer (a spawn, or a buff the holding team
 * still has), then the dragons each team holds for the soul race.
 */
defineProps<{ t: number; timers: ObjTimer[]; drakes: { ally: string[]; enemy: string[] } }>()

const ICON = {
  dragon: Flame,
  grubs: Bug,
  herald: Eye,
  baron: Crown,
  baronBuff: Crown,
  elderBuff: Flame,
}

const DRAKE_COLORS: Record<string, string> = {
  Fire: '#ff6b3d',
  Water: '#3dc6ff',
  Earth: '#c79a5b',
  Air: '#d9e6f2',
  Hextech: '#47e0d0',
  Chemtech: '#9be34a',
}
</script>

<template>
  <div class="ov-panel obj">
    <ul class="obj-pills">
      <li
        v-for="tm in timers"
        :key="tm.key"
        class="obj-pill"
        :class="[
          tm.key,
          tm.team,
          {
            up: !tm.team && tm.at <= t,
            soon: !tm.team && tm.at > t && tm.at - t <= 60,
          },
        ]"
        :title="tm.label"
      >
        <component :is="ICON[tm.key]" :size="13" :stroke-width="1.8" />
        <b v-if="!tm.team && tm.at <= t">UP</b>
        <b v-else>{{ mmss(Math.max(0, tm.at - t)) }}</b>
      </li>
    </ul>
    <div v-if="drakes.ally.length || drakes.enemy.length" class="obj-drakes">
      <span v-for="side in ['ally', 'enemy'] as const" :key="side" :class="side">
        <i
          v-for="(d, i) in drakes[side]"
          :key="i"
          :title="d"
          :style="{ background: DRAKE_COLORS[d] ?? '#888' }"
        />
      </span>
    </div>
  </div>
</template>
