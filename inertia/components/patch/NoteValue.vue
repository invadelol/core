<script setup lang="ts">
import { computed } from 'vue'
import { valueRuns } from '../../lib/patch_notes.js'

/**
 * A value as Riot writes it ("50 / 75 / 100 (+60% AP)"): the numbers that changed from `before`
 * in bold (coloured by the line), AD and AP with their stat icon, as the game's tooltips show them.
 * Each bracketed ratio holds together on one line (`.rg`).
 */
const props = defineProps<{ value: string; before?: string }>()
/** A ratio short enough to hold on one line ("(+110% AD)"); a long one may wrap between words. */
const KEEP = 32
const runs = computed(() =>
  valueRuns(props.value, props.before).map((r) => ({
    ...r,
    keep:
      r.ratio && r.parts.reduce((n, p) => n + (p.kind === 'stat' ? 2 : p.text.length), 0) <= KEEP,
  }))
)
</script>

<template>
  <span v-for="(r, j) in runs" :key="j" :class="{ rg: r.keep }"
    ><template v-for="(p, i) in r.parts" :key="i"
      ><template v-if="p.kind === 'text'">{{ p.text }}</template
      ><b v-else-if="p.kind === 'num' && p.changed" class="nv">{{ p.text }}</b
      ><template v-else-if="p.kind === 'num'">{{ p.text }}</template
      ><span v-else class="rt" :class="p.stat"
        ><img :src="`/cdn/stat/${p.stat}.png`" alt="" width="13" height="13" />{{
          p.stat.toUpperCase()
        }}</span
      ></template
    ></span
  >
</template>
