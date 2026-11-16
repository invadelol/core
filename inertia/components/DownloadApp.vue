<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Icon from './ui/Icon.vue'
import { detectDesktopTarget, type DesktopPlatform } from '../lib/platform.js'

/**
 * The desktop app's two download buttons: the computer's installer in violet first, the other
 * system beside it. The server and the first paint assume Windows (most players); a Mac swaps
 * them once the page runs, an Intel Mac gets its own installer.
 */
withDefaults(defineProps<{ size?: 'lg' | 'sm'; track?: string }>(), { size: 'lg', track: 'app' })

const target = ref<DesktopPlatform | null | undefined>(undefined)
onMounted(async () => (target.value = await detectDesktopTarget()))
const mac = computed(() => target.value === 'mac-arm' || target.value === 'mac-intel')
const macHref = computed(
  () => `/download/${target.value === 'mac-intel' ? 'mac-intel' : 'mac-arm'}`
)
</script>

<template>
  <span class="row dl-app">
    <template v-if="mac">
      <a :class="['btn', size, 'pri']" :href="macHref" :data-track="`${track}_download_mac`"
        ><Icon name="download" :size="16" />Download for macOS</a
      >
      <a :class="['btn', size]" href="/download/windows" :data-track="`${track}_download_windows`"
        >Windows</a
      >
    </template>
    <template v-else>
      <a
        :class="['btn', size, 'pri']"
        href="/download/windows"
        :data-track="`${track}_download_windows`"
        ><Icon name="download" :size="16" />Download for Windows</a
      >
      <a :class="['btn', size]" :href="macHref" :data-track="`${track}_download_mac`">macOS</a>
    </template>
  </span>
</template>
