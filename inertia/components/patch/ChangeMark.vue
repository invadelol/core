<script setup lang="ts">
import Icon from '../ui/Icon.vue'
import type { ChangeKind } from '../../lib/patch_notes.js'

/** A change's kind: the round badge on a picture, or the labelled pill beside a name. */
defineProps<{ kind: ChangeKind; pill?: boolean }>()
const WORD = { up: 'Buff', down: 'Nerf', mix: 'Adjusted', new: 'New' } as const
const ICON = { up: 'arrow', down: 'arrow', mix: 'compare', new: 'plus' } as const
</script>

<template>
  <span v-if="pill" class="pn-k" :class="kind"
    ><Icon :name="ICON[kind]" :size="12" />{{ WORD[kind] }}</span
  >
  <span v-else class="pn-b" :class="kind" :title="WORD[kind]"
    ><Icon :name="ICON[kind]" :size="12"
  /></span>
</template>
