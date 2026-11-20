<script setup lang="ts">
import Icon from '../ui/Icon.vue'
import { FACES, ndImage, type Post } from '../../lib/new_dawn.js'

/**
 * A Riot post's picture: its still (with the video's length, and a play mark on the big rows), or
 * the post itself drawn as a card when it is words only (a post on X, a Reddit comment). `small`
 * is the overview's list: the card shows the handle and the words alone.
 */
defineProps<{ post: Post; small?: boolean }>()
</script>

<template>
  <span class="nw-pic">
    <template v-if="post.pic"
      ><img
        :src="ndImage(post.pic)"
        alt=""
        loading="lazy"
        decoding="async"
        :style="post.pos ? { objectPosition: post.pos } : undefined"
      /><span v-if="post.kind === 'video' && !small" class="pl" aria-hidden="true"
        ><Icon name="triangle" :size="14" /></span
      ><span v-if="post.length" class="tc">{{ post.length }}</span></template
    >
    <span v-else-if="post.xpost" class="nw-xp"
      ><span class="nw-xw"
        ><img :src="FACES[post.xpost.face]" alt="" width="18" height="18" loading="lazy" /><template
          v-if="small"
          >{{ post.xpost.handle }}</template
        ><template v-else
          >{{ post.xpost.name }}<span class="nw-hd">{{ post.xpost.handle }}</span></template
        ></span
      ><q>{{ post.xpost.text }}</q
      ><span v-if="!small && post.xpost.likes" class="lk"
        ><Icon name="x" :size="11" />{{ post.xpost.likes }} likes</span
      ></span
    >
  </span>
</template>
