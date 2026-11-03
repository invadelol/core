<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { leagueLogo, teamLogo } from '../../lib/board.js'
import '../../css/pro_media.css'

/**
 * A team's or a league's logo from our own /cdn, drawn at its size (a resized WebP), or its
 * short name when there is none.
 */
const props = withDefaults(
  defineProps<{
    /** A team without an id (not one of ours) shows its short name. */
    team?: { id: string | null; name: string; shortName?: string | null } | null
    league?: { slug: string; code: string; name?: string } | null
    size?: 16 | 20 | 24 | 32 | 40 | 56 | 72
    /** Lazy unless it is part of the first screen. */
    eager?: boolean
  }>(),
  { size: 20, eager: false }
)
const failed = ref(false)
const img = ref<HTMLImageElement | null>(null)
// A logo that failed before the page hydrated never fires the handler.
onMounted(() => {
  if (img.value?.complete && !img.value.naturalWidth) failed.value = true
})
const src = () =>
  props.team
    ? props.team.id
      ? teamLogo(props.team.id, props.size)
      : null
    : leagueLogo(props.league!.slug, props.size)
const label = () => props.team?.name ?? props.league?.code ?? ''
const initials = () =>
  (props.team ? props.team.shortName || props.team.name : (props.league?.code ?? ''))
    .slice(0, 4)
    .toUpperCase()
</script>

<template>
  <span class="lgo" :class="[`s${size}`, { team: !!team }]" :title="label()">
    <img
      v-if="!failed && (team || league) && src()"
      ref="img"
      data-fallback="applied"
      :src="src()"
      :alt="label()"
      :width="size"
      :height="size"
      :loading="eager ? 'eager' : 'lazy'"
      decoding="async"
      @error="failed = true"
    />
    <template v-else>{{ initials() }}</template>
  </span>
</template>
