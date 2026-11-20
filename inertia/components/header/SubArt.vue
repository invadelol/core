<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { emblemBackground } from '../../lib/facet.js'
import { loadSiteNav, siteNav } from '../../lib/site_nav.js'
import type { SubPicture } from './sub_art.js'

/**
 * A sub-row link's picture (`.sri`, 22 px): grey until its link is hovered or current, which the
 * header's CSS decides. A team logo waits for the menus' data to name the team's id, asked for
 * once the browser is idle; until then its well stays empty.
 */
const props = defineProps<{ art: SubPicture }>()

const src = computed(() => {
  const a = props.art
  if (a.kind === 'square' || a.kind === 'logo' || a.kind === 'round') return a.src
  if (a.kind === 'pro') return `/cdn/pro/${a.slug}?s=48`
  if (a.kind === 'team') {
    const id = siteNav.value?.art?.teams?.[a.slug]
    return id ? `/cdn/team/${id}?s=48` : null
  }
  return null
})
const crest = computed(() =>
  props.art.kind === 'emblem' ? emblemBackground(props.art.tier, 22, 1) : null
)

onMounted(() => {
  if (props.art.kind !== 'team' || siteNav.value) return
  const idle = (window as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback
  if (idle) idle(() => loadSiteNav())
  else setTimeout(loadSiteNav, 1200)
})

/** A picture the server cannot serve leaves its well empty rather than a broken image. */
const gone = (event: Event) => ((event.target as HTMLImageElement).style.visibility = 'hidden')
</script>

<template>
  <span v-if="art.kind === 'duo'" class="sri duo" aria-hidden="true"
    ><img
      v-for="id in art.ids"
      :key="id"
      :src="`/cdn/champion/${id}.png`"
      alt=""
      width="22"
      height="22"
      decoding="async"
      @error="gone"
  /></span>
  <span v-else-if="crest" class="sri ct em" :style="{ background: crest }" aria-hidden="true" />
  <span
    v-else
    class="sri"
    :class="{
      ct: art.kind === 'logo' || art.kind === 'team',
      o: art.kind === 'pro' || art.kind === 'round',
      rd: art.kind === 'round',
    }"
    aria-hidden="true"
    ><img v-if="src" :src="src" alt="" width="22" height="22" decoding="async" @error="gone"
  /></span>
</template>
