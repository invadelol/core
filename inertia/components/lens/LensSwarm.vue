<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import { champIcon, championName } from '../../lib/assets.js'
import { PACE_RATING, type LensGame } from '../../lib/lens.js'

/**
 * Every game of the window as its champion, placed by its Invade score on one 0–100 line and
 * stacked where games collide, so the swing is something you see: a tight cluster is a steady
 * player, a long spread a swinging one. Your average is the violet line, a band one swing wide
 * around it.
 */
const props = defineProps<{ games: LensGame[]; average: number | null; swing: number | null }>()

const box = useTemplateRef<HTMLElement>('box')
const width = ref(640)
let resize: ResizeObserver | undefined
onMounted(() => {
  resize = new ResizeObserver(([entry]) => (width.value = entry.contentRect.width || width.value))
  if (box.value) resize.observe(box.value)
})
onBeforeUnmount(() => resize?.disconnect())

const SIZE = computed(() => (width.value < 420 ? 22 : 28))

/** Greedy beeswarm: each game takes the row nearest the axis where it touches no other. */
const placed = computed(() => {
  const size = SIZE.value
  const gap = size + 2
  const scored = props.games
    .map((g, i) => ({ g, i }))
    .filter((x): x is { g: LensGame & { score: number }; i: number } => x.g.score !== null)
    .sort((a, b) => a.g.score - b.g.score)
  const rows: number[][] = []
  const out = scored.map(({ g, i }) => {
    const x = (g.score / 100) * width.value
    let level = 0
    for (let k = 0; ; k++) {
      const candidate = k === 0 ? 0 : k % 2 ? (k + 1) / 2 : -k / 2
      const row = rows[k] ?? (rows[k] = [])
      if (row.every((other) => Math.abs(other - x) >= gap)) {
        row.push(x)
        level = candidate
        break
      }
    }
    return { g, x, level, order: i }
  })
  const levels = out.map((p) => p.level)
  const top = Math.max(0, ...levels)
  const bottom = Math.min(0, ...levels)
  return {
    items: out,
    height: (top - bottom + 1) * gap + 8,
    centre: top * gap + gap / 2 + 4,
    gap,
  }
})

const at = (score: number) => `${score}%`
</script>

<template>
  <div class="lv-swarm">
    <div
      ref="box"
      class="lv-swarm-field"
      :style="{ 'height': `${placed.height}px`, '--size': `${SIZE}px` }"
      role="img"
      :aria-label="`The Invade score of each of the last ${games.length} games`"
    >
      <i
        v-if="average !== null && swing !== null"
        class="lv-swarm-band"
        :style="{
          left: at(Math.max(0, average - swing)),
          width: at(Math.min(100, average + swing) - Math.max(0, average - swing)),
        }"
      />
      <i class="lv-swarm-pace" :style="{ left: at(PACE_RATING) }" />
      <i v-if="average !== null" class="lv-swarm-mean" :style="{ left: at(average) }" />
      <img
        v-for="p in placed.items"
        :key="p.g.matchId"
        class="lv-swarm-game"
        :src="champIcon(p.g.championId)"
        :alt="`${championName(p.g.championId)}, ${p.g.score}`"
        :title="`${championName(p.g.championId)} · ${p.g.win ? 'Win' : 'Loss'} · ${p.g.score}`"
        :style="{
          left: `${p.x}px`,
          top: `${placed.centre - p.level * placed.gap}px`,
          animationDelay: `${150 + p.order * 35}ms`,
        }"
      />
    </div>
    <div class="lv-swarm-axis num">
      <span style="left: 0">0</span>
      <span :style="{ left: at(PACE_RATING) }">Emerald pace</span>
      <span v-if="average !== null" class="mean" :style="{ left: at(average) }"
        >Your average {{ Math.round(average) }}</span
      >
      <span style="left: 100%">100</span>
    </div>
  </div>
</template>

<style scoped>
.lv-swarm-field {
  position: relative;
  margin: 0 calc(var(--size) / 2);
}

.lv-swarm-band {
  position: absolute;
  inset-block: 0;
  border-radius: var(--r-md);
  background: rgb(var(--brand-rgb) / 0.08);
  animation: lv-fade 900ms 300ms var(--ease-glide) both;
}

.lv-swarm-pace,
.lv-swarm-mean {
  position: absolute;
  inset-block: -6px;
  width: 0;
}

.lv-swarm-pace {
  border-left: 1px dashed var(--text-3);
}

.lv-swarm-mean {
  border-left: 1.5px solid var(--brand);
}

.lv-swarm-game {
  position: absolute;
  width: var(--size);
  height: var(--size);
  margin: calc(var(--size) / -2) 0 0 calc(var(--size) / -2);
  border-radius: 50%;
  box-shadow:
    0 0 0 1.5px var(--solid-1),
    var(--contact);
  object-fit: cover;
  animation: lv-pop 700ms var(--ease-glide) both;
}

@keyframes lv-pop {
  from {
    opacity: 0;
    transform: scale(0.4);
  }
}

@keyframes lv-fade {
  from {
    opacity: 0;
  }
}

.lv-swarm-axis {
  position: relative;
  height: 38px;
  margin: 10px calc(var(--size, 28px) / 2) 0;
  border-top: 1px solid var(--line-2);
  font-size: 11px;
  color: var(--text-4);
}

.lv-swarm-axis span {
  position: absolute;
  top: 5px;
  white-space: nowrap;
  transform: translateX(-50%);
}

.lv-swarm-axis span:first-child {
  transform: none;
}

.lv-swarm-axis span:last-child {
  transform: translateX(-100%);
}

.lv-swarm-axis .mean {
  top: 20px;
  font-weight: 600;
  color: var(--brand-hi);
}

@media (prefers-reduced-motion: reduce) {
  .lv-swarm-band,
  .lv-swarm-game {
    animation: none;
  }
}
</style>
