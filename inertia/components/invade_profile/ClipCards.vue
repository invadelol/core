<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import Icon from '../ui/Icon.vue'
import { since } from '../../lib/ladders.js'
import { clipLength } from '../../lib/profile_view.js'
import type { ClipCard } from '../../lib/profile_types.js'

/**
 * Clips as covers: the pinned one big (`pinned`), the others three a row. Each cover opens the
 * clip's page; "Only me" and "Link only" clips say so on their cover (their owner alone sees them
 * on the profile).
 */
withDefaults(
  defineProps<{
    clips: ClipCard[]
    names: Record<number, string>
    pinned?: boolean
    /** The Clips tab: views, comments and GG under each title. */
    detailed?: boolean
  }>(),
  { pinned: false, detailed: false }
)

/** "2 hours ago": in the visitor's own time, once in the browser. */
const mounted = ref(false)
onMounted(() => (mounted.value = true))
const when = (iso: string) => (mounted.value ? since(Date.parse(iso)) : '')
const stats = (c: ClipCard) =>
  [
    `${c.views.toLocaleString('en-US')} ${c.views === 1 ? 'view' : 'views'}`,
    c.gg ? `${c.gg} GG` : null,
    c.comments ? `${c.comments} ${c.comments === 1 ? 'comment' : 'comments'}` : null,
  ]
    .filter(Boolean)
    .join(', ')
const line = (c: ClipCard, names: Record<number, string>) =>
  [c.moment, names[c.championId], when(c.postedAt)].filter(Boolean).join(', ')
</script>

<template>
  <template v-if="pinned">
    <Link v-for="c in clips" :key="c.id" :href="c.url" class="pf-pin">
      <span class="pf-pv">
        <img v-if="c.poster" :src="c.poster" alt="" />
        <span class="pf-play"><Icon name="play" :size="26" /></span>
        <span class="pf-dur num">{{ clipLength(c.durationMs) }}</span>
      </span>
      <span class="pf-pt-t">
        <b>{{ c.title }}</b>
        <span class="meta">{{ line(c, names) }}</span>
        <span class="meta t2">{{ stats(c) }}</span>
      </span>
    </Link>
  </template>
  <div v-else class="pf-ccs">
    <Link v-for="c in clips" :key="c.id" :href="c.url" class="pf-cc">
      <span class="pf-ccv">
        <img v-if="c.poster" :src="c.poster" alt="" loading="lazy" />
        <span v-if="c.visibility !== 'everyone'" class="pf-vis">
          <Icon :name="c.visibility === 'private' ? 'lock' : 'link'" :size="13" />
          <span class="skn-vh">{{ c.visibility === 'private' ? 'Only you' : 'Link only' }}</span>
        </span>
        <span class="pf-dur num">{{ clipLength(c.durationMs) }}</span>
      </span>
      <b class="ell">{{ c.title }}</b>
      <span class="meta ell">{{ line(c, names) }}</span>
      <span v-if="detailed" class="meta">{{
        c.visibility === 'private' ? 'Only you' : stats(c)
      }}</span>
    </Link>
  </div>
</template>
