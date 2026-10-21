<script setup lang="ts">
import { computed } from 'vue'
import { nameOf } from '../../lib/assets.js'
import { itemUrl, pct, type BuildStats } from '../../lib/champions.js'

/** The most played build in buy order: start, boots, the core of three, then the 4th to 6th item. */
const props = defineProps<{ build: BuildStats }>()

const item = (id: number) => nameOf('item', id) ?? ''
const core = computed(() => props.build.cores[0] ?? null)
const later = computed(() => props.build.slots.map((slot) => slot[0]).filter(Boolean))
const start = computed(() => props.build.starters[0] ?? null)
const boots = computed(() => props.build.boots[0] ?? null)
</script>

<template>
  <div class="cs-path">
    <div v-if="start" class="cs-step">
      <span class="k">Start</span>
      <span class="i"
        ><img
          v-for="(id, i) in [...new Set(start.items)].slice(0, 2)"
          :key="i"
          :src="itemUrl(id)"
          :alt="item(id)"
          :title="item(id)"
      /></span>
      <span class="n">{{ item(start.items[0]) }}</span>
      <span class="v"
        ><b>{{ pct(start.win) }}</b
        ><small>{{ pct(start.share, 0) }}</small></span
      >
    </div>
    <div v-if="boots" class="cs-step">
      <span class="k">Boots</span>
      <span class="i"
        ><img
          :src="itemUrl(boots.items[0])"
          :alt="item(boots.items[0])"
          :title="item(boots.items[0])"
      /></span>
      <span class="n">{{ item(boots.items[0]) }}</span>
      <span class="v"
        ><b>{{ pct(boots.win) }}</b
        ><small>{{ pct(boots.share, 0) }}</small></span
      >
    </div>
    <div v-if="core" class="cs-core">
      <div v-for="(id, i) in core.items" :key="id" class="cs-step">
        <span class="k">{{ ['1st', '2nd', '3rd'][i] }}</span>
        <span class="i"><img :src="itemUrl(id)" :alt="item(id)" :title="item(id)" /></span>
        <span class="n">{{ item(id) }}</span>
      </div>
      <span class="foot"
        ><b>{{ pct(core.win) }}</b> win · {{ pct(core.share, 0) }} of games</span
      >
    </div>
    <div v-for="(s, i) in later" :key="s.item" class="cs-step">
      <span class="k">{{ ['4th', '5th', '6th'][i] }}</span>
      <span class="i"
        ><img :src="itemUrl(s.item)" :alt="item(s.item)" :title="item(s.item)"
      /></span>
      <span class="n">{{ item(s.item) }}</span>
      <span class="v"
        ><b>{{ pct(s.win) }}</b
        ><small>{{ pct(s.share, 0) }}</small></span
      >
    </div>
  </div>
</template>
