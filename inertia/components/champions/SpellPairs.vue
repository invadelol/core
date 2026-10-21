<script setup lang="ts">
import { nameOf } from '../../lib/assets.js'
import { pct, spellUrl, type SpellStats } from '../../lib/champions.js'

defineProps<{ spells: SpellStats; count?: number }>()
const name = (id: number) => nameOf('spell', id) ?? ''
</script>

<template>
  <div>
    <div v-for="p in spells.pairs.slice(0, count ?? 3)" :key="p.spells.join()" class="cs-sp">
      <span class="i"
        ><img
          v-for="id in p.spells"
          :key="id"
          :src="spellUrl(id)"
          :alt="name(id)"
          :title="name(id)"
      /></span>
      <span class="n">{{ p.spells.map(name).join(' + ') }}</span>
      <span class="v"
        ><b>{{ pct(p.win) }}</b
        ><small>{{ pct(p.share, 0) }}</small></span
      >
    </div>
  </div>
</template>
