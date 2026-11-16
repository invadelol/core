<script setup lang="ts">
import { computed } from 'vue'
import { valueParts } from '../../lib/patch_notes.js'

/**
 * A value as Riot writes it ("50 / 75 / 100 (+60% AP)"): the numbers that changed from `before`
 * in bold (coloured by the line), AD and AP with their stat icon, as the game's tooltips show them.
 */
const props = defineProps<{ value: string; before?: string }>()
const parts = computed(() => valueParts(props.value, props.before))
</script>

<template>
  <template v-for="(p, i) in parts" :key="i"
    ><template v-if="p.kind === 'text'">{{ p.text }}</template
    ><b v-else-if="p.kind === 'num' && p.changed" class="nv">{{ p.text }}</b
    ><template v-else-if="p.kind === 'num'">{{ p.text }}</template
    ><span v-else class="rt" :class="p.stat"
      ><img :src="`/cdn/stat/${p.stat}.png`" alt="" width="13" height="13" />{{
        p.stat.toUpperCase()
      }}</span
    ></template
  >
</template>
