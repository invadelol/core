<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { detectDesktopTarget, type DesktopPlatform } from '../../lib/platform.js'

/**
 * The download, Apple style: one small pill for this computer, a quiet link to the others. On the
 * server, and on computers the app does not run on (phones, Linux), the pill leads to the list.
 */
withDefaults(defineProps<{ big?: boolean; others?: boolean }>(), { big: false, others: true })

const SHORT: Record<DesktopPlatform, string> = {
  'windows': 'Windows',
  'mac-arm': 'macOS',
  'mac-intel': 'macOS',
}

const target = ref<DesktopPlatform | null>(null)
onMounted(async () => (target.value = await detectDesktopTarget()))
</script>

<template>
  <div class="dl">
    <a :href="target ? `/download/${target}` : '#download'" class="ap-pill" :class="{ big }">
      <template v-if="target">Download for {{ SHORT[target] }}</template>
      <template v-else>Download Invade</template>
    </a>
    <a v-if="others" href="#download" class="ap-link">
      Other platforms
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="m6 3.5 4.5 4.5L6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" />
      </svg>
    </a>
  </div>
</template>

<style scoped>
.dl {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 14px 26px;
}
</style>
