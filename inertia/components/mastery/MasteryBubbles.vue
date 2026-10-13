<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { champIcon, championName, championSplash } from '../../lib/assets.js'
import { compact, timeAgo } from '../../lib/format.js'
import { bubbleAt, packBubbles, type Bubble } from '../../lib/bubble_pack.js'
import type { ChampionMastery } from '../../lib/types.js'
import MasteryCrest from './MasteryCrest.vue'

/**
 * Every champion as a circle whose area is its mastery points: how much of the account each one
 * holds, at a glance. Hover (or tap) a circle for its figures; the list below carries the same
 * data for keyboards and screen readers.
 */
const props = defineProps<{ mastery: ChampionMastery[] }>()

/** Circles at least this wide carry their name; wider still, the splash instead of the icon. */
const LABEL_MIN = 92
const ART_MIN = 124
/** And wider again, their mastery crest beside the points. */
const CREST_MIN = 150

const root = ref<HTMLElement>()
const width = ref(0)
const active = shallowRef<Bubble | null>(null)
/** The entrance: circles wait out of view, then grow in, the biggest first. */
const stage = ref<'still' | 'wait' | 'play'>('still')

const entries = computed(() => new Map(props.mastery.map((m) => [m.championId, m])))
const total = computed(() => props.mastery.reduce((sum, m) => sum + m.championPoints, 0))

const layout = computed(() => {
  const w = width.value
  if (!w) return null
  const wide = w >= 480
  return packBubbles(
    props.mastery.map((m) => ({ id: m.championId, value: m.championPoints })),
    {
      width: w,
      aspect: w >= 720 ? 2.1 : wide ? 1.5 : 1.05,
      gap: wide ? 3 : 2,
      minRadius: wide ? 9 : 7,
    }
  )
})

const label = computed(() => {
  const top = props.mastery
    .slice(0, 8)
    .map((m) => `${championName(m.championId)} ${compact(m.championPoints)}`)
  return `Mastery points by champion, largest first: ${top.join(', ')}`
})

const tip = computed(() => {
  const bubble = active.value
  const entry = bubble && entries.value.get(bubble.id)
  if (!bubble || !entry || !layout.value) return null
  const tipWidth = 216
  const left = Math.min(Math.max(bubble.x - tipWidth / 2, 0), layout.value.width - tipWidth)
  const above = bubble.y - bubble.r > 76
  return {
    entry,
    share: total.value ? Math.round((entry.championPoints / total.value) * 1000) / 10 : 0,
    style: {
      left: `${left}px`,
      top: `${above ? bubble.y - bubble.r - 8 : bubble.y + bubble.r + 8}px`,
      transform: above ? 'translateY(-100%)' : undefined,
      width: `${tipWidth}px`,
    },
  }
})

function local(event: PointerEvent | MouseEvent) {
  const box = root.value!.getBoundingClientRect()
  return { x: event.clientX - box.left, y: event.clientY - box.top }
}

function onMove(event: PointerEvent) {
  if (event.pointerType !== 'mouse' || !layout.value) return
  const { x, y } = local(event)
  const found = bubbleAt(layout.value.bubbles, x, y, 2)
  if (found?.id !== active.value?.id) active.value = found
}

/** What pressed last: a click from a mouse is already a hover, a tap is not. */
let pointer = 'mouse'
function onDown(event: PointerEvent) {
  pointer = event.pointerType
}

function onLeave() {
  if (pointer === 'mouse') active.value = null
}

/** A tap shows a circle's figures (small ones are found within a finger's reach). */
function onTap(event: MouseEvent) {
  if (!layout.value || pointer === 'mouse') return
  const { x, y } = local(event)
  const found = bubbleAt(layout.value.bubbles, x, y, 14)
  active.value = found && found.id !== active.value?.id ? found : null
}

let observer: ResizeObserver | undefined
let viewer: IntersectionObserver | undefined
let frame = 0

onMounted(() => {
  const element = root.value!
  width.value = Math.floor(element.clientWidth)
  observer = new ResizeObserver(() => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      const next = Math.floor(element.clientWidth)
      if (next !== width.value) {
        active.value = null
        width.value = next
      }
    })
  })
  observer.observe(element)

  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (still || !('IntersectionObserver' in window)) return
  stage.value = 'wait'
  viewer = new IntersectionObserver(
    ([seen]) => {
      if (!seen.isIntersecting) return
      stage.value = 'play'
      viewer?.disconnect()
    },
    { threshold: 0.15 }
  )
  viewer.observe(element)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  viewer?.disconnect()
  cancelAnimationFrame(frame)
})
</script>

<template>
  <div
    ref="root"
    class="ms-map"
    :class="[`is-${stage}`, { 'is-focus': active }]"
    :style="{ height: layout ? `${Math.ceil(layout.height)}px` : '320px' }"
    role="img"
    :aria-label="label"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerleave="onLeave"
    @click="onTap"
  >
    <template v-if="layout">
      <div
        v-for="(bubble, index) in layout.bubbles"
        :key="bubble.id"
        class="ms-bubble"
        :class="{ 'is-on': active?.id === bubble.id }"
        :style="{
          'left': `${bubble.x - bubble.r}px`,
          'top': `${bubble.y - bubble.r}px`,
          'width': `${bubble.r * 2}px`,
          'height': `${bubble.r * 2}px`,
          '--delay': `${Math.min(index * 16, 640)}ms`,
        }"
      >
        <img
          :src="bubble.r * 2 >= ART_MIN ? championSplash(bubble.id) : champIcon(bubble.id)"
          :class="{ 'is-art': bubble.r * 2 >= ART_MIN }"
          alt=""
          decoding="async"
          :loading="index < 24 ? 'eager' : 'lazy'"
        />
        <span
          v-if="bubble.r * 2 >= LABEL_MIN"
          class="ms-label iv-dark"
          :style="{ fontSize: `${Math.min(13, 10 + bubble.r / 40)}px` }"
        >
          <span class="ms-label-name">{{ championName(bubble.id) }}</span>
          <span class="ms-label-points num">
            <MasteryCrest
              v-if="bubble.r * 2 >= CREST_MIN"
              :level="entries.get(bubble.id)?.championLevel ?? 0"
              :size="Math.round(Math.min(26, bubble.r / 6))"
            />
            {{ compact(bubble.value) }}
          </span>
        </span>
      </div>
    </template>

    <div v-if="tip" class="ms-tip" :style="tip.style" aria-hidden="true">
      <MasteryCrest :level="tip.entry.championLevel" :size="40" />
      <span class="min-w-0">
        <span class="ms-tip-name">{{ championName(tip.entry.championId) }}</span>
        <span class="ms-tip-line num">
          Level {{ tip.entry.championLevel }} <span class="ms-dot">·</span>
          {{ compact(tip.entry.championPoints) }} points
        </span>
        <span class="ms-tip-line num">
          {{ tip.share }}% of all points <span class="ms-dot">·</span>
          {{ timeAgo(tip.entry.lastPlayTime) }}
        </span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.ms-map {
  position: relative;
  width: 100%;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
}

.ms-bubble {
  position: absolute;
  overflow: hidden;
  border-radius: 50%;
  background: var(--well);
  box-shadow: var(--portrait-sm);
  transition: opacity var(--t-base) var(--ease);
}

.ms-bubble > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* Riot's square portraits carry a thin border: a slight crop drops it. */
  transform: scale(1.1);
}

.ms-bubble > img.is-art {
  object-position: 50% 26%;
  transform: none;
}

/* A hovered circle: the others step back, it keeps a neutral rim. */
.ms-map.is-focus .ms-bubble:not(.is-on) {
  opacity: 0.4;
}

.ms-bubble.is-on {
  box-shadow:
    0 0 0 1.5px var(--text-2),
    var(--contact);
}

/* Names on the biggest circles, over a shade of the night ink so they read on any art. */
.ms-label {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding: 0 14% 15%;
  line-height: 1.2;
  text-align: center;
  color: var(--text-1);
  background: linear-gradient(
    0deg,
    color-mix(in srgb, var(--ink-0) 82%, transparent),
    color-mix(in srgb, var(--ink-0) 0%, transparent) 52%
  );
  pointer-events: none;
}

.ms-label-name {
  max-width: 100%;
  overflow: hidden;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.ms-label-points {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 0.86em;
  font-weight: 500;
  color: var(--text-2);
}

/* Entrance: the circles grow in, biggest first, once the map is in view. */
.ms-map.is-wait .ms-bubble {
  opacity: 0;
}

.ms-map.is-play .ms-bubble {
  animation: ms-grow 620ms var(--ease-glide) var(--delay) both;
}

@keyframes ms-grow {
  from {
    opacity: 0;
    transform: scale(0.55);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ms-map.is-play .ms-bubble {
    animation: none;
  }
}

.ms-tip {
  position: absolute;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px 8px 8px;
  background: var(--solid-1);
  border: 1px solid var(--line-2);
  border-radius: var(--r-sm);
  box-shadow: var(--shadow-2);
  pointer-events: none;
  animation: ms-tip-in var(--t-fast) var(--ease) both;
}

@keyframes ms-tip-in {
  from {
    opacity: 0;
  }
}

.ms-tip-name {
  display: block;
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  line-height: 17px;
  color: var(--text-1);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.ms-tip-line {
  display: block;
  font-size: 12px;
  line-height: 16px;
  color: var(--text-2);
  white-space: nowrap;
}

.ms-tip-line + .ms-tip-line {
  color: var(--text-3);
}

.ms-dot {
  margin-inline: 3px;
  color: var(--text-4);
}
</style>
