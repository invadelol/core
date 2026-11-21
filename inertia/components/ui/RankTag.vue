<script setup lang="ts">
import { computed } from 'vue'
import { bracketOf } from '../../lib/champions.js'

/**
 * A rank filter where a line prints it ("Patch 26.23, Emerald+"): Riot's small crest of the
 * tier, as the client draws it beside a rank, then the filter's name, as the rank menu shows them.
 * Every rank has no crest.
 */
const props = defineProps<{ bracket: string | null | undefined }>()
const b = computed(() => bracketOf(props.bracket ?? 'emerald_plus'))
</script>

<template>
  <span class="rk-tag"
    ><img v-if="b.crest" :src="`/cdn/rank/${b.crest}.svg`" alt="" width="16" height="16" />{{
      b.value === 'all' ? 'all ranks' : b.label
    }}</span
  >
</template>

<style>
@layer components {
  /* A rank filter in a line of text: components/ui/RankTag.vue. */
  .rk-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
    vertical-align: bottom;
  }
  .rk-tag img {
    flex: none;
    width: 16px;
    height: 16px;
  }
}
</style>
