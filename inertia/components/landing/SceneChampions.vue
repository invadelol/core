<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Check } from 'lucide-vue-next'
import Screen from './Screen.vue'
/* Written by scripts/capture_landing.mjs: image sizes and the boxes the camera moves to. */
import shots from '../../../public/landing/shots.json'

/**
 * Champions: two screenshots of the app (the ranking, then Ahri's page), filmed like a screen
 * recording. The cursor goes to Ahri's row and opens it, the page cross-dissolves in, the
 * camera settles on the build, then on the button that keeps it for the next game.
 */
const props = defineProps<{ step: number; active: boolean; still: boolean; narrow?: boolean }>()

const W = 1440
const H = 900

type Box = { x: number; y: number; w: number; h: number }
const manifest = shots as unknown as Record<string, Record<string, Box | number | undefined>>
const box = (shot: string, key: string, fallback: Box): Box =>
  (manifest[shot]?.[key] as Box | undefined) ?? fallback

const ROW = box('app-tierlist', 'focus', { x: 0.164, y: 0.867, w: 0.817, h: 0.044 })
const BUILD = box('app-champion', 'build', { x: 0.161, y: 0.411, w: 0.822, h: 0.56 })
const ACTION = box('app-champion', 'action', { x: 0.844, y: 0.326, w: 0.131, h: 0.036 })

const px = (b: Box) => ({ x: b.x * W, y: b.y * H, w: b.w * W, h: b.h * H })
const row = px(ROW)
const build = px(BUILD)
const action = px(ACTION)

/* ── Time inside a step: the click in step 1, the save in step 3 ── */
const elapsed = ref(0)
let started = 0
let frame = 0

function run() {
  elapsed.value = performance.now() - started
  if (elapsed.value < 4000) frame = requestAnimationFrame(run)
}

function restart() {
  cancelAnimationFrame(frame)
  started = performance.now()
  elapsed.value = 0
  if (props.active && !props.still) frame = requestAnimationFrame(run)
}

watch(() => props.step, restart)
watch(
  () => props.active && !props.still,
  (on) => (on ? restart() : cancelAnimationFrame(frame))
)
onBeforeUnmount(() => cancelAnimationFrame(frame))

const CLICK = 1300

/** Which page shows: the ranking until the click of step 1, then the champion. */
const champion = computed(
  () => props.still || props.step > 1 || (props.step === 1 && elapsed.value > CLICK)
)
const hovered = computed(
  () => props.step === 1 && elapsed.value > 700 && elapsed.value <= CLICK + 200
)
const saved = computed(() => !props.still && props.step === 3 && elapsed.value > 1300)

const camera = computed(() => {
  if (props.still) return { x: W / 2, y: H / 2, z: 1 }
  if (props.narrow) {
    // A phone: the ranking's names and tiers, the row, the runes, the button.
    switch (props.step) {
      case 0:
        return { x: 520, y: 330, z: 2 }
      case 1:
        return champion.value ? { x: 560, y: 200, z: 2 } : { x: row.x + 260, y: row.y, z: 2.4 }
      case 2:
        return { x: build.x + 250, y: build.y + 200, z: 2.1 }
      default:
        return { x: action.x + action.w / 2 - 90, y: action.y + 60, z: 2.6 }
    }
  }
  switch (props.step) {
    case 0:
      return { x: W / 2, y: H / 2, z: 1 }
    case 1:
      return champion.value
        ? { x: W / 2, y: H / 2, z: 1 }
        : { x: row.x + row.w * 0.42, y: row.y, z: 1.7 }
    case 2:
      return { x: build.x + build.w / 2, y: build.y + build.h / 2, z: 1.18 }
    default:
      return { x: action.x + action.w / 2 - 170, y: action.y + 110, z: 1.65 }
  }
})

/** The pointer: resting low on the page, then on Ahri's row, then on the button. */
const cursor = computed(() => {
  if (props.still) return null
  if (props.step === 1 && !champion.value)
    return { x: row.x + 240, y: row.y + row.h / 2 + 4, down: elapsed.value > CLICK - 160 }
  if (props.step === 3)
    return {
      x: action.x + action.w * 0.55,
      y: action.y + action.h * 0.6,
      down: elapsed.value > 1150 && elapsed.value < 1350,
    }
  if (props.step === 0) return { x: W * 0.62, y: H * 0.7, down: false }
  return null
})
</script>

<template>
  <Screen :w="W" :h="H" :camera="camera">
    <div class="cs">
      <img
        :src="'/landing/app-tierlist.webp'"
        alt="The tier list: every Mid champion at Emerald with tier, win, pick and ban rates"
        :width="W"
        :height="H"
        loading="lazy"
        decoding="async"
        class="cs-shot"
        :class="{ off: champion }"
      />
      <img
        :src="'/landing/app-champion.webp'"
        alt="Ahri's page: tier and rates, the recommended runes, spells, skill order and items"
        :width="W"
        :height="H"
        loading="lazy"
        decoding="async"
        class="cs-shot"
        :class="{ off: !champion }"
      />

      <!-- The row under the pointer, as the app shows a hovered row -->
      <i
        class="cs-hover"
        :class="{ on: hovered && !champion }"
        :style="{
          left: `${row.x}px`,
          top: `${row.y}px`,
          width: `${row.w}px`,
          height: `${row.h}px`,
        }"
      />

      <!-- The button once pressed: the app's own "Setup saved" -->
      <span
        class="cs-saved"
        :class="{ on: saved }"
        :style="{
          left: `${action.x}px`,
          top: `${action.y}px`,
          width: `${action.w}px`,
          height: `${action.h}px`,
        }"
      >
        <Check :size="14" :stroke-width="2.4" />Setup saved
      </span>

      <svg
        v-if="cursor"
        class="cs-cursor"
        :class="{ down: cursor.down }"
        :style="{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }"
        width="22"
        height="26"
        viewBox="0 0 22 26"
        aria-hidden="true"
      >
        <path
          d="M2 1.5v19.2l5.1-4.9 3.4 7.9 3.3-1.4-3.3-7.7H17z"
          fill="#fff"
          stroke="#111"
          stroke-width="1.4"
          stroke-linejoin="round"
        />
      </svg>
    </div>
  </Screen>
</template>

<style scoped>
.cs {
  position: relative;
  width: 1440px;
  height: 900px;
  overflow: hidden;
  background: #0d0e13;
}

.cs-shot {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transition: opacity 700ms var(--ease);
}

.cs-shot.off {
  opacity: 0;
}

.cs-hover {
  position: absolute;
  border-radius: 6px;
  background: rgb(190 190 255 / 0.07);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.08);
  opacity: 0;
  transition: opacity 160ms var(--ease);
}

.cs-hover.on {
  opacity: 1;
}

.cs-saved {
  position: absolute;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 5px;
  background: #7b6dff;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  opacity: 0;
  transition: opacity 200ms var(--ease);
}

.cs-saved.on {
  opacity: 1;
}

.cs-cursor {
  position: absolute;
  top: 0;
  left: 0;
  filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.5));
  transition: transform 900ms cubic-bezier(0.65, 0, 0.35, 1);
}

.cs-cursor path {
  transition: transform 120ms var(--ease);
  transform-origin: 2px 2px;
}

.cs-cursor.down path {
  transform: scale(0.86);
}
</style>
