<script setup lang="ts">
import { onMounted, shallowRef } from 'vue'
import CardHead from '../ui/CardHead.vue'
import ClipRow from './ClipRow.vue'
import { fetchClips } from '../../lib/clips.js'
import type { Clip } from '../../lib/clip_types.js'
import '../../css/clips.css'

/**
 * The match page's Clips card, at the top of its right column: the clips players of the game
 * posted, in game order. Nothing at all when there is none.
 */
const props = defineProps<{ matchId: string }>()
const clips = shallowRef<Clip[]>([])
onMounted(async () => {
  clips.value = await fetchClips({ match: props.matchId })
})
</script>

<template>
  <div v-if="clips.length" class="card">
    <CardHead title="Clips" icon="film" :meta="String(clips.length)" />
    <div class="cl-list">
      <ClipRow v-for="c in clips" :key="c.id" :clip="c" />
    </div>
  </div>
</template>
