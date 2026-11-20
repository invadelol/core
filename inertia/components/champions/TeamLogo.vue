<script setup lang="ts">
import { ref } from 'vue'
import Logo from '../pros/Logo.vue'

/**
 * A team's logo from our own /cdn (the copy for the theme's ground), or its short name when there
 * is none.
 */
const props = withDefaults(
  defineProps<{ team: { id: string; name: string; shortName?: string | null }; size?: number }>(),
  { size: 32 }
)
const failed = ref(false)
const initials = () => (props.team.shortName || props.team.name).slice(0, 3).toUpperCase()
</script>

<template>
  <span
    class="cs-logo"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size / 3)}px` }"
    :title="team.name"
  >
    <Logo v-if="!failed" :team="team.id" :size="size" :alt="team.name" @missing="failed = true" />
    <template v-else>{{ initials() }}</template>
  </span>
</template>

<style>
/* A team's logo, sized by the component, on every page the search reaches. */
.cs-logo {
  display: inline-grid;
  place-items: center;
  flex: none;
  overflow: hidden;
  border-radius: 5px;
  background: var(--s2);
  font-weight: 700;
  color: var(--t2);
}
.cs-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
