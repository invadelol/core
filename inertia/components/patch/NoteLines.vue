<script setup lang="ts">
import Icon from '../ui/Icon.vue'
import NoteValue from './NoteValue.vue'
import { labelStat, type ChangeKind, type NoteLine } from '../../lib/patch_notes.js'

/** The lines of one change block: old → new, a new effect, a value set, a description. */
defineProps<{ lines: NoteLine[]; kind: ChangeKind }>()
</script>

<template>
  <template v-for="(l, i) in lines" :key="i">
    <div v-if="l.type === 'new'" class="pn-l">
      <span class="pn-new">New</span><span class="nvv"><NoteValue :value="l.text" /></span>
    </div>
    <p v-else-if="l.type === 'desc'" class="pn-d">{{ l.text }}</p>
    <div v-else-if="l.type === 'set'" class="pn-l">
      <img
        v-if="labelStat(l.label)"
        class="si"
        :src="`/cdn/stat/${labelStat(l.label)}.png`"
        alt=""
        width="15"
        height="15"
      /><span class="lb">{{ l.label }}:</span
      ><span class="nvv"><NoteValue :value="l.value" /></span>
    </div>
    <template v-else>
      <div class="pn-l" :class="l.dir ?? kind">
        <img
          v-if="labelStat(l.label)"
          class="si"
          :src="`/cdn/stat/${labelStat(l.label)}.png`"
          alt=""
          width="15"
          height="15"
        /><span class="lb">{{ l.label }}:</span><span class="ov"><NoteValue :value="l.old" /></span
        ><span class="to" aria-label="to"><Icon name="arrow" :size="14" /></span
        ><span class="nvv"><NoteValue :value="l.new" :before="l.old" /></span>
      </div>
      <div v-if="l.chips?.length" class="pn-ch">
        <span v-for="c in l.chips" :key="c.range" :class="c.way"
          ><span>{{ c.range }}</span
          ><b v-if="c.value">{{ c.value }}</b
          >{{ c.way === 'unchanged' ? 'Unchanged' : c.way }}</span
        >
      </div>
    </template>
  </template>
</template>
