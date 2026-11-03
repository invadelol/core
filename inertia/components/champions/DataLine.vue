<script setup lang="ts">
import { computed } from 'vue'
import { bracketOf } from '../../lib/champions.js'
import { ago, thousands } from '../../lib/board.js'

/** The sample a page's figures stand on: "12,408 games, Emerald+, patch 16.20, updated 2 h ago". */
const props = defineProps<{
  games?: number | null
  bracket?: string | null
  region?: string | null
  patch?: string | null
  updatedAt?: number | null
  /** The time the page was answered, so the server and the browser say the same "ago". */
  now?: number | null
}>()
const text = computed(() =>
  [
    props.games ? `${thousands(props.games)} games` : null,
    props.bracket ? bracketOf(props.bracket).label : null,
    props.patch ? (props.region ? props.region.toUpperCase() : 'all regions') : null,
    props.patch ? `patch ${props.patch}` : null,
    props.updatedAt
      ? `updated ${ago(props.updatedAt, props.now ?? Date.now()).replace('Yesterday', 'yesterday')}`
      : null,
  ]
    .filter(Boolean)
    .join(', ')
)
</script>

<template>
  <span class="num">{{ text }}</span>
</template>
