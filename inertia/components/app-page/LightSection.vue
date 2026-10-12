<script setup lang="ts">
import { vReveal } from './reveal.js'

/**
 * What Invade costs the computer, from the app's performance audit (docs/performance-audit.md
 * in the app's repository, 0.2.9 pass of 12 October 2026). Measured numbers only. The chart is
 * the second five-minute idle run of the release build, League closed: CPU per 10 s interval,
 * in percent of one core.
 */
const IDLE = [
  0.035, 0.011, 0.032, 0.014, 0.013, 0.033, 0.019, 0.027, 0.013, 0.015, 0.027, 0.012, 0.023, 0.011,
  0.029, 0.019, 0.014, 0.034, 0.012, 0.024, 0.015, 0.016, 0.031, 0.016, 0.023, 0.021, 0.029, 0.022,
  0.015, 0.026,
]

const W = 600
const H = 180
/** The chart's top: 0.2 % of one core. */
const MAX = 0.2

const pts = IDLE.map((v, i) => [(i / (IDLE.length - 1)) * W, H - (v / MAX) * H] as const)

/** A smooth line through the points (Catmull-Rom as cubic Béziers, tension 0.5). */
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

const STATS = [
  { value: '0.02', unit: '%', text: 'of one CPU core at rest, League closed' },
  { value: '20', unit: 'kB', text: 'per game sent to invade.lol, compressed' },
  { value: 'GPU', unit: '', text: 'recording runs on your graphics card\'s encoder, never on the CPU' },
  { value: '8.8', unit: 'MB', text: 'the app\'s executable, its game data included' },
]
</script>

<template>
  <section id="performance" class="ap-section page">
    <header v-reveal class="ap-head">
      <div>
        <p class="ap-kicker">Light on your PC</p>
        <h2>Built to stay out of your game's way</h2>
      </div>
      <p>
        The work is done in Rust, the overlay only exists while you are in champ select or in game,
        and recording runs on your graphics card. Here is what that costs, measured.
      </p>
    </header>

    <div class="light">
      <figure v-reveal class="chart iv-panel">
        <figcaption>
          <span>CPU at rest, over five minutes</span>
          <b>0.021<small>% of one core on average</small></b>
        </figcaption>
        <div class="plot">
          <span class="guide" style="top: 0"><i>0.2 %</i></span>
          <span class="guide" style="top: 50%"><i>0.1 %</i></span>
          <span class="guide base" style="top: 100%"><i>0</i></span>
          <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="ap-idle-fade" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stop-color="var(--brand)" stop-opacity="0.28" />
                <stop offset="1" stop-color="var(--brand)" stop-opacity="0" />
              </linearGradient>
            </defs>
            <path :d="area" fill="url(#ap-idle-fade)" />
            <path :d="line" class="line" />
          </svg>
        </div>
        <p class="axis"><span>0:00</span><span>2:30</span><span>5:00</span></p>
      </figure>

      <ul class="stats">
        <li v-for="s in STATS" :key="s.text" v-reveal class="iv-panel">
          <b>{{ s.value }}<small v-if="s.unit">{{ s.unit }}</small></b>
          <span>{{ s.text }}</span>
        </li>
      </ul>
    </div>

    <p class="ap-caption">
      Measured on an M3 MacBook Pro with the 0.2.9 release build, League closed (the app's
      performance audit). The CPU line is the app with its window open behind others; in the tray it
      does the same work.
    </p>
  </section>
</template>

<style scoped>
.light {
  display: grid;
  gap: 16px;
}

@media (min-width: 1024px) {
  .light {
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  }
}

.chart {
  display: grid;
  gap: 18px;
  padding: 22px 24px 18px;
}

figcaption {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px 20px;
}

figcaption span {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}

figcaption b {
  font-size: 28px;
  font-stretch: var(--fig);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-1);
  font-variant-numeric: tabular-nums;
}

figcaption small {
  margin-left: 8px;
  font-size: 12.5px;
  font-weight: 500;
  font-stretch: 100%;
  letter-spacing: 0;
  color: var(--text-3);
}

.plot {
  position: relative;
  height: 200px;
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
  vector-effect: non-scaling-stroke;
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
  font-size: 11.5px;
  font-style: normal;
  line-height: 16px;
  color: var(--text-3);
  background: var(--solid-1);
  padding-left: 6px;
}

.axis {
  display: flex;
  justify-content: space-between;
  margin-right: 52px;
  font-size: 11.5px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

.seen .plot svg {
  animation: ap-wipe 1600ms 200ms var(--ease) both;
}

.stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.stats li {
  display: grid;
  align-content: space-between;
  gap: 18px;
  min-height: 150px;
  padding: 20px;
}

.stats b {
  font-size: clamp(32px, 3.4vw, 44px);
  font-stretch: var(--fig);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--text-1);
  font-variant-numeric: tabular-nums;
}

.stats b small {
  margin-left: 3px;
  font-size: 0.5em;
  font-weight: 600;
  letter-spacing: 0;
  color: var(--text-3);
}

.stats span {
  font-size: 13.5px;
  line-height: 1.45;
  color: var(--text-2);
}

@media (max-width: 400px) {
  .stats li {
    min-height: 0;
    padding: 16px;
  }
}
</style>
