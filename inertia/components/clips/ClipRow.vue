<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { championName, championSplash } from '../../lib/assets.js'
import type { Clip } from '../../lib/clip_types.js'
import { clipClock } from '../../lib/clips.js'

/**
 * One clip in a list (the match page's Clips): its picture with its length, its title, who posted
 * it on which champion, and when in the game. The row is the link to its page.
 */
defineProps<{ clip: Clip }>()
</script>

<template>
  <Link class="cl-row" :href="`/clip/${clip.id}`" prefetch>
    <span class="cl-thumb">
      <img
        :src="clip.poster ?? championSplash(clip.championId)"
        alt=""
        width="128"
        height="72"
        loading="lazy"
      />
      <b class="num">{{ clipClock(clip.durationMs) }}</b>
    </span>
    <span class="cl-txt">
      <b class="ell">{{ clip.title }}</b>
      <span class="ell">{{ clip.author.name }}, {{ championName(clip.championId) }}</span>
      <span class="num"
        >{{ clip.moment ? `${clip.moment}, ` : ''
        }}{{ clipClock(clip.momentAt ?? clip.startMs) }} in the game</span
      >
    </span>
  </Link>
</template>
