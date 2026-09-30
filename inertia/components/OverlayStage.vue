<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import ObjectiveTimers from './ObjectiveTimers.vue'

/**
 * The overlay's widgets, as the desktop app draws them, placed where they sit over a game.
 * Behind them, Riot's minimap of Summoner's Rift, zoomed on mid lane and out of focus, stands in
 * for the game. The stage stays dark in both themes because the widgets are made for a dark game.
 *
 * Widgets keep the size they have on a 1440 px wide screen, scaled with the stage (`--k`).
 */
const widgets = [
  {
    id: 'gold',
    w: 249,
    h: 174,
    alt: 'Win probability, team gold lead, fight power and enemy respawn timers',
  },
  {
    id: 'stats',
    w: 219,
    h: 237,
    alt: 'Your KDA, CS, gold, kill participation and vision per minute',
  },
  {
    id: 'tips',
    w: 293,
    h: 115,
    alt: 'Tips that react to the game: an objective window, an item to counter healing',
  },
  {
    id: 'next',
    w: 249,
    h: 119,
    alt: 'The next item of the recommended build and the gold it still needs',
  },
] as const

const stage = ref<HTMLElement>()
const k = ref(1)
const shown = ref(false)
/** Game clock, in seconds from the moment the scene starts. */
const clock = ref(0)

let timer: ReturnType<typeof setInterval> | undefined
let resize: ResizeObserver | undefined
let seen: IntersectionObserver | undefined

function tick() {
  // Dragon spawns at 64 s; hold "UP" for a moment, then play it again.
  clock.value = clock.value >= 72 ? 0 : clock.value + 1
}

onMounted(() => {
  const el = stage.value!
  resize = new ResizeObserver(([entry]) => {
    const width = entry.contentRect.width
    // Narrow screens drop two widgets and give the others more room.
    k.value = width < 640 ? width / 520 : width / 1440
  })
  resize.observe(el)

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches
  seen = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) shown.value = true
      clearInterval(timer)
      timer = entry.isIntersecting && !still ? setInterval(tick, 1000) : undefined
    },
    { threshold: 0.25 }
  )
  seen.observe(el)
})

onBeforeUnmount(() => {
  clearInterval(timer)
  resize?.disconnect()
  seen?.disconnect()
})
</script>

<template>
  <div ref="stage" class="stage" :class="{ shown }" :style="{ '--k': k }">
    <div class="scene" aria-hidden="true">
      <img
        :src="`/landing/rift-blur.webp`"
        alt=""
        width="1600"
        height="1000"
        loading="lazy"
        decoding="async"
      />
      <img
        :src="`/landing/rift-sharp.webp`"
        alt=""
        width="1600"
        height="1000"
        loading="lazy"
        decoding="async"
        class="focus"
      />
    </div>
    <div class="grain" aria-hidden="true" />
    <div class="vignette" aria-hidden="true" />

    <div class="hud">
      <div class="w top-center" style="--d: 0ms">
        <ObjectiveTimers :t="clock" />
      </div>
      <img
        v-for="(w, i) in widgets"
        :key="w.id"
        :src="`/landing/ov-${w.id}.webp`"
        :alt="w.alt"
        :width="w.w"
        :height="w.h"
        :style="{ '--w': `${w.w}px`, '--d': `${(i + 1) * 90}ms` }"
        loading="lazy"
        decoding="async"
        class="w"
        :class="w.id"
      />
      <img
        :src="`/landing/rift-mini.webp`"
        alt=""
        width="160"
        height="160"
        loading="lazy"
        decoding="async"
        class="minimap"
        aria-hidden="true"
      />
    </div>
  </div>
</template>

<style scoped>
.stage {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: #07080a;
  container-type: inline-size;
  clip-path: polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 0 100%);
}

/* The game: the map seen by a camera tilted towards it, out of focus. */
.scene {
  position: absolute;
  inset: -12% -8%;
  perspective: 900px;
}
.scene img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: rotateX(24deg) scale(1.18);
  transform-origin: 50% 70%;
}
/* A band in focus across the middle, like a camera looking at the lane. */
.scene .focus {
  mask-image: linear-gradient(to bottom, transparent 30%, #000 50%, #000 62%, transparent 82%);
}
.grain {
  position: absolute;
  inset: 0;
  opacity: 0.16;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
.vignette {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 70% 60% at 50% 48%, transparent 40%, rgb(4 5 7 / 0.7) 100%),
    linear-gradient(
      to bottom,
      rgb(4 5 7 / 0.35),
      transparent 22%,
      transparent 78%,
      rgb(4 5 7 / 0.45)
    );
}

.hud {
  position: absolute;
  inset: 0;
}

/* Every widget keeps its real size relative to a 1440 px wide screen. */
.w {
  position: absolute;
  transform-origin: 0 0;
  opacity: 0;
  translate: 0 8px;
  transition:
    opacity 500ms var(--ease) var(--d),
    translate 500ms var(--ease) var(--d);
}
img.w {
  width: calc(var(--w) * var(--k));
  height: auto;
}
.shown .w {
  opacity: 1;
  translate: 0 0;
}
.top-center {
  top: calc(12px * var(--k));
  left: 50%;
  transform: translateX(-50%) scale(var(--k));
  transform-origin: 50% 0;
}
.shown .top-center {
  translate: 0 0;
}
.gold {
  top: calc(88px * var(--k));
  left: calc(14px * var(--k));
}
.stats {
  top: calc(360px * var(--k));
  left: calc(14px * var(--k));
}
.tips {
  top: calc(88px * var(--k));
  right: calc(18px * var(--k));
}
.next {
  right: calc(214px * var(--k));
  bottom: calc(20px * var(--k));
}
.minimap {
  position: absolute;
  right: calc(18px * var(--k));
  bottom: calc(18px * var(--k));
  width: calc(180px * var(--k));
  height: calc(180px * var(--k));
  border: 1px solid rgb(255 255 255 / 0.14);
  box-shadow: 0 2px 10px rgb(0 0 0 / 0.5);
  filter: saturate(0.8) brightness(0.85);
}

/* Phones: a taller scene, and only what reads at that size. */
@container (max-width: 639px) {
  .stats,
  .tips {
    display: none;
  }
}
@media (max-width: 639px) {
  .stage {
    aspect-ratio: 4 / 5;
  }
  .gold {
    top: calc(100px * var(--k));
  }
  .next {
    right: auto;
    left: calc(14px * var(--k));
    bottom: calc(18px * var(--k));
  }
  .minimap {
    width: calc(150px * var(--k));
    height: calc(150px * var(--k));
  }
}

@media (prefers-reduced-motion: no-preference) {
  @supports (animation-timeline: view()) {
    /* The camera drifts a little as the scene scrolls past. */
    .scene img {
      animation: drift linear both;
      animation-timeline: view();
    }
  }
}
@keyframes drift {
  from {
    transform: rotateX(24deg) scale(1.18) translate3d(-2.5%, 3%, 0);
  }
  to {
    transform: rotateX(24deg) scale(1.18) translate3d(2.5%, -3%, 0);
  }
}
</style>
