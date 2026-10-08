<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * One chapter of the /app page: a player frame that stays in view while the page scrolls past
 * it, its stage showing one step of the chapter at a time, and a caption bar under the stage
 * (the step, one line about it, and where the chapter is).
 *
 * Scrolling drives the steps. With reduced motion, or a window too short to hold the frame,
 * nothing is pinned: the stage shows `still` and the caption bar lists every step.
 * On a phone the chapter's intro rides in the pinned frame, above the stage.
 */
const props = withDefaults(
  defineProps<{
    id: string
    /** The chapter's name, for assistive technology. */
    name: string
    steps: Array<{ title: string; text: string }>
    /** The step shown when nothing moves. */
    still?: number
  }>(),
  { still: undefined }
)

const HEADER = 56

const track = ref<HTMLElement>()
const frameEl = ref<HTMLElement>()
const step = ref(0)
const local = ref(0)
/** The chapter is on screen (its stage may animate and play video). */
const near = ref(false)
/** Pinned and scroll-driven, or one still state. Decided once the browser is known. */
const mode = ref<'scroll' | 'still'>('scroll')
/** A phone: the intro goes into the pinned frame. */
const narrow = ref(false)

const count = computed(() => props.steps.length)
const shown = computed(() =>
  mode.value === 'still' ? (props.still ?? count.value - 1) : step.value
)

let frame = 0
let observer: IntersectionObserver | undefined
let motion: MediaQueryList | undefined
let phone: MediaQueryList | undefined

function measure() {
  frame = 0
  const el = track.value
  if (!el || mode.value !== 'scroll') return
  const rect = el.getBoundingClientRect()
  const pin = window.innerHeight - HEADER
  const travel = Math.max(1, rect.height - pin)
  const progress = Math.min(1, Math.max(0, (HEADER - rect.top) / travel))
  const at = progress * count.value
  step.value = Math.min(count.value - 1, Math.floor(at))
  local.value = Math.min(1, at - step.value)
}

function onScroll() {
  if (!frame) frame = requestAnimationFrame(measure)
}

function decide() {
  narrow.value = !!phone?.matches
  mode.value = motion?.matches || window.innerHeight < 520 ? 'still' : 'scroll'
  measure()
}

/** Scrolls to a step. */
function goto(index: number) {
  const el = track.value
  if (!el || mode.value !== 'scroll') return
  const top = el.getBoundingClientRect().top + window.scrollY
  const travel = el.offsetHeight - (window.innerHeight - HEADER)
  window.scrollTo({
    top: top - HEADER + ((index + 0.3) / count.value) * travel,
    behavior: 'smooth',
  })
}

onMounted(() => {
  motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  phone = window.matchMedia('(max-width: 640px)')
  motion.addEventListener?.('change', decide)
  phone.addEventListener?.('change', decide)
  decide()
  // The stage plays once a good part of it is in view, so nothing runs out of sight.
  observer = new IntersectionObserver(
    ([entry]) => (near.value = entry.isIntersecting && entry.intersectionRatio >= 0.35),
    { threshold: [0, 0.35, 0.6] }
  )
  if (frameEl.value) observer.observe(frameEl.value)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', decide, { passive: true })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  motion?.removeEventListener?.('change', decide)
  phone?.removeEventListener?.('change', decide)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', decide)
  cancelAnimationFrame(frame)
})

const fill = (index: number) =>
  index < shown.value ? 1 : index === shown.value ? (mode.value === 'still' ? 1 : local.value) : 0
</script>

<template>
  <section :id="id" class="chapter" :class="`is-${mode}`" :aria-label="name">
    <header v-if="$slots.intro && !narrow" class="chapter-intro">
      <slot name="intro" />
    </header>

    <div ref="track" class="chapter-track" :style="{ '--steps': count }">
      <div class="chapter-pin">
        <header v-if="$slots.intro && narrow" class="chapter-intro in-pin">
          <slot name="intro" />
        </header>

        <figure ref="frameEl" class="player">
          <div class="player-stage theme-dark" inert>
            <slot
              :step="shown"
              :local="mode === 'still' ? 1 : local"
              :active="near"
              :still="mode === 'still'"
              :narrow="narrow"
            />
          </div>

          <figcaption class="player-bar">
            <template v-if="mode === 'scroll'">
              <div class="player-caption">
                <Transition name="caption" mode="out-in">
                  <p :key="shown">
                    <b>{{ steps[shown].title }}</b>
                    <span>{{ steps[shown].text }}</span>
                  </p>
                </Transition>
              </div>
              <ol class="player-steps">
                <li v-for="(item, index) in steps" :key="item.title">
                  <button
                    type="button"
                    :aria-label="item.title"
                    :aria-current="index === shown ? 'step' : undefined"
                    @click="goto(index)"
                  >
                    <i :style="{ transform: `scaleX(${fill(index)})` }" />
                  </button>
                </li>
              </ol>
            </template>
            <ul v-else class="player-list">
              <li v-for="item in steps" :key="item.title">
                <b>{{ item.title }}</b>
                <span>{{ item.text }}</span>
              </li>
            </ul>
          </figcaption>
        </figure>
      </div>
    </div>
  </section>
</template>

<style scoped>
.chapter {
  --bar: 76px;
  --step-h: 62svh;
}

.is-scroll .chapter-track {
  height: calc(100svh - 56px + var(--steps) * var(--step-h));
}

.chapter-pin {
  display: flex;
  flex-direction: column;
  align-items: center;
  /* From the top: on a tall window the room left over goes under the frame, not above it. */
  justify-content: flex-start;
  padding: 16px 0;
}

.is-scroll .chapter-pin {
  position: sticky;
  top: 56px;
  height: calc(100svh - 56px);
}

/* The frame: as wide as the page allows and as tall as the window can show with its bar. */
.player {
  width: min(100%, calc((100svh - 56px - 32px - var(--bar)) * 16 / 9));
  margin: 0;
  overflow: hidden;
  border-radius: var(--radius-lg);
  background: #0d0e13;
  box-shadow:
    0 0 0 1px var(--color-line-2),
    var(--shadow-e2);
}

.is-still .player {
  width: 100%;
}

.player-stage {
  position: relative;
  color: var(--color-ink);
  background: #0d0e13;
}

/* ── The caption bar: the step, one line, where the chapter is ─ */
.player-bar {
  display: flex;
  align-items: center;
  gap: 24px;
  min-height: var(--bar);
  padding: 14px 20px;
  background: var(--color-solid);
  border-top: 1px solid var(--color-line);
}

.player-caption {
  flex: 1;
  min-width: 0;
}

.player-caption p,
.player-list li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 12px;
  row-gap: 2px;
  margin: 0;
}

.player-caption b,
.player-list b {
  font-size: 15px;
  font-weight: 600;
  line-height: 20px;
  color: var(--color-ink);
}

.player-caption span,
.player-list span {
  font-size: 14px;
  line-height: 20px;
  color: var(--color-ink-2);
}

.player-steps {
  display: flex;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Each step is a short track that fills as the page scrolls through it. */
.player-steps button {
  position: relative;
  display: block;
  width: 28px;
  height: 23px;
}

.player-steps button::before,
.player-steps i {
  position: absolute;
  left: 0;
  right: 0;
  top: 10px;
  height: 3px;
  border-radius: 2px;
}

.player-steps button::before {
  content: '';
  background: var(--color-track);
}

.player-steps i {
  background: var(--color-brand);
  transform-origin: left;
  transition: transform 160ms linear;
}

.player-list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 4px 0;
  list-style: none;
}

.caption-enter-active,
.caption-leave-active {
  transition:
    opacity 180ms var(--ease),
    transform 180ms var(--ease);
}

.caption-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.caption-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ── The intro: before the frame, or on a phone inside it ─────── */
.chapter-intro {
  padding: clamp(72px, 14vh, 140px) 0 8px;
}

.chapter-intro.in-pin {
  align-self: stretch;
  padding: 0;
  margin-bottom: 18px;
}

@media (max-width: 640px) {
  .chapter {
    --bar: 116px;
    --step-h: 56svh;
  }

  .player-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    padding: 12px 14px;
  }

  .player-caption {
    min-height: 58px;
  }

  .player-caption p {
    display: grid;
  }

  .player-caption b {
    font-size: 14px;
  }

  .player-caption span {
    font-size: 13px;
    line-height: 18px;
  }

  .player-steps li {
    flex: 1;
  }

  .player-steps button {
    width: auto;
    height: 11px;
  }

  .player-steps button::before,
  .player-steps i {
    top: 4px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .caption-enter-active,
  .caption-leave-active,
  .player-steps i {
    transition: none;
  }
}
</style>
