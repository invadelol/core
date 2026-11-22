<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Head, Link, router } from '@inertiajs/vue3'
import { queueName } from '@invadelol/ui/logic'
import SiteLayout from '../../components/SiteLayout.vue'
import CardHead from '../../components/ui/CardHead.vue'
import Frame from '../../components/ui/Frame.vue'
import Glyph from '../../components/ui/Glyph.vue'
import Icon from '../../components/ui/Icon.vue'
import ClipRow from '../../components/clips/ClipRow.vue'
import { champIcon, championName, profileIcon } from '../../lib/assets.js'
import { profilePath } from '../../lib/format.js'
import { since } from '../../lib/ladders.js'
import { EVENT_WORD, clipClock } from '../../lib/clips.js'
import type { Clip } from '../../lib/clip_types.js'
import '../../css/clips.css'

/**
 * /clip/:id: the video first, then the match it is from (both fives, the result, the whole game's
 * clock with this clip and the game's other clips on it); beside it, the game's other clips and
 * where clips come from. Its owner can delete it here.
 */
interface Seat {
  championId: number
  puuid: string
  gameName: string
  tagLine: string
  kills: number
}
const props = defineProps<{
  clip: Clip
  match: {
    matchId: string
    queueId: number
    gameStartMs: number
    duration: number
    blueWon: boolean
    blue: Seat[]
    red: Seat[]
    score: number[]
  } | null
  others: Clip[]
}>()

const c = computed(() => props.clip)
const who = computed(() => c.value.player)
const champion = computed(() => championName(c.value.championId))
const side = computed(() => {
  if (!props.match) return null
  return props.match.blue.some((p) => p.puuid === who.value.puuid) ? 'Blue side' : 'Red side'
})
const line = computed(
  () =>
    `${EVENT_WORD[c.value.event]} at ${clipClock(c.value.gameTime)} in the game, ${Math.round(c.value.durationMs / 1000)} seconds`
)
const matchHref = computed(() =>
  who.value.gameName
    ? `${profilePath(who.value.gameName, who.value.tagLine)}/match/${encodeURIComponent(c.value.matchId)}`
    : null
)
/** Dates in the visitor's own time zone and "posted 2 hours ago": drawn once the page is in the browser. */
const mounted = ref(false)
onMounted(() => (mounted.value = true))
const posted = computed(() =>
  mounted.value ? `, posted ${since(Date.parse(c.value.createdAt))}` : ''
)
const views = computed(
  () => `${c.value.views.toLocaleString('en-US')} ${c.value.views === 1 ? 'view' : 'views'}`
)
const when = computed(() => {
  if (!props.match) return ''
  if (!mounted.value) return queueName(props.match.queueId)
  const d = new Date(props.match.gameStartMs)
  const day = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${queueName(props.match.queueId)}, ${day}, ${time}`
})

/** The game's clock: a tick every ten minutes, this clip and the game's others where they start. */
const clock = computed(() => {
  const length = props.match?.duration ?? 0
  if (!length) return null
  const at = (s: number) => Math.min(100, Math.max(0, (s / length) * 100))
  const ticks = []
  for (let m = 10; m * 60 < length; m += 10) ticks.push({ m, x: at(m * 60) })
  return {
    ticks,
    marks: [
      {
        id: c.value.id,
        x: at(c.value.gameTime),
        label: 'This clip',
        time: clipClock(c.value.gameTime),
        on: true,
      },
      ...props.others.map((o) => ({
        id: o.id,
        x: at(o.gameTime),
        label: EVENT_WORD[o.event],
        time: clipClock(o.gameTime),
        on: false,
      })),
    ],
  }
})

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
async function share() {
  try {
    await navigator.clipboard.writeText(c.value.url)
    copied.value = true
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (copied.value = false), 1800)
  } catch {
    /* The address is in the bar to copy by hand. */
  }
}
onBeforeUnmount(() => clearTimeout(copiedTimer))

const asking = ref(false)
const busy = ref(false)
const error = ref('')
async function remove() {
  busy.value = true
  error.value = ''
  try {
    const response = await fetch(`/api/clips/${c.value.id}`, { method: 'DELETE' })
    if (!response.ok) throw new Error()
    router.visit(who.value.gameName ? profilePath(who.value.gameName, who.value.tagLine) : '/')
  } catch {
    error.value = 'The clip could not be deleted. Try again.'
    busy.value = false
  }
}
</script>

<template>
  <Head :title="c.title" />
  <SiteLayout>
    <div class="wrap cl-page">
      <nav class="crumbs cl-crumbs" aria-label="Breadcrumb">
        <Link v-if="who.gameName" :href="profilePath(who.gameName, who.tagLine)">{{
          who.gameName
        }}</Link
        ><Icon v-if="who.gameName" name="chevr" /><span class="t2 ell" aria-current="page">{{
          c.title
        }}</span>
      </nav>

      <div class="cl-grid">
        <div class="cl-main">
          <div class="cl-video" :style="{ aspectRatio: `${c.width ?? 16} / ${c.height ?? 9}` }">
            <video
              :src="c.video"
              :poster="c.poster ?? undefined"
              controls
              playsinline
              preload="metadata"
            />
          </div>

          <h1 class="cl-title">{{ c.title }}</h1>
          <p class="meta">{{ line }}</p>

          <div class="cl-by">
            <img :src="profileIcon(who.profileIconId)" alt="" width="40" height="40" />
            <span class="cl-who">
              <Link v-if="who.gameName" :href="profilePath(who.gameName, who.tagLine)" class="ell"
                ><b>{{ who.gameName }}</b
                ><small>#{{ who.tagLine }}</small></Link
              >
              <span class="ell"
                >{{ champion }}<template v-if="side">, {{ side }}</template
                >{{ posted }}, recorded with Invade</span
              >
            </span>
            <span class="cl-acts">
              <span class="meta num">{{ views }}</span>
              <button type="button" class="btn sm" @click="share">
                <Icon :name="copied ? 'check' : 'share'" />{{ copied ? 'Link copied' : 'Share' }}
              </button>
              <template v-if="c.mine">
                <button v-if="!asking" type="button" class="btn sm ghost" @click="asking = true">
                  Delete
                </button>
                <template v-else>
                  <button type="button" class="btn sm cl-danger" :disabled="busy" @click="remove">
                    Delete the clip
                  </button>
                  <button type="button" class="btn sm ghost" @click="asking = false">Cancel</button>
                </template>
              </template>
            </span>
          </div>
          <p v-if="error" class="cl-err" role="alert">{{ error }}</p>

          <section v-if="match" class="card cl-match">
            <CardHead title="The match" icon="swords" :meta="when">
              <Link v-if="matchHref" class="btn sm" :href="matchHref" prefetch
                >Open the match<Icon name="chevr"
              /></Link>
            </CardHead>
            <div class="mx2-sc cl-sc">
              <div class="side3">
                <div class="cs2">
                  <Frame
                    v-for="p in match.blue"
                    :key="p.puuid"
                    :src="champIcon(p.championId)"
                    size="s"
                    :alt="championName(p.championId)"
                    :class="{ me: p.puuid === who.puuid }"
                  />
                </div>
              </div>
              <div class="mx2-mid">
                <span class="fg-xl num">{{ match.score[0] }} - {{ match.score[1] }}</span>
                <span class="meta cl-res"
                  >{{ match.blueWon ? 'Blue' : 'Red' }} side won in
                  {{ clipClock(match.duration) }}</span
                >
              </div>
              <div class="side3 r">
                <div class="cs2">
                  <Frame
                    v-for="p in match.red"
                    :key="p.puuid"
                    :src="champIcon(p.championId)"
                    size="s"
                    :alt="championName(p.championId)"
                    :class="{ me: p.puuid === who.puuid }"
                  />
                </div>
              </div>
            </div>
            <div v-if="clock" class="cl-clock" aria-label="Clips in the game">
              <div class="cl-line">
                <Link
                  v-for="m in clock.marks"
                  :key="m.id"
                  :href="`/clip/${m.id}`"
                  class="cl-mark"
                  :class="{ on: m.on }"
                  :style="{ left: `${m.x}%` }"
                  :aria-current="m.on ? 'page' : undefined"
                  :title="`${m.label} ${m.time}`"
                  ><span class="cl-mark-l"
                    >{{ m.label }} <span class="num">{{ m.time }}</span></span
                  ><Icon name="film" :size="12"
                /></Link>
              </div>
              <div class="cl-ticks meta num">
                <span>0</span>
                <span v-for="t in clock.ticks" :key="t.m" :style="{ left: `${t.x}%` }"
                  >{{ t.m }} min</span
                >
              </div>
            </div>
          </section>
        </div>

        <aside class="cl-side">
          <section v-if="others.length" class="card">
            <CardHead title="More from this game" icon="film" :meta="String(others.length)" />
            <div class="cl-list">
              <ClipRow v-for="o in others" :key="o.id" :clip="o" />
            </div>
          </section>
          <section class="card cl-app">
            <Glyph :h="22" />
            <span class="cl-app-t">
              <b>Recorded with Invade</b>
              <span>Clips your games by itself, free for Windows and macOS</span>
            </span>
            <Link class="btn sm" href="/app" prefetch data-track="clip_get_app">Get the app</Link>
          </section>
        </aside>
      </div>
    </div>
  </SiteLayout>
</template>
