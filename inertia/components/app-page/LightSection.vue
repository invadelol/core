<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * What Invade costs the computer, from the app's performance audit (docs/performance-audit.md
 * in the app's repository, 0.2.9 pass of 12 October 2026). Measured numbers only. The chart is
 * the second five-minute idle run of the release build, League closed: CPU per 10 s interval,
 * in percent of one core. It draws itself once, when it comes into view.
 */
const IDLE = [
  0.035, 0.011, 0.032, 0.014, 0.013, 0.033, 0.019, 0.027, 0.013, 0.015, 0.027, 0.012, 0.023, 0.011,
  0.029, 0.019, 0.014, 0.034, 0.012, 0.024, 0.015, 0.016, 0.031, 0.016, 0.023, 0.021, 0.029, 0.022,
  0.015, 0.026,
]

const W = 1000
const H = 200
/** The chart's top: 0.2 % of one core. */
const MAX = 0.2

const pts = IDLE.map((v, i) => [(i / (IDLE.length - 1)) * W, H - (v / MAX) * H] as const)

/** A smooth line through the points (Catmull-Rom as cubic Béziers). */
const line = pts
  .map(([x, y], i) => {
    if (!i) return `M${x.toFixed(1)} ${y.toFixed(1)}`
    const [x0, y0] = pts[Math.max(0, i - 2)]
    const [x1, y1] = pts[i - 1]
    const [x3, y3] = pts[Math.min(pts.length - 1, i + 1)]
    const c1 = [x1 + (x - x0) / 6, y1 + (y - y0) / 6]
    const c2 = [x - (x3 - x1) / 6, y - (y3 - y1) / 6]
    return `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`
  })
  .join('')
const area = `${line}L${W} ${H}L0 ${H}Z`

const FACTS = [
  {
    value: '0',
    text: 'overlay windows between games. It opens with champ select and closes after the game.',
  },
  { value: '20 kB', text: 'per game sent to invade.lol, compressed.' },
  { value: 'GPU', text: "Recording runs on your graphics card's encoder, never on the CPU." },
  { value: '8.8 MB', text: "The app's executable, its game data included." },
]

const fig = ref<HTMLElement>()
const drawn = ref(false)
let io: IntersectionObserver | undefined
onMounted(() => {
  if (!fig.value || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    drawn.value = true
    return
  }
  io = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return
      drawn.value = true
      io?.disconnect()
    },
    { rootMargin: '0px 0px -20% 0px' }
  )
  io.observe(fig.value)
})
onBeforeUnmount(() => io?.disconnect())
</script>

<template>
  <section id="performance" class="light page">
    <div class="light-head">
      <p class="kicker">Light on your PC</p>
      <h2>At rest, Invade uses 0.021% of one core.</h2>
      <p class="light-lead">
        The work is done in Rust. The overlay only exists while you are in champ select or in game,
        and recording runs on your graphics card. Measured, not estimated.
      </p>
    </div>

    <figure ref="fig" class="chart" :class="{ drawn }">
      <div class="plot">
        <span class="guide" style="top: 0"><i>0.2%</i></span>
        <span class="guide" style="top: 50%"><i>0.1%</i></span>
        <span class="guide base" style="top: 100%"><i>0</i></span>
        <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="ap-idle-fade" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stop-color="var(--brand)" stop-opacity="0.22" />
              <stop offset="1" stop-color="var(--brand)" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path :d="area" class="area" fill="url(#ap-idle-fade)" />
          <path :d="line" class="line" pathLength="1" />
        </svg>
      </div>
      <figcaption>
        <span>CPU over five minutes, window behind others, League closed</span>
        <span class="axis"><span>0:00</span><span>2:30</span><span>5:00</span></span>
      </figcaption>
    </figure>

    <ul class="facts">
      <li v-for="f in FACTS" :key="f.value">
        <b>{{ f.value }}</b>
        <span>{{ f.text }}</span>
      </li>
    </ul>

    <p class="note">
      Measured on an M3 MacBook Pro with the 0.2.9 release build (the app's performance audit). In
      the tray the app does the same work as with its window behind others.
    </p>
  </section>
</template>

<style scoped>
.light {
  padding-top: clamp(96px, 12vw, 168px);
}

.light-head {
  display: grid;
  gap: 18px 64px;
  align-items: end;
}

@media (min-width: 1024px) {
  .light-head {
    grid-template-columns: minmax(0, 1fr) minmax(0, 30em);
  }

  .light-head .kicker {
    grid-column: 1 / -1;
  }
}

.kicker {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-3);
}

h2 {
  max-width: 14em;
  font-size: clamp(30px, 2.6vw, 40px);
  font-weight: 640;
  line-height: 1.06;
  letter-spacing: -0.035em;
  color: var(--text-1);
  text-wrap: balance;
}

.light-lead {
  font-size: 15.5px;
  line-height: 1.6;
  color: var(--text-2);
  text-wrap: pretty;
}

.chart {
  margin-top: clamp(40px, 5vw, 64px);
}

.plot {
  position: relative;
  height: clamp(160px, 18vw, 240px);
  margin-right: 52px;
}

.plot svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.line {
  fill: none;
  stroke: var(--brand);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  transition: stroke-dashoffset 1800ms cubic-bezier(0.65, 0, 0.35, 1);
}

.area {
  opacity: 0;
  transition: opacity 900ms 900ms ease;
}

.drawn .line {
  stroke-dashoffset: 0;
}

.drawn .area {
  opacity: 1;
}

.guide {
  position: absolute;
  left: 0;
  right: -52px;
  height: 0;
  border-top: 1px dashed var(--line-2);
}

.guide.base {
  border-top-style: solid;
}

.guide i {
  position: absolute;
  right: 0;
  top: -8px;
  padding-left: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-style: normal;
  line-height: 16px;
  color: var(--text-3);
  background: var(--ink-1);
}

figcaption {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px 24px;
  margin-top: 12px;
  margin-right: 52px;
  font-size: 12.5px;
  color: var(--text-3);
}

.axis {
  display: flex;
  justify-content: space-between;
  min-width: min(100%, 420px);
  font-family: var(--font-mono);
  font-size: 11px;
}

.facts {
  display: grid;
  gap: 28px 32px;
  margin-top: clamp(48px, 6vw, 80px);
}

@media (min-width: 720px) {
  .facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1100px) {
  .facts {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.facts li {
  display: grid;
  align-content: start;
  gap: 10px;
  padding-top: 18px;
  border-top: 1px solid var(--line-2);
}

.facts b {
  font-family: var(--font-mono);
  font-size: 22px;
  font-weight: 500;
  letter-spacing: -0.02em;
  color: var(--text-1);
}

.facts span {
  font-size: 14px;
  line-height: 1.55;
  color: var(--text-2);
}

.note {
  margin-top: 32px;
  font-size: 12.5px;
  color: var(--text-3);
}

@media (prefers-reduced-motion: reduce) {
  .line,
  .area {
    transition: none;
  }
}
</style>
