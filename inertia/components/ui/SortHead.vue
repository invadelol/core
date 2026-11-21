<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import type { Sorter } from './sort.js'

/**
 * A sortable column head: the head cell itself (one element, so a table's `:nth-child` rules still
 * count it), carrying `aria-sort`, with a button inside, or a link when the server sorts
 * (`linkSort`). The arrow points the way the figures run: down, most first; up, least first.
 * Classes on it (`n`, `r`, `c`, `hm`) land on the cell, as on the plain head it replaces.
 */
const props = defineProps<{
  sorter: Sorter
  /** The column's key in the sorter. */
  col: string
  /** The head's words; the default slot replaces them. */
  label?: string
  /** A longer name, shown on hover. */
  title?: string
}>()

const on = computed(() => props.sorter.key === props.col)
const ariaSort = computed(() =>
  on.value ? (props.sorter.dir === 'desc' ? 'descending' : 'ascending') : undefined
)
const state = computed(() =>
  on.value ? (props.sorter.dir === 'desc' ? ', sorted high to low' : ', sorted low to high') : ''
)
</script>

<template>
  <span role="columnheader" :aria-sort="ariaSort" class="sh" :class="{ sorted: on }">
    <Link
      v-if="sorter.href"
      class="sh-b"
      :href="sorter.href(col)"
      :title="title"
      preserve-scroll
      ><slot>{{ label }}</slot
      ><svg class="sh-a" :class="{ up: on && sorter.dir === 'asc' }" viewBox="0 0 12 12" aria-hidden="true">
        <path v-if="on" d="M6 1.5v8.5M2.5 6.5 6 10l3.5-3.5" />
        <path v-else d="M3.5 4.5 6 2l2.5 2.5M3.5 7.5 6 10l2.5-2.5" /></svg
      ><span class="sr-only">{{ state }}</span></Link
    >
    <button v-else type="button" class="sh-b" :title="title" @click="sorter.toggle?.(col)">
      <slot>{{ label }}</slot
      ><svg class="sh-a" :class="{ up: on && sorter.dir === 'asc' }" viewBox="0 0 12 12" aria-hidden="true">
        <path v-if="on" d="M6 1.5v8.5M2.5 6.5 6 10l3.5-3.5" />
        <path v-else d="M3.5 4.5 6 2l2.5 2.5M3.5 7.5 6 10l2.5-2.5" /></svg
      ><span class="sr-only">{{ state }}</span>
    </button>
  </span>
</template>

<style scoped>
.sh {
  min-width: 0;
}
.sh-b {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  margin: -6px -4px;
  padding: 6px 4px;
  border-radius: 6px;
  font: inherit;
  font-weight: 650;
  color: inherit;
  white-space: nowrap;
  cursor: pointer;
  transition: color 140ms ease;
}
.sh-b:hover,
.sh.sorted .sh-b {
  color: var(--t1);
}
.sh-b:focus-visible {
  outline: 2px solid var(--v400);
  outline-offset: 0;
}
.sh-a {
  width: 12px;
  height: 12px;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linejoin: miter;
  stroke-linecap: butt;
  opacity: 0;
  transition:
    opacity 140ms ease,
    transform 160ms ease;
}
.sh-b:hover .sh-a,
.sh-b:focus-visible .sh-a {
  opacity: 0.55;
}
.sh.sorted .sh-a {
  opacity: 1;
  color: var(--v300);
}
.sh-a.up {
  transform: rotate(180deg);
}
/* A right-aligned figure's head (`.n`, `.r`): the words still end on the column's edge. */
.sh:is(.n, .r) {
  text-align: right;
}
.sh:is(.n, .r) .sh-b {
  flex-direction: row-reverse;
}
/* A centred head (`.c`): the words over the middle of the column, the arrow just after them. */
.sh.c .sh-b {
  position: relative;
}
.sh.c .sh-a {
  position: absolute;
  left: 100%;
  top: 50%;
  margin-top: -6px;
}
@media (hover: none) {
  .sh-a {
    opacity: 0.4;
  }
}
</style>
