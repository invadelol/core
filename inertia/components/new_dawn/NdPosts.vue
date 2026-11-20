<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import Icon from '../ui/Icon.vue'
import Segmented from '../ui/Segmented.vue'
import NdPostPic from './NdPostPic.vue'
import { DISCORD_URL } from '../../lib/links.js'
import {
  FACES,
  KIND_LABEL,
  NEW_DAWN,
  POSTS,
  POST_FILTERS,
  PUBLIC_COUNTS_READ,
  SPEAKERS,
  ndImage,
  type Post,
  type PostKind,
} from '../../lib/new_dawn.js'
import type { IconName } from '../../lib/icons.js'

/**
 * The hub's Riot posts: what is next, who speaks and how many watched, then every post and video
 * Riot published about New Dawn, newest first, by month: its picture, when, what it said, who
 * said it and its public number, with the link. A type filter narrows the list in place.
 */
const KIND_ICON: Record<PostKind, IconName> = {
  video: 'youtube',
  article: 'page',
  x: 'x',
  reddit: 'reddit',
  page: 'page',
}

const n = (x: number) => x.toLocaleString('en-US')

const people = SPEAKERS.map((s) => ({
  ...s,
  count: POSTS.filter((p) => p.speakers.includes(s.key)).length,
}))
const videos = POSTS.filter((p) => p.kind === 'video' && p.count)
  .map((p) => ({ name: p.short ?? p.title, views: p.count!.value }))
  .sort((a, b) => b.views - a.views)
const most = videos[0]?.views ?? 1

const filter = ref<(typeof POST_FILTERS)[number]['key']>('all')
const options = POST_FILTERS.map((f) => ({
  value: f.key,
  label: f.label,
  note: String(POSTS.filter((p) => (f.kinds as readonly PostKind[]).includes(p.kind)).length),
}))
/** The list by month, newest first, as the filter leaves it. */
const months = computed(() => {
  const kinds = POST_FILTERS.find((f) => f.key === filter.value)!.kinds as readonly PostKind[]
  const out: { month: string; posts: Post[] }[] = []
  for (const p of POSTS) {
    if (!kinds.includes(p.kind)) continue
    const last = out.at(-1)
    if (last?.month === p.month) last.posts.push(p)
    else out.push({ month: p.month, posts: [p] })
  }
  return out
})
</script>

<template>
  <div class="nw-trk">
    <div class="nw-band">
      <section class="card lit-sheet nw-next" aria-label="Next from Riot">
        <span class="nw-zz"
          ><img :src="ndImage('poro-snoozy')" alt="" width="104" height="104"
        /></span>
        <div>
          <span class="lab">Next from Riot</span><b>{{ NEW_DAWN.next.title }}</b>
          <p>{{ NEW_DAWN.next.lineShort }}</p>
          <a
            class="btn sm"
            :href="DISCORD_URL"
            target="_blank"
            rel="noreferrer"
            data-track="newdawn_ping"
            ><Icon name="bell" :size="15" />Ping me on Discord</a
          >
        </div>
      </section>
      <section class="card nw-sc" aria-label="Who speaks">
        <div class="nw-ch">
          <Icon name="users" :size="16" /><b>Who speaks</b
          ><span class="meta">Posts and videos</span>
        </div>
        <div v-for="p in people" :key="p.key" class="nw-pp">
          <img v-if="p.face" :src="FACES[p.face]" alt="" width="36" height="36" loading="lazy" />
          <span v-else class="nw-ico"><Icon name="page" :size="17" /></span>
          <span
            ><b>{{ p.name }}</b
            ><span class="meta">{{ p.role }}</span></span
          >
          <span class="num">{{ p.count }}</span>
        </div>
      </section>
      <section class="card nw-sc" aria-label="Views on YouTube">
        <div class="nw-ch">
          <Icon name="film" :size="16" /><b>Views on YouTube</b
          ><span class="meta">{{ PUBLIC_COUNTS_READ.label }}</span>
        </div>
        <div v-for="v in videos" :key="v.name" class="nw-vw">
          <div class="nw-vt">
            <span>{{ v.name }}</span
            ><b class="num">{{ n(v.views) }}</b>
          </div>
          <span class="nw-bar"
            ><i :style="{ width: `${((v.views / most) * 100).toFixed(1)}%` }"
          /></span>
        </div>
      </section>
    </div>

    <div class="nw-fbar">
      <Segmented v-model="filter" :options="options" label="Type" />
      <span class="meta"
        >Riot's own channels only, newest first. Leaks and press reports are in
        <Link href="/new-dawn/rumours" prefetch>Rumours</Link>.</span
      >
    </div>

    <div class="nw-list">
      <template v-for="m in months" :key="m.month">
        <div class="nw-mo">
          <h2 class="h3">{{ m.month }}</h2>
          <span class="meta num"
            >{{ m.posts.length }} {{ m.posts.length === 1 ? 'post' : 'posts' }}</span
          >
        </div>
        <article v-for="p in m.posts" :key="p.id" class="nw-p" :class="{ lead: p.lead }">
          <NdPostPic :post="p" />
          <div class="nw-body">
            <span class="nw-ty2"
              ><Icon :name="KIND_ICON[p.kind]" :size="15" />{{ KIND_LABEL[p.kind]
              }}<span>{{ p.when }}</span></span
            >
            <h3>{{ p.title }}</h3>
            <p class="nw-said">{{ p.said }}</p>
            <div v-if="p.chapters" class="nw-chap">
              <a
                v-for="c in p.chapters"
                :key="c.second"
                :class="{ on: c.on }"
                :href="`${p.link.href}&t=${c.second}s`"
                target="_blank"
                rel="noreferrer"
                ><span class="num">{{ c.time }}</span
                >{{ c.label }}</a
              >
            </div>
            <span class="nw-by2"
              ><img
                v-if="p.by.face"
                :src="FACES[p.by.face]"
                alt=""
                width="22"
                height="22"
                loading="lazy"
              />{{ p.by.name }}</span
            >
          </div>
          <div class="nw-fig">
            <template v-if="p.count"
              ><b class="num">{{ n(p.count.value) }}</b
              ><span class="meta">{{ p.count.unit }}</span></template
            >
            <a class="nw-ext" :href="p.link.href" target="_blank" rel="noreferrer"
              >{{ p.link.label }}<Icon name="external" :size="13"
            /></a>
          </div>
        </article>
      </template>
    </div>
  </div>
</template>
