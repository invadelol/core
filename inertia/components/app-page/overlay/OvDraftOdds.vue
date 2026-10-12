<script setup lang="ts">
import { RoleIcon } from '@invadelol/ui'
import { assetUrl } from '../../../lib/assets.js'

type Lane = 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT'

/** Draft odds, as the champ select overlay draws it: the draft's win probability, then every lane. */
defineProps<{
  win: number
  lanes: Array<{ lane: Lane; ally: number; enemy: number; w: number }>
}>()

const pct = (x: number) => `${Math.round(x * 100)}%`
const tone = (w: number) => (w >= 0.52 ? 'ally' : w <= 0.48 ? 'enemy' : '')
</script>

<template>
  <div class="ov-panel draft-odds">
    <div class="odds-win">
      <small>Win</small>
      <div class="wp-bar"><div class="wp-fill" :style="{ transform: `scaleX(${win})` }" /></div>
      <b :class="win >= 0.5 ? 'ally' : 'enemy'">{{ pct(win) }}</b>
    </div>
    <ul class="odds-lanes">
      <li v-for="l in lanes" :key="l.lane">
        <RoleIcon :lane="l.lane" />
        <img :src="assetUrl('champion', l.ally)" alt="" width="24" height="24" />
        <b :class="tone(l.w)">{{ pct(l.w) }}</b>
        <img :src="assetUrl('champion', l.enemy)" alt="" width="24" height="24" />
      </li>
    </ul>
  </div>
</template>
