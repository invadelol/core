<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Icon from '../ui/Icon.vue'
import { TEASER, clock, ndImage } from '../../lib/new_dawn.js'
import {
  currentOf,
  embedSrc,
  listen,
  onPlayerMessage,
  playAt,
  playInView,
  teaser,
} from './teaser.js'

/**
 * The teaser on the page: Riot's dawn still with a play button until a visitor asks for it, then
 * YouTube's privacy-enhanced player in its place. Beside it, the teaser's moments by the second
 * (the cast has its own row under it): each one plays the teaser from there, the one playing lit.
 */
const frame = ref<HTMLIFrameElement | null>(null)
const vid = ref<HTMLElement>()
const origin = ref('')
onMounted(() => {
  origin.value = window.location.origin
  window.addEventListener('message', onPlayerMessage)
})
onBeforeUnmount(() => {
  window.removeEventListener('message', onPlayerMessage)
  teaser.frame = null
  teaser.on = false
  teaser.time = null
  teaser.asked = null
})

const src = computed(() => embedSrc(teaser.start, origin.value))
const seconds = TEASER.moments.map((m) => m.second)
/** The moment playing ("Seven champions" holds while the cast runs). */
const now = computed(() => currentOf(seconds))
const loaded = () => frame.value && listen(frame.value)
</script>

<template>
  <div class="nw-pl">
    <div ref="vid" class="fr nw-vid">
      <iframe
        v-if="teaser.on && origin"
        ref="frame"
        :src="src"
        title="League of Legends: New Dawn teaser"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        referrerpolicy="strict-origin-when-cross-origin"
        @load="loaded"
      />
      <button
        v-else
        type="button"
        class="nw-poster"
        aria-label="Play the New Dawn teaser, 2 minutes 1 second"
        @click="playAt(0)"
      >
        <img
          :src="ndImage('dawn-1280')"
          :srcset="`${ndImage('dawn-1280')} 1280w, ${ndImage('dawn-1920')} 1920w`"
          sizes="(max-width: 1199px) 100vw, 860px"
          alt=""
          width="1280"
          height="533"
          loading="lazy"
        />
        <span class="nw-pb"><Icon name="triangle" :size="26" /></span>
        <span class="nw-pt"
          ><b>New Dawn teaser</b><span class="num">{{ TEASER.length }}</span></span
        >
      </button>
    </div>
    <ol class="nw-mom" aria-label="In the teaser, by the second">
      <li v-for="m in TEASER.moments" :key="m.second">
        <button
          type="button"
          :class="{ on: now === m.second }"
          :aria-current="now === m.second ? 'true' : undefined"
          @click="playInView(m.second, vid)"
        >
          <span class="t num">{{ clock(m.second) }}</span
          ><span class="l"
            ><span v-if="m.who" class="who">{{ m.who }}</span
            >{{ m.label }}</span
          >
        </button>
      </li>
    </ol>
  </div>
</template>
