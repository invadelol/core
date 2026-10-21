<script setup lang="ts">
import { TIERS } from '../../lib/champions.js'

/** A champion's tier letter (0 S+ … 5 D); a dash when it has too few games to be ranked. */
defineProps<{ tier: number | null | undefined; large?: boolean }>()
</script>

<template>
  <span
    class="cs-tier"
    :class="[tier === null || tier === undefined ? 't5' : `t${tier}`, { lg: large }]"
  >
    {{ tier === null || tier === undefined ? '–' : TIERS[tier] }}
  </span>
</template>
