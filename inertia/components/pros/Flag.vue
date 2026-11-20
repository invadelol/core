<script setup lang="ts">
import { ref } from 'vue'
import '../../css/pro_pics.css'

/**
 * A country's flag (`public/flags/<code>.svg`, Tabler's flags, MIT): 20 by 15, lazy. A country
 * without one draws nothing; the country's name beside it says the rest.
 */
const props = withDefaults(defineProps<{ code: string | null | undefined; size?: number }>(), {
  size: 20,
})
const failed = ref(false)
const src = () =>
  props.code && /^[a-z]{2}$/i.test(props.code) ? `/flags/${props.code.toLowerCase()}.svg` : null
</script>

<template>
  <img
    v-if="src() && !failed"
    class="flag"
    loading="lazy"
    decoding="async"
    alt=""
    :width="size"
    :height="Math.round((size * 3) / 4)"
    :style="{ width: `${size}px`, height: `${(size * 3) / 4}px` }"
    :src="src()!"
    data-fallback="applied"
    @error="failed = true"
  />
</template>
