<script setup lang="ts">
import { computed } from 'vue'
import { nameOf } from '../../lib/assets.js'

/**
 * An item, rune, rune tree, summoner spell or ability icon from our /cdn, at a fixed size (no
 * layout shift). Its name, when known, is its alternative text and its tooltip.
 */
const props = withDefaults(
  defineProps<{
    kind: 'item' | 'rune' | 'runeStyle' | 'spell' | 'ability'
    id: number | string
    size?: number
    round?: boolean
    /** A name the page already has (sent with it): no name map to load. */
    name?: string | null
    eager?: boolean
  }>(),
  { size: 24, round: false, name: null, eager: false }
)
const PATH = {
  item: 'item',
  rune: 'perk',
  runeStyle: 'perkstyle',
  spell: 'spell',
  ability: 'ability',
}
const src = computed(() => `/cdn/${PATH[props.kind]}/${props.id}.png`)
const label = computed(
  () => props.name ?? (props.kind === 'ability' ? '' : (nameOf(props.kind, Number(props.id)) ?? ''))
)
</script>

<template>
  <img
    class="nb-img"
    :class="{ round }"
    :src="src"
    :alt="label"
    :title="label || undefined"
    :width="size"
    :height="size"
    :loading="eager ? 'eager' : 'lazy'"
    decoding="async"
  />
</template>
