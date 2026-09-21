<script setup lang="ts">
import { computed } from 'vue'
import { GRADE_COLOR, type Grade } from '../lib/match.js'

const props = withDefaults(defineProps<{ grade: Grade; size?: number }>(), { size: 40 })

const color = computed(() => GRADE_COLOR[props.grade.letter])
</script>

<template>
  <span
    class="grade"
    :style="{
      '--grade': color,
      'width': `${size}px`,
      'height': `${size}px`,
      'fontSize': `${Math.round(size * 0.46)}px`,
    }"
  >
    {{ grade.letter }}
    <span class="grade-bar">
      <span :style="{ width: `${Math.max(grade.rating, 6)}%` }" />
    </span>
  </span>
</template>
