<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { starsWords } from '../../lib/skins.js'

/**
 * The visitor's own rating: five stars, each in two halves. Hovering fills up to the half under
 * the pointer; clicking the rating already given takes it back. Ten radio buttons underneath, so
 * the keyboard moves with the arrows and a screen reader reads "3.5 stars".
 */
const props = defineProps<{ modelValue: number | null; disabled?: boolean; size?: number }>()
const emit = defineEmits<{ 'update:modelValue': [value: number | null] }>()

const name = useId()
const hover = ref<number | null>(null)
const shown = computed(() => hover.value ?? props.modelValue ?? 0)
const STAR =
  'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.12 2.12 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.12 2.12 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.12 2.12 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.12 2.12 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.12 2.12 0 0 0 1.597-1.16z'

function pick(value: number) {
  if (props.disabled) return
  emit('update:modelValue', value === props.modelValue ? null : value)
}
</script>

<template>
  <div
    class="skn-input"
    role="radiogroup"
    aria-label="Your rating"
    :class="{ off: disabled }"
    @mouseleave="hover = null"
  >
    <span v-for="star in 5" :key="star" class="skn-istar">
      <svg :width="size ?? 26" :height="size ?? 26" viewBox="0 0 24 24" aria-hidden="true">
        <path class="off" :d="STAR" />
        <path v-if="shown >= star * 2" class="on" :d="STAR" />
        <path
          v-else-if="shown === star * 2 - 1"
          class="on"
          :d="STAR"
          style="clip-path: inset(0 50% 0 0)"
        />
      </svg>
      <label
        v-for="half in [star * 2 - 1, star * 2]"
        :key="half"
        :class="half % 2 ? 'l' : 'r'"
        @mouseenter="hover = half"
        @click.prevent="pick(half)"
      >
        <input
          type="radio"
          :name="name"
          :value="half"
          :checked="modelValue === half"
          :disabled="disabled"
          @change="pick(half)"
        />
        <span class="skn-vh">{{ starsWords(half) }}</span>
      </label>
    </span>
  </div>
</template>
