<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { Logo } from '@invadelol/ui'
import Shot from '../app-page/Shot.vue'
</script>

<template>
  <!-- The desktop app in one card: what it is, the window itself, and the way to it. -->
  <section class="dl iv-panel" aria-labelledby="dl-title">
    <div class="dl-grid">
      <div class="copy">
        <Logo :size="22" />
        <h2 id="dl-title" class="mt-4">Invade for desktop</h2>
        <p>
          Live stats over your game, scouting in champ select, and every game scored as it ends.
        </p>
        <div class="actions">
          <Link href="/app" class="iv-btn primary lg">Get the app</Link>
          <span class="label">Free · Windows and macOS</span>
        </div>
      </div>

      <div class="art" aria-hidden="true">
        <div class="window app-window iv-dark">
          <Shot name="home" alt="" sizes="(min-width: 768px) 760px, 600px" />
          <span class="lights"><i /><i /><i /></span>
        </div>
        <div class="overlay">
          <Shot name="ov-perf" alt="" sizes="168px" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Lit as the app's window is: its violet light from the top right, a fainter one at the foot. */
.dl {
  --dl-light: calc(var(--sheet-light) * 3);
  overflow: hidden;
  container-type: inline-size;
  background:
    radial-gradient(
      75% 120% at 100% 0%,
      rgb(var(--brand-rgb) / var(--dl-light)),
      rgb(var(--brand-rgb) / 0) 70%
    ),
    radial-gradient(
      60% 90% at 0% 100%,
      rgb(var(--brand-rgb) / calc(var(--dl-light) * 0.35)),
      rgb(var(--brand-rgb) / 0) 70%
    ),
    var(--sheen), var(--surface-1);
}

.dl-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

.copy {
  position: relative;
  z-index: 1;
  padding: 24px 20px 20px;
}

.copy h2 {
  font-size: 22px;
  font-weight: 650;
  line-height: 26px;
  letter-spacing: -0.012em;
  color: var(--text-1);
}

.copy p {
  max-width: 38ch;
  margin-top: 8px;
  font-size: 13.5px;
  line-height: 20px;
  color: var(--text-2);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
  margin-top: 20px;
}

.art {
  position: relative;
  height: 210px;
}

/* A slice of the app's Home in its window (.app-window), straight, its top-left corner in the card
   and the rest past the edge. */
.window {
  position: absolute;
  top: 4px;
  left: 20px;
  width: 600px;
  mask-image: linear-gradient(180deg, #000 60%, rgb(0 0 0 / 0.35) 100%);
}

/* One in-game overlay, over the window's corner, as it sits over the game. */
.overlay {
  position: absolute;
  right: 12px;
  bottom: 6px;
  width: 132px;
  filter: drop-shadow(0 14px 22px rgb(10 8 40 / 0.4));
}

@container (min-width: 720px) {
  .dl-grid {
    grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
    min-height: 272px;
  }

  .copy {
    align-self: center;
    padding: 36px 8px 36px 36px;
  }

  .art {
    height: auto;
  }

  .window {
    top: 40px;
    left: 56px;
    width: 760px;
  }

  .overlay {
    right: auto;
    bottom: 18px;
    left: 0;
    width: 168px;
  }
}
</style>
