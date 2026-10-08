<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Screen from './Screen.vue'
import PlateReveal from './PlateReveal.vue'
import MatchRow from '../MatchRow.vue'
import { DEMO_EARLIER, DEMO_MATCH, DEMO_PUUID } from './demo_match.js'
import { loadChampions, loadItems, loadRunes } from '../../lib/assets.js'

/**
 * After the game: the site's own match rows (the same component as every profile), on a sample
 * game. The newest row's plate counts up and lights, the row opens on the scoreboard with all
 * ten plates, then your breakdown opens. The camera follows what opens.
 */
const props = defineProps<{ step: number; active: boolean; still: boolean; narrow?: boolean }>()

const W = 1000
/** Tall enough for an opened row with an opened player. */
const H = 1640
const RATIO = 9 / 16
const VIEW_H = W * RATIO

const expanded = computed(() => props.still || props.step >= 1)
const focus = computed(() => (!props.still && props.step >= 2 ? DEMO_PUUID : ''))

/* ── The plate counting up ────────────────────────────────────── */
const reveal = ref(props.still ? 1 : 0)
let frame = 0
let delay: ReturnType<typeof setTimeout> | undefined

function countUp() {
  cancelAnimationFrame(frame)
  clearTimeout(delay)
  reveal.value = 0
  delay = setTimeout(() => {
    const from = performance.now()
    const run = (now: number) => {
      const x = Math.min(1, (now - from) / 1500)
      reveal.value = 1 - Math.pow(1 - x, 3)
      if (x < 1) frame = requestAnimationFrame(run)
    }
    frame = requestAnimationFrame(run)
  }, 450)
}

watch(
  () => [props.step, props.active, props.still] as const,
  ([step, active, still], before) => {
    if (still || step > 0) {
      cancelAnimationFrame(frame)
      clearTimeout(delay)
      reveal.value = 1
      return
    }
    const [prevStep, prevActive] = before ?? [-1, false]
    // Count again when the chapter comes back into view, or when scrolling back to the first step.
    if (active && (!prevActive || prevStep !== 0)) countUp()
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  clearTimeout(delay)
})

/* ── The camera, aimed at what is open ────────────────────────── */
const page = ref<HTMLElement>()
const aim = ref({ x: W / 2, y: VIEW_H / 2, z: 1 })

/** An element's top inside the page, in the page's own pixels (the camera scales the page). */
function offsetIn(el: HTMLElement | null) {
  const root = page.value
  if (!el || !root) return 0
  const box = root.getBoundingClientRect()
  const scale = box.height / root.offsetHeight || 1
  return (el.getBoundingClientRect().top - box.top) / scale
}

async function frameStep() {
  await nextTick()
  const root = page.value
  if (!root) return
  const first = root.querySelector<HTMLElement>('.mrow')
  if (props.still) {
    aim.value = { x: W / 2, y: VIEW_H / 2, z: 1 }
  } else if (props.step === 0 && first) {
    // Close on the newest game, its plate in the middle of the right half.
    const y = offsetIn(first) + first.offsetHeight / 2
    aim.value = props.narrow
      ? { x: W * 0.8, y: y + 40, z: 2.3 }
      : { x: W * 0.72, y: y + 90, z: 1.55 }
  } else if (props.step === 1) {
    const board = root.querySelector<HTMLElement>('.mrow-detail table')
    const top = board ? offsetIn(board) : 220
    aim.value = props.narrow
      ? { x: W * 0.28, y: top + 150, z: 1.9 }
      : { x: W / 2, y: top + VIEW_H / 2 - 24, z: 1 }
  } else {
    const self = root.querySelector<HTMLElement>('.mrow-detail tr.is-self')
    const top = self ? offsetIn(self) : 400
    if (props.narrow) {
      // A phone: the breakdown itself, the plate and its five bars.
      const plate = root.querySelector<HTMLElement>('.mrow-detail td[colspan] .perf')
      const at = plate ? pointIn(plate) : { x: 300, y: top + 200 }
      aim.value = { x: at.x + 190, y: at.y + 90, z: 1.9 }
    } else {
      aim.value = { x: W / 2, y: top + VIEW_H / 2 - 10, z: 1 }
    }
  }
}

/** An element's top-left corner inside the page, in the page's own pixels. */
function pointIn(el: HTMLElement) {
  const root = page.value!
  const box = root.getBoundingClientRect()
  const scale = box.width / root.offsetWidth || 1
  const r = el.getBoundingClientRect()
  return { x: (r.left - box.left) / scale, y: (r.top - box.top) / scale }
}

onMounted(() => {
  // Names for the scoreboard's champions, items and runes.
  loadChampions()
  loadItems()
  loadRunes()
  void frameStep()
})
watch(() => [props.step, props.still, props.narrow], frameStep)
/* Rows open with their content a beat later: aim again once it is there. */
watch(
  () => props.step,
  () => setTimeout(frameStep, 120)
)
</script>

<template>
  <Screen :w="W" :h="H" :ratio="RATIO" :camera="aim">
    <div ref="page" class="pg">
      <div class="section">
        <h2>Match history</h2>
        <span class="meta num">3 games · 2W 1L</span>
      </div>

      <div class="pg-day">
        <span>Today</span>
        <span class="text-ink-3">1W 0L</span>
      </div>
      <PlateReveal :value="reveal">
        <MatchRow
          :match="DEMO_MATCH"
          :puuid="DEMO_PUUID"
          summoner-slug="demo"
          :expanded="expanded"
          :focus="focus"
        />
      </PlateReveal>

      <div class="pg-day">
        <span>Yesterday</span>
        <span class="text-ink-3">0W 1L</span>
      </div>
      <MatchRow
        :match="DEMO_EARLIER[0]"
        :puuid="DEMO_PUUID"
        summoner-slug="demo"
        :expanded="false"
      />

      <div class="pg-day">
        <span>Monday</span>
        <span class="text-ink-3">1W 0L</span>
      </div>
      <MatchRow
        :match="DEMO_EARLIER[1]"
        :puuid="DEMO_PUUID"
        summoner-slug="demo"
        :expanded="false"
      />
    </div>
  </Screen>
</template>

<style scoped>
.pg {
  width: 1000px;
  min-height: 1640px;
  padding: 22px 24px;
  background: var(--color-bg);
  color: var(--color-ink);
  font-size: 14px;
}

.pg-day {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 34px;
  margin-top: 6px;
  padding: 0 2px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-ink-2);
}
</style>
