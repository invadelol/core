<script setup lang="ts">
import { assetUrl } from '../../lib/assets.js'
import { figureText } from '../../lib/lens.js'

/** Vision in the game's own pieces: the wards placed, the control wards bought, the wards cleared. */
defineProps<{
  items: Array<{
    key: string
    /** The item the figure is about (Stealth Ward, Control Ward, Oracle Lens). */
    item: number
    label: string
    you: number | null
    opponents: number | null
  }>
}>()
</script>

<template>
  <ul class="lv-wards">
    <li v-for="(w, i) in items" :key="w.key" :style="{ animationDelay: `${150 + i * 110}ms` }">
      <img :src="assetUrl('item', w.item)" alt="" width="40" height="40" loading="lazy" />
      <span class="lv-wards-value num">{{ w.you === null ? '–' : figureText(w.you, 1) }}</span>
      <span class="lv-wards-label">{{ w.label }}</span>
      <span v-if="w.opponents !== null" class="lv-wards-opp num">
        Opponents {{ figureText(w.opponents, 1) }}
      </span>
    </li>
  </ul>
</template>

<style scoped>
.lv-wards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.lv-wards li {
  display: grid;
  justify-items: start;
  gap: 2px;
  min-width: 0;
  padding: 14px;
  border-radius: var(--r-md);
  background: var(--well);
  box-shadow: var(--inset-shadow);
  animation: lv-rise 800ms var(--ease-glide) both;
}

@keyframes lv-rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}

.lv-wards img {
  width: 40px;
  height: 40px;
  margin-bottom: 10px;
  border-radius: var(--r-sm);
  box-shadow: var(--portrait-sm);
}

.lv-wards-value {
  font-size: 24px;
  font-weight: 700;
  font-stretch: var(--fig);
  line-height: 1.1;
  color: var(--text-1);
}

.lv-wards-label {
  font-size: 12px;
  color: var(--text-2);
}

.lv-wards-opp {
  margin-top: 4px;
  font-size: 11.5px;
  color: var(--text-3);
}

@media (max-width: 26rem) {
  .lv-wards {
    gap: 8px;
  }

  .lv-wards li {
    padding: 10px;
  }

  .lv-wards-value {
    font-size: 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lv-wards li {
    animation: none;
  }
}
</style>
