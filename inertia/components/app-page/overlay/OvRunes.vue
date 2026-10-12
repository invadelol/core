<script setup lang="ts">
import { Icon, RunePage } from '@invadelol/ui'
import { assetUrl } from '../../../lib/assets.js'

/**
 * Runes & build, as the champ select overlay draws it: the rune page (already in the client), the
 * spells and skill order, boots and core items of the pick.
 */
defineProps<{
  champion: string
  position: string
  page: { p: number[]; s: number[]; m: number[] }
  spells: number[]
  skills: string
  boots: number[]
  core: number[]
}>()
</script>

<template>
  <div class="ov-panel runes">
    <div class="runes-head">
      <strong>{{ champion }}</strong>
      <span class="muted">{{ position }}</span>
    </div>
    <RunePage :page="page" />
    <div class="runes-row">
      <img v-for="id in spells" :key="id" :src="assetUrl('spell', id)" alt="" width="22" height="22" />
      <span class="skills">{{ skills }}</span>
    </div>
    <div class="runes-items">
      <img v-for="id in boots" :key="`b${id}`" :src="assetUrl('item', id)" alt="" width="24" height="24" />
      <i class="sep" />
      <img v-for="id in core" :key="`c${id}`" :src="assetUrl('item', id)" alt="" width="24" height="24" />
    </div>
    <p class="runes-import"><Icon name="check" :size="11" />Runes set in the client</p>
  </div>
</template>
