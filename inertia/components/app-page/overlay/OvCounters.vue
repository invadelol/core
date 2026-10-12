<script setup lang="ts">
import { Icon, RoleIcon } from '@invadelol/ui'
import { assetUrl } from '../../../lib/assets.js'

/** Counters, as the champ select overlay draws it: the three best picks into the enemy laner. */
defineProps<{
  enemy: { id: number; name: string }
  lane: 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT'
  picks: Array<{ id: number; name: string; games: string; edge: number; mine?: number }>
}>()

const signed = (x: number) => `${x < 0 ? '−' : '+'}${(Math.abs(x) * 100).toFixed(1)}%`
</script>

<template>
  <div class="ov-panel counters">
    <div class="counters-head">
      <img :src="assetUrl('champion', enemy.id)" alt="" width="20" height="20" />
      <strong>Picks into {{ enemy.name }}</strong>
      <RoleIcon :lane="lane" />
    </div>
    <ul>
      <li v-for="c in picks" :key="c.id">
        <img :src="assetUrl('champion', c.id)" alt="" width="28" height="28" />
        <span>
          <b>{{ c.name }}</b>
          <small
            >{{ c.games }} games<i v-if="c.mine"
              ><Icon name="user" :size="10" />{{ c.mine }}</i
            ></small
          >
        </span>
        <em :class="{ ahead: c.edge >= 0.01 }">{{ signed(c.edge) }}</em>
      </li>
    </ul>
  </div>
</template>
