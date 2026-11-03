<script setup lang="ts">
import { TIERS } from '../../lib/champions.js'

/** A tier letter (S+ to D). The letter always shows; its colour only adds to it. */
defineProps<{ tier: number | null | undefined; large?: boolean }>()
</script>

<template>
  <span
    v-if="tier !== null && tier !== undefined"
    class="nb-tier"
    :class="[`t${tier}`, { lg: large }]"
    >{{ TIERS[tier] }}<span class="nb-sr"> tier</span></span
  >
  <span v-else class="nb-tier" :class="{ lg: large }">-</span>
</template>
