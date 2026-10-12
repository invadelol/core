<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Download } from 'lucide-vue-next'
import { DESKTOP_TARGETS, detectDesktopTarget, type DesktopPlatform } from '../../lib/platform.js'

/**
 * The hero's download: the installer for this computer as the one primary button, the other
 * builds as quiet links beside it. Before the browser is inspected (server render) and on
 * computers the app does not run on (phones, Linux), the button leads to the download section.
 */
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
  <div class="cta">
    <a v-if="target" :href="`/download/${target}`" class="iv-btn primary cta-main">
      <Download :size="16" :stroke-width="2" />Download for {{ SHORT[target] }}
    </a>
    <a v-else href="#download" class="iv-btn primary cta-main">
      <Download :size="16" :stroke-width="2" />Download Invade
    </a>
    <p class="cta-others" :class="{ shown: checked }">
      <template v-if="target">
        Also for
        <template v-for="(other, i) in others" :key="other.id">
          <a :href="`/download/${other.id}`">{{ other.label }}</a
          ><template v-if="i < others.length - 1">, </template>
        </template>
      </template>
      <template v-else>For Windows and macOS computers</template>
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

.cta-main {
  height: 44px;
  padding: 0 20px 0 18px;
  gap: 9px;
  font-size: 14.5px;
  border-radius: 8px;
}

.cta-others {
  min-height: 20px;
  font-size: 13px;
  color: var(--text-3);
  opacity: 0;
  transition: opacity 240ms var(--ease);
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
