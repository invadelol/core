<script setup lang="ts">
import { onMounted } from 'vue'
import { runeIcon, runeStyleIcon, runeName, loadRunes } from '../lib/assets.js'
import type { RuneSet } from '../lib/types.js'
defineProps<{ runes: RuneSet }>()
onMounted(loadRunes)
</script>
<template>
  <div class="rune-build">
    <section
      v-for="(tree, i) in [runes.primaryStyle, runes.secondaryStyle]"
      :key="i"
      class="card rune-tree"
    >
      <h4>
        <img v-if="tree" :src="runeStyleIcon(tree)" :alt="runeName(tree)" />{{
          tree ? runeName(tree) : 'Unavailable'
        }}<span>{{ i === 0 ? 'Primary' : 'Secondary' }}</span>
      </h4>
      <div
        v-for="id in i === 0 ? runes.runes.slice(0, 4) : runes.runes.slice(4)"
        :key="id"
        class="rune-pick"
      >
        <img :src="runeIcon(id)" :alt="runeName(id)" /><span
          >{{ runeName(id) }}<small v-if="id === runes.keystone">Keystone</small></span
        >
      </div>
      <p v-if="!runes.runes.length" class="subtle">
        Individual rune selections are unavailable for this match.
      </p>
    </section>
    <div class="rune-shards">
      <span class="label">Stat shards</span
      ><span v-for="(id, key) in runes.statPerks" :key="key"
        ><img v-if="id" :src="runeIcon(id)" :alt="runeName(id)" /><span
          >{{ key }}<small>{{ id ? runeName(id) : 'Unavailable' }}</small></span
        ></span
      >
    </div>
  </div>
</template>
