<script setup lang="ts">
import { ref } from 'vue'
import { Logo } from '@invadelol/ui'
import AppWindow from './AppWindow.vue'
import DownloadButtons from './DownloadButtons.vue'
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
  <section class="hero ap-lit">
    <div v-reveal class="hero-copy ap-wrap">
      <Logo :size="36" class="hero-glyph ln" />
      <h1 class="ap-display ln">Invade</h1>
      <p class="hero-line ln">The desktop companion for League of Legends.</p>
      <DownloadButtons class="hero-dl ln" />
      <p class="hero-meta label ln">
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

.hero-stage {
  margin-top: clamp(40px, 4.4vw, 64px);
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
    opacity 1400ms var(--ease-glide),
    filter 1400ms var(--ease-glide);
  transition-delay: 380ms;
}

.hero-copy .ln:nth-child(1) {
  --d: 0ms;
}
</style>
