<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { DESKTOP_TARGETS, detectDesktopTarget, type DesktopPlatform } from '../../lib/platform.js'

/**
 * The download: the installer for this computer as one solid button, the other builds as quiet
 * links under it. Before the browser is inspected (server render) and on computers the app does
 * not run on (phones, Linux), the button leads to the download section.
 */
withDefaults(defineProps<{ align?: 'start' | 'center' }>(), { align: 'center' })

const target = ref<DesktopPlatform | null>(null)
const checked = ref(false)

onMounted(async () => {
  target.value = await detectDesktopTarget()
  checked.value = true
})

const SHORT: Record<DesktopPlatform, string> = {
  'windows': 'Windows',
  'mac-arm': 'macOS',
  'mac-intel': 'macOS (Intel)',
}

const others = computed(() => DESKTOP_TARGETS.filter((t) => t.id !== target.value))
</script>

<template>
  <div class="cta" :class="align">
    <a :href="target ? `/download/${target}` : '#download'" class="cta-main">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 2.5v8m0 0L4.5 7M8 10.5 11.5 7M3 13.5h10" />
      </svg>
      <template v-if="target">Download for {{ SHORT[target] }}</template>
      <template v-else>Download Invade</template>
    </a>
    <p class="cta-others" :class="{ shown: checked }">
      <template v-if="target">
        Free, no account. Also for
        <template v-for="(other, i) in others" :key="other.id">
          <a :href="`/download/${other.id}`">{{ other.label }}</a
          ><template v-if="i < others.length - 1">, </template>
        </template>
      </template>
      <template v-else>Free, for Windows and macOS computers</template>
    </p>
  </div>
</template>

<style scoped>
.cta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.cta.start {
  align-items: flex-start;
}

/* One solid button in the text colour: clear on any background, no glow. */
.cta-main {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  height: 44px;
  padding: 0 20px 0 16px;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--ink-0);
  background: var(--text-1);
  border-radius: 9px;
  box-shadow:
    inset 0 -1px 0 rgb(0 0 0 / 0.12),
    0 1px 2px rgb(0 0 0 / 0.3);
  transition:
    transform 160ms cubic-bezier(0.16, 1, 0.3, 1),
    background-color 160ms;
}

.cta-main:hover {
  background: #fff;
}

.cta-main:active {
  transform: scale(0.98);
}

.cta-main:focus-visible {
  outline: none;
  box-shadow: var(--focus);
}

.cta-main svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

:global([data-theme='light']) .cta-main {
  color: #fff;
  background: #14151c;
}

:global([data-theme='light']) .cta-main:hover {
  background: #000;
}

@media (prefers-color-scheme: light) {
  :global([data-theme='system']) .cta-main {
    color: #fff;
    background: #14151c;
  }
}

.cta-others {
  min-height: 20px;
  font-size: 13px;
  color: var(--text-3);
  opacity: 0;
  transition: opacity 240ms ease;
}

.cta-others.shown {
  opacity: 1;
}

.cta-others a {
  color: var(--text-2);
  text-decoration: underline;
  text-decoration-color: var(--line-3);
  text-underline-offset: 3px;
  transition: color var(--t-fast);
}

.cta-others a:hover {
  color: var(--text-1);
}
</style>
