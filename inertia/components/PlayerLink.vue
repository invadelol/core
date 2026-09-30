<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import { profilePath } from '../lib/format.js'

const props = withDefaults(
  defineProps<{
    gameName: string
    tagLine: string
    /** Renders the tag after the name; off inside dense tables. */
    showTag?: boolean
    /** Marks the player whose profile is being viewed. */
    isSelf?: boolean
    bold?: boolean
    /** Lets a long name wrap onto a second line instead of being cut (the full Riot ID is always the tooltip). */
    wrap?: boolean
  }>(),
  { showTag: false, isSelf: false, bold: false, wrap: false }
)

/**
 * Riot omits the Riot ID for some participants (a partial ingest, a player
 * who has since been anonymised). Those cannot be linked anywhere, so they
 * render as plain text rather than a link to a 404.
 */
const linkable = computed(() => Boolean(props.gameName && props.tagLine))
const href = computed(() => profilePath(props.gameName, props.tagLine))
</script>

<template>
  <component
    :is="linkable ? Link : 'span'"
    v-bind="linkable ? { href } : {}"
    :title="gameName && tagLine ? `${gameName}#${tagLine}` : undefined"
    class="inline-flex min-w-0 items-baseline gap-1"
    :class="[
      wrap ? 'flex-wrap break-words' : 'truncate',
      linkable ? 'transition-colors hover:text-ink hover:underline underline-offset-2' : '',
      isSelf || bold ? 'font-semibold text-ink' : 'font-medium text-ink',
    ]"
  >
    <span :class="wrap ? 'break-words [overflow-wrap:anywhere]' : 'truncate'">{{
      gameName || 'Unknown player'
    }}</span>
    <span v-if="showTag && tagLine" class="shrink-0 text-[0.9em] font-normal text-ink-3">
      #{{ tagLine }}
    </span>
  </component>
</template>
