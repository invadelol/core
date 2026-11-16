<script setup lang="ts">
import { itemUrl } from '../../lib/champions.js'
import { thousands } from '../../lib/tier_lists.js'

/**
 * An item's recipe as a small tree (`.rc`): the item and its price on top, what it is built from
 * under it, each with its own price. `root` draws the finished item and the gold it costs to
 * combine the parts.
 */
export interface RecipeNode {
  item: number
  gold: number
  from: RecipeNode[]
}
const props = withDefaults(defineProps<{ node: RecipeNode; root?: boolean }>(), { root: false })
const combine = () =>
  Math.max(0, props.node.gold - props.node.from.reduce((n, c) => n + c.gold, 0))
</script>

<template>
  <div v-if="root" class="rc">
    <span class="rc-n top"><img :src="itemUrl(node.item)" alt="" />{{ thousands(node.gold) }}</span>
    <div v-if="node.from.length" class="rc-k">
      <RecipeTree v-for="(c, i) in node.from" :key="i" :node="c" />
    </div>
    <span v-if="node.from.length" class="rc-tot">Combine for <b>{{ thousands(combine()) }}</b> gold</span>
  </div>
  <div v-else>
    <span class="rc-n"><img :src="itemUrl(node.item)" alt="" />{{ thousands(node.gold) }}</span>
    <div v-if="node.from.length" class="rc-k">
      <RecipeTree v-for="(c, i) in node.from" :key="i" :node="c" />
    </div>
  </div>
</template>
