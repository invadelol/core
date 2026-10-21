<script setup lang="ts">
import { onMounted, ref } from 'vue'

/** A team's logo from our own /cdn, or its short name when there is none. */
const props = withDefaults(
  defineProps<{ team: { id: string; name: string; shortName?: string | null }; size?: number }>(),
  { size: 32 }
)
const failed = ref(false)
const img = ref<HTMLImageElement | null>(null)
// A logo that failed before the page hydrated never fires the handler. The initials are this
// image's fallback, so the site-wide one (icon_fallback.ts) leaves it alone.
onMounted(() => {
  if (img.value?.complete && !img.value.naturalWidth) failed.value = true
})
const initials = () => (props.team.shortName || props.team.name).slice(0, 3).toUpperCase()
</script>

<template>
  <span
    class="cs-logo"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size / 3)}px` }"
    :title="team.name"
  >
    <img
      v-if="!failed"
      ref="img"
      data-fallback="applied"
      :src="`/cdn/team/${team.id}`"
      :alt="team.name"
      loading="lazy"
      @error="failed = true"
    />
    <template v-else>{{ initials() }}</template>
  </span>
</template>
