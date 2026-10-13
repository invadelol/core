<script setup lang="ts">
import { computed } from 'vue'
import { champIcon, championName } from '../../lib/assets.js'

/**
 * Your part of your team's fights: two rings around your champion, the outer one your share of
 * the team's kills, the inner one your share of its damage, the Emerald pace a tick on the outer.
 * The arcs sweep in when they first show.
 */
const props = defineProps<{
  champion: number | null
  /** Percent, 0–100. */
  kills: number | null
  damage: number | null
  /** Percent: the Emerald kill participation of the role. */
  pace: number | null
  opponents: { kills: number | null; damage: number | null }
}>()

const OUTER = 82
const INNER = 62
const arc = (r: number, pct: number | null) => {
  const c = 2 * Math.PI * r
  return `${(c * Math.max(0, Math.min(100, pct ?? 0))) / 100} ${c}`
}
const tick = computed(() => {
  if (props.pace === null) return null
  const a = ((props.pace / 100) * 360 - 90) * (Math.PI / 180)
  return {
    x1: (OUTER - 10) * Math.cos(a),
    y1: (OUTER - 10) * Math.sin(a),
    x2: (OUTER + 10) * Math.cos(a),
    y2: (OUTER + 10) * Math.sin(a),
  }
})
const round = (v: number | null) => (v === null ? '–' : `${Math.round(v)}%`)
</script>

<template>
  <div class="lv-share">
    <svg viewBox="-100 -100 200 200" class="lv-share-rings" aria-hidden="true">
      <circle :r="OUTER" class="track" />
      <circle :r="INNER" class="track" />
      <g transform="rotate(-90)">
        <circle :r="OUTER" class="arc outer" :stroke-dasharray="arc(OUTER, kills)" />
        <circle :r="INNER" class="arc inner" :stroke-dasharray="arc(INNER, damage)" />
      </g>
      <line v-if="tick" class="pace" v-bind="tick" />
      <clipPath id="lv-share-face"><circle r="40" /></clipPath>
      <image
        v-if="champion"
        :href="champIcon(champion)"
        x="-40"
        y="-40"
        width="80"
        height="80"
        clip-path="url(#lv-share-face)"
        preserveAspectRatio="xMidYMid slice"
      />
      <circle r="40" class="rim" />
    </svg>
    <dl class="lv-share-legend">
      <div>
        <dt><i class="outer" />Kills</dt>
        <dd class="num">{{ round(kills) }}</dd>
        <p class="num">
          of your team's<template v-if="opponents.kills !== null">
            · opponents {{ round(opponents.kills) }}</template
          >
        </p>
      </div>
      <div>
        <dt><i class="inner" />Damage</dt>
        <dd class="num">{{ round(damage) }}</dd>
        <p class="num">
          of your team's<template v-if="opponents.damage !== null">
            · opponents {{ round(opponents.damage) }}</template
          >
        </p>
      </div>
    </dl>
    <span v-if="champion" class="sr-only">{{ championName(champion) }}</span>
  </div>
</template>

<style scoped>
.lv-share {
  display: flex;
  align-items: center;
  gap: 24px;
}

.lv-share-rings {
  flex: none;
  width: 168px;
  height: 168px;
  overflow: visible;
}

.track {
  fill: none;
  stroke: var(--track);
  stroke-width: 12;
}

.arc {
  fill: none;
  stroke-width: 12;
  stroke-linecap: round;
  animation: lv-sweep 1300ms 200ms var(--ease-glide) both;
}

.arc.outer {
  stroke: var(--brand);
}

.arc.inner {
  stroke: color-mix(in oklab, var(--brand) 55%, var(--text-3));
  animation-delay: 380ms;
}

@keyframes lv-sweep {
  from {
    stroke-dasharray: 0 600;
  }
}

.pace {
  stroke: var(--text-1);
  stroke-width: 1.5;
  stroke-dasharray: 2 2;
}

.rim {
  fill: none;
  stroke: var(--line-3);
  stroke-width: 1.5;
}

.lv-share-legend {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.lv-share-legend dt {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-3);
}

.lv-share-legend dt i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.lv-share-legend dt i.outer {
  background: var(--brand);
}

.lv-share-legend dt i.inner {
  background: color-mix(in oklab, var(--brand) 55%, var(--text-3));
}

.lv-share-legend dd {
  font-size: 26px;
  font-weight: 700;
  font-stretch: var(--fig);
  line-height: 1.1;
  letter-spacing: -0.01em;
  color: var(--text-1);
}

.lv-share-legend p {
  font-size: 12px;
  color: var(--text-3);
}

@media (max-width: 26rem) {
  .lv-share {
    gap: 16px;
  }

  .lv-share-rings {
    width: 132px;
    height: 132px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .arc {
    animation: none;
  }
}
</style>
