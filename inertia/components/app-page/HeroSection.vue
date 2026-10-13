<script setup lang="ts">
import { ref } from 'vue'
import { Logo } from '@invadelol/ui'
import AppWindow from './AppWindow.vue'
import DownloadPill from './DownloadPill.vue'
import { ease, prefersReduced, useScrollFx, vReveal } from './motion'

/**
 * The name, one line, the download, then Home in its window. The window settles as the page
 * scrolls: from 86% to full size, rising a little, its shadow deepening under it.
 */
defineProps<{ version: string | null }>()

const stage = ref<HTMLElement>()
const frame = ref<HTMLElement>()
useScrollFx(stage, (box, vh) => {
  const el = frame.value
  if (!el) return
  const p = prefersReduced() ? 1 : ease((vh - box.top) / (vh * 1.05))
  el.style.transform = `translate3d(0, ${(1 - p) * 40}px, 0) scale(${0.86 + 0.14 * p})`
})
</script>

<template>
  <section class="hero">
    <div v-reveal class="hero-copy ap-wrap">
      <Logo :size="36" class="hero-glyph ln" />
      <h1 class="ln">Invade</h1>
      <p class="hero-line ln">The desktop companion for League of Legends.</p>
      <DownloadPill class="hero-dl ln" />
      <p class="hero-meta ln">
        Free<template v-if="version"> · Version {{ version }}</template> · Windows and macOS
      </p>
    </div>

    <div ref="stage" v-reveal class="hero-stage ap-wrap">
      <div ref="frame" class="hero-frame pic">
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
  padding-top: clamp(40px, 4.6vw, 64px);
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

h1 {
  font-size: clamp(64px, 6.6vw, 96px);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.045em;
}

.hero-line {
  margin-top: 14px;
  font-size: clamp(21px, 2vw, 28px);
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--ap-grey);
  text-wrap: balance;
}

.hero-dl {
  margin-top: 28px;
}

.hero-meta {
  margin-top: 16px;
  font-size: 14px;
  color: var(--text-3);
}

.hero-stage {
  margin-top: clamp(36px, 3.6vw, 52px);
}

.hero-frame {
  max-width: var(--ap-wide);
  margin-inline: auto;
  transform-origin: 50% 0;
  will-change: transform;
}

/* The settling scale is on the frame; the reveal only fades and sharpens it. */
.rv .hero-frame.pic {
  transform: none;
  transition:
    opacity 1400ms var(--ap-ease),
    filter 1400ms var(--ap-ease);
  transition-delay: 380ms;
}

.hero-copy .ln:nth-child(1) {
  --d: 0ms;
}
</style>
