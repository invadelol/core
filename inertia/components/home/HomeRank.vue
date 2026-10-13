<script setup lang="ts">
import { RankCrest } from '@invadelol/ui'
import { rankLabel, tierColor } from '@invadelol/ui/logic'
import type { HomeRank } from '../../lib/home.js'

/**
 * A Solo/Duo rank in a list line: the small crest, the tier in its colour, LP when asked. Nothing
 * when no rank is stored: that is not the same as unranked.
 */
withDefaults(defineProps<{ rank: HomeRank | null; lp?: boolean }>(), { lp: true })
</script>

<template>
  <span v-if="rank" class="inline-flex min-w-0 items-center gap-1.5">
    <RankCrest :tier="rank.tier" :size="14" />
    <span class="truncate font-medium" :style="{ color: tierColor(rank.tier) }">
      {{ rankLabel({ ...rank }, false) }}
    </span>
    <span v-if="lp" class="num shrink-0 text-ink-3">{{ rank.lp }} LP</span>
  </span>
</template>
