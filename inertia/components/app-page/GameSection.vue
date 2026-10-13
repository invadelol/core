<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Shot from './Shot.vue'
import type { ShotName } from './shots'
import { ease, lerp, prefersReduced, useScrollFx, vReveal } from './motion'

/**
 * In game, as one pinned shot: a still of a real game with Invade's overlay windows at their
 * default places (each cut from the real overlay window at 1920 × 1080, placed by its own rect).
 * Scrolling plays it: the panels appear one by one, the camera moving in on each, then Tab is
 * held and the lane gold plates come down the middle of the scoreboard.
 */

/** Each overlay image: its box in the 1920 × 1080 game (the window's padding for its shadow included). */
const OVERLAYS = {
  objectives: { x: 663.2, y: 0, w: 344, h: 110, at: 0.15 },
  perf: { x: 0, y: 360.8, w: 248, h: 229, at: 0.35 },
  build: { x: 1469.6, y: 641.6, w: 268, h: 170, at: 0.53 },
} as const
const PLATES = { x: 904, y: 178.4, w: 112, h: 512 }
const TAB_AT = 0.81

type Name = keyof typeof OVERLAYS
const OV_SHOT: Record<Name, ShotName> = {
  objectives: 'ov-objectives',
  perf: 'ov-perf',
  build: 'ov-build',
}
const place = (b: { x: number; y: number; w: number; h: number }) => ({
  left: `${(b.x / 1920) * 100}%`,
  top: `${(b.y / 1080) * 100}%`,
  width: `${(b.w / 1920) * 100}%`,
})
const centre = (b: { x: number; y: number; w: number; h: number }) => [
  (b.x + b.w / 2) / 1920,
  (b.y + b.h / 2) / 1080,
]

const CAPTIONS = [
  {
    title: 'Timers, at a glance.',
    text: 'Dragon, grubs, herald and Baron as small pills, with the dragons each team holds.',
  },
  {
    title: 'Your pace, live.',
    text: 'CS, gold, KDA and kill participation against a target rank, with a trend over the game.',
  },
  {
    title: 'What to buy next.',
    text: 'The next item of your build, and the gold it still takes once your components are counted.',
  },
  {
    title: 'Hold Tab for lane gold.',
    text: 'Each lane’s gold lead on a small plate, down the middle of the game’s scoreboard.',
  },
]

const section = ref<HTMLElement>()
const frame = ref<HTMLElement>()
const world = ref<HTMLElement>()
const shade = ref<HTMLElement>()
const progress = ref(0)
const reduced = ref(false)
const step = computed(() => {
  const p = progress.value
  if (reduced.value) return 4
  return p < OVERLAYS.objectives.at
    ? 0
    : p < OVERLAYS.perf.at
      ? 1
      : p < OVERLAYS.build.at
        ? 2
        : p < TAB_AT
          ? 3
          : 4
})
const shown = (name: Name) =>
  reduced.value || (progress.value >= OVERLAYS[name].at && progress.value < TAB_AT)
const tab = computed(() => !reduced.value && progress.value >= TAB_AT)

/** Camera keyframes: [progress, centre x, centre y, zoom]. Phones zoom further in. */
function keys(phone: boolean): Array<[number, number, number, number]> {
  const z = phone ? 1.25 : 1
  const [ox, oy] = centre(OVERLAYS.objectives)
  const [px, py] = centre(OVERLAYS.perf)
  const [bx, by] = centre(OVERLAYS.build)
  const [tx, ty] = centre(PLATES)
  return [
    [0, 0.5, 0.5, 1.1],
    [0.1, 0.5, 0.5, 1],
    [0.16, 0.5, 0.5, 1],
    [0.24, ox, oy, 2.2 * z],
    [0.31, ox, oy, 2.2 * z],
    [0.41, px, py, 2.3 * z],
    [0.49, px, py, 2.3 * z],
    [0.59, bx, by, 2.3 * z],
    [0.67, bx, by, 2.3 * z],
    [0.75, 0.5, 0.5, 1],
    [0.81, 0.5, 0.5, 1],
    [0.9, tx, ty, 1.75 * z],
    [1, tx, ty, 1.75 * z],
  ]
}

function cameraAt(p: number, phone: boolean) {
  const k = keys(phone)
  let i = 0
  while (i < k.length - 2 && p > k[i + 1][0]) i++
  const [p0, x0, y0, s0] = k[i]
  const [p1, x1, y1, s1] = k[i + 1]
  const t = ease((p - p0) / (p1 - p0))
  return { x: lerp(x0, x1, t), y: lerp(y0, y1, t), s: lerp(s0, s1, t) }
}

const cam = { x: 0.5, y: 0.5, s: 1.1 }
let size = { w: 0, h: 0 }
function measure() {
  if (frame.value) size = { w: frame.value.clientWidth, h: frame.value.clientHeight }
}

useScrollFx(section, (box, vh) => {
  const run = box.height - vh
  const p = run > 0 ? Math.min(1, Math.max(0, -box.top / run)) : 0
  progress.value = p
  if (!size.w) measure()
  const { w: W, h: H } = size
  if (!W || !world.value) return
  const phone = W < 700
  const target = reduced.value ? { x: 0.5, y: 0.5, s: 1 } : cameraAt(p, phone)
  // The camera eases toward where the scroll puts it: smooth on wheels that jump.
  const k = reduced.value ? 1 : 0.14
  cam.x += (target.x - cam.x) * k
  cam.y += (target.y - cam.y) * k
  cam.s += (target.s - cam.s) * k
  const ww = Math.max(W, (H * 16) / 9)
  const wh = (ww * 9) / 16
  const sw = ww * cam.s
  const sh = wh * cam.s
  const tx = Math.min(0, Math.max(W - sw, W / 2 - cam.x * sw))
  const ty = Math.min(0, Math.max(H - sh, H / 2 - cam.y * sh))
  const el = world.value
  el.style.width = `${ww}px`
  el.style.height = `${wh}px`
  el.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${cam.s.toFixed(4)})`
  // The game recedes a little while the camera is in on a panel.
  if (shade.value) shade.value.style.opacity = String(Math.min(0.38, (cam.s - 1) * 0.36))
  return (
    Math.abs(target.s - cam.s) > 0.0005 ||
    Math.abs(target.x - cam.x) > 0.0002 ||
    Math.abs(target.y - cam.y) > 0.0002
  )
})

onMounted(() => {
  reduced.value = prefersReduced()
  measure()
  window.addEventListener('resize', measure, { passive: true })
})
onBeforeUnmount(() => window.removeEventListener('resize', measure))
</script>

<template>
  <section class="ap-section game">
    <header v-reveal class="ap-head ap-wrap">
      <p class="ap-eyebrow ln">In game</p>
      <h2 class="ap-h2 ln">Only what matters, right on the game.</h2>
      <p class="ap-lead ln">
        Small panels drawn over League from the game’s own live data, one transparent window that
        never takes your keyboard.
        <strong>Nothing is injected, and nothing reads the game’s memory.</strong>
      </p>
    </header>

    <div ref="section" class="run" :class="{ reduced }">
      <div class="pin">
        <div ref="frame" class="frame">
          <div ref="world" class="world">
            <Shot
              name="game"
              alt="A game of League of Legends in progress, Invade’s overlay over it"
              sizes="(min-width: 1300px) 2400px, 200vw"
              class="still"
            />
            <i ref="shade" class="shade" />
            <i class="tab-shade" :class="{ on: tab }" />
            <div
              v-for="(b, name) in OVERLAYS"
              :key="name"
              class="ov"
              :class="{ on: shown(name) }"
              :style="place(b)"
            >
              <Shot :name="OV_SHOT[name]" alt="" sizes="1000px" />
            </div>
            <div class="ov plates" :class="{ on: tab }" :style="place(PLATES)">
              <Shot name="ov-tabgold" alt="" sizes="1000px" />
            </div>
          </div>
        </div>

        <ol class="steps" aria-hidden="true">
          <li
            v-for="(c, i) in CAPTIONS"
            :key="c.title"
            :class="{ on: step === i + 1, done: step > i + 1 }"
          />
        </ol>

        <div class="captions" aria-live="polite">
          <p class="cap intro" :class="{ on: step === 0 }">
            A real game, Invade’s panels at their default places.
          </p>
          <div
            v-for="(c, i) in CAPTIONS"
            :key="c.title"
            class="cap"
            :class="{ on: step === i + 1 }"
          >
            <p>
              <kbd v-if="i === 3" class="key" :class="{ down: tab }">Tab</kbd>
              <strong>{{ c.title }}</strong> {{ c.text }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Reduced motion: the four captions as a list under the finished shot. -->
    <ul v-if="reduced" class="cap-list ap-wrap">
      <li v-for="c in CAPTIONS" :key="c.title">
        <strong>{{ c.title }}</strong> {{ c.text }}
      </li>
    </ul>
  </section>
</template>

<style scoped>
.run {
  position: relative;
  height: 560vh;
  margin-top: clamp(40px, 5vw, 72px);
}

.pin {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
  height: 100vh;
  height: 100svh;
  padding: 72px 24px 24px;
}

.frame {
  position: relative;
  overflow: hidden;
  width: min(var(--ap-wide), calc(100vw - 48px), calc((100svh - 280px) * 16 / 9));
  aspect-ratio: 16 / 9;
  border-radius: 20px;
  background: #0b0c10;
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 0.08),
    var(--ap-shadow);
  isolation: isolate;
}

.world {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  will-change: transform;
}

.still,
.still :deep(img) {
  width: 100%;
  height: 100%;
}

.shade,
.tab-shade {
  position: absolute;
  inset: 0;
  background: #05060a;
  opacity: 0;
  pointer-events: none;
}

.tab-shade {
  transition: opacity 700ms var(--ap-ease);
}

.tab-shade.on {
  opacity: 0.55;
}

.ov {
  position: absolute;
  opacity: 0;
  transform: translate3d(0, 10px, 0) scale(0.97);
  transform-origin: 50% 50%;
  transition:
    opacity 700ms var(--ap-ease),
    transform 800ms var(--ap-ease);
}

.ov.on {
  opacity: 1;
  transform: none;
}

/* The plates come down the scoreboard's middle, top to bottom. */
.ov.plates {
  transform: none;
  clip-path: inset(0 0 100% 0);
  transition:
    opacity 300ms var(--ap-ease),
    clip-path 1100ms var(--ap-ease-out) 150ms;
}

.ov.plates.on {
  clip-path: inset(0);
}

/* ── Captions ── */

.captions {
  position: relative;
  display: grid;
  width: min(640px, 100%);
  min-height: 84px;
  text-align: center;
}

.cap {
  grid-area: 1 / 1;
  opacity: 0;
  transform: translate3d(0, 12px, 0);
  transition:
    opacity 500ms var(--ap-ease),
    transform 700ms var(--ap-ease);
  pointer-events: none;
}

.cap.on {
  opacity: 1;
  transform: none;
  transition-delay: 160ms;
}

.cap p,
.cap.intro {
  font-size: clamp(17px, 1.4vw, 21px);
  font-weight: 500;
  line-height: 1.45;
  letter-spacing: -0.012em;
  color: var(--ap-grey);
  text-wrap: balance;
}

.cap strong {
  font-weight: 600;
  color: var(--text-1);
}

/* Where the game is: four dots, the current one drawn out into a short bar. */
.steps {
  display: flex;
  gap: 8px;
  margin-top: -4px;
}

.steps li {
  width: 7px;
  height: 7px;
  background: var(--text-4);
  border-radius: 4px;
  opacity: 0.6;
  transition:
    width 500ms var(--ap-ease),
    background-color 500ms var(--ap-ease),
    opacity 500ms var(--ap-ease);
}

.steps li.done {
  opacity: 1;
}

.steps li.on {
  width: 28px;
  background: var(--text-1);
  opacity: 1;
}

.run.reduced .steps {
  display: none;
}

.key {
  display: inline-grid;
  place-items: center;
  min-width: 46px;
  height: 28px;
  margin-right: 8px;
  padding: 0 10px;
  font: 600 13px/1 var(--font);
  color: var(--text-1);
  vertical-align: 2px;
  background: var(--surface-3);
  border-radius: 7px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.08),
    0 3px 0 rgb(0 0 0 / 0.45);
  transition:
    transform 160ms var(--ap-ease),
    box-shadow 160ms var(--ap-ease);
}

.key.down {
  transform: translateY(2px);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.08),
    0 1px 0 rgb(0 0 0 / 0.45);
}

@media (max-width: 700px) {
  .run {
    height: 600vh;
  }

  .pin {
    gap: 22px;
    padding: 64px 16px 16px;
  }

  .frame {
    width: calc(100vw - 32px);
    aspect-ratio: 4 / 5;
    max-height: calc(100svh - 240px);
    border-radius: 16px;
  }

  .captions {
    min-height: 110px;
  }
}

/* Reduced motion: one finished frame, every panel in place, the captions listed under it. */
.run.reduced {
  height: auto;
}

.run.reduced .pin {
  position: static;
  height: auto;
}

.run.reduced .captions {
  display: none;
}

.run.reduced .ov,
.run.reduced .cap {
  transition: none;
}

.cap-list {
  display: grid;
  gap: 14px;
  max-width: 760px;
  margin-top: 32px;
  font-size: 19px;
  line-height: 1.45;
  color: var(--ap-grey);
}

.cap-list strong {
  color: var(--text-1);
}
</style>
