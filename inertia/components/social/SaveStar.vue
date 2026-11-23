<script setup lang="ts">
import { computed } from 'vue'
import Icon from '../ui/Icon.vue'
import { useSaved } from '../../lib/account.js'
import type { SavedKind } from '../../lib/account_types.js'

/**
 * The star that keeps a clip or a match in the visitor's Favorites (synced with the app): a ghost
 * icon button, gold once kept. A visitor is sent to sign in first. `puuid`: whose game a match
 * is, so Favorites draws it from that side.
 */
const props = defineProps<{
  kind: SavedKind
  id: string
  puuid?: string
  /** What it keeps, for the screen reader: "this clip". */
  label: string
}>()

const { isSaved, toggleSaved } = useSaved()
const saved = computed(() => isSaved(props.kind, props.id))

function toggle() {
  toggleSaved(props.kind, props.id, props.puuid).catch(() => {})
}
</script>

<template>
  <button
    type="button"
    class="btn ico sv-star"
    :class="{ on: saved }"
    :aria-pressed="saved"
    :aria-label="saved ? `Remove ${label} from Favorites` : `Add ${label} to Favorites`"
    :title="saved ? 'In your Favorites' : 'Add to Favorites'"
    data-track="save"
    @click="toggle"
  >
    <Icon name="star" :size="16" />
  </button>
</template>

<style scoped>
.sv-star {
  color: var(--t2);
}
.sv-star:hover {
  color: var(--t1);
}
.sv-star.on {
  color: var(--gold);
}
.sv-star.on :deep(svg) {
  fill: currentColor;
}
</style>
