<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { masteryCrest } from '../../lib/assets.js'

/**
 * The League client's mastery crest for a level. Levels past ten wear the tenth crest; the level
 * itself is printed next to it by whoever shows one. A crest that cannot load leaves its level.
 */
const props = defineProps<{ level: number; size: number }>()

const failed = ref(false)
watch(
  () => props.level,
  () => (failed.value = false)
)
const src = computed(() => masteryCrest(props.level))
</script>

<template>
  <span
    class="ms-crest"
    :style="{ width: `${size}px`, height: `${size}px` }"
    :title="`Mastery level ${level}`"
  >
    <img
      v-if="!failed"
      :src="src"
      alt=""
      :width="size"
      :height="size"
      loading="lazy"
      decoding="async"
      @error="failed = true"
    />
    <span v-else class="num">{{ level }}</span>
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

.ms-crest > span {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
}
</style>
