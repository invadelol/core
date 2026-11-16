<script setup lang="ts">
import { computed } from 'vue'
import Icon from '../ui/Icon.vue'
import NoteValue from './NoteValue.vue'
import { labelStat, rankTable, type ChangeKind, type NoteLine } from '../../lib/patch_notes.js'

/**
 * One ability's change as Riot's tables put it: a value given per rank becomes a small table, the
 * patch before over this one, the ranks that moved lit in the change's colour (green a buff, red
 * a nerf, violet both); any other value reads old → new, a new effect or a description as text.
 */
const props = defineProps<{
  lines: NoteLine[]
  kind: ChangeKind
  /** The two patches' names for the table's rows ("26.21", "26.22"). */
  before: string
  after: string
}>()

const dirOf = (l: NoteLine) => ('dir' in l && l.dir ? l.dir : props.kind)
/** Each line with its rank table, when both values are per-rank lists of the same length. */
const rows = computed(() =>
  props.lines.map((l) => ({
    l,
    t: l.type === undefined ? rankTable(l.old, l.new) : null,
  }))
)
const ICON = { up: 'up', down: 'down', mix: 'compare', new: 'plus' } as const
</script>

<template>
  <template v-for="({ l, t }, i) in rows" :key="i">
    <div v-if="l.type === 'new' || l.type === 'desc'" class="ct-l txt">
      <span class="ct-lab"
        ><span class="ct-dg" :class="l.type === 'new' ? 'new' : 'mix'"
          ><Icon :name="l.type === 'new' ? 'plus' : 'compare'" :size="12" /></span
        >{{ l.type === 'new' ? 'New' : 'Changed' }}</span
      >
      <span class="ct-t"><NoteValue :value="l.text" /></span>
    </div>
    <div v-else-if="l.type === 'set'" class="ct-l txt">
      <span class="ct-lab"
        ><img
          v-if="labelStat(l.label)"
          class="si"
          :src="`/cdn/stat/${labelStat(l.label)}.png`"
          alt=""
          width="14"
          height="14"
        />{{ l.label }}</span
      >
      <span class="ct-t"><NoteValue :value="l.value" /></span>
    </div>
    <template v-else>
      <div v-if="t" class="ct-l tab" :class="dirOf(l)" :style="{ '--n': t!.old.length }">
        <span class="ct-lab"
          ><span class="ct-dg" :class="dirOf(l)"><Icon :name="ICON[dirOf(l)]" :size="12" /></span
          ><img
            v-if="labelStat(l.label)"
            class="si"
            :src="`/cdn/stat/${labelStat(l.label)}.png`"
            alt=""
            width="14"
            height="14"
          />{{ l.label }}</span
        >
        <div class="ct-g" role="table" :aria-label="l.label">
          <span class="ct-p" />
          <span v-for="(_, k) in t!.old" :key="`h${k}`" class="ct-c h" role="columnheader"
            >Rank {{ k + 1 }}</span
          >
          <span class="ct-p">{{ before }}</span>
          <span v-for="(v, k) in t!.old" :key="`o${k}`" class="ct-c od" role="cell"
            >{{ v }}<small v-if="t!.unit">{{ t!.unit }}</small></span
          >
          <span class="ct-p">{{ after }}</span>
          <span
            v-for="(v, k) in t!.new"
            :key="`n${k}`"
            class="ct-c nw"
            :class="{ mv: v !== t!.old[k] }"
            role="cell"
            >{{ v }}<small v-if="t!.unit">{{ t!.unit }}</small></span
          >
        </div>
        <div v-if="t!.restOld || t!.restNew" class="ct-x">
          <template v-if="t!.restOld !== t!.restNew">
            <span class="ov"><NoteValue :value="t!.restOld" /></span
            ><Icon name="arrow" :size="13" /><span
              ><NoteValue :value="t!.restNew" :before="t!.restOld"
            /></span>
          </template>
          <span v-else class="ov"><NoteValue :value="t!.restNew" /></span>
        </div>
      </div>
      <div v-else class="ct-l" :class="dirOf(l)">
        <span class="ct-lab"
          ><span class="ct-dg" :class="dirOf(l)"><Icon :name="ICON[dirOf(l)]" :size="12" /></span
          ><img
            v-if="labelStat(l.label)"
            class="si"
            :src="`/cdn/stat/${labelStat(l.label)}.png`"
            alt=""
            width="14"
            height="14"
          />{{ l.label }}</span
        >
        <span class="ct-t"
          ><span class="ov"><NoteValue :value="l.old" /></span><Icon name="arrow" :size="13" /><span
            ><NoteValue :value="l.new" :before="l.old" /></span
        ></span>
      </div>
      <div v-if="l.chips?.length" class="pn-ch ct-chips">
        <span v-for="c in l.chips" :key="c.range" :class="c.way"
          ><span>{{ c.range }}</span
          ><b v-if="c.value">{{ c.value }}</b
          >{{ c.way === 'unchanged' ? 'Unchanged' : c.way }}</span
        >
      </div>
    </template>
  </template>
</template>
