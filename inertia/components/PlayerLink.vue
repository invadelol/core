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
    class="plink"
    :class="{ wrap, link: linkable, b: isSelf || bold }"
  >
    <span class="plink-n">{{ gameName || 'Unknown player' }}</span>
    <span v-if="showTag && tagLine" class="plink-t">#{{ tagLine }}</span>
  </component>
</template>

<style scoped>
.plink {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  font-weight: 600;
  color: var(--t1);
}
.plink.b {
  font-weight: 700;
}
.plink.link:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}
.plink-n {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.plink.wrap {
  flex-wrap: wrap;
}
.plink.wrap .plink-n {
  overflow-wrap: anywhere;
  white-space: normal;
}
.plink-t {
  flex: none;
  font-size: 0.9em;
  font-weight: 500;
  color: var(--t3);
}
</style>
