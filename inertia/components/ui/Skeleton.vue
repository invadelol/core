<script setup lang="ts">
/**
 * A placeholder while a block loads: flat bars on the surface, the shape of what is coming
 * (`rows` lines of a list, or one block of `height`). It breathes slowly; no shimmer sweep.
 */
withDefaults(defineProps<{ rows?: number; height?: number | string; pic?: boolean }>(), {
  rows: 0,
  height: 120,
  pic: false,
})
</script>

<template>
  <div class="skel-wrap" aria-busy="true" aria-label="Loading">
    <template v-if="rows">
      <div v-for="r in rows" :key="r" class="skel-row">
        <span v-if="pic" class="skel" style="width: 36px; height: 36px" />
        <span class="skel" :style="{ width: `${38 + ((r * 17) % 30)}%`, height: '12px' }" />
        <span class="skel" style="width: 56px; height: 12px; margin-left: auto" />
      </div>
    </template>
    <span
      v-else
      class="skel block"
      :style="{ height: typeof height === 'number' ? `${height}px` : height }"
    />
  </div>
</template>
