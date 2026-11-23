<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Icon from '../ui/Icon.vue'
import KillCard from './KillCard.vue'
import { champIcon, championName } from '../../lib/assets.js'
import { clipClock, gameClock } from '../../lib/clips.js'
import type { Clip, ClipComment, ClipEvent } from '../../lib/clip_types.js'

/**
 * The clip's video with its tray: the controls, then two lanes under one playhead running from
 * the scrubber down: Actions (what Riot's data says happened, each at its game time) and Comments
 * (the faces at the second they name), with the game clock under them. The action under the
 * playhead (or the one pointed at) opens its card: for a kill, the duel and its damage both ways.
 */
const props = defineProps<{ clip: Clip; comments: ClipComment[] }>()
const emit = defineEmits<{ time: [ms: number] }>()

const video = ref<HTMLVideoElement>()
const frame = ref<HTMLElement>()
const playing = ref(false)
const muted = ref(false)
/** Where the video is, ms from the clip's start. */
const now = ref(0)
const length = computed(() => props.clip.durationMs)

const at = (gameMs: number) =>
  Math.min(100, Math.max(0, ((gameMs - props.clip.startMs) / length.value) * 100))

function seek(ms: number) {
  const target = Math.min(length.value, Math.max(0, ms))
  if (video.value) video.value.currentTime = target / 1000
  now.value = target
  emit('time', target)
}

let raf = 0
function follow() {
  if (video.value) {
    now.value = video.value.currentTime * 1000
    emit('time', now.value)
  }
  if (playing.value) raf = requestAnimationFrame(follow)
}
function toggle() {
  const v = video.value
  if (!v) return
  if (v.paused) v.play().catch(() => {})
  else v.pause()
}
function onPlay() {
  playing.value = true
  raf = requestAnimationFrame(follow)
}
function onPause() {
  playing.value = false
  cancelAnimationFrame(raf)
  follow()
}
function toggleMute() {
  if (!video.value) return
  video.value.muted = !video.value.muted
  muted.value = video.value.muted
}
function fullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  else frame.value?.requestFullscreen().catch(() => {})
}
onMounted(() => (muted.value = video.value?.muted ?? false))
onBeforeUnmount(() => cancelAnimationFrame(raf))

/* ── The lanes ────────────────────────────────────────────────────── */

const WORD: Record<ClipEvent['kind'], string> = {
  kill: 'Kill',
  death: 'Death',
  assist: 'Assist',
  multikill: 'Multikill',
  objective: 'Objective',
  first_blood: 'First blood',
  ace: 'Ace',
}
const actions = computed(() =>
  props.clip.events
    .filter((e) => e.t >= props.clip.startMs && e.t <= props.clip.startMs + length.value)
    .map((e, i) => ({ ...e, key: `${e.kind}:${e.t}:${i}`, pos: at(e.t) }))
)
const notes = computed(() =>
  props.comments
    .filter((c) => c.atMs !== null)
    .map((c) => ({ ...c, pos: (c.atMs! / length.value) * 100 }))
)
const ticks = computed(() => {
  const out: { label: string; pos: number }[] = []
  const end = props.clip.startMs + length.value
  for (let t = Math.ceil(props.clip.startMs / 5000) * 5000; t <= end; t += 5000) {
    out.push({ label: clipClock(t), pos: at(t) })
  }
  return out
})
const playhead = computed(() => (now.value / length.value) * 100)

/** The action pointed at, else the last one the playhead passed, else the clip's first kill. */
const pointed = ref<string | null>(null)
const open = computed(() => {
  const list = actions.value
  if (pointed.value) return list.find((a) => a.key === pointed.value) ?? null
  const game = props.clip.startMs + now.value
  const passed = list.filter((a) => a.t <= game + 250)
  return passed.at(-1) ?? list.find((a) => a.kind === 'kill') ?? list[0] ?? null
})
const recap = computed(() => {
  const event = open.value
  if (!event) return null
  return props.clip.recap.find((r) => Math.abs(r.t - event.t) < 2000) ?? null
})
defineExpose({ seek })

const describe = (e: ClipEvent) =>
  `${WORD[e.kind]}${e.victim ? ` on ${championName(e.victim)}` : ''} at ${gameClock(e.t)}`
</script>

<template>
  <section class="card clp-stage" aria-label="The clip">
    <div ref="frame" class="clp-frame">
      <video
        ref="video"
        class="clp-video"
        :src="clip.video"
        :poster="clip.poster ?? undefined"
        preload="metadata"
        playsinline
        @play="onPlay"
        @pause="onPause"
        @ended="onPause"
        @click="toggle"
      ></video>
      <button
        v-if="!playing"
        type="button"
        class="clp-big"
        aria-label="Play the clip"
        @click="toggle"
      >
        <Icon name="triangle" :size="28" />
      </button>
      <span class="clp-over num" aria-hidden="true"
        >{{ clipClock(now) }} <span>/ {{ clipClock(length) }}</span></span
      >
    </div>

    <div class="clp-tray">
      <div class="clp-rows" :style="{ '--at': `${playhead}%` }">
        <div class="clp-row clp-bar">
          <span class="clp-l">
            <button
              type="button"
              class="btn sm ico"
              :aria-label="playing ? 'Pause' : 'Play'"
              @click="toggle"
            >
              <Icon :name="playing ? 'pause' : 'triangle'" :size="16" />
            </button>
            <span class="clp-time num"
              >{{ clipClock(now) }} <span>/ {{ clipClock(length) }}</span></span
            >
          </span>
          <input
            class="clp-scrub"
            type="range"
            min="0"
            :max="length"
            step="100"
            :value="now"
            aria-label="Seek in the clip"
            @input="seek(Number(($event.target as HTMLInputElement).value))"
          />
          <span class="clp-r">
            <button
              type="button"
              class="btn sm ico ghost"
              :aria-label="muted ? 'Sound on' : 'Sound off'"
              @click="toggleMute"
            >
              <Icon :name="muted ? 'mute' : 'sound'" :size="16" />
            </button>
            <button
              type="button"
              class="btn sm ico ghost clp-full"
              aria-label="Full screen"
              @click="fullscreen"
            >
              <Icon name="max" :size="16" />
            </button>
          </span>
        </div>
        <div class="clp-row">
          <span class="clp-l clp-lab"><Icon name="swords" :size="15" /><span>Actions</span></span>
          <div class="clp-track">
            <button
              v-for="a in actions"
              :key="a.key"
              type="button"
              class="clp-act"
              :class="{ on: open?.key === a.key }"
              :style="{ left: `${a.pos}%` }"
              :aria-label="`${describe(a)}: go to it`"
              @mouseenter="pointed = a.key"
              @mouseleave="pointed = null"
              @focus="pointed = a.key"
              @blur="pointed = null"
              @click="seek(a.t - clip.startMs)"
            >
              <img v-if="a.killer" :src="champIcon(a.killer)" alt="" />
              <Icon v-else :name="a.kind === 'objective' ? 'riotBaron' : 'swords'" :size="14" />
              <template v-if="a.victim">
                <Icon name="swords" :size="11" class="clp-x" />
                <img :src="champIcon(a.victim)" alt="" />
              </template>
              <span class="clp-at num">{{ gameClock(a.t) }}</span>
            </button>
          </div>
        </div>
        <div class="clp-row">
          <span class="clp-l clp-lab"
            ><Icon name="chat" :size="15" /><span>Comments</span
            ><span class="meta num">{{ clip.commentCount }}</span></span
          >
          <div class="clp-track">
            <button
              v-for="c in notes"
              :key="c.id"
              type="button"
              class="clp-note"
              :style="{ left: `${c.pos}%` }"
              :aria-label="`${c.author.name} at ${clipClock(c.atMs!)}: go to it`"
              :title="c.body"
              @click="seek(c.atMs!)"
            >
              <img v-if="c.championId" :src="champIcon(c.championId)" alt="" />
              <img v-else-if="c.author.avatarUrl" :src="c.author.avatarUrl" alt="" />
              <Icon v-else name="user" :size="14" />
            </button>
          </div>
        </div>
        <div class="clp-row clp-clock" aria-hidden="true">
          <span class="clp-l"></span>
          <div class="clp-track">
            <span v-for="t in ticks" :key="t.label" :style="{ left: `${t.pos}%` }">{{
              t.label
            }}</span>
          </div>
        </div>
        <div class="clp-rail" aria-hidden="true"><i class="clp-playhead"></i></div>
      </div>

      <KillCard v-if="open" :event="open" :recap="recap" :author="clip.championId" />
    </div>
  </section>
</template>
