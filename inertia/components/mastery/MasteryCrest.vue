<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { masteryCrest } from '../../lib/assets.js'

/**
 * The League client's mastery crest for a level. Levels past ten wear the tenth crest; the level
 * itself is printed beside it by whoever shows one, so a crest that cannot load simply goes.
 */
const props = withDefaults(defineProps<{ level: number; size: number; titled?: boolean }>(), {
  titled: true,
})

const failed = ref(false)
watch(
  () => props.level,
  () => (failed.value = false)
)
const src = computed(() => masteryCrest(props.level))
</script>

<template>
  <span
    v-if="!failed"
    class="ms-crest"
    :style="{ width: `${size}px`, height: `${size}px` }"
    :title="titled ? `Mastery level ${level}` : undefined"
  >
    <img
      :src="src"
      alt=""
      :width="size"
      :height="size"
      loading="lazy"
      decoding="async"
      @error="failed = true"
    />
  </span>
</template>

<style scoped>
.ms-crest {
  display: inline-grid;
  flex: none;
  place-items: center;
}

.ms-crest > img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
