<script setup lang="ts">
import { ref, useId } from 'vue'
import Icon from '../ui/Icon.vue'

/**
 * How a team's average LP is counted (app/services/team_lp.ts), behind a small question mark:
 * on hover, on focus, or on a tap. With `counted`, it also says how many starters it counts.
 */
const props = defineProps<{ counted?: number; starters?: number }>()
const open = ref(false)
const id = useId()
const countLine = () =>
  props.counted !== undefined && props.starters
    ? props.counted === props.starters
      ? `All ${props.starters} starters are counted.`
      : `${props.counted} of ${props.starters} starters are counted.`
    : null
</script>

<template>
  <span class="lp-rule" @mouseenter="open = true" @mouseleave="open = false">
    <button
      type="button"
      class="lp-rule-b"
      :aria-expanded="open"
      :aria-describedby="open ? id : undefined"
      aria-label="How the LP average is counted"
      @click.prevent.stop="open = !open"
      @focus="open = true"
      @blur="open = false"
    >
      <Icon name="question" :size="14" />
    </button>
    <span v-if="open" :id="id" role="tooltip" class="lp-rule-tip"
      >The starters' best solo queue accounts, against Master 0 LP. Master and above count their LP.
      Diamond counts 100 LP down per division, plus its LP: Diamond I 50 LP is −50, Diamond IV 0 LP
      is −400. Lower ranks and unranked starters are left out.<template v-if="countLine()">
        <b>{{ countLine() }}</b></template
      ></span
    >
  </span>
</template>

<style scoped>
.lp-rule {
  position: relative;
  display: inline-flex;
  vertical-align: middle;
}
.lp-rule-b {
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: var(--r1);
  background: none;
  color: var(--t3);
  cursor: help;
  transition: color 140ms var(--ease);
}
.lp-rule-b:hover,
.lp-rule-b[aria-expanded='true'] {
  color: var(--t1);
}
.lp-rule-b:focus-visible {
  outline: 2px solid var(--v400);
  outline-offset: 0;
}
.lp-rule-tip {
  position: absolute;
  top: calc(100% + 8px);
  right: -8px;
  z-index: 20;
  width: 280px;
  padding: 10px 12px;
  border-radius: var(--r2);
  background: var(--s2);
  box-shadow:
    inset 0 0 0 1px var(--line-2),
    var(--drop);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
  letter-spacing: 0;
  color: var(--t2);
  text-align: left;
  white-space: normal;
}
.lp-rule-tip b {
  display: block;
  margin-top: 6px;
  font-weight: 600;
  color: var(--t1);
}
@media (pointer: coarse) {
  .lp-rule-b {
    width: 32px;
    height: 32px;
    margin: -5px;
  }
}
</style>
