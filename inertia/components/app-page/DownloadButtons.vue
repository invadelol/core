<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Download } from 'lucide-vue-next'
import { detectDesktopTarget, type DesktopPlatform } from '../../lib/platform.js'

/**
 * The download, as the site's buttons: the primary one for this computer, a secondary one to the
 * other builds. On the server, and on computers the app does not run on (phones, Linux), the
 * primary leads to the list.
 */
withDefaults(defineProps<{ others?: boolean }>(), { others: true })

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
    <a :href="target ? `/download/${target}` : '#download'" class="iv-btn primary lg">
      <Download :size="14" aria-hidden="true" />
      <template v-if="target">Download for {{ SHORT[target] }}</template>
      <template v-else>Download Invade</template>
    </a>
    <a v-if="others" href="#download" class="iv-btn lg">Other platforms</a>
  </div>
</template>

<style scoped>
.dl {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
</style>
