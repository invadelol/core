<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { leagueLogo, teamLogo } from '../../lib/board.js'
import '../../css/pro_pics.css'

defineOptions({ inheritAttrs: false })

/**
 * A team's or a league's logo from our own /cdn, drawn for the page's ground. The server keeps a
 * copy per ground (a black logo is redrawn light for the dark theme, a white one dark for the
 * light theme: `/cdn/team/:id?on=light`), so this draws both, lazy, and the theme hides one
 * (`pro_pics.css`): a hidden lazy image is never fetched, so a visitor loads one copy. Classes and
 * styles given to it land on both images, so a page styles it as a plain `<img>`.
 */
const props = withDefaults(
  defineProps<{
    /** A team's id (a team without one draws nothing). */
    team?: string | null
    /** A league's slug. */
    league?: string | null
    /** The drawn size in CSS px: the nearest served size at or above it is loaded. */
    size?: number
    alt?: string
    /** A ground that does not follow the theme (a picture always on dark ink). */
    ground?: 'dark' | 'light' | null
  }>(),
  { team: null, league: null, size: 32, alt: '', ground: null }
)

/** `LOGO_SIZES` of app/services/team_logo_service.ts. */
const SIZES = [16, 20, 24, 32, 40, 56, 72, 96]

const url = (on: 'dark' | 'light') => {
  const s = SIZES.find((x) => x >= props.size) ?? SIZES[SIZES.length - 1]
  if (props.team) return teamLogo(props.team, s, on)
  if (props.league) return leagueLogo(props.league, s, on)
  return null
}
const grounds = computed(() => (props.ground ? [props.ground] : (['dark', 'light'] as const)))
const failed = ref(false)
/** The team or league has no logo: a host can put its own stand-in. */
const emit = defineEmits<{ missing: [] }>()
watch(failed, (gone) => gone && emit('missing'))
const imgs = ref<HTMLImageElement[]>([])
// A logo that failed before the page hydrated never fires the handler.
onMounted(() => {
  if (imgs.value.some((img) => img.complete && img.currentSrc && !img.naturalWidth)) {
    failed.value = true
  }
})
</script>

<template>
  <template v-if="team || league">
    <img
      v-for="on in grounds"
      :key="on"
      ref="imgs"
      v-bind="$attrs"
      :class="[ground ? null : `lg-${on}`, { 'lg-x': failed }]"
      :src="url(on)!"
      :alt="alt"
      :width="size"
      :height="size"
      loading="lazy"
      decoding="async"
      data-fallback="applied"
      @error="failed = true"
    />
  </template>
</template>
