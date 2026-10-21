<script setup lang="ts">
import { computed } from 'vue'
import { nameOf } from '../../lib/assets.js'
import { perkUrl, styleUrl, type RunePage, type RuneTrees } from '../../lib/champions.js'

/** A rune page as the client draws it: both trees, the chosen runes lit, the others dimmed. */
const props = defineProps<{ page: RunePage; trees: RuneTrees; big?: boolean }>()

const chosen = computed(
  () => new Set([props.page.keystone, ...props.page.primary, ...props.page.secondary])
)
const primary = computed(() => props.trees.styles[props.page.primaryStyle]?.rows ?? [])
const secondary = computed(() =>
  (props.trees.styles[props.page.secondaryStyle]?.rows ?? []).slice(1)
)
const name = (id: number) => nameOf('rune', id) ?? ''
const style = (id: number) => props.trees.styles[id]?.name ?? nameOf('runeStyle', id) ?? ''
</script>

<template>
  <div class="cs-runes" :class="{ big }">
    <div class="cs-tree">
      <span class="th"
        ><img :src="styleUrl(page.primaryStyle)" alt="" />{{ style(page.primaryStyle) }}</span
      >
      <div v-for="(row, i) in primary" :key="i" class="r" :class="{ key: i === 0 }">
        <img
          v-for="id in row"
          :key="id"
          :class="{ on: chosen.has(id) }"
          :src="perkUrl(id)"
          :alt="name(id)"
          :title="name(id)"
        />
      </div>
    </div>
    <div class="cs-tree">
      <span class="th"
        ><img :src="styleUrl(page.secondaryStyle)" alt="" />{{ style(page.secondaryStyle) }}</span
      >
      <div v-for="(row, i) in secondary" :key="i" class="r">
        <img
          v-for="id in row"
          :key="id"
          :class="{ on: chosen.has(id) }"
          :src="perkUrl(id)"
          :alt="name(id)"
          :title="name(id)"
        />
      </div>
      <div v-if="trees.shards.length" class="shards">
        <div v-for="(row, i) in trees.shards" :key="i" class="r sh">
          <img
            v-for="id in row"
            :key="id"
            :class="{ on: page.shards[i] === id }"
            :src="perkUrl(id)"
            :alt="name(id)"
            :title="name(id)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
