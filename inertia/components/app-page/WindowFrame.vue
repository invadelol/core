<script setup lang="ts">
/**
 * A window around a live view on the page: macOS traffic lights and a title, or with `url` a
 * browser's address bar. The content is the slot, at its real size (not scaled), in the app's
 * dark ink. `light` draws the browser in the site's current theme instead.
 */
defineProps<{ title?: string; url?: string; light?: boolean }>()
</script>

<template>
  <div class="wf" :class="[light ? '' : 'iv-dark', { browser: url }]">
    <header class="wf-bar">
      <i class="wf-lights" aria-hidden="true"><b /><b /><b /></i>
      <span v-if="url" class="wf-url">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4.5 7V5.5a3.5 3.5 0 0 1 7 0V7M3.5 7h9v6.5h-9z" />
        </svg>
        {{ url }}
      </span>
      <span v-else-if="title" class="wf-title">{{ title }}</span>
    </header>
    <div class="wf-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.wf {
  --grain: url('../../css/grain.png');
  position: relative;
  overflow: hidden;
  color: var(--text-1);
  background: var(--grain), var(--light), var(--ink-1);
  border-radius: 12px;
  font-variant-numeric: tabular-nums;
}

.wf::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 3;
  border-radius: inherit;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.1),
    inset 0 0 0 1px rgb(255 255 255 / 0.07);
  pointer-events: none;
}

.wf.browser:not(.iv-dark)::after {
  box-shadow: inset 0 0 0 1px var(--line);
}

.wf-bar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 0 16px;
  background: var(--ink-0);
  border-bottom: 1px solid var(--line);
}

.wf-lights {
  position: absolute;
  left: 16px;
  display: flex;
  gap: 8px;
}

.wf-lights b {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ff5f57;
  box-shadow: inset 0 0 0 0.5px rgb(0 0 0 / 0.25);
}

.wf-lights b:nth-child(2) {
  background: #febc2e;
}

.wf-lights b:nth-child(3) {
  background: #28c840;
}

.wf-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}

.wf-url {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: min(360px, 56%);
  height: 28px;
  font-size: 12.5px;
  color: var(--text-2);
  background: var(--surface-2);
  border-radius: 7px;
}

.wf-url svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  opacity: 0.7;
}

@media (max-width: 520px) {
  .wf-url {
    width: auto;
    padding: 0 12px;
    margin-left: 56px;
  }
}

.wf-body {
  position: relative;
}
</style>
