<script setup lang="ts">
import { ref } from 'vue'
import { Link } from '@inertiajs/vue3'
import { Logo } from '@invadelol/ui'
import AppWindow from './AppWindow.vue'
import DownloadButtons from './DownloadButtons.vue'
import PhoneActions from './PhoneActions.vue'
import { ease, prefersReduced, useScrollFx } from './motion'

/**
 * The name, one line, the download, then Home in its window. The window settles as the page
 * scrolls: from 86% to full size, rising a little, its shadow deepening under it.
 * Everything here is on screen from the first paint, with no observer to wait for: the lines rise
 * a little into place and the window fades in sharp (CSS, so before the page even runs). The
 * window starts at its smallest, and eases to where the scroll puts it once the page runs.
 */
defineProps<{ version: string | null }>()

const stage = ref<HTMLElement>()
const frame = ref<HTMLElement>()
let placed = false
useScrollFx(stage, (box, vh) => {
  const el = frame.value
  if (!el) return
  const reduced = prefersReduced()
  const p = reduced ? 1 : ease((vh - box.top) / (vh * 1.05))
  if (!placed) {
    placed = true
    if (!reduced) {
      el.style.transition = 'transform 1100ms var(--ease-glide)'
      setTimeout(() => (el.style.transition = ''), 1100)
    }
  }
  el.style.transform = `translate3d(0, ${(1 - p) * 40}px, 0) scale(${0.86 + 0.14 * p})`
})
</script>

<template>
  <section class="hero ap-lit">
    <div class="hero-copy ap-wrap">
      <Logo :size="36" class="hero-glyph" />
      <h1 class="ap-display">Invade</h1>
      <p class="hero-line">The desktop companion for League of Legends.</p>
      <DownloadButtons class="hero-dl on-pc" />
      <PhoneActions class="hero-dl on-phone" />
      <p class="hero-meta label on-pc">
        Free<template v-if="version">
          · <Link href="/app/changelog" class="hero-version">Version {{ version }}</Link></template
        >
        · Windows and macOS
      </p>
      <p class="hero-meta label on-phone">Invade runs on Windows and macOS.</p>
    </div>

    <div ref="stage" class="hero-stage ap-wrap">
      <div ref="frame" class="hero-frame">
        <AppWindow
          name="home"
          alt="Invade’s Home: rank and LP, the last games with their scores, clips, favorites, champions and performance against a target rank"
          eager
          :crop="[0.155, 0.105, 0.31, 0.55]"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero {
  padding-top: clamp(48px, 5.6vw, 80px);
}

.hero-copy {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.hero-glyph {
  margin-bottom: 18px;
  color: var(--brand);
}

.hero-line {
  max-width: 24em;
  margin-top: 14px;
  font-size: var(--ap-h3);
  font-weight: 500;
  line-height: 1.25;
  letter-spacing: -0.012em;
  color: var(--text-2);
  text-wrap: balance;
}

.hero-dl {
  margin-top: 28px;
}

.hero-meta {
  margin-top: 14px;
}

.hero-version {
  color: inherit;
  transition: color var(--t-fast) var(--ease);
}

.hero-version:hover {
  color: var(--text-1);
}

.hero-stage {
  margin-top: clamp(40px, 4.4vw, 64px);
}

.hero-frame {
  max-width: var(--ap-wide);
  margin-inline: auto;
  transform-origin: 50% 0;
  will-change: transform;
}

/* The entrance, from the first paint: the lines rise a little in turn, the window fades in sharp. */
@media (prefers-reduced-motion: no-preference) {
  .hero-copy > * {
    animation: hero-rise 900ms var(--ease-glide) backwards;
  }

  .hero-copy > :nth-child(2) {
    animation-delay: 50ms;
  }

  .hero-copy > :nth-child(3) {
    animation-delay: 100ms;
  }

  .hero-copy > :nth-child(n + 4) {
    animation-delay: 150ms;
  }

  .hero-stage {
    animation: hero-settle 1200ms var(--ease-glide) 120ms backwards;
  }

  /* Where the scroll starts the window, until the page runs and places it. */
  .hero-frame {
    transform: translate3d(0, 40px, 0) scale(0.86);
  }
}

@keyframes hero-rise {
  from {
    opacity: 0.6;
    transform: translate3d(0, 12px, 0);
  }
}

@keyframes hero-settle {
  from {
    opacity: 0;
    filter: blur(8px);
  }
}
</style>
