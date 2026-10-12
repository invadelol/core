<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { MatchDetailPanel, MatchRow } from '@invadelol/ui'
import { summaryOf } from '@invadelol/ui/logic'
import Screen from './Screen.vue'
import { DEMO_EARLIER, DEMO_MATCH, DEMO_PUUID } from './demo_match.js'
import { detailOf } from '../../lib/match.js'

/**
 * After the game: the shared match rows and detail (the same as every profile, here and in the
 * app), on a sample game. The newest row's dial counts up and lights, the row opens on the
 * scoreboard, then on the breakdown. The camera follows what opens.
 */
const props = defineProps<{ step: number; active: boolean; still: boolean; narrow?: boolean }>()

const W = 1000
/** Tall enough for an opened row. */
const H = 1640
const RATIO = 9 / 16
const VIEW_H = W * RATIO

const detail = detailOf(DEMO_MATCH)
const DAYS = [
  { label: 'Today', match: DEMO_MATCH },
  { label: 'Yesterday', match: DEMO_EARLIER[0] },
  { label: 'Friday', match: DEMO_EARLIER[1] },
].map(({ label, match }) => {
  const game = summaryOf(match === DEMO_MATCH ? detail : detailOf(match), DEMO_PUUID)!
  return { label, game, record: game.win ? '1W 0L' : '0W 1L' }
})

const expanded = computed(() => props.still || props.step >= 1)
/** Dates read in the visitor's time zone: the rows are drawn in the browser only. */
const mounted = ref(false)

/* ── The dial counting up ─────────────────────────────────────── */
const reveal = ref(props.still ? 1 : 0)
/** The newest game's score, at the share of it the count has reached. */
const shown = computed(() => {
  const s = DAYS[0].game.score
  return s && { ...s, score: s.score * reveal.value }
})
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

/** An element's top-left corner inside the page, in the page's own pixels (the camera scales it). */
function pointIn(el: HTMLElement) {
  const root = page.value!
  const box = root.getBoundingClientRect()
  const scale = box.width / root.offsetWidth || 1
  const r = el.getBoundingClientRect()
  return { x: (r.left - box.left) / scale, y: (r.top - box.top) / scale }
}

/** The detail's tabs are its own; the demo presses them as a viewer would. */
function openTab(label: string) {
  const tabs = page.value?.querySelectorAll<HTMLButtonElement>('.iv-md .iv-tabs button')
  const tab = [...(tabs ?? [])].find((b) => b.textContent?.trim() === label)
  if (tab && !tab.classList.contains('on')) tab.click()
}

async function frameStep() {
  await nextTick()
  const root = page.value
  if (!root) return
  if (expanded.value) {
    openTab(!props.still && props.step >= 2 ? 'Breakdown' : 'Scoreboard')
    await nextTick()
  }
  const row = root.querySelector<HTMLElement>('.iv-mr')
  const body = root.querySelector<HTMLElement>('.iv-md-body')
  if (props.still || !row) {
    aim.value = { x: W / 2, y: VIEW_H / 2, z: 1 }
  } else if (props.step === 0) {
    // Close on the newest game, its dial in the middle of the right half.
    const dial = row.querySelector<HTMLElement>('.iv-dial')
    const at = dial ? pointIn(dial) : { x: W * 0.8, y: pointIn(row).y }
    aim.value = props.narrow
      ? { x: at.x, y: at.y + 20, z: 2.3 }
      : { x: at.x - 120, y: at.y + 20, z: 1.55 }
  } else {
    const top = body ? pointIn(body).y : 220
    aim.value = props.narrow
      ? { x: W * 0.32, y: top + 150, z: 1.9 }
      : { x: W / 2, y: top + VIEW_H / 2 - 40, z: 1 }
  }
}

onMounted(() => {
  mounted.value = true
  void frameStep()
})
watch(() => [props.step, props.still, props.narrow], frameStep)
/* The detail opens with its content a beat later: aim again once it is there. */
watch(
  () => props.step,
  () => setTimeout(frameStep, 120)
)
</script>

<template>
  <Screen :w="W" :h="H" :ratio="RATIO" :camera="aim">
    <div ref="page" class="pg iv-root">
      <section v-for="(day, i) in mounted ? DAYS : []" :key="day.label">
        <h3 class="iv-mr-day">
          {{ day.label }}<span>{{ day.record }}</span>
        </h3>
        <MatchRow :game="day.game" :score="i ? day.game.score : shown" :open="!i && expanded" />
        <MatchDetailPanel v-if="!i && expanded" :detail="detail" :puuid="DEMO_PUUID" />
      </section>
    </div>
  </Screen>
</template>

<style scoped>
.pg {
  width: 1000px;
  min-height: 1640px;
  padding: 22px 24px;
  background: var(--ink-1);
}
</style>
