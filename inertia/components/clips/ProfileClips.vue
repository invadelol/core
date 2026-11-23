<script setup lang="ts">
import { onMounted, shallowRef, watch } from 'vue'
import { Link } from '@inertiajs/vue3'
import CardHead from '../ui/CardHead.vue'
import { championName, championSplash } from '../../lib/assets.js'
import { clipClock, fetchClips } from '../../lib/clips.js'
import type { Clip } from '../../lib/clip_types.js'
import '../../css/clips.css'

/**
 * A profile's clips, between Performance and the match history: the player's newest public clips
 * as pictures. Nothing at all when there is none.
 */
const props = defineProps<{ puuid: string }>()
const clips = shallowRef<Clip[]>([])
async function load() {
  clips.value = props.puuid ? await fetchClips({ puuid: props.puuid }) : []
}
onMounted(load)
watch(() => props.puuid, load)
</script>

<template>
  <section v-if="clips.length" class="card pl-clips">
    <CardHead title="Clips" icon="film" :meta="String(clips.length)" />
    <div class="cl-strip">
      <Link v-for="c in clips" :key="c.id" class="cl-card" :href="`/clip/${c.id}`" prefetch>
        <span class="cl-thumb">
          <img
            :src="c.poster ?? championSplash(c.championId)"
            alt=""
            width="320"
            height="180"
            loading="lazy"
          />
          <b class="num">{{ clipClock(c.durationMs) }}</b>
        </span>
        <span class="cl-txt">
          <b class="ell">{{ c.title }}</b>
          <span class="ell num"
            >{{ championName(c.championId) }}, {{ c.moment ? `${c.moment},` : 'at' }}
            {{ clipClock(c.momentAt ?? c.startMs) }}</span
          >
        </span>
      </Link>
    </div>
  </section>
</template>
