<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import type { SignatureChampion } from '../../lib/invade_profile.js'

/** The champions the main account played most this season, on their art. */
defineProps<{ champions: SignatureChampion[]; puuidPath: string | null }>()
const rate = (c: SignatureChampion) => Math.round((c.wins / Math.max(1, c.games)) * 100)
</script>

<template>
  <div class="pf-sigs">
    <component
      :is="puuidPath ? Link : 'div'"
      v-for="c in champions"
      :key="c.championId"
      class="pf-sig"
      :href="puuidPath ? `${puuidPath}/champions` : undefined"
    >
      <img :src="`/cdn/centered/${c.championId}.jpg?w=960`" alt="" loading="lazy" />
      <span class="pf-sig-t">
        <b>{{ c.name }}</b>
        <span class="num">{{ c.games }} games, {{ rate(c) }}%</span>
      </span>
    </component>
  </div>
</template>
