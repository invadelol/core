<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import DownloadCta from '../DownloadCta.vue'
import Stage from '../Stage.vue'
import SceneDraft from './SceneDraft.vue'
import SceneGame from './SceneGame.vue'
import SceneDesk from './SceneDesk.vue'
import { CAMERA, CHAPTERS, STARTS, TOTAL, type Rect } from './chapters.js'
import { clamp, ease, inOut, inn, lerp, out, seg } from './motion.js'

/**
 * The story: one game, told by the product. A frame stays pinned while the section scrolls past
 * it; the scroll position is the story's clock (`s`, in screen heights from the top), and every
 * chapter reads its own progress from it. The stage draws a 1280 × 720 world once, at its real
 * size, and a camera (one transform) frames it: the whole screen with push-ins on desktop, tight
 * readable crops on a phone. With reduced motion the chapters are laid out one after the other,
 * each at its end state.
 */
defineProps<{ version: string | null }>()

const W = 1280
const H = 720
const HEADER = 56

const root = ref<HTMLElement>()
const frame = ref<HTMLElement>()
const stage = ref<HTMLElement>()

/** Where the story is, smoothed a little so a trackpad's steps read as one motion. */
const s = ref(0)
let target = 0
const box = shallowRef({ w: 0, h: 0 })
const phone = ref(false)
const still = ref(false)
const ready = ref(false)
const idle = ref(0)

const local = (i: number) => clamp((s.value - STARTS[i]) / CHAPTERS[i].len)
const pDraft = computed(() => local(1))
const pGame = computed(() => local(2))
const pTab = computed(() => local(3))
const pPlay = computed(() => local(4))
const pAfter = computed(() => local(5))
const pWeb = computed(() => local(6))

/* Which scene is on: draft → game (the game window comes up) → desk (the app, after the game). */
const toGame = computed(() => ease(s.value, STARTS[2] - 0.14, STARTS[2] + 0.06))
const toDesk = computed(() => ease(pPlay.value, 0.56, 0.68))
const scene = (show: number, enterK: number, leaveK: number) => ({
  opacity: show.toFixed(3),
  transform: `scale(${(lerp(1.03, 1, enterK) * lerp(1, 0.985, leaveK)).toFixed(4)})`,
  visibility: show > 0.001 ? ('visible' as const) : ('hidden' as const),
})
const draftStyle = computed(() => scene(1 - toGame.value, 1, toGame.value))
const gameStyle = computed(() =>
  scene(Math.min(toGame.value, 1 - toDesk.value), toGame.value, toDesk.value)
)
const deskStyle = computed(() => scene(toDesk.value, toDesk.value, 0))

/* The camera: the rect at `s`, eased between keys, fitted to the stage (always covering it). */
function rectAt(x: number): Rect {
  const key = phone.value ? 'm' : 'd'
  let i = CAMERA.findIndex((k) => k.s > x)
  if (i === -1) return CAMERA[CAMERA.length - 1][key]
  if (i === 0) return CAMERA[0][key]
  const a = CAMERA[i - 1]
  const b = CAMERA[i]
  const k = inOut(seg(x, a.s, b.s))
  return a[key].map((v, j) => lerp(v, b[key][j], k)) as Rect
}
/** Layers are promoted only while the camera zooms, so it is smooth then and crisp at rest. */
const zooming = ref(false)
let lastZ = 0
let zoomTimer: ReturnType<typeof setTimeout> | undefined
function noteZoom(z: number) {
  if (Math.abs(z - lastZ) < 1e-4) return
  lastZ = z
  zooming.value = true
  clearTimeout(zoomTimer)
  zoomTimer = setTimeout(() => (zooming.value = false), 180)
}
const camera = computed(() => {
  const { w, h } = box.value
  if (!w) return { transform: 'scale(0)' }
  const [rx, ry, rw, rh] = rectAt(s.value)
  const cover = Math.max(w / W, h / H)
  const z = Math.max(cover, Math.min(w / rw, h / rh))
  const cx = rx + rw / 2
  const cy = ry + rh / 2
  const tx = clamp(w / 2 - cx * z, w - W * z, 0)
  const ty = clamp(h / 2 - cy * z, h - H * z, 0)
  noteZoom(z)
  return {
    transform: `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${z.toFixed(4)})`,
  }
})

/* The copy: the hero, then each chapter's caption, crossing as the chapters change. */
const heroK = computed(() => 1 - ease(s.value, 0.04, STARTS[1] - 0.06, inn))
const caption = (i: number) => {
  const start = STARTS[i]
  const end = start + CHAPTERS[i].len
  // One caption at a time: the last one is gone before the next one comes.
  const enter = ease(s.value, start - 0.02, start + 0.14)
  const leave = i === CHAPTERS.length - 1 ? 0 : ease(s.value, end - 0.16, end - 0.04, inn)
  return {
    opacity: Math.min(enter, 1 - leave).toFixed(3),
    transform: `translate3d(0, ${((1 - enter) * 16 - leave * 12).toFixed(2)}px, 0)`,
    visibility: enter > 0.001 && leave < 0.999 ? ('visible' as const) : ('hidden' as const),
  }
}
const current = computed(() => {
  let i = 0
  for (let j = 1; j < CHAPTERS.length; j++) if (s.value >= STARTS[j] - 0.06) i = j
  return i
})

function go(i: number) {
  if (!root.value || !frame.value) return
  const range = root.value.offsetHeight - frame.value.offsetHeight
  const top = root.value.getBoundingClientRect().top + scrollY - HEADER
  scrollTo({ top: top + ((STARTS[i] + 0.1) / TOTAL) * range, behavior: 'smooth' })
}

/* ── The clock: one passive scroll listener, one rAF that eases `s` to where the page is ── */
function measure() {
  if (!root.value || !frame.value) return
  const rect = root.value.getBoundingClientRect()
  const range = rect.height - frame.value.offsetHeight
  target = clamp((HEADER - rect.top) / range) * TOTAL
}

let raf = 0
let last = 0
function tick(now: number) {
  const dt = last ? Math.min(64, now - last) : 16
  last = now
  const d = target - s.value
  if (Math.abs(d) < 0.0004) {
    s.value = target
    raf = 0
    last = 0
    return
  }
  // A big jump (a link, a reload mid-page) is not played back: it lands.
  s.value = Math.abs(d) > 1.2 ? target : s.value + d * (1 - Math.exp(-dt / 70))
  raf = requestAnimationFrame(tick)
}
function onScroll() {
  measure()
  if (!raf) raf = requestAnimationFrame(tick)
}

/* The light that follows the pointer over the stage: one variable pair, no re-render. */
function onPointer(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement
  const r = el.getBoundingClientRect()
  el.style.setProperty('--mx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`)
  el.style.setProperty('--my', `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`)
}

/** Nothing on the stage takes the keyboard: it is a picture you can hover, not a control. */
function unfocus(el: HTMLElement | undefined) {
  el?.querySelectorAll<HTMLElement>('button, a, [tabindex]').forEach((n) => (n.tabIndex = -1))
}

let observer: ResizeObserver | undefined
let clock: ReturnType<typeof setInterval> | undefined
let media: MediaQueryList | undefined
const onMedia = () => (phone.value = !!media?.matches)

onMounted(() => {
  still.value = matchMedia('(prefers-reduced-motion: reduce)').matches
  media = matchMedia('(max-width: 1023px)')
  onMedia()
  media.addEventListener('change', onMedia)
  ready.value = true
  if (still.value) return
  observer = new ResizeObserver(([entry]) => {
    box.value = { w: entry.contentRect.width, h: entry.contentRect.height }
  })
  if (stage.value) observer.observe(stage.value)
  addEventListener('scroll', onScroll, { passive: true })
  addEventListener('resize', onScroll, { passive: true })
  measure()
  s.value = target
  // Before the story starts, the room is alive: the client's timer, the hover roaming.
  clock = setInterval(() => {
    if (!document.hidden && s.value < STARTS[2]) idle.value += 1
  }, 1000)
  requestAnimationFrame(() => unfocus(stage.value))
  setTimeout(() => unfocus(stage.value), 1500)
})

onBeforeUnmount(() => {
  removeEventListener('scroll', onScroll)
  removeEventListener('resize', onScroll)
  media?.removeEventListener('change', onMedia)
  observer?.disconnect()
  clearInterval(clock)
  clearTimeout(zoomTimer)
  cancelAnimationFrame(raf)
})

const chapters = CHAPTERS.slice(1)
</script>

<template>
  <!-- Reduced motion: every chapter at its end, one after the other -->
  <section v-if="still" class="story-still page">
    <header class="still-hero">
      <p class="kicker">{{ version ? `Invade ${version}` : 'Invade' }} · Windows and macOS</p>
      <h1>A small app that sits beside League.</h1>
      <p class="lead">
        A free League of Legends companion. Follow one game with it, from champ select to the score
        at the end.
      </p>
      <DownloadCta align="start" />
    </header>
    <article v-for="(c, i) in chapters" :key="c.id" class="still-ch">
      <div class="cap">
        <p class="cap-n">
          <span>{{ c.n }}</span
          >{{ c.name }}
        </p>
        <h2>{{ c.title }}</h2>
        <p class="cap-body">{{ c.body }}</p>
        <p class="cap-fact">{{ c.fact }}</p>
      </div>
      <div class="still-stage iv-dark">
        <Stage :w="1280" :h="720" :label="c.title">
          <SceneDraft v-if="i === 0" :p="1" :idle="0" />
          <SceneGame v-else-if="i === 1" :p="1" :tab="0" :k="0" />
          <SceneGame v-else-if="i === 2" :p="1" :tab="0.5" :k="0" />
          <SceneDesk v-else-if="i === 3" :rec="1" :after="0" :web="0" />
          <SceneDesk v-else-if="i === 4" :rec="1" :after="1" :web="0" />
          <SceneDesk v-else :rec="1" :after="1" :web="1" />
        </Stage>
      </div>
    </article>
  </section>

  <section
    v-else
    ref="root"
    class="story"
    :style="{ '--len': TOTAL }"
    aria-label="One game with Invade, from champ select to invade.lol"
  >
    <div ref="frame" class="pin">
      <div class="pin-in page">
        <div class="copy">
          <div class="caps">
            <header
              class="cap hero"
              :style="{
                opacity: heroK.toFixed(3),
                transform: `translate3d(0, ${((1 - heroK) * -14).toFixed(2)}px, 0)`,
                visibility: heroK > 0.001 ? 'visible' : 'hidden',
              }"
            >
              <p class="kicker">
                {{ version ? `Invade ${version}` : 'Invade' }} · Windows and macOS
              </p>
              <h1>A small app that sits beside League.</h1>
              <p class="lead">
                A free League of Legends companion. Scroll to follow one game with it, from champ
                select to the score at the end.
              </p>
              <DownloadCta align="start" />
            </header>

            <article v-for="(c, i) in chapters" :key="c.id" class="cap" :style="caption(i + 1)">
              <p class="cap-n">
                <span>{{ c.n }}</span
                >{{ c.name }}
              </p>
              <h2>{{ c.title }}</h2>
              <p class="cap-body">{{ c.body }}</p>
              <p class="cap-fact">{{ c.fact }}</p>
            </article>
          </div>

          <nav class="rail" aria-label="Chapters">
            <button
              v-for="(c, i) in chapters"
              :key="c.id"
              type="button"
              :class="{ on: current === i + 1, past: current > i + 1 }"
              @click="go(i + 1)"
            >
              <span class="rail-n">{{ c.n }}</span>
              <span class="rail-name">{{ c.name }}</span>
              <i class="rail-bar"
                ><b :style="{ transform: `scaleX(${local(i + 1).toFixed(3)})` }"
              /></i>
            </button>
          </nav>
        </div>

        <div class="frame" @pointermove="onPointer">
          <div
            ref="stage"
            class="stage iv-dark"
            role="img"
            aria-label="Invade's overlay and app, playing through one game"
          >
            <div v-if="ready" class="world" :class="{ zooming }" :style="camera" aria-hidden="true">
              <div class="scene" :style="draftStyle"><SceneDraft :p="pDraft" :idle="idle" /></div>
              <div class="scene" :style="gameStyle">
                <SceneGame :p="pGame" :tab="pTab" :k="seg(pPlay, 0, 0.6)" />
              </div>
              <div class="scene" :style="deskStyle">
                <SceneDesk :rec="seg(pPlay, 0.62, 1)" :after="pAfter" :web="pWeb" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.story {
  position: relative;
  height: calc(var(--len) * 100vh + 100svh - 56px);
}

.pin {
  position: sticky;
  top: 56px;
  height: calc(100svh - 56px);
  overflow: hidden;
}

.pin-in {
  display: grid;
  grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
  align-items: center;
  gap: clamp(28px, 3.4vw, 52px);
  height: 100%;
  padding-block: 24px;
}

/* ── The copy ── */
.copy {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  max-height: 720px;
  min-height: 0;
  padding-block: 8px;
}

.caps {
  position: relative;
  flex: 1;
  min-height: 0;
}

.cap {
  position: absolute;
  inset: 0 0 auto;
  will-change: transform, opacity;
}

.kicker,
.cap-n {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 22px;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--text-3);
}

.cap-n span {
  color: var(--brand-hi);
}

h1,
h2 {
  font-size: clamp(30px, 2.6vw, 40px);
  font-weight: 640;
  line-height: 1.06;
  letter-spacing: -0.035em;
  color: var(--text-1);
  text-wrap: balance;
}

.lead,
.cap-body {
  margin-top: 18px;
  font-size: 15.5px;
  line-height: 1.6;
  color: var(--text-2);
  text-wrap: pretty;
}

.hero .lead {
  margin-bottom: 28px;
}

.cap-fact {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  padding-top: 14px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-3);
  border-top: 1px solid var(--line-2);
}

/* ── The rail: where you are in the game, and a way to jump ── */
.rail {
  display: grid;
  gap: 2px;
}

.rail button {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 56px;
  align-items: center;
  gap: 10px;
  height: 30px;
  padding: 0;
  font-size: 13px;
  color: var(--text-3);
  text-align: left;
  background: none;
  border: 0;
  cursor: pointer;
  transition: color 200ms;
}

.rail button:hover,
.rail button.on {
  color: var(--text-1);
}

.rail-n {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--text-4);
  transition: color 200ms;
}

.rail button.on .rail-n,
.rail button.past .rail-n {
  color: var(--brand-hi);
}

.rail-bar {
  display: block;
  height: 2px;
  overflow: hidden;
  background: var(--line-2);
  border-radius: 1px;
}

.rail-bar b {
  display: block;
  height: 100%;
  background: var(--brand);
  transform-origin: left;
}

/* ── The stage ── */
.frame {
  --mx: 70%;
  --my: 10%;
  position: relative;
  /* On wide screens the stage runs past the text column's grid to the window's gutter. */
  --bleed: max(0px, (100vw - 1320px) / 2);
  justify-self: start;
  width: min(calc(100% + var(--bleed)), calc((100svh - 56px - 48px) * 16 / 9), 1280px);
  border-radius: 14px;
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 0.08),
    0 2px 4px rgb(0 0 0 / 0.3),
    0 30px 60px -20px rgb(0 0 0 / 0.6),
    0 80px 140px -50px rgb(0 0 0 / 0.7);
}

/* The light under the pointer: a soft violet wash on the glass, nothing more. */
.frame::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  border-radius: inherit;
  background: radial-gradient(
    520px circle at var(--mx) var(--my),
    rgb(var(--brand-rgb) / 0.09),
    rgb(var(--brand-rgb) / 0) 70%
  );
  opacity: 0;
  transition: opacity 400ms;
  pointer-events: none;
  mix-blend-mode: screen;
}

.frame:hover::after {
  opacity: 1;
}

.stage {
  position: relative;
  color: var(--text-1);
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: #08090c;
  border-radius: inherit;
  isolation: isolate;
}

.world {
  position: absolute;
  top: 0;
  left: 0;
  width: 1280px;
  height: 720px;
  transform-origin: 0 0;
}

.world.zooming {
  will-change: transform;
}

/* The UI on the stage answers the pointer like the real thing: rows light, tips explain. */
.stage :deep(.perf-row) {
  margin: 0 -4px;
  padding: 0 4px;
  border-radius: 4px;
  transition: background-color 160ms;
}

.stage :deep(.perf-row:hover),
.stage :deep(.odds-lanes li:hover) {
  background: rgb(255 255 255 / 0.06);
}

.stage :deep([data-tip]:hover::after) {
  content: attr(data-tip);
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  z-index: 5;
  padding: 6px 9px;
  font: 500 11.5px/1.3 var(--font);
  letter-spacing: 0;
  white-space: nowrap;
  color: #ececf3;
  background: #1b1c25;
  border-radius: 6px;
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 0.08),
    0 6px 16px rgb(0 0 0 / 0.5);
  transform: translateX(-50%);
  pointer-events: none;
}

.scene {
  position: absolute;
  inset: 0;
  transform-origin: 50% 50%;
}

@media (prefers-color-scheme: light) {
  [data-theme='system'] .frame {
    box-shadow:
      0 0 0 1px rgb(12 12 20 / 0.12),
      0 2px 4px rgb(12 12 20 / 0.08),
      0 30px 60px -20px rgb(12 12 20 / 0.25),
      0 80px 140px -50px rgb(12 12 20 / 0.3);
  }
}

[data-theme='light'] .frame {
  box-shadow:
    0 0 0 1px rgb(12 12 20 / 0.12),
    0 2px 4px rgb(12 12 20 / 0.08),
    0 30px 60px -20px rgb(12 12 20 / 0.25),
    0 80px 140px -50px rgb(12 12 20 / 0.3);
}

/* ── Below 1024: the stage on top, the copy under it ── */
@media (min-width: 96rem) {
  .frame {
    --bleed: max(0px, (100vw - 1480px) / 2);
  }
}

@media (max-width: 1023px) {
  .pin-in {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto;
    align-items: stretch;
    gap: 18px;
    padding-block: 12px 16px;
  }

  .frame {
    grid-row: 1;
    width: 100%;
    min-height: 0;
  }

  .stage {
    aspect-ratio: auto;
    height: 100%;
  }

  .copy {
    grid-row: 2;
    height: auto;
    padding: 0;
  }

  .caps {
    height: 232px;
    flex: none;
  }

  .kicker,
  .cap-n {
    margin-bottom: 10px;
  }

  h1,
  h2 {
    font-size: clamp(24px, 6.4vw, 32px);
  }

  .lead,
  .cap-body {
    margin-top: 10px;
    font-size: 14.5px;
    line-height: 1.5;
  }

  .hero .lead {
    margin-bottom: 16px;
  }

  .cap-fact {
    display: none;
  }

  /* The rail becomes six short bars. */
  .rail {
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 6px;
    order: -1;
    margin-bottom: 14px;
  }

  .rail button {
    display: block;
    height: 14px;
  }

  .rail-n,
  .rail-name {
    display: none;
  }

  .rail-bar {
    margin-top: 6px;
  }
}

@media (max-width: 1023px) and (max-height: 700px) {
  .caps {
    height: 176px;
  }

  .lead,
  .cap-body {
    font-size: 13.5px;
  }
}

/* ── Reduced motion ── */
.story-still {
  display: grid;
  gap: clamp(64px, 8vw, 112px);
  padding-top: clamp(40px, 6vw, 80px);
}

.still-hero {
  max-width: 560px;
}

.still-ch {
  display: grid;
  gap: 24px;
  align-items: center;
}

@media (min-width: 1024px) {
  .still-ch {
    grid-template-columns: minmax(250px, 330px) minmax(0, 1fr);
    gap: 56px;
  }
}

.still-stage {
  overflow: hidden;
  border-radius: 14px;
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.08);
}
</style>
